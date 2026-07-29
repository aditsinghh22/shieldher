import json
from pathlib import Path
from playwright.sync_api import sync_playwright

import rpa_complaint_bot as bot


PAYLOAD_PATH = Path("rpa_tmp/payload_1775770178326.json")


def dump_tab2_state(page):
    state = page.evaluate(
        """() => {
            const visible = (el) => {
                const cs = window.getComputedStyle(el);
                return (el.offsetParent !== null || cs.position === 'fixed')
                    && cs.display !== 'none'
                    && cs.visibility !== 'hidden';
            };

            const pick = (sel) => {
                const el = document.querySelector(sel);
                if (!el) return null;
                return {
                    selector: sel,
                    id: el.id || '',
                    name: el.name || '',
                    tag: (el.tagName || '').toLowerCase(),
                    type: el.type || '',
                    value: el.value || '',
                    text: (el.textContent || '').trim(),
                    disabled: !!el.disabled,
                    visible: visible(el),
                    outerHTML: (el.outerHTML || '').slice(0, 1200),
                };
            };

            const tracked = [
                '#ContentPlaceHolder1_txt_Name',
                '#ContentPlaceHolder1_ddl_Id',
                '#ContentPlaceHolder1_ddl_Councode',
                '#ContentPlaceHolder1_txt_IdNo',
                '#ContentPlaceHolder1_btnAdd',
                '#txt_AnyOtherDetails',
                '#ContentPlaceHolder1_btnNext',
            ].map(pick);

            const addControls = Array.from(
                document.querySelectorAll('input[type="submit"],input[type="button"],button,a')
            ).map((el) => {
                const txt = (el.value || el.textContent || '').trim();
                const rect = el.getBoundingClientRect();
                return {
                    id: el.id || '',
                    name: el.name || '',
                    tag: (el.tagName || '').toLowerCase(),
                    text: txt,
                    disabled: !!el.disabled,
                    visible: visible(el),
                    rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
                };
            }).filter((x) => x.visible && x.text.toLowerCase().includes('add'));

            const suspectTables = Array.from(document.querySelectorAll('table')).map((t) => {
                const txt = (t.textContent || '').trim();
                const rows = Array.from(t.querySelectorAll('tr')).map((r) =>
                    Array.from(r.querySelectorAll('th,td')).map((c) => (c.textContent || '').trim())
                );
                return {
                    id: t.id || '',
                    visible: visible(t),
                    textSample: txt.slice(0, 600),
                    rows,
                };
            }).filter((t) => t.visible && (t.id.toLowerCase().includes('gv') || t.textSample.toLowerCase().includes('suspect')));

            const errors = Array.from(
                document.querySelectorAll(
                    '.field-validation-error, .validation-summary-errors, span[style*="Red"], span[style*="red"], div[style*="Red"], div[style*="red"]'
                )
            ).map((el) => {
                const cs = window.getComputedStyle(el);
                return {
                    tag: (el.tagName || '').toLowerCase(),
                    id: el.id || '',
                    className: el.className || '',
                    text: (el.textContent || '').trim(),
                    visible: visible(el),
                    display: cs.display,
                    color: cs.color,
                };
            }).filter((e) => e.text);

            return {
                title: document.title || '',
                url: window.location.href,
                tracked,
                addControls,
                suspectTables,
                errors,
            };
        }"""
    )
    return state


def main():
    if not PAYLOAD_PATH.exists():
        raise FileNotFoundError(f"Payload not found: {PAYLOAD_PATH}")

    data = json.loads(PAYLOAD_PATH.read_text(encoding="utf-8"))

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(viewport={"width": 1366, "height": 900})
        page = context.new_page()

        page.on("dialog", lambda d: d.accept())

        page.goto("https://cybercrime.gov.in/Webform/Crime_ReportAnonymously.aspx", timeout=90000)
        page.wait_for_timeout(3000)
        try:
            page.locator("text='I Accept'").click(timeout=2000)
        except Exception:
            pass

        tab1_ok = bot.fill_tab1(page, data)
        print(f"TAB1_OK={tab1_ok}")
        if not tab1_ok:
            page.screenshot(path="debug_tab2_dom_tab1_failed.png", full_page=True)
            Path("debug_tab2_dom_tab1_failed.html").write_text(page.content(), encoding="utf-8")
            browser.close()
            return

        # Prevent moving to tab3 so we can inspect tab2 immediately after ADD attempts.
        original_next = bot._click_tab2_preview_next
        bot._click_tab2_preview_next = lambda pg: False
        try:
            tab2_ok = bot.fill_tab2(page, data)
            print(f"TAB2_OK={tab2_ok}")
        finally:
            bot._click_tab2_preview_next = original_next

        page.wait_for_timeout(1200)
        page.screenshot(path="debug_tab2_dom_after_add.png", full_page=True)
        Path("debug_tab2_dom_after_add.html").write_text(page.content(), encoding="utf-8")
        Path("debug_tab2_state.json").write_text(
            json.dumps(dump_tab2_state(page), indent=2, ensure_ascii=False), encoding="utf-8"
        )

        browser.close()


if __name__ == "__main__":
    main()
