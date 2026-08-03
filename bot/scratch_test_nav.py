"""Quick live test: Nav -> Submenu -> I Understand -> Checkboxes -> Report Anonymously -> Form"""
import sys, time, re, json
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding='utf-8')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    page = browser.new_context(viewport={"width": 1280, "height": 800}).new_page()

    print("[1] Opening portal...")
    page.goto("https://cybercrime.gov.in/", wait_until="networkidle", timeout=60000)
    time.sleep(2)

    print("[2] Clicking 'Report Cyber Crime' nav...")
    nav = page.locator("a, button, span").filter(has_text=re.compile(r"Report Cyber Crime", re.I)).first
    nav.hover(); time.sleep(0.5); nav.click(force=True); time.sleep(0.8)

    print("[3] Clicking 'Women/Children Related Crime'...")
    sub = page.locator("a:has-text('Women/Children Related Crime'), a:has-text('Women/Children')").first
    if sub.is_visible(timeout=3000):
        sub.click(force=True)
    else:
        page.evaluate("""() => { const l = Array.from(document.querySelectorAll('a')).find(a => a.textContent.includes('Women/Children')); if(l) l.click(); }""")
    time.sleep(1.5)

    print("[4] Waiting for 'I Understand' modal...")
    page.wait_for_selector("button.educate-btn", state="visible", timeout=20000)
    time.sleep(0.5)
    page.screenshot(path="test_modal_visible.png")
    print("  -> Modal visible. Clicking button.educate-btn via JS...")
    page.evaluate("""() => { const btn = document.querySelector('button.educate-btn'); if (btn) btn.click(); }""")
    time.sleep(2)

    print(f"[5] URL after modal: {page.url}")
    page.wait_for_selector("input[type='checkbox']", timeout=15000)
    for cb in page.locator("input[type='checkbox']").all():
        cb.check(force=True)
    time.sleep(0.5)

    btn = page.locator("button:has-text('Report Anonymously')").first
    if btn.is_visible(timeout=5000):
        btn.click(); time.sleep(2.5)

    print(f"[6] Final URL: {page.url}")
    page.screenshot(path="test_final_form.png")
    print(">>> DONE!")
    browser.close()
