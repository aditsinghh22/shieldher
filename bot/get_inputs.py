from playwright.sync_api import sync_playwright

def get_inputs():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto('https://cybercrime.gov.in/Webform/Crime_ReportAnonymously.aspx')
        
        # Give it a few seconds to load ASP.NET webforms
        page.wait_for_timeout(5000)
        
        inputs = page.locator('input, select, textarea').all()
        for i in inputs:
            try:
                type_ = i.get_attribute('type') or i.evaluate('node => node.tagName.toLowerCase()')
                id_ = i.get_attribute('id')
                name = i.get_attribute('name')
                print(f"Type: {type_}, ID: {id_}, Name: {name}")
            except Exception as e:
                pass

        browser.close()

if __name__ == '__main__':
    get_inputs()
