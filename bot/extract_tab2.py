from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto('https://cybercrime.gov.in/Webform/Crime_ReportAnonymously.aspx', timeout=60000)

        page.wait_for_selector('select#ContentPlaceHolder1_ddl_CategoryCrime')
        
        # We'll just run visual capture in headed mode via subagent if headless blocking triggers.
        # But let's dump HTML immediately after click first.
        page.locator('select#ContentPlaceHolder1_ddl_CategoryCrime').select_option(index=1)
        page.wait_for_timeout(2000)
        page.locator('select#ContentPlaceHolder1_ddl_SubCategoryCrime').select_option(index=1)
        page.locator('#txt_ApproxDateTime').fill('01/04/2026')
        page.locator('#ContentPlaceHolder1_txtresiondelay').fill('Because of intense psychological distress.')
        page.locator('select#ContentPlaceHolder1_ddl_State').select_option(index=1)
        page.wait_for_timeout(2000)
        
        if page.locator('select#ContentPlaceHolder1_ddl_District').is_visible():
            page.locator('select#ContentPlaceHolder1_ddl_District').select_option(index=1)
        
        page.locator('select#ContentPlaceHolder1_ddl_InformationSource').select_option(index=1)
        
        details = "A "*210
        page.locator('#txt_AdditionalInfo').fill(details)

        page.locator('#ContentPlaceHolder1_btnNext').click()

        print("Clicked NEXT, wait 10s")
        page.wait_for_timeout(10000) 
        
        # Capture a screenshot so we can see what actually happened (e.g. captcha error, validation text)
        page.screenshot(path='tab1_result.png')

        browser.close()

run()
