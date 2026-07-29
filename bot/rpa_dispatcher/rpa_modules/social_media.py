import logging
from playwright.sync_api import sync_playwright, TimeoutError

logger = logging.getLogger("ShieldHer_SocialMedia")

def file_social_media_report(payload: dict, platform: str = "Instagram"):
    """
    RPA agent for Social Media impersonation reporting.
    """
    logger.info(f"Initializing {platform} RPA task...")
    
    incident_details = payload.get("incident_details", {})
    suspect_data = incident_details.get("suspect_data", {})
    suspect_url = suspect_data.get("platform_url", "https://instagram.com")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=50) 
        context = browser.new_context(
            viewport={'width': 1280, 'height': 720},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()

        try:
            url = "https://help.instagram.com/contact/636276399721841" if platform.lower() == "instagram" else suspect_url
            logger.info(f"Navigating to {url}")
            page.goto(url, timeout=60000, wait_until="domcontentloaded")

            logger.info("Reached data entry pause point.")
            page.wait_for_timeout(2000) 
            
            output_filename = "social_media_prefilled_form.png"
            page.screenshot(path=output_filename, full_page=True)
            logger.info(f"✅ Success! Captured verification screenshot at: {output_filename}")
            
            # --- HUMAN IN THE LOOP ---
            print("\n" + "="*50)
            print(f"🚀 HUMAN IN THE LOOP PAUSE: {platform} 🚀")
            print("The RPA bot has navigated to the platform's impersonation form.")
            print("Please upload your government ID/selfie directly here to verify your identity.")
            print("You have complete control: you can submit the form or close the browser.")
            print("="*50 + "\n")
            
            input("Press Enter here in the console to close the browser (or let it timeout)...")

        except TimeoutError as te:
            logger.error(f"Page timeout expired: {str(te)}")
        except Exception as e:
            logger.error(f"Critical execution error during RPA flow: {str(e)}")
        finally:
            logger.info("Closing browser context...")
            browser.close()
