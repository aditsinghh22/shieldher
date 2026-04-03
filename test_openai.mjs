async function run() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("Missing OPENAI_API_KEY");
    process.exit(1);
  }

  console.log("Testing OpenAI connection and prompt...");
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this chat screenshot for a women\'s protection application.

                CRITICAL INSTRUCTIONS:
                1. CONTEXT AWARENESS: Distinguish between mutual banter/jokes and actual manipulative, coercive, or threatening behavior.
                2. BEHAVIORAL ANALYSIS: Look for signs of gaslighting, emotional blackmail, isolation tactics.
                3. LEGAL ANALYSIS: Perform a preliminary legal analysis identifying potential laws violated (e.g., cyber harassment). You MUST include a disclaimer.

                Please format your response EXACTLY as a JSON object matching this schema:
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
                }`,
              },
              {
                type: "image_url",
                image_url: {
                  url: "https://i.ibb.co/L5hYhH1/abusive-text.png",
                },
              },
            ],
          },
        ],
        max_tokens: 1500,
        response_format: { type: "json_object" },
      }),
    });

    const data = await response.json();
    if (data.error) {
      console.error("OpenAI Error:", JSON.stringify(data.error, null, 2));
    } else {
      console.log(
        JSON.stringify(JSON.parse(data.choices[0].message.content), null, 2),
      );
    }
  } catch (error) {
    console.error("API Error:", error);
  }
}
run();
