"""Extract Tab 2 field IDs by selecting category first then navigating to Tab 2."""
from playwright.sync_api import sync_playwright
import json, sys

with sync_playwright() as p:
    # Use slower mo for diagnostic script to ensure stability
    browser = p.chromium.launch(headless=False, slow_mo=100)
    page = browser.new_page()
    
    try:
        print("Navigating to portal...")
        page.goto("https://cybercrime.gov.in/Webform/Crime_ReportAnonymously.aspx", 
                  timeout=120000, wait_until="networkidle")
    except Exception as e:
        print(f"Navigation warning/timeout: {e}", file=sys.stderr)
    
    page.wait_for_timeout(10000) # Wait for any extra dynamic scripts

    try:
        # Step 1: Select "Sexually Explicit Act" (value="14")
        print("Selecting category...")
        # Check if it exists before selecting
        if page.locator("#ContentPlaceHolder1_ddl_CategoryCrime").is_visible():
            page.select_option("#ContentPlaceHolder1_ddl_CategoryCrime", value="14")
            print("Category selected, waiting for postback...")
            page.wait_for_timeout(10000) # Wait for postback to load dynamic fields
    except Exception as e:
        print(f"Category selection error: {e}", file=sys.stderr)

    # Extract all elements visible now
    print("Extracting current fields...")
    elements = page.evaluate("""() => {
        var selects = document.querySelectorAll('select');
        var inputs = document.querySelectorAll('input, textarea');
        var res = {selects: [], inputs: []};
        
        selects.forEach(s => {
            var opts = [];
            for (var i = 0; i < s.options.length; i++) {
                opts.push({idx: i, val: s.options[i].value, txt: s.options[i].text.trim()});
            }
            res.selects.push({id: s.id, name: s.name, visible: s.offsetParent !== null, opts: opts});
        });
        
        inputs.forEach(i => {
            if (['hidden','submit','button','image'].includes(i.type)) return;
            res.inputs.push({id: i.id, name: i.name, type: i.type, ph: i.placeholder || '', visible: i.offsetParent !== null});
        });
        
        return res;
    }""")

    with open("form_ids_current.json", "w", encoding="utf-8") as f:
        json.dump(elements, f, indent=2, ensure_ascii=False)
    
    print("Saved form_ids_current.json. Script done.")
    browser.close()
