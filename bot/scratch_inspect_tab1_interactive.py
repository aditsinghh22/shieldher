import json
import re
import sys
import time
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    page = browser.new_context(viewport={"width": 1280, "height": 800}).new_page()
    
    print("[1] Opening Portal...")
    page.goto("https://cybercrime.gov.in/", wait_until="networkidle", timeout=60000)
    time.sleep(2)
    
    print("[2] Opening 'Report Cyber Crime' in top nav...")
    top_nav = page.locator("a, button, span").filter(has_text=re.compile(r"Report Cyber Crime", re.I)).first
    top_nav.hover()
    time.sleep(0.5)
    top_nav.click(force=True)
    time.sleep(0.8)
    
    print("[3] Clicking 'Women/Children Related Crime' link...")
    page.evaluate("""() => {
        const links = Array.from(document.querySelectorAll('a, button'));
        const link = links.find(l => {
            const t = (l.innerText || l.textContent || '').toLowerCase();
            return t.includes('women') && (t.includes('children') || t.includes('child'));
        });
        if (link) link.click();
    }""")
    time.sleep(1.5)
    
    print("[4] Waiting for 'I Understand' modal...")
    page.wait_for_selector("button.educate-btn", state="visible", timeout=20000)
    time.sleep(0.5)
    
    print("[5] Clicking 'I Understand' button...")
    page.evaluate("""() => {
        const btn = document.querySelector('button.educate-btn');
        if (btn) btn.click();
    }""")
    
    print("[6] Waiting for #cb1 and #cb2 on /login...")
    page.wait_for_selector("#cb1, #cb2", state="visible", timeout=20000)
    time.sleep(1)
    
    print("[7] Checking #cb1 and #cb2...")
    page.evaluate("""() => {
        const cb1 = document.getElementById('cb1');
        const cb2 = document.getElementById('cb2');
        if (cb1 && !cb1.checked) cb1.click();
        if (cb2 && !cb2.checked) cb2.click();
    }""")
    time.sleep(0.8)
    
    print("[8] Clicking 'Report Anonymously' button...")
    page.evaluate("""() => {
        const allBtns = Array.from(document.querySelectorAll('button, a, input'));
        const anonBtn = allBtns.find(b => {
            const t = (b.innerText || b.textContent || b.value || '').toLowerCase();
            return t.includes('anonymously') || t.includes('anonymous');
        });
        if (anonBtn) anonBtn.click();
    }""")
    
    print("[9] Waiting for complaint form to render...")
    page.wait_for_selector("#CrimeCategory", state="visible", timeout=30000)
    time.sleep(2)
    
    # 1. Print all options of #CrimeCategory
    cat_options = page.evaluate("""() => {
        const s = document.getElementById('CrimeCategory');
        return Array.from(s.options).map(o => ({ value: o.value, text: o.text.trim() }));
    }""")
    print("CrimeCategory options:", json.dumps(cat_options, indent=2))
    
    # Select Category (e.g. Sexually Explicit Act or Cyber Blackmailing)
    page.select_option("#CrimeCategory", index=1)
    time.sleep(1)
    
    # 2. Test filling CrimeApproxDate (datetime-local format: YYYY-MM-DDTHH:mm)
    print("Filling CrimeApproxDate...")
    page.fill("#CrimeApproxDate", "2026-04-01T10:30")
    time.sleep(0.5)
    date_val = page.input_value("#CrimeApproxDate")
    print(f"  -> CrimeApproxDate value: '{date_val}'")
    
    # 3. Test filling ReasonForDelay
    print("Filling ReasonForDelay...")
    page.fill("#ReasonForDelay", "Due to psychological trauma and fear of retaliation.")
    time.sleep(0.5)
    
    # 4. Print State options
    state_options = page.evaluate("""() => {
        const s = document.getElementById('CrimeState');
        return Array.from(s.options).map(o => ({ value: o.value, text: o.text.trim() }));
    }""")
    print("CrimeState options (first 10):", json.dumps(state_options[:10], indent=2))
    
    # Select State (DELHI)
    page.select_option("#CrimeState", label="DELHI")
    time.sleep(1.5)
    
    # Print District options after state selected
    dist_options = page.evaluate("""() => {
        const s = document.getElementById('CrimeDistrict');
        return Array.from(s.options).map(o => ({ value: o.value, text: o.text.trim() }));
    }""")
    print("CrimeDistrict options after DELHI:", json.dumps(dist_options, indent=2))
    
    # Select District index 1
    if len(dist_options) > 1:
        page.select_option("#CrimeDistrict", index=1)
        time.sleep(1.5)
        
    # Print Police Station options
    ps_options = page.evaluate("""() => {
        const s = document.getElementById('CrimePoliceStation');
        return Array.from(s.options).map(o => ({ value: o.value, text: o.text.trim() }));
    }""")
    print("CrimePoliceStation options:", json.dumps(ps_options[:10], indent=2))
    if len(ps_options) > 1:
        page.select_option("#CrimePoliceStation", index=1)
        time.sleep(1)
        
    # 5. Print InFoId (Platform) options
    info_options = page.evaluate("""() => {
        const s = document.getElementById('InFoId');
        return Array.from(s.options).map(o => ({ value: o.value, text: o.text.trim() }));
    }""")
    print("InFoId (Platform) options:", json.dumps(info_options, indent=2))
    
    # Select InFoId (WhatsApp or Instagram)
    page.select_option("#InFoId", index=1)
    time.sleep(1)
    
    # Check dynamic fields after selecting platform
    dynamic_inputs = page.evaluate("""() => {
        return Array.from(document.querySelectorAll('input, select, textarea')).map(el => ({
            tag: el.tagName,
            type: el.type,
            id: el.id,
            name: el.name,
            placeholder: el.placeholder,
            visible: el.offsetParent !== null,
            outer: el.outerHTML.slice(0, 150)
        }));
    }""")
    print("All inputs after dynamic selection:", json.dumps(dynamic_inputs, indent=2))
    
    page.screenshot(path="scratch_tab1_interactive_state.png", full_page=True)
    browser.close()
