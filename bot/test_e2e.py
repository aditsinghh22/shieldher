from playwright.sync_api import sync_playwright
import os
import time
import base64

def run_test():
    image_path = r"C:\Users\LENOVO\Downloads\WhatsApp Image 2026-03-29 at 21.54.00.jpeg"
    
    with sync_playwright() as p:
        print("Launching Chromium...")
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        try:
            print("Going to localhost:3000/auth")
            page.goto("http://localhost:3000/auth", wait_until="networkidle")
            
            # Switch to Sign Up
            page.click("button:has-text('Sign up')")
            
            email = f"test_{int(time.time())}@shieldher.com"
            print(f"Signing up with {email}")
            
            page.fill("input[type='text']", "Test User")
            page.fill("input[type='email']", email)
            page.fill("input[type='password']", "StrongPass123!")
            page.click("button[type='submit']")
            
            print("Waiting for dashboard redirect...")
            page.wait_for_url("**/dashboard*", timeout=15000)
            print("On Dashboard!")
            
            page.goto("http://localhost:3000/dashboard/upload")
            print("Waiting for Dropzone...")
            page.wait_for_selector("input[type='file']", state="attached")
            
            print("Uploading image...")
            file_input = page.locator("input[type='file']")
            file_input.set_input_files(image_path)
            
            print("Waiting for Analyze button...")
            page.wait_for_selector("button:has-text('Analyze')", state="visible")
            page.click("button:has-text('Analyze')")
            
            print("Waiting for Analysis Completion (could take 10-15s)...")
            page.wait_for_url("**/dashboard/analysis/*", timeout=45000)
            
            print("On Analysis Results! Finding Legal Dispatcher button...")
            # Scroll down
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.screenshot(path="analysis_result.png", full_page=True)
            
            page.click("button:has-text('Run Legal Dispatcher')")
            
            print("Waiting for Modal...")
            page.wait_for_selector("text=Initialize RPA Legal Dispatcher")
            
            print("Entering dummy details for Dispatch...")
            page.fill("input[placeholder='your.email@example.com']", email)
            page.fill("input[placeholder='+91 98765 43210']", "9876543210")
            
            print("Clicking Dispatch Button...")
            # We don't click it so the python bot doesn't spam the actual PC screen, 
            # or we do click it and wait to see if the API succeeds!
            # Since the user specifically asked me to run the bot, I will execute it!
            page.click("button:has-text('Dispatch to Government Portal')")
            
            print("Waiting for dispatch success message...")
            page.wait_for_selector("text=Dispatcher initialized successfully", timeout=30000)
            print("SUCCESS! The bot has been triggered.")
            
        except Exception as e:
            print("Test failed:", str(e))
            page.screenshot(path="error_state.png", full_page=True)
        finally:
            browser.close()

if __name__ == "__main__":
    run_test()
