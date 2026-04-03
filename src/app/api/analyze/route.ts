import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const { uploadId, language = 'English' } = await request.json();

    if (!uploadId) {
      return NextResponse.json({ error: 'Upload ID is required' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Gemini API key is not configured' }, { status: 500 });
    }

    const supabase = await createClient();

    // Get the user to determine their declared country
    const { data: { user } } = await supabase.auth.getUser();
    const userCountry = user?.user_metadata?.country || 'United States';

    // Get the upload record
    const { data: upload, error: uploadError } = await supabase
      .from('uploads')
      .select('*')
      .eq('id', uploadId)
      .single();

    if (uploadError || !upload) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
    }

    // Update status to analyzing
    await supabase
      .from('uploads')
      .update({ status: 'analyzing' })
      .eq('id', uploadId);

    let result;
    try {
      const fileUrls = upload.file_url.split(',');

      // 1. Fetch the data from the Supabase public URL for all uploads
      const imageParts = await Promise.all(fileUrls.map(async (fileUrl: string) => {
        const imageResp = await fetch(fileUrl);
        if (!imageResp.ok) {
           throw new Error('Failed to fetch file from storage');
        }
        const arrayBuffer = await imageResp.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString('base64');
        
        let mimeType = imageResp.headers.get('content-type') || '';
        
        // Fallback MIME type detection based on file extension
        if (!mimeType || mimeType.startsWith('application/')) {
          try {
            const urlObj = new URL(fileUrl);
            const pathname = urlObj.pathname.toLowerCase();
            if (pathname.endsWith('.mp3')) mimeType = 'audio/mp3';
            else if (pathname.endsWith('.wav')) mimeType = 'audio/wav';
            else if (pathname.endsWith('.m4a')) mimeType = 'audio/x-m4a';
            else if (pathname.endsWith('.ogg')) mimeType = 'audio/ogg';
            else if (pathname.endsWith('.png')) mimeType = 'image/png';
            else if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) mimeType = 'image/jpeg';
            else if (pathname.endsWith('.webp')) mimeType = 'image/webp';
            else mimeType = 'audio/ogg'; // Default fallback for unknown audio or binary
          } catch {
            mimeType = 'image/png';
          }
        }
        return {
          inlineData: {
            data: base64Data,
            mimeType
          }
        };
      }));

      // 2. Initialize the Gemini Vision model
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      // 3. Define the prompt
      const prompt = `Analyze this chat evidence (screenshot or voice recording) for a women's protection application.
          
          CRITICAL INSTRUCTIONS:
          0. LANGUAGE REQUIREMENT: You MUST generate the ENTIRE analysis, summary, descriptions, and all JSON string values strictly in the following language: ${language}.
          1. COMMUNICATION STYLE: Write all responses in plain, simple, and highly empathetic language. Avoid overly clinical, technical, or confusing psychological jargon. Explain concepts clearly and gently, as if speaking to a friend in need of support. Keep sentences short and accessible.
          2. CONTEXT AWARENESS: Carefully evaluate the context, especially the recipient's responses. Distinguish between mutual banter/jokes and actual manipulative, coercive, or threatening behavior. Do not flag obvious mutual joking as critical abuse.
          3. BEHAVIORAL ANALYSIS: Look for signs of gaslighting, emotional blackmail, isolation tactics, DARVO, or physical threats, but explain them simply.
          4. LEGAL ANALYSIS: Perform a preliminary legal analysis identifying any potential laws or legal frameworks that may have been violated, specifically keeping in mind the jurisdiction and laws of ${userCountry}. Include a disclaimer that this is not official legal advice.
          
          Please format your response EXACTLY as a JSON object matching this schema without markdown code blocks:
          {
            "risk_level": "safe" | "low" | "medium" | "high" | "critical",
            "summary": "A plain, easy-to-understand, and empathetic overview of the conversation and findings",
            "flags": [
              {
                "category": "String (e.g., Direct Threats, Gaslighting, Mutual Banter)",
                "description": "String describing what was found in simple, supportive language",
                "severity": "safe" | "low" | "medium" | "high" | "critical",
                "evidence": "String quoting the specific text from the image or audio transcription"
              }
            ],
            "details": {
              "tone_analysis": "String analyzing the power dynamic and tone in simple, non-clinical language",
              "manipulation_indicators": ["Array of short, easy-to-understand strings"],
              "threat_indicators": ["Array of short, easy-to-understand strings"],
              "recommendations": ["Array of strings with actionable, supportive, and practical advice"],
              "confidence_score": "Number between 0 and 100",
              "legal_analysis": {
                "summary": "String explaining the legal context simply",
                "potential_violations": ["Array of strings naming potential legal issues"],
                "disclaimer": "This AI-generated analysis is for informational purposes only and does not constitute professional legal advice. Please consult with a qualified attorney."
              }
            }
          }`;

      // 4. Generate content
      const aiResponse = await model.generateContent([prompt, ...imageParts]);
      const text = aiResponse.response.text();
      
      // 5. Parse the JSON safely, handling potential markdown wrappers
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      result = JSON.parse(cleanText);

    } catch (aiError: any) {
      console.error('Gemini Analysis Failed:', aiError?.message || aiError);
      // Fallback on error so app doesn't break
      await supabase.from('uploads').update({ status: 'completed' }).eq('id', uploadId);
      return NextResponse.json({ error: 'AI Analysis failed to process file' }, { status: 500 });
    }

    // Store analysis result in DB
    const { data: analysisResult, error: analysisError } = await supabase
      .from('analysis_results')
      .insert({
        upload_id: uploadId,
        risk_level: result.risk_level,
        summary: result.summary,
        flags: result.flags,
        details: result.details,
      })
      .select()
      .single();

    if (analysisError) {
      throw analysisError;
    }

    // Update upload status
    const finalStatus =
      result.risk_level === 'high' || result.risk_level === 'critical'
        ? 'flagged'
        : 'completed';

    await supabase
      .from('uploads')
      .update({ status: finalStatus })
      .eq('id', uploadId);

    return NextResponse.json({ success: true, analysis: analysisResult });
  } catch (error: unknown) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { error: 'Failed to process uploads' },
      { status: 500 }
    );
  }
}
