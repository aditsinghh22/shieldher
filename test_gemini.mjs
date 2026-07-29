
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY");
    process.exit(1);
  }

  console.log('Testing Gemini connection and prompt...');
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `Analyze this chat screenshot for a women's protection application.
                CRITICAL INSTRUCTIONS:
                1. CONTEXT AWARENESS: Distinguish between mutual banter/jokes and actual manipulative, coercive, or threatening behavior.
                2. BEHAVIORAL ANALYSIS: Look for signs of gaslighting, emotional blackmail, isolation tactics.
                3. LEGAL ANALYSIS: Perform a preliminary legal analysis identifying potential laws violated. You MUST include a disclaimer.
                
                Please format your response EXACTLY as a JSON object matching this schema without markdown code blocks:
                {
                  "risk_level": "safe" | "low" | "medium" | "high" | "critical",
                  "summary": "overview",
                  "flags": [],
                  "details": {
                    "legal_analysis": {
                      "summary": "string",
                      "potential_violations": ["string"],
                      "disclaimer": "string"
                    }
                  }
                }`;

    // Try to find a local image to test with
    const possiblePaths = [
      './public/language-icon.png',
      './public/logo.png',
      '/home/hades/.gemini/antigravity/brain/f63dd2bb-da24-4aea-b22f-007d02bb9e40/chat_screenshot_1773224494404.png'
    ];
    
    let filePath = '';
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        filePath = p;
        break;
      }
    }

    if (!filePath) {
      console.error("No test image found in public/ or hardcoded path.");
      return;
    }

    console.log(`Testing with file: ${filePath}`);
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');
    
    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: filePath.endsWith('.png') ? 'image/png' : 'image/jpeg'
      },
    };

    const aiResponse = await model.generateContent([prompt, imagePart]);
    const text = aiResponse.response.text();
    console.log("Raw Gemini Output:\n", text);
    
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    console.log("\nParsed JSON:\n", JSON.parse(cleanText));
    
  } catch (error) {
    console.error('API Error:', error);
  }
}
run();
