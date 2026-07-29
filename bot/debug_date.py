from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto('https://cybercrime.gov.in/Webform/Crime_ReportAnonymously.aspx', timeout=60000)

        page.wait_for_selector('select#ContentPlaceHolder1_ddl_CategoryCrime', timeout=30000)
        
        page.locator('select#ContentPlaceHolder1_ddl_CategoryCrime').select_option(index=1)
        page.wait_for_timeout(2000)
        page.locator('select#ContentPlaceHolder1_ddl_SubCategoryCrime').select_option(index=1)
        
        # Test date bypass properly
        try:
            page.evaluate("document.getElementById('txt_ApproxDateTime').removeAttribute('readonly')")
            page.evaluate("document.getElementById('txt_ApproxDateTime').value = '04/04/2026'")
            print("Successfully injected date via JS value.")
        except Exception as e:
            print("JS injection failed.", str(e))
        
        # Let's see what visual state it's in now
        page.screenshot(path='tab1_debug.png')
        browser.close()

run()
