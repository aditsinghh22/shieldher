import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';
import { writeFile, unlink, mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import crypto from 'node:crypto';
import { decryptBuffer, encryptData } from '@/lib/crypto-server';
import { analyzeMediaAuthenticity, type MediaAuthenticityInput } from '@/lib/mediaAuthenticity';
import geminiContentDetector from '@/lib/geminiAuthDetector.server';
import {
  type AnalysisFlag,
  type MediaAuthenticityResult,
  type RiskLevel,
} from '@/lib/types';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const REQUESTED_MODEL_CANDIDATES = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-3-flash'];

type GeminiModelListResponse = {
  models?: Array<{
    name?: string;
    supportedGenerationMethods?: string[];
  }>;
};

type GeneratedAnalysisResult = {
  risk_level: RiskLevel;
  summary: string;
  flags: AnalysisFlag[];
  details: {
    tone_analysis?: string;
    manipulation_indicators?: string[];
    threat_indicators?: string[];
    recommendations?: string[];
    confidence_score?: number;
    media_authenticity?: MediaAuthenticityResult;
    legal_analysis?: {
      summary: string;
      potential_violations?: string[];
      kanoon_search_keywords?: string;
      disclaimer?: string;
      powered_by_kanoon?: boolean;
    };
    rpa_filing_data?: {
      platform?: string;
      platform_url_or_id?: string | null;
      incident_category?: string;
      suspect_info?: {
        name?: string;
        identifier_type?: string;
        identifier_value?: string | null;
      };
    };
  };
};

type UploadRecord = {
  id: string;
  file_url: string;
  file_name: string;
  file_iv?: string | null;
  original_type?: string | null;
};

type KanoonSearchResponse = {
  docs?: Array<{
    title?: string;
    headline?: string;
  }>;
};

type AnalysisDbPayload = {
  upload_id: string;
  risk_level: RiskLevel;
  summary: string;
  flags: AnalysisFlag[];
  details: GeneratedAnalysisResult['details'];
  encrypted_summary?: string;
  encrypted_flags?: string;
  encrypted_details?: string;
  encryption_iv?: string;
};

// --- GEMINI HELPERS ---

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorStatusCode(error: unknown): number | null {
  if (error && typeof error === 'object') {
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number') return status;
  }
  const message = error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message)
      : '';
  const match = message.match(/\[(\d{3})\s/);
  if (match) return Number(match[1]);
  return null;
}

function parseModelJson(rawText: string) {
  const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleanText);
  } catch {
    const start = cleanText.indexOf('{');
    const end = cleanText.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleanText.slice(start, end + 1));
    }
    throw new Error('Invalid JSON response from Gemini');
  }
}

function normalizeModelName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getMimeTypeFallback(fileUrl: string) {
  try {
    const pathname = new URL(fileUrl).pathname.toLowerCase();
    if (pathname.endsWith('.mp3') || pathname.endsWith('.mp3.enc')) return 'audio/mp3';
    if (pathname.endsWith('.wav') || pathname.endsWith('.wav.enc')) return 'audio/wav';
    if (pathname.endsWith('.m4a') || pathname.endsWith('.m4a.enc')) return 'audio/x-m4a';
    if (pathname.endsWith('.aac') || pathname.endsWith('.aac.enc')) return 'audio/aac';
    if (pathname.endsWith('.ogg') || pathname.endsWith('.ogg.enc')) return 'audio/ogg';
    if (pathname.endsWith('.mp4') || pathname.endsWith('.mp4.enc')) return 'video/mp4';
    if (pathname.endsWith('.mov') || pathname.endsWith('.mov.enc')) return 'video/quicktime';
    if (pathname.endsWith('.webm') || pathname.endsWith('.webm.enc')) return 'video/webm';
    if (pathname.endsWith('.mkv') || pathname.endsWith('.mkv.enc')) return 'video/x-matroska';
    if (pathname.endsWith('.png') || pathname.endsWith('.png.enc')) return 'image/png';
    if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg') || pathname.endsWith('.jpg.enc') || pathname.endsWith('.jpeg.enc')) return 'image/jpeg';
    if (pathname.endsWith('.webp') || pathname.endsWith('.webp.enc')) return 'image/webp';
    if (pathname.endsWith('.pdf') || pathname.endsWith('.pdf.enc')) return 'application/pdf';
    if (pathname.endsWith('.txt') || pathname.endsWith('.txt.enc')) return 'text/plain';
    if (pathname.endsWith('.md') || pathname.endsWith('.md.enc')) return 'text/markdown';
    if (pathname.endsWith('.doc') || pathname.endsWith('.doc.enc')) return 'application/msword';
    if (pathname.endsWith('.docx') || pathname.endsWith('.docx.enc')) {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
  } catch {
    return 'application/octet-stream';
  }
  return 'application/octet-stream';
}

function getOriginalFileName(fileUrl: string, uploadFileName: string, index: number, total: number) {
  if (total === 1 && uploadFileName && !uploadFileName.includes('items uploaded together')) {
    return uploadFileName;
  }

  try {
    const pathname = decodeURIComponent(new URL(fileUrl).pathname);
    const rawName = pathname.split('/').pop() || `Evidence asset ${index + 1}`;
    return rawName.replace(/\.enc$/i, '').replace(/^\d+-/, '');
  } catch {
    return `Evidence asset ${index + 1}`;
  }
}

async function resolveGeminiModelCandidates(apiKey: string) {
  try {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      cache: 'no-store',
    });
    if (!resp.ok) return REQUESTED_MODEL_CANDIDATES;
    const payload = (await resp.json()) as GeminiModelListResponse;
    const availableNames = (payload.models || [])
      .filter((model) => Array.isArray(model.supportedGenerationMethods))
      .filter((model) => model.supportedGenerationMethods?.includes('generateContent'))
      .map((model) => String(model.name || '').replace(/^models\//, ''))
      .filter(Boolean);
    if (availableNames.length === 0) return REQUESTED_MODEL_CANDIDATES;
    const resolved: string[] = [];
    for (const requested of REQUESTED_MODEL_CANDIDATES) {
      const requestedNorm = normalizeModelName(requested);
      const exact = availableNames.find((item) => normalizeModelName(item) === requestedNorm);
      const fuzzy = availableNames.find((item) => normalizeModelName(item).includes(requestedNorm));
      resolved.push(exact || fuzzy || requested);
    }
    return Array.from(new Set(resolved));
  } catch {
    return REQUESTED_MODEL_CANDIDATES;
  }
}

// --- MAIN ROUTE ---

export async function POST(request: NextRequest) {
  let supabase: Awaited<ReturnType<typeof createClient>> | undefined;
  let uploadId: string | undefined;

  try {
    const body = (await request.json()) as {
      uploadId?: string;
      language?: string;
      masterKey?: string;
    };
    uploadId = body.uploadId;
    const language = body.language || 'English';
    const masterKey = body.masterKey;

    if (!uploadId) {
      return NextResponse.json({ error: 'Upload ID is required' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Gemini API key is not configured' }, { status: 500 });
    }

    supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userCountry = user?.user_metadata?.country || 'India';

    // Get the upload record
    const { data: upload, error: uploadError } = await supabase
      .from('uploads')
      .select('*')
      .eq('id', uploadId)
      .single();

    if (uploadError || !upload) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
    }
    const uploadRecord = upload as UploadRecord;

    // Update status to analyzing
    await supabase.from('uploads').update({ status: 'analyzing' }).eq('id', uploadId);

    let result: GeneratedAnalysisResult | null = null;
    const tempFiles: string[] = [];
    
    try {
      const fileUrls = uploadRecord.file_url.split(',');
      const fileIVs = (uploadRecord.file_iv || '').split(',');
      const fileTypes = (uploadRecord.original_type || '').split(',');
      const stagedAuthenticityFiles: MediaAuthenticityInput[] = [];

      // 1. Fetch, decrypt, and stage media
      let hasVideo = false;

      const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

      const imageParts = await Promise.all(fileUrls.map(async (fileUrl: string, index: number) => {
        const imageResp = await fetch(fileUrl);
        if (!imageResp.ok) throw new Error('Failed to fetch file from storage');
        
        const arrayBuffer = await imageResp.arrayBuffer();
        let buffer: Buffer<ArrayBufferLike> = Buffer.from(arrayBuffer);
        
        // Decrypt if encrypted and key is provided
        if (masterKey && fileIVs[index]) {
          try {
            buffer = decryptBuffer(buffer, masterKey, fileIVs[index]);
          } catch (e) {
            console.error('Decryption failed for file index', index, e);
          }
        }
        
        let mimeType = fileTypes[index] || imageResp.headers.get('content-type') || '';
        // Fallback MIME type detection based on file extension
        if (!mimeType || mimeType.startsWith('application/')) {
          mimeType = getMimeTypeFallback(fileUrl);
        }

        stagedAuthenticityFiles.push({
          fileName: getOriginalFileName(fileUrl, uploadRecord.file_name, index, fileUrls.length),
          mimeType,
          buffer,
        });
        
        const shouldUseFileManager =
          mimeType.startsWith('video/') ||
          mimeType.startsWith('audio/') ||
          mimeType === 'application/pdf' ||
          mimeType === 'application/msword' ||
          mimeType.includes('wordprocessingml');

        if (shouldUseFileManager) {
          if (mimeType.startsWith('video/')) hasVideo = true;
          // E2EE Video Pipeline
          const tempDir = await mkdtemp(join(tmpdir(), 'shieldher-'));
          const ext = getOriginalFileName(fileUrl, uploadRecord.file_name, index, fileUrls.length).split('.').pop() || mimeType.split('/')[1] || 'bin';
          const tempPath = join(tempDir, `evidence_${index}.${ext}`);
          
          await writeFile(tempPath, buffer);
          tempFiles.push(tempPath);
          
          const uploadResult = await fileManager.uploadFile(tempPath, { mimeType });
          let geminiFile = uploadResult.file;
          
          while (geminiFile.state === FileState.PROCESSING) {
            await sleep(2500);
            geminiFile = await fileManager.getFile(geminiFile.name);
          }
          if (geminiFile.state === FileState.FAILED) {
            throw new Error('Google AI failed to process an evidence asset');
          }
          
          return { fileData: { fileUri: geminiFile.uri, mimeType: geminiFile.mimeType } };
        } else {
          // Standard base64 proxy pipeline for audio/images
          const base64Data = buffer.toString('base64');
          return { inlineData: { data: base64Data, mimeType } };
        }
      }));

      // 2. Define the unified prompt
      const prompt = `Analyze this evidence for a women's protection application. ${hasVideo ? '(Ensure you review the visual scenes, dialogue, and body language in the attached video clip).' : ''}
          
          CRITICAL INSTRUCTIONS:
          0. LANGUAGE: Generate the ENTIRE analysis in strictly: ${language}.
          1. TRANSLATION & SLANG: The evidence might contain text in Hindi, Hinglish (Hindi written in English alphabet), or local slang. Translate and understand it internally before scoring. Threats like "dekh lunga" (I will see you), "pic viral kar dunga" (I will make your picture viral) are serious threats.
          2. STYLE: Use plain, simple, and HIGHLY EMPATHETIC language. Explain gently, like speaking to a friend.
          3. CONTEXT: Evaluate the thread for power dynamics. Distinguish mutual banter from actual abuse, coercion, blackmail, or stalking.
          4. LEGAL ANALYSIS: Identify potential violations specifically for the jurisdiction of ${userCountry}. Provide clear search keywords for legal precedents.
          5. RPA DATA: Extract suspect identifiers (usernames, phone numbers), platform, and incident category for legal filing.
          
          Format EXACTLY as a JSON object:
          {
            "risk_level": "safe" | "low" | "medium" | "high" | "critical",
            "summary": "Empathetic overview",
            "flags": [
              {
                "category": "String",
                "description": "Simple explanation",
                "severity": "safe" | "low" | "medium" | "high" | "critical",
                "evidence": "Quoted text/transcription"
              }
            ],
            "details": {
              "tone_analysis": "Dynamic explanation",
              "manipulation_indicators": ["String"],
              "threat_indicators": ["String"],
              "recommendations": ["Supportive advice"],
              "confidence_score": 0-100,
              "legal_analysis": {
                "summary": "Simple context",
                "potential_violations": ["Legal issues"],
                "kanoon_search_keywords": "Concise search query (e.g. 'cyber stalking ipc 354d') for Indian Kanoon",
                "disclaimer": "Informational only disclaimer"
              },
              "rpa_filing_data": {
                "platform": "WhatsApp/Instagram/etc",
                "platform_url_or_id": "profile handle or identifier",
                "incident_category": "harassment/stalking/etc",
                "suspect_info": { "name": "string", "identifier_type": "string", "identifier_value": "string" }
              }
            }
          }`;

      const modelCandidates = await resolveGeminiModelCandidates(process.env.GEMINI_API_KEY);
      let analysisDone = false;
      let lastError: unknown = null;

      for (const modelName of modelCandidates) {
        const model = genAI.getGenerativeModel({ model: modelName });
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const aiResponse = await model.generateContent([prompt, ...imageParts]);
            result = parseModelJson(aiResponse.response.text()) as GeneratedAnalysisResult;
            analysisDone = true;
            break;
          } catch (e) {
            lastError = e;
            const status = getErrorStatusCode(e);
            if (status === 403 || status === 404) break;
            if (attempt < 2) await sleep(1000 * attempt);
          }
        }
        if (analysisDone) break;
      }

      if (!analysisDone || !result) throw lastError || new Error('AI analysis failed');

      result.details = result.details || {};
      try {
        result.details.media_authenticity = await analyzeMediaAuthenticity(stagedAuthenticityFiles, [geminiContentDetector]);
      } catch (authenticityError) {
        console.error('[MediaAuthenticity] Ensemble failed:', authenticityError);
        result.details.media_authenticity = {
          provider: 'ShieldHer Open Detector Ensemble',
          status: 'unavailable',
          label: 'Unavailable',
          summary: 'AI media authenticity detection could not be completed for this upload.',
          analyzed_count: stagedAuthenticityFiles.length,
          supported_count: 0,
          items: [],
        };
      }

      // --- 3. INDIAN KANOON INTEGRATION ---
      if (process.env.KANOON_API_TOKEN && result.details?.legal_analysis?.kanoon_search_keywords && userCountry.toLowerCase() === 'india') {
        try {
          const kQuery = result.details.legal_analysis.kanoon_search_keywords;
          const kRes = await fetch('https://api.indiankanoon.org/search/', {
            method: 'POST',
            headers: {
              'Authorization': `Token ${process.env.KANOON_API_TOKEN}`,
              'Accept': 'application/json',
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'ShieldHer-Legal-Bot'
            },
            body: new URLSearchParams({ formInput: kQuery, pagenum: '0' }).toString()
          });

          if (kRes.ok) {
            const kData = (await kRes.json()) as KanoonSearchResponse;
            const topDocs = (kData.docs || []).slice(0, 3).map((d) =>
              `- Title: ${(d.title || '').replace(/<[^>]+>/g, '')}\n  Snippet: ${(d.headline || '').replace(/<[^>]+>/g, '')}`
            ).join('\n\n');

            if (topDocs) {
              const synthesisPrompt = `You are an expert Indian Cyber-Lawyer. Synthesize this legal analysis with the following real Indian Kanoon results for a high-priority evidence analysis.
              
              Original Analysis Summary: ${result.details.legal_analysis.summary}
              
              Actual Legal Documents Found on Indian Kanoon:
              ${topDocs}
              
              Task: Draft a formal "Preliminary Legal Memorandum" in Markdown. 
              
              STRICT FORMAT REQUIREMENT:
              # Preliminary Legal Analysis
              ## Deep Legal Profile powered by Indian Kanoon API
              
              # PRELIMINARY LEGAL MEMORANDUM
              **DATE:** ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              **TO:** Concerned Party
              **FROM:** ShieldHer AI Protection Bureau
              **SUBJECT:** Preliminary Legal Assessment Regarding Online Abuse
              
              ---
              
              ### I. EXECUTIVE SUMMARY
              [Brief high-level summary]
              
              ### II. CASE FACTS
              [Summarize what happened based on the evidence]
              
              ### III. APPLICABLE LAWS & STATUTES
              [Detailed discussion of Sections like 354D, 66E, 67, etc. Quote the laws where helpful]
              
              ### IV. ANALYSIS & APPLICATION OF PRECEDENT
              [Apply the specific case results from Kanoon to this situation]
              
              ### V. PRELIMINARY RECOMMENDATIONS
              [Immediate legal and safety steps]
              
              ### VI. DISCLAIMER
              *This AI-generated analysis is for informational purposes only and does not constitute professional legal advice. Please consult with a qualified attorney.*
              
              CRITICAL: Translate the ENTIRE memo (including headers) into strictly: ${language}. Use professional legal terminology appropriate for ${language}.`;
              
              let synthesisDone = false;
              for (const sModelName of modelCandidates) {
                const sModel = genAI.getGenerativeModel({ model: sModelName });
                for (let sAttempt = 1; sAttempt <= 2; sAttempt++) {
                  try {
                    const memoResp = await sModel.generateContent(synthesisPrompt);
                    result.details.legal_analysis.summary = memoResp.response.text();
                    result.details.legal_analysis.powered_by_kanoon = true;
                    synthesisDone = true;
                    break;
                  } catch (sErr) {
                    const sStatus = getErrorStatusCode(sErr);
                    if (sStatus === 403 || sStatus === 404) break; 
                    if (sAttempt < 2) await sleep(1000 * sAttempt);
                  }
                }
                if (synthesisDone) break;
              }
            }
          }
        } catch (kErr) { console.error('Kanoon integration failed:', kErr); }
      }

    } catch (aiError: unknown) {
      console.error('Final Analysis Failure:', aiError instanceof Error ? aiError.message : aiError);
      await supabase.from('uploads').update({ status: 'pending' }).eq('id', uploadId);
      return NextResponse.json({ error: 'AI analysis failed. Please try again later.' }, { status: 500 });
    } finally {
      // Securely wipe ephemeral decrypted files
      for (const tempPath of tempFiles) {
        try {
          await unlink(tempPath);
          console.log(`[E2EE] Cleaned up ephemeral temporary trace: ${tempPath}`);
        } catch (cleanupErr) {
          console.error(`[E2EE] Failed to clean up temp file: ${tempPath}`, cleanupErr);
        }
      }
    }

    // --- 4. ENCRYPT AND STORE RESULTS ---
    if (!result) {
      return NextResponse.json({ error: 'AI analysis failed. Please try again later.' }, { status: 500 });
    }

    let dbPayload: AnalysisDbPayload = {
      upload_id: uploadId,
      risk_level: result.risk_level,
      summary: result.summary,
      flags: result.flags,
      details: result.details,
    };

    if (masterKey) {
      console.log(`[E2EE] Encrypting analysis results for upload ${uploadId} using shared IV.`);
      const sharedIv = crypto.randomBytes(12);
      const encryptedSummary = encryptData(result.summary, masterKey, sharedIv);
      const encryptedFlags = encryptData(result.flags, masterKey, sharedIv);
      const encryptedDetails = encryptData(result.details, masterKey, sharedIv);

      dbPayload = {
        ...dbPayload,
        summary: '[encrypted]',
        flags: [],
        details: {},
        encrypted_summary: encryptedSummary.ciphertext,
        encrypted_flags: encryptedFlags.ciphertext,
        encrypted_details: encryptedDetails.ciphertext,
        encryption_iv: sharedIv.toString('base64'),
      };
      console.log(`[E2EE] Encryption complete. IV: ${sharedIv.toString('base64')}`);
    }

    const { data: analysisResult, error: analysisError } = await supabase
      .from('analysis_results')
      .insert(dbPayload)
      .select()
      .single();

    if (analysisError) throw analysisError;

    const finalStatus = (result.risk_level === 'high' || result.risk_level === 'critical') ? 'flagged' : 'completed';
    await supabase.from('uploads').update({ status: finalStatus }).eq('id', uploadId);

    // Return the UNENCRYPTED result to the frontend for immediate viewing
    return NextResponse.json({ 
      success: true, 
      analysis: {
        id: analysisResult.id,
        upload_id: uploadId,
        risk_level: result.risk_level,
        summary: result.summary,
        flags: result.flags,
        details: result.details
      } 
    });

  } catch (error: unknown) {
    console.error('API Route Error:', error);
    if (supabase && uploadId) await supabase.from('uploads').update({ status: 'pending' }).eq('id', uploadId);
    return NextResponse.json({ error: 'Failed to process uploads' }, { status: 500 });
  }
}
