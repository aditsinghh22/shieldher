import os
import asyncio
from dotenv import load_dotenv

def run_agentic_dispatch(payload_data):
    """
    Spins up the AI Brain Agent using Browser-Use with Google Gemini.
    Autonomously navigates the Indian CyberCrime portal and fills the Anonymous complaint form.
    """
    # Load the Gemini key dynamically from your NextJS local env
    env_path = os.path.join(os.getcwd(), 'shieldher', '.env.local')
    load_dotenv(env_path)
    
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if not gemini_key:
        print("CRITICAL ERROR: GEMINI_API_KEY NOT FOUND in shieldher/.env.local!")
        return
    
    # browser-use requires GOOGLE_API_KEY
    os.environ["GOOGLE_API_KEY"] = gemini_key

    async def main():
        from browser_use import Agent
        from langchain_google_genai import ChatGoogleGenerativeAI

        llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash")
        
        task_instructions = f"""
        Objective: Fill out a preliminary online cyber harassment complaint on the Indian Government Portal.
        Do NOT submit the final complaint. Only fill out the intermediate forms!
        
        1. Navigate directly to: https://cybercrime.gov.in/Webform/Crime_ReportAnonymously.aspx
        2. Read the page. If there is an 'I Accept' button or Terms & Conditions, click it to proceed.
        3. For 'Category of complaint', select the option related to 'Sexually Explicit Act' or 'Women/Child'.
        4. For Sub-Category, select any appropriate option.
        5. For the date field: click the small calendar icon next to it, then click 'Today' in the date picker popup.
        6. For State / UTs, select 'Delhi'.
        7. For 'Where did the incident occur?', choose 'WhatsApp' or similar.
        8. In 'Additional Information', type: "{payload_data.get('incident', 'The victim received severely explicit and harassing messages through digital media platforms. The images and videos shared without consent caused extreme psychological distress and fear. The incident has been ongoing for several weeks with multiple attempts of blackmail and coercion.')}"
        9. Click 'Save & Next' after filling Tab 1.
        10. On Tab 2 (Suspect Details): fill any available text boxes with generic data like 'Unknown person operating through social media'.
        11. Click 'Save & Next' after filling Tab 2.
        12. STOP immediately when you reach the 'Preview & Submit' page. Do not click Submit!
        
        CRITICAL RULES:
        - The date field has a readonly attribute. Do NOT try to type into it directly. Instead, find and click the calendar icon button next to it, then click on 'Today' or any date in the popup calendar.
        - Minimum 200 characters are required in the Additional Information box. Make sure the text is long enough.
        - Never click the final Submit button. Stop at Preview & Submit page only.
        """
        
        print("Injecting Consciousness... Starting Gemini Multimodal Agent...")
        agent = Agent(task=task_instructions, llm=llm, max_failures=5)
        
        result = await agent.run(max_steps=30)
        print("Agent Complete. Review the browser and submit manually!")
        print(result)
        
        # Keep browser alive for 5 minutes for the user to complete submission
        print("Browser held open for 5 minutes. Please complete the submission manually.")
        await asyncio.sleep(300)

    asyncio.run(main())

if __name__ == '__main__':
    dummy_payload = {
        "incident": "Severe psychological harassment via explicit images shared without consent over WhatsApp.",
        "state": "Delhi"
    }
    run_agentic_dispatch(dummy_payload)
