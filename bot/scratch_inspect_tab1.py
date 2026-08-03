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
    page.wait_for_selector("#CrimeCategory, select:visible", state="visible", timeout=30000)
    time.sleep(2)
    
    # Detailed inspection of Tab 1
    tab1_dump = page.evaluate("""() => {
        const selects = Array.from(document.querySelectorAll('select')).map(s => ({
            id: s.id,
            name: s.name,
            className: s.className,
            visible: s.offsetParent !== null,
            options: Array.from(s.options).map(o => ({
                text: o.text.trim(),
                value: o.value,
                selected: o.selected
            }))
        }));
        
        const inputs = Array.from(document.querySelectorAll('input, textarea')).map(inp => ({
            tag: inp.tagName,
            type: inp.type,
            id: inp.id,
            name: inp.name,
            placeholder: inp.placeholder,
            value: inp.value,
            visible: inp.offsetParent !== null,
            outer: inp.outerHTML.slice(0, 150)
        }));
        
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a.btn')).map(b => ({
            tag: b.tagName,
            type: b.type,
            id: b.id,
            name: b.name,
            text: (b.innerText || b.textContent || b.value || '').trim(),
            visible: b.offsetParent !== null,
            outer: b.outerHTML.slice(0, 150)
        }));
        
        return { selects, inputs, buttons };
    }""")
    
    print("\n--- ALL SELECTS ON TAB 1 ---")
    for s in tab1_dump['selects']:
        print(f"Select ID: '{s['id']}', Name: '{s['name']}', Visible: {s['visible']}")
        print("  Options (first 10):", [f"{o['value']}: {o['text']}" for o in s['options'][:10]])
        
    print("\n--- ALL INPUTS ON TAB 1 ---")
    for inp in tab1_dump['inputs']:
        print(f"Input: tag={inp['tag']}, type={inp['type']}, id='{inp['id']}', name='{inp['name']}', placeholder='{inp['placeholder']}', visible={inp['visible']}")
        
    print("\n--- ALL BUTTONS ON TAB 1 ---")
    for b in tab1_dump['buttons']:
        print(f"Button: text='{b['text']}', id='{b['id']}', name='{b['name']}', visible={b['visible']}")
        
    page.screenshot(path="scratch_tab1_inspected.png", full_page=True)
    browser.close()
