import logging
from playwright.sync_api import sync_playwright, TimeoutError
import time

logger = logging.getLogger("ShieldHer_CyberCrime")

def file_cybercrime_report(payload: dict, financial_focus: bool = False):
    """
    RPA agent for cybercrime.gov.in
    """
    victim_details = payload.get("victim_details", {})
    incident_details = payload.get("incident_details", {})
    
    reporting_state = victim_details.get("state", "Delhi")
    dummy_login_id = victim_details.get("login_id", "shieldher_test_user")

    logger.info(f"Initializing cybercrime.gov.in RPA task...")

    with sync_playwright() as p:
        # Launch Chromium visually so the user can verify its actions
        # and take control when needed.
        browser = p.chromium.launch(headless=False, slow_mo=50) 
        
        context = browser.new_context(
            viewport={'width': 1280, 'height': 720},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        
        page = context.new_page()

        try:
            logger.info("Navigating to https://cybercrime.gov.in/")
            # High timeout because government portals often have severe latency
            page.goto("https://cybercrime.gov.in/", timeout=60000, wait_until="domcontentloaded")

            # --- Step 1: Click "File a Complaint" ---
            logger.info("Waiting for the 'File a complaint' button to appear...")
            file_complaint_loc = page.locator("a, button").filter(has_text="File a complaint").first
            file_complaint_loc.wait_for(state="visible", timeout=30000)
            file_complaint_loc.click()

            # --- Step 2: Accept Terms and Conditions ---
            logger.info("Waiting for Terms & Conditions agreement...")
            accept_button = page.locator("a, button").filter(has_text="I Accept").first
            accept_button.wait_for(state="visible", timeout=30000)
            accept_button.click()

            # --- Step 3: Wait for "Report and Track" Login View ---
            logger.info("Awaiting the 'Report and Track' citizen login portal...")
            state_dropdown = page.wait_for_selector("select", timeout=45000)
            login_id_input = page.wait_for_selector("input[type='text'], input[placeholder*='Login ID']", timeout=15000)

            # --- Step 4: Fill Dummy Data ---
            logger.info("Filling in preliminary demographic and login data...")
            if state_dropdown:
                try:
                    state_dropdown.select_option(label=reporting_state)
                except Exception:
                    state_dropdown.select_option(index=2)

            if login_id_input:
                login_id_input.fill(dummy_login_id)
            
            if financial_focus:
                logger.info("Focusing on Financial Fraud elements (UPI, Bank Accounts)...")
                # Here we would add specific logic to navigate to financial fraud sections
                # and fill in suspect UPI/bank details based on incident_details.get("suspect_data")

            # --- Step 5: Stop at CAPTCHA/OTP Wall & Screenshot ---
            logger.info("Reached data entry pause point.")
            
            page.wait_for_timeout(2000) 
            
            output_filename = "cybercrime_prefilled_form.png"
            page.screenshot(path=output_filename, full_page=True)
            logger.info(f"✅ Success! Captured verification screenshot at: {output_filename}")
            
            # --- HUMAN IN THE LOOP ---
            print("\n" + "="*50)
            print("🚀 HUMAN IN THE LOOP PAUSE 🚀")
            print("The RPA bot has reached the OTP/CAPTCHA step.")
            print("The browser has been left open for you.")
            print("Please review the pre-filled data in the browser window.")
            print("You have complete control: you can fill the OTP, click submit, or close the browser to cancel.")
            print("="*50 + "\n")
            
            # This causes the script to pause indefinitely until the user presses Enter in the console.
            # This keeps the Playwright browser window open for the user to interact with.
            input("Press Enter here in the console to close the browser (or let it timeout)...")

        except TimeoutError as te:
            logger.error(f"Page timeout expired: {str(te)}")
        except Exception as e:
            logger.error(f"Critical execution error during RPA flow: {str(e)}")
        finally:
            logger.info("Closing browser context...")
            browser.close()
