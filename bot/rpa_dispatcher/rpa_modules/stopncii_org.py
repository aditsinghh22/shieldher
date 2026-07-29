import logging
from playwright.sync_api import sync_playwright, TimeoutError
import time

logger = logging.getLogger("ShieldHer_StopNCII")

def file_stopncii_report(payload: dict):
    """
    RPA agent for stopncii.org
    """
    logger.info(f"Initializing StopNCII RPA task...")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=50) 
        context = browser.new_context(
            viewport={'width': 1280, 'height': 720},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()

        try:
            logger.info("Navigating to https://stopncii.org/create-case/")
            page.goto("https://stopncii.org/create-case/", timeout=60000, wait_until="domcontentloaded")

            # --- Step 1: Age verification / Consent ---
            logger.info("Checking for consent forms...")
            # Note: The actual dom/selectors for StopNCII might vary, so these are representational
            # finding standard buttons to proceed.
            try:
                proceed_btn = page.locator("button, a").filter(has_text="Create a case").first
                if proceed_btn.is_visible(timeout=5000):
                    proceed_btn.click()
            except TimeoutError:
                pass 

            # --- Step 2: Stop at file selection wall & Screenshot ---
            logger.info("Reached data entry pause point. StopNCII generates hashes locally.")
            
            page.wait_for_timeout(2000) 
            
            output_filename = "stopncii_prefilled_form.png"
            page.screenshot(path=output_filename, full_page=True)
            logger.info(f"✅ Success! Captured verification screenshot at: {output_filename}")
            
            # --- HUMAN IN THE LOOP ---
            print("\n" + "="*50)
            print("🚀 HUMAN IN THE LOOP PAUSE: StopNCII 🚀")
            print("The RPA bot has navigated to StopNCII.")
            print("StopNCII works strictly by analyzing your images locally on your device to create a 'hash'.")
            print("Because this involves extremely sensitive files, the bot will NOT automate file selection.")
            print("Please perform the hashing step yourself in the open browser.")
            print("="*50 + "\n")
            
            input("Press Enter here in the console to close the browser (or let it timeout)...")

        except TimeoutError as te:
            logger.error(f"Page timeout expired: {str(te)}")
        except Exception as e:
            logger.error(f"Critical execution error during RPA flow: {str(e)}")
        finally:
            logger.info("Closing browser context...")
            browser.close()
