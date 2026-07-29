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
        
        # Bypass read-only on date field and enforce 
        page.locator('#txt_ApproxDateTime').evaluate("node => node.removeAttribute('readonly')")
        page.locator('#txt_ApproxDateTime').fill('01/04/2026')
        print("Filled Date via evaluate")
        
        page.locator('select#ContentPlaceHolder1_ddl_State').select_option(index=1)
        page.wait_for_timeout(2000)
        
        if page.locator('select#ContentPlaceHolder1_ddl_District').is_visible():
            page.locator('select#ContentPlaceHolder1_ddl_District').select_option(index=1)
        
        page.locator('select#ContentPlaceHolder1_ddl_InformationSource').select_option(index=1)
        
        details = "A "*210
        page.locator('#txt_AdditionalInfo').fill(details)

        # Submit Tab 1
        page.locator('#ContentPlaceHolder1_btnNext').click()
        print("Clicked Save and Next")

        page.wait_for_timeout(5000) # give time for Tab 2 to load
        
        # Extract Tab 2 Details!
        inputs = page.locator('input, select, textarea').all()
        found_tab2 = False
        for i in inputs:
            try:
                id_ = i.get_attribute('id')
                if id_ and 'ContentPlaceHolder1' in id_ and 'btn' not in id_ and 'lbl' not in id_:
                    print(f"Tab 2 ID found: {id_}")
                    found_tab2 = True
            except:
                pass
                
        if not found_tab2:
            page.screenshot(path='tab1_failure.png')
            print("Failed to reach Tab 2. Screenshot saved.")

        browser.close()

run()
