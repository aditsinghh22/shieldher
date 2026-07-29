import json
import sys
from playwright.sync_api import sync_playwright

def get_states_and_districts():
    print("Launching browser...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            print("Navigating to Cybercrime portal...")
            page.goto("https://cybercrime.gov.in/Webform/Crime_ReportAnonymously.aspx", timeout=90000, wait_until="domcontentloaded")
            page.wait_for_timeout(2000)

            # Accept terms
            try:
                accept = page.locator("a, button, input").filter(has_text="I Accept").first
                if accept.is_visible(timeout=2000):
                    accept.click()
            except:
                pass

            # Category -> Sexually Explicit Act (14) to enable state/district
            print("Selecting category...")
            page.select_option("#ContentPlaceHolder1_ddl_CategoryCrime", value="14")
            page.wait_for_timeout(3000)

            # Get all states
            states = page.evaluate("""() => {
                const opts = document.querySelector('#ContentPlaceHolder1_ddl_State').options;
                const data = [];
                for (let i=1; i<opts.length; i++) {
                    data.push({val: opts[i].value, label: opts[i].text.trim()});
                }
                return data;
            }""")

            state_district_map = {}

            print(f"Found {len(states)} states. Extracting districts...")
            for s in states:
                # Select State
                page.select_option("#ContentPlaceHolder1_ddl_State", value=s['val'])
                
                # Wait for postback
                try:
                    page.wait_for_function(
                        "document.querySelector('#ContentPlaceHolder1_ddl_District') && document.querySelector('#ContentPlaceHolder1_ddl_District').options.length > 2",
                        timeout=5000
                    )
                except:
                    page.wait_for_timeout(1500)
                
                # Extract districts
                districts = page.evaluate("""() => {
                    const opts = document.querySelector('#ContentPlaceHolder1_ddl_District').options;
                    const data = [];
                    for (let i=1; i<opts.length; i++) {
                        data.push(opts[i].text.trim());
                    }
                    return data;
                }""")
                
                state_district_map[s['label']] = districts
                print(f"{s['label']}: {len(districts)} districts")
                
            return state_district_map
        finally:
            browser.close()

if __name__ == "__main__":
    result = get_states_and_districts()
    with open("cybercrime_districts.json", "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
    print("Done! Saved to cybercrime_districts.json")
