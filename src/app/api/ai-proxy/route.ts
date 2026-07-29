import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Ephemeral AI Proxy Route
 * 
 * ZERO ADMIN ACCESS: This route receives a plaintext image from the browser,
 * sends it to Gemini for analysis, and returns the result. It NEVER saves
 * anything to the database or storage. The image exists only in server RAM
 * during the Gemini API call.
 */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Gemini API key is not configured' }, { status: 500 });
    }

    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Read the images from the request body (multipart form data)
    const formData = await request.formData();
    const imageFiles = formData.getAll('image') as File[];

    if (imageFiles.length === 0) {
      return NextResponse.json({ error: 'At least one image file is required' }, { status: 400 });
    }

    // Convert all images to base64 for Gemini
    const imageParts = await Promise.all(
      imageFiles.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        return {
          inlineData: {
            data: Buffer.from(arrayBuffer).toString('base64'),
            mimeType: file.type || 'image/png',
          },
        };
      })
    );

    // Initialize the Gemini Vision model
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Define the analysis prompt with RPA filing data extraction
    const prompt = `Analyze these chat screenshots together as a single continuous conversation thread for a women's protection application.
          
          CRITICAL INSTRUCTIONS:
          1. CONTEXT AWARENESS: Evaluate the entire multi-image conversation. Carefully distinguish between mutual banter/jokes and actual manipulative, coercive, or threatening behavior. Do not flag obvious mutual joking as critical abuse.
          2. BEHAVIORAL ANALYSIS: Look for signs of gaslighting, emotional blackmail, isolation tactics, DARVO, or physical threats across all provided evidence.
          3. LEGAL ANALYSIS: Perform a preliminary legal analysis identifying potential laws or legal frameworks violated (e.g., cyber harassment, stalking, terroristic threats). Include a disclaimer that this is not official legal advice.
          4. RPA FILING DATA EXTRACTION: Extract actionable data needed to file a cyber-crime complaint based on the collective context of all screenshots. Identify the platform used, suspect identifiers (usernames, phone numbers, email), approximate date, and incident category.
          
          Please format your response EXACTLY as a JSON object matching this schema without markdown code blocks:
          {
            "risk_level": "safe" | "low" | "medium" | "high" | "critical",
            "summary": "A concise overview of the conversation and findings across all images",
            "flags": [
              {
                "category": "String",
                "description": "String describing what was found",
                "severity": "safe" | "low" | "medium" | "high" | "critical",
                "evidence": "String quoting specific text from the screenshots"
              }
            ],
            "details": {
              "tone_analysis": "String analyzing the power dynamic and tone",
              "manipulation_indicators": ["Array of strings"],
              "threat_indicators": ["Array of strings"],
              "recommendations": ["Array of strings"],
              "confidence_score": "Number between 0 and 100",
              "legal_analysis": {
                "summary": "String",
                "potential_violations": ["Array of strings"],
                "kanoon_search_keywords": "A concise search query (e.g. 'cyber stalking section 354d ipc' or 'online harassment') to find relevant precedents on Indian Kanoon. Use max 4-5 core keywords. Leave empty string if not applicable.",
                "disclaimer": "This AI-generated analysis is for informational purposes only and does not constitute professional legal advice. Please consult with a qualified attorney."
              },
              "rpa_filing_data": {
                "platform": "WhatsApp, Instagram, Facebook, Telegram, Twitter, Snapchat, or Other.",
                "platform_url_or_id": "Suspect's profile URL, username, or handle. null if not found.",
                "incident_category": "online_harassment, sexual_content, financial_fraud, stalking, impersonation, threats, other",
                "approximate_date": "Date in YYYY-MM-DD format if mentioned. null if not determinable.",
                "suspect_info": {
                  "name": "Suspect's display name or real name. 'Unknown' if not identifiable.",
                  "identifier_type": "mobile, email, social_media_id, username, or none",
                  "identifier_value": "The actual phone number, email, handle, or username. null if none found.",
                  "description": "Brief description of suspect's behavior pattern."
                }
              }
            }
          }`;

    // Generate content — the images are only in RAM during this call
    const aiResponse = await model.generateContent([prompt, ...imageParts]);
    const text = aiResponse.response.text();

    // Parse the JSON safely
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanText);

    // --- INDIAN KANOON INTEGRATION ---
    if (process.env.KANOON_API_TOKEN && result.details?.legal_analysis?.kanoon_search_keywords) {
      try {
        const query = result.details.legal_analysis.kanoon_search_keywords;
        const kRes = await fetch('https://api.indiankanoon.org/search/', {
          method: 'POST',
          headers: {
            'Authorization': `Token ${process.env.KANOON_API_TOKEN}`,
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          body: new URLSearchParams({ formInput: query }).toString()
        });

        if (kRes.ok) {
          const kData = await kRes.json();
          // Extract top 4 results
          const topDocs = (kData.docs || []).slice(0, 4).map((d: any) => 
            `- Title: ${d.title.replace(/<[^>]+>/g, '')}\n  Snippet: ${d.headline.replace(/<[^>]+>/g, '')}\n  Type: ${d.docsource}`
          ).join('\n\n');

          if (topDocs) {
            const synthesisPrompt = `You are an expert Indian Cyber-Lawyer. 
Below is an initial assessment of an online abuse case, followed by actual legal precedents and statutes fetched fresh from the Indian Kanoon legal database.

Initial Assessment:
${result.details.legal_analysis.summary}
Violations: ${result.details.legal_analysis.potential_violations.join(', ')}

Indian Kanoon Database Search Results for "${query}":
${topDocs}

Task: Draft a formal, court-ready Preliminary Legal Memo in Markdown format. 
The memo must:
1. Be professional, empathetic to the victim, and clearly structured.
2. Heavily cite the specific Indian Kanoon results provided above to explain how those precise statutes or precedents apply to the victim's situation.
3. Be formatted beautifully using markdown headers (e.g., ## Case Facts, ## Applicable Laws, ## Case Precedents, ## Recommendations).
4. Conclude with the explicit disclaimer: "*This AI-generated analysis is for informational purposes only and does not constitute professional legal advice. Please consult with a qualified attorney.*"

Do not summarize the search results dryly; weave them into a powerful legal analysis document.`;

            // Second Gemini call to synthesize the Kanoon data
            const memoResponse = await model.generateContent(synthesisPrompt);
            result.details.legal_analysis.summary = memoResponse.response.text();
            result.details.legal_analysis.powered_by_kanoon = true;
          }
        } else {
          const errText = await kRes.text();
          console.error(`Kanoon API returned ${kRes.status}: ${errText}`);
        }
      } catch (kanoonErr) {
        console.error('Kanoon sub-pipeline failed:', kanoonErr);
        // We catch errors so the pipeline gracefully falls back to the original Gemini analysis
      }
    }

    // Return the AI result directly to the browser — NOTHING is saved to DB/storage
    return NextResponse.json({ success: true, analysis: result });

  } catch (error: any) {
    console.error('AI Proxy Error:', error);

    // Check if it's a 429 Too Many Requests error
    if (error?.status === 429 || error?.message?.includes('429')) {
      return NextResponse.json(
        { error: 'AI analysis failed: Rate limit exceeded (Too Many Requests). Please wait a moment and try again.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: 'AI analysis failed. Please try again.' },
      { status: 500 }
    );
  }
}