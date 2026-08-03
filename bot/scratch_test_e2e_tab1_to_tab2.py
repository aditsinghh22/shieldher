import json
import os
import re
import sys
import time
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')

dummy_img_path = os.path.abspath("dummy_evidence.png")
if not os.path.exists(dummy_img_path):
    with open(dummy_img_path, "wb") as f:
        f.write(b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82')

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
    
    # 1. Select Category
    print("Selecting CrimeCategory...")
    page.select_option("#CrimeCategory", index=4) # Sexually Explicit Act
    time.sleep(0.5)
    
    # 2. Fill Date & Time
    print("Filling CrimeApproxDate...")
    page.fill("#CrimeApproxDate", "2026-04-01T10:30")
    time.sleep(0.3)
    
    # 3. Fill Delay Reason
    print("Filling ReasonForDelay...")
    page.fill("#ReasonForDelay", "Due to psychological trauma and fear of retaliation")
    time.sleep(0.3)
    
    # 4. Select State
    print("Selecting State DELHI...")
    page.select_option("#CrimeState", label="DELHI")
    time.sleep(1.5)
    
    # 5. Select District
    print("Selecting District...")
    page.select_option("#CrimeDistrict", index=1)
    time.sleep(1.5)
    
    # 6. Select Police Station
    print("Selecting Police Station...")
    page.select_option("#CrimePoliceStation", index=1)
    time.sleep(0.5)
    
    # 7. Select Platform (WhatsApp)
    print("Selecting Platform WhatsApp...")
    page.select_option("#InFoId", value="6: 9")
    time.sleep(0.5)
    
    # 8. Fill Platform Contact
    print("Filling InFoText...")
    page.fill("#InFoText", "9876543210")
    time.sleep(0.5)
    
    # 9. Select MediaType
    print("Selecting MediaType...")
    page.select_option("#MediaType", index=1)
    time.sleep(0.5)
    
    # 10. Set File Input
    print("Attaching evidence file...")
    page.set_input_files("#inFoSource", dummy_img_path)
    time.sleep(1)
    
    # 11. Click Media 'Add' button
    print("Clicking Media 'Add' button...")
    page.evaluate("""() => {
        const btns = Array.from(document.querySelectorAll('button, input[type="button"], a'));
        const addBtn = btns.find(b => (b.innerText || b.value || '').trim().toLowerCase() === 'add');
        if (addBtn) addBtn.click();
    }""")
    time.sleep(1.5)
    
    # 12. Clean text
    clean_text = (
        "The victim has been subjected to severe and persistent online harassment and non-consensual content sharing "
        "on social media platforms. The perpetrator has been sending threatening messages demanding extortion and circulating "
        "private media without consent. This has caused severe emotional distress and fear. The victim seeks immediate legal "
        "intervention and investigation under the Information Technology Act and Indian Penal Code."
    )
    print("Filling CrimeAdditionalInfo...")
    page.evaluate("""(val) => {
        const ta = document.getElementById('CrimeAdditionalInfo');
        ta.value = val;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
    }""", clean_text)
    time.sleep(1)
    
    # 13. Click Save & Next
    print("Clicking 'Save & Next'...")
    page.evaluate("""() => {
        const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        const saveBtn = btns.find(b => (b.innerText || b.value || '').trim().toLowerCase().includes('save & next'));
        if (saveBtn) saveBtn.click();
    }""")
    time.sleep(4)
    
    # 14. Fill Tab 2 (Suspect Details)
    print("Waiting for Tab 2 (#SuspectName)...")
    page.wait_for_selector("#SuspectName", state="visible", timeout=20000)
    time.sleep(1)
    
    print("Filling SuspectName...")
    page.fill("#SuspectName", "Unknown Online Perpetrator")
    time.sleep(0.5)
    
    print("Selecting Suspect ID Type Mobile Number...")
    page.select_option("#FK_IdTypeId", label="Mobile Number")
    time.sleep(0.5)
    
    print("Filling Suspect IdNumber...")
    page.fill("#IdNumber", "9876543210")
    time.sleep(0.5)
    
    print("Clicking Suspect 'Add' button...")
    page.evaluate("""() => {
        const btns = Array.from(document.querySelectorAll('button, input[type="button"]'));
        const addBtn = btns.find(b => (b.innerText || b.value || '').trim().toLowerCase() === 'add');
        if (addBtn) addBtn.click();
    }""")
    time.sleep(1.5)
    
    print("Filling Tab 2 AdditionalInfo...")
    page.fill("#AdditionalInfo", "Perpetrator operates through anonymous online handles and encrypted messaging.")
    time.sleep(0.5)
    
    page.screenshot(path="scratch_tab2_filled.png", full_page=True)
    
    print("Clicking 'Preview & Next' button...")
    page.evaluate("""() => {
        const btns = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
        const previewBtn = btns.find(b => (b.innerText || b.value || '').trim().toLowerCase().includes('preview & next'));
        if (previewBtn) previewBtn.click();
    }""")
    time.sleep(4)
    
    page.screenshot(path="scratch_tab3_preview_rendered.png", full_page=True)
    print("Reached Tab 3 Preview successfully!")
    
    browser.close()
