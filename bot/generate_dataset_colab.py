import os
import json
import time
import random
import logging
import re
try:
    from google.colab import drive
    HAS_COLAB = True
except ImportError:
    HAS_COLAB = False

from google import genai
from google.genai import types
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type

# Setup Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

SYSTEM_PERSONA = "You are ShieldHer, an empathetic, highly knowledgeable AI legal advocate specializing in Indian Cyber Law (BNS, IT Act 2000). You protect women, analyze evidence, clearly explain legal options, and can trigger web-automation tools to file complaints."

def get_generation_prompt():
    scenarios = [
        "threats of doxxing and exposing sensitive personal info",
        "distressing non-consensual image sharing (NCII) by an ex-partner",
        "persistent aggressive cyberstalking across multiple social media platforms",
        "severe online harassment, abuse, and character assassination",
        "morphing of images, deepfakes, and blackmail"
    ]
    scenario = random.choice(scenarios)
    
    # We ask the model to generate the array of message objects directly
    return f"""
    You are an expert dataset generator. Generate ONE realistic multi-turn conversation between a distressed user and an AI named 'ShieldHer' in Indian context.
    
    Scenario focus: {scenario}
    
    CONVERSATION FLOW:
    
    1. USER MESSAGE 1: 
       - Must include a simulated text transcript of a harassment screenshot (e.g., "[Parsed Screenshot: 'If you don't reply, I'll post the pictures...']").
       - Intermixed with the user's extremely distressed, panicked questions written in natural Hinglish (Hindi + English).
    
    2. ASSISTANT MESSAGE 1 (ShieldHer):
       - Empathy & Validation: Acknowledge the distress warmly and assure them it is NOT their fault.
       - Legal Analysis: Clearly cite relevant Indian laws (e.g., IT Act Sec 67/67A, BNS Sec 78/79, etc.) applicable to the transcript. Explain simply.
       - Actionable Advice: Direct them to stop engaging, secure accounts, and preserve evidence.
       - The 'Ask': End the message EXACTLY with this phrase: "Would you like me to securely auto-fill a preliminary complaint on the National Cyber Crime Reporting Portal (cybercrime.gov.in) using the details you provided?"
    
    3. USER MESSAGE 2:
       - The user replies affirmatively in Hinglish (e.g., "Yes please", "Haan please kar do meri help", "Yes, do it quickly").
    
    4. ASSISTANT MESSAGE 2:
       - Acknowledge the affirmation.
       - MUST include exactly the following tool call format at the end:
         [SYSTEM_ACTION: trigger_rpa_filing, {{"suspect_info": "<extracted info or Unknown>", "incident_type": "<type>", "evidence_ref": "parsed_screenshot_transcript"}}]
       
    Output the conversation strictly as a JSON list of message objects, conforming to the ChatML format.
    Include the system prompt as the first message.
    
    Format:
    [
      {{"role": "system", "content": "{SYSTEM_PERSONA}"}},
      {{"role": "user", "content": "..."}},
      {{"role": "assistant", "content": "..."}},
      {{"role": "user", "content": "..."}},
      {{"role": "assistant", "content": "..."}}
    ]
    """

# Retry with exponential backoff for handling API rate limits gracefully
@retry(wait=wait_exponential(multiplier=2, min=4, max=60), stop=stop_after_attempt(5))
def generate_conversation(client: genai.Client) -> list:
    prompt = get_generation_prompt()
    
    # Call Gemini 3.1 Flash via the google-genai SDK
    response = client.models.generate_content(
        model='gemini-3.1-flash',
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.7,
            # Force JSON format output for robust parsing
            response_mime_type="application/json",
            safety_settings=[
                types.SafetySetting(
                    category=types.HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold=types.HarmBlockThreshold.BLOCK_NONE,
                ),
                types.SafetySetting(
                    category=types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold=types.HarmBlockThreshold.BLOCK_NONE,
                ),
                types.SafetySetting(
                    category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold=types.HarmBlockThreshold.BLOCK_NONE,
                ),
                types.SafetySetting(
                    category=types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                    threshold=types.HarmBlockThreshold.BLOCK_NONE,
                ),
            ]
        )
    )
    
    if not response.text:
        raise ValueError("Received empty response from the Gemini API.")
    
    return json.loads(response.text)

def validate_conversation(convo: list) -> bool:
    """Basic validation to ensure correct structure, flow, and required string matches."""
    if not isinstance(convo, list) or len(convo) != 5:
        return False
        
    roles = [msg.get("role") for msg in convo]
    if roles != ["system", "user", "assistant", "user", "assistant"]:
        return False
        
    first_assistant_msg = convo[2].get("content", "")
    ask_phrase = "Would you like me to securely auto-fill a preliminary complaint on the National Cyber Crime Reporting Portal (cybercrime.gov.in) using the details you provided?"
    if ask_phrase not in first_assistant_msg:
        return False
        
    final_assistant_msg = convo[4].get("content", "")
    if "[SYSTEM_ACTION: trigger_rpa_filing" not in final_assistant_msg:
        return False
        
    return True

def main():
    logger.info("Initializing ShieldHer Dataset Generation Script...")
    
    # 1. Mount Google Drive
    if HAS_COLAB:
        try:
            drive.mount('/content/drive')
            logger.info("Successfully mounted Google Drive.")
        except Exception as e:
            logger.warning(f"Could not mount Google Drive. Error: {e}")
    else:
        logger.info("Local environment detected; skipping Google Drive mount.")
    
    output_dir = '/content/drive/MyDrive/ShieldHer_ML/'
    output_file = os.path.join(output_dir, 'legal_training_data.jsonl')
    
    try:
        os.makedirs(output_dir, exist_ok=True)
    except Exception as e:
        logger.error(f"Failed to create directory {output_dir}. Error: {e}")
        # Fallback to local
        output_file = 'legal_training_data.jsonl'
        logger.info(f"Falling back to local path: {output_file}")
        
    # 2. Setup Gemini Client using GenAI SDK
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        if HAS_COLAB:
            try:
                from google.colab import userdata
                api_key = userdata.get('GEMINI_API_KEY')
            except Exception as e:
                logger.warning(f"Could not load key from userdata: {e}")
            
    if not api_key:
        logger.error("GEMINI_API_KEY not found! Please set it in Colab Secrets or as an environment variable.")
        return
        
    # Initialize the client from google-genai
    client = genai.Client(api_key=api_key)
    
    NUM_CONVERSATIONS = 500
    logger.info(f"Starting generation of {NUM_CONVERSATIONS} ShieldHer ChatML conversations...")
    
    success_count = 0
    
    # 3. Data Generation Loop
    with open(output_file, 'a', encoding='utf-8') as f:
        for i in range(1, NUM_CONVERSATIONS + 1):
            try:
                convo = generate_conversation(client)
                
                # Check formatting constraints before saving
                if validate_conversation(convo):
                    f.write(json.dumps(convo, ensure_ascii=False) + '\n')
                    success_count += 1
                else:
                    logger.warning(f"Generation {i} failed structural validation constraints. Retrying via standard loop.")
                    
            except Exception as e:
                logger.error(f"Failed to generate conversation {i} after retries: {e}")
                
            # Log progress every 10 generations as requested
            if i % 10 == 0:
                logger.info(f"PROGRESS UPDATE: Processed {i}/{NUM_CONVERSATIONS}. Successful so far: {success_count}.")
                
            # Sleep slightly to respect usage limits generally, distinct from retry backoff
            time.sleep(2)
            
    logger.info(f"=== Dataset Generation Complete! ===")
    logger.info(f"Saved {success_count} valid multi-turn JSON conversations to {output_file}")

if __name__ == "__main__":
    main()
