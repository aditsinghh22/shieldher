from playwright.sync_api import sync_playwright

def test_cal_click():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=500)
        page = browser.new_page()
        page.goto('https://cybercrime.gov.in/Webform/Crime_ReportAnonymously.aspx', timeout=60000)

        page.wait_for_selector('select#ContentPlaceHolder1_ddl_CategoryCrime', timeout=30000)
        
        page.locator('select#ContentPlaceHolder1_ddl_CategoryCrime').select_option(index=1)
        page.wait_for_timeout(2000)
        
        try:
            print("Attempting to explicitly click the UI calendar icon...")
            
            # The portal uses a standard jQuery datepicker with a specific icon class
            page.locator(".ui-datepicker-trigger").first.click(timeout=5000)
            
            print("Click sent to trigger. Wait for table...")
            page.wait_for_selector(".ui-datepicker-calendar", timeout=5000)
            
            # Find the active 'Today' class or active date that can be clicked
            today_btn = page.locator(".ui-datepicker-days-cell-over, .ui-state-highlight, td a").first
            today_btn.click()
            print("Successfully clicked a calendar date!")
            
        except Exception as e:
            print("Click sequence failed:", e)

        print("Done. Closing.")
        page.wait_for_timeout(2000)
        browser.close()

test_cal_click()
