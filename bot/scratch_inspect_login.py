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
        if (cb1 && !cb1.checked) {
            cb1.click();
        }
        if (cb2 && !cb2.checked) {
            cb2.click();
        }
    }""")
    time.sleep(0.8)
    
    cb_states = page.evaluate("""() => {
        const cb1 = document.getElementById('cb1');
        const cb2 = document.getElementById('cb2');
        return {
            cb1: cb1 ? cb1.checked : false,
            cb2: cb2 ? cb2.checked : false
        };
    }""")
    print("Checkbox states after clicking:", cb_states)
    
    print("[8] Clicking 'Report Anonymously' button...")
    page.evaluate("""() => {
        const allBtns = Array.from(document.querySelectorAll('button, a, input'));
        const anonBtn = allBtns.find(b => {
            const t = (b.innerText || b.textContent || b.value || '').toLowerCase();
            return t.includes('anonymously') || t.includes('anonymous');
        });
        if (anonBtn) {
            anonBtn.click();
        }
    }""")
    
    print("[9] Waiting for complaint form navigation...")
    time.sleep(5)
    print("  -> Current URL after click:", page.url)
    
    page.screenshot(path="scratch_real_flow_form_success.png")
    
    form_state = page.evaluate("""() => {
        const selects = Array.from(document.querySelectorAll('select')).map(s => ({
            id: s.id,
            options: s.options ? s.options.length : 0,
            visible: s.offsetParent !== null
        }));
        return {
            url: window.location.href,
            numSelects: selects.length,
            selects: selects
        };
    }""")
    print("Form state:", json.dumps(form_state, indent=2))
    
    browser.close()
