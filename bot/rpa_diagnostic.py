"""
Diagnostic script: Fill Tab 1 completely, advance to Tab 2, dump all field IDs.
Saves screenshots of both tabs and prints every interactive element on Tab 2.
"""
from playwright.sync_api import sync_playwright
import json, os

def run_diagnostic():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=200)
        page = browser.new_page(viewport={"width": 1280, "height": 720})

        # ──────── NAVIGATE ────────
        print("[1/8] Navigating to Anonymous form...")
        page.goto("https://cybercrime.gov.in/Webform/Crime_ReportAnonymously.aspx", timeout=60000, wait_until="domcontentloaded")
        page.wait_for_timeout(3000)

        # ──────── TAB 1: CATEGORY ────────
        print("[2/8] Selecting Category & Sub-Category...")
        page.wait_for_selector("select#ContentPlaceHolder1_ddl_CategoryCrime", timeout=30000)
        page.select_option("select#ContentPlaceHolder1_ddl_CategoryCrime", index=1)
        page.wait_for_timeout(2000)  # let ASP.NET postback load sub-categories

        # Sub-Category (dynamic, loaded after category postback)
        try:
            page.select_option("select#ContentPlaceHolder1_ddl_SubCategoryCrime", index=1)
        except:
            print("  [WARN] Sub-category not available or already set")

        # ──────── TAB 1: DATE via jQuery DatePicker ────────
        print("[3/8] Clicking calendar icon for date...")
        try:
            # The portal uses jQuery UI datepicker. There is a small calendar icon next to the field.
            cal_icon = page.locator("img.ui-datepicker-trigger")
            if cal_icon.count() > 0:
                cal_icon.first.click()
            else:
                # Fallback: try the generic trigger class
                page.locator(".ui-datepicker-trigger").first.click()
            
            page.wait_for_timeout(1000)
            
            # Click "Today" button if it exists at the bottom of the datepicker
            today_btn = page.locator("button.ui-datepicker-current")
            if today_btn.count() > 0 and today_btn.is_visible():
                today_btn.click()
            else:
                # Fallback: click any highlighted/active date cell
                page.locator(".ui-datepicker-calendar td a").first.click()
            
            print("  Date selected successfully via calendar!")
        except Exception as e:
            print(f"  [WARN] Calendar click failed: {e}")
            # Nuclear fallback: inject via JS and fire change event
            try:
                page.evaluate("""
                    var el = document.getElementById('txt_ApproxDateTime');
                    el.removeAttribute('readonly');
                    el.value = '04/04/2026';
                    el.dispatchEvent(new Event('change', {bubbles: true}));
                """)
                print("  Date injected via JS fallback")
            except:
                print("  [ERR] All date methods failed")

        # ──────── TAB 1: DELAY REASON ────────
        print("[4/8] Filling delay reason & state...")
        try:
            page.fill("#ContentPlaceHolder1_txtresiondelay", "Due to severe psychological trauma and fear of retaliation.")
        except:
            pass

        # ──────── TAB 1: STATE & DISTRICT ────────
        try:
            page.select_option("select#ContentPlaceHolder1_ddl_State", index=1)
            page.wait_for_timeout(2000)  # wait for district postback
            page.select_option("select#ContentPlaceHolder1_ddl_District", index=1)
        except Exception as e:
            print(f"  [WARN] State/District: {e}")

        # ──────── TAB 1: INFORMATION SOURCE ────────
        try:
            page.select_option("select#ContentPlaceHolder1_ddl_InformationSource", index=1)
        except:
            pass

        # ──────── TAB 1: ADDITIONAL INFO (min 200 chars) ────────
        print("[5/8] Filling additional information (200+ chars)...")
        long_text = (
            "The victim has been subjected to severe and persistent online harassment "
            "through social media platforms. The perpetrator has been sharing explicit "
            "and inappropriate content without the consent of the victim, causing immense "
            "psychological distress and trauma. The harassment has been ongoing for several "
            "weeks, with multiple episodes of threatening messages, blackmail attempts, "
            "and non-consensual sharing of intimate images. This has caused significant "
            "emotional harm and fear for personal safety."
        )
        try:
            page.fill("#txt_AdditionalInfo", long_text)
        except:
            pass

        # ──────── TAB 1: SCREENSHOT ────────
        page.screenshot(path="diag_tab1_filled.png", full_page=True)
        print("  Screenshot saved: diag_tab1_filled.png")

        # ──────── TAB 1: CLICK SAVE & NEXT ────────
        print("[6/8] Clicking SAVE & NEXT on Tab 1...")
        try:
            page.click("#ContentPlaceHolder1_btnNext", timeout=10000)
            page.wait_for_timeout(8000)  # generous wait for Tab 2
        except Exception as e:
            print(f"  [ERR] SAVE & NEXT failed: {e}")
            # Check for validation errors
            try:
                errors = page.locator(".field-validation-error, .validation-summary-errors, span[style*='color:Red'], span[style*='color:red']").all_text_contents()
                if errors:
                    print(f"  Validation errors found: {errors}")
            except:
                pass

        page.screenshot(path="diag_after_tab1_next.png", full_page=True)
        print("  Screenshot saved: diag_after_tab1_next.png")

        # ──────── TAB 2: DUMP ALL FIELDS ────────
        print("[7/8] Scanning Tab 2 for all interactive elements...")
        fields = []
        for tag in ["input", "select", "textarea"]:
            elements = page.locator(tag).all()
            for el in elements:
                try:
                    el_id = el.get_attribute("id") or ""
                    el_name = el.get_attribute("name") or ""
                    el_type = el.get_attribute("type") or tag
                    el_visible = el.is_visible()
                    
                    if el_id and "ContentPlaceHolder1" in el_id and el_visible:
                        fields.append({
                            "tag": tag,
                            "id": el_id,
                            "name": el_name,
                            "type": el_type,
                        })
                except:
                    pass

        print(f"\n{'='*60}")
        print(f"  Found {len(fields)} visible ContentPlaceHolder1 fields:")
        print(f"{'='*60}")
        for f in fields:
            print(f"  [{f['tag'].upper():8s}] id={f['id']:<60s} type={f['type']}")
        print(f"{'='*60}\n")

        # Save to JSON for reference
        with open("tab2_fields.json", "w") as fp:
            json.dump(fields, fp, indent=2)
        print("  Field map saved: tab2_fields.json")

        # ──────── DONE ────────
        print("[8/8] Diagnostic complete. Holding browser for 60s...")
        page.wait_for_timeout(60000)
        browser.close()

if __name__ == "__main__":
    run_diagnostic()
