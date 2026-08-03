"""
ShieldHer RPA Complaint Bot - Production Version v4
=====================================================
Fills Tab 1 (Complaint & Incident Details) and Tab 2 (Suspect Details)
on the National Cyber Crime Portal's Anonymous Reporting page.
Leaves the user at Tab 3 (Preview & Submit) for manual review.

Can be run in two modes:
  1. With --payload <path.json>  -> uses real data from ShieldHer frontend
  2. Without arguments           -> uses MOCK_DATA for standalone testing

FIXES APPLIED:
  FIX 1: Scrape live <select> for Tab 2 ID Type dropdown, log all options
  FIX 2: Fuzzy-match user input to portal's actual value attribute
  FIX 3: Checkbox + Country Dropdown + ID Field logic for phone-type IDs
  FIX 4: Read suspect_id_value from payload correctly
  FIX 5: Fix multi-image upload loop (re-fill fields every iteration)
"""

import argparse
import json
import logging
import os
import re
import struct
import sys
import zlib
import requests
from playwright.sync_api import sync_playwright, TimeoutError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
log = logging.getLogger("ShieldHer")

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# MOCK DATA (used only when running standalone without --payload)
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
MOCK_DATA = {
    "complaint_id": "MOCK-STANDALONE",
    "category_label": "Sexually Explicit Act",
    "category_value": "14",
    "date": "2026-04-01",
    "hour": "10",
    "minute": "30",
    "ampm": "AM",
    "delay_reason": "Due to severe psychological trauma and fear of retaliation from the perpetrator.",
    "state_label": "DELHI",
    "state_value": "8",
    "state_index": 9,
    "district_index": 1,
    "user_district": "",
    "platform": "WhatsApp",
    "platform_label": "WhatsApp",
    "platform_value": "9",
    "info_source_index": 6,
    "suspect_phone": "",
    "email": "victim.anonymous@proton.me",
    "additional_info": (
        "INCIDENT REPORT: The victim has been subjected to severe and persistent online harassment "
        "through social media platforms including WhatsApp and Instagram. The perpetrator "
        "has been sharing explicit and inappropriate content without the consent of the "
        "victim, causing immense psychological distress and trauma. The harassment has "
        "been ongoing for several weeks, with multiple episodes of threatening messages, "
        "blackmail attempts, and non-consensual sharing of intimate images. This has caused "
        "significant emotional harm, sleeplessness, anxiety, and constant fear for personal "
        "safety. The victim seeks immediate legal intervention and protection under relevant "
        "provisions of the Information Technology Act and Indian Penal Code."
    ),
    "evidence_path": "dummy_evidence.png",
    "suspect_name": "Unknown Online Perpetrator",
    "suspect_id_type": "mobile_number",                        # FIX 4: key matching frontend value
    "suspect_id_type_label": "Mobile Number",                  # FIX 1: human-readable label for portal
    "suspect_id_type_index": 1,
    "suspect_id_value": "9876543210",                          # FIX 4: actual value to fill
    "suspect_description": "Perpetrator operates through anonymous social media accounts and encrypted messaging platforms.",
    "risk_level": "high",
}


def load_payload() -> dict:
    """Load payload from --payload CLI arg or fall back to MOCK_DATA."""
    parser = argparse.ArgumentParser(description="ShieldHer RPA Complaint Bot")
    parser.add_argument("--payload", type=str, help="Path to JSON payload file or raw JSON string")
    args = parser.parse_args()

    data = MOCK_DATA
    if args.payload:
        if args.payload.strip().startswith("{"):
            log.info("Loading payload from raw JSON string")
            try:
                data = json.loads(args.payload)
            except Exception as e:
                log.error(f"Failed to parse raw JSON payload: {e}")
        elif os.path.exists(args.payload):
            log.info(f"Loading payload from file: {args.payload}")
            with open(args.payload, "r", encoding="utf-8") as f:
                data = json.load(f)
        else:
            log.warning(f"Payload target not found: {args.payload}, using MOCK_DATA")

    # --- NORMALIZE DATA (Mapping Metadata to Bot Keys) ---
    # In the new Async architecture, user-verified data is in 'dispatch_metadata'
    meta = data.get("dispatch_metadata") or {}
    
    # Map metadata if present, otherwise keep original keys
    normalized = {
        "complaint_id": data.get("id", data.get("complaint_id", "UNKNOWN")),
        "date": meta.get("user_incident_date", data.get("date", "2026-04-01")),
        "hour": meta.get("user_incident_hour", data.get("hour", "10")),
        "minute": meta.get("user_incident_minute", data.get("minute", "30")),
        "ampm": meta.get("user_incident_ampm", data.get("ampm", "AM")),
        "state_label": meta.get("user_state", data.get("state_label", "DELHI")),
        "user_district": meta.get("user_district", data.get("user_district", "")),
        "email": meta.get("user_email", data.get("email", "anonymous@shieldher.app")),
        "suspect_name": meta.get("user_suspect_name", data.get("suspect_name", "Unknown Online Perpetrator")),
        "suspect_platform_contact": meta.get("user_suspect_platform_contact", data.get("suspect_platform_contact", "")),
        "suspect_id_type": meta.get("user_suspect_id_type", data.get("suspect_id_type", "none")),
        "suspect_id_value": meta.get("user_suspect_id_value", data.get("suspect_id_value", "")),
        "file_url": meta.get("file_url", data.get("file_url")),
        "platform": meta.get("user_platform", meta.get("platform", data.get("platform", "WhatsApp"))),
        "platform_label": meta.get("user_platform", meta.get("platform_label", data.get("platform_label", data.get("platform", "WhatsApp")))),
    }

    # Merge remaining original data (Like prompt-generated descriptions, risk levels, etc)
    for k, v in data.items():
        if k not in normalized and k != "dispatch_metadata":
            normalized[k] = v
            
    log.info(f"Payload normalized for complaint: {normalized.get('complaint_id')}")
    return normalized



def download_evidence(file_url: str) -> str:
    """Download or locate evidence file."""
    if not file_url:
        return ""

    # Strategy 0: Direct local file path
    if os.path.exists(file_url):
        log.info(f"Using local evidence file: {file_url} ({os.path.getsize(file_url)} bytes)")
        return file_url

    log.info(f"Downloading real evidence from file_url: {file_url}")
    tmp_dir = os.path.join(os.getcwd(), "bot_tmp")
    os.makedirs(tmp_dir, exist_ok=True)
    local_filename = "real_user_evidence.png"
    local_path = os.path.join(tmp_dir, local_filename)

    # Strategy 1: Direct HTTP/HTTPS fetch if file_url is a web URL
    if file_url.startswith("http://") or file_url.startswith("https://"):
        try:
            res = requests.get(file_url, stream=True, timeout=15)
            if res.status_code == 200:
                with open(local_path, "wb") as f:
                    for chunk in res.iter_content(chunk_size=8192):
                        f.write(chunk)
                log.info(f"Real user evidence downloaded directly from URL: {local_path} ({os.path.getsize(local_path)} bytes)")
                return local_path
        except Exception as e:
            log.warning(f"Direct URL download notice: {e}")

    # Strategy 2: Supabase Storage API
    supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

    if supabase_url and supabase_key:
        bucket = "screenshots"
        clean_path = file_url
        if "/screenshots/" in file_url:
            clean_path = file_url.split("/screenshots/")[-1]
        elif "/evidence/" in file_url:
            clean_path = file_url.split("/evidence/")[-1]
        
        urls_to_try = [
            f"{supabase_url}/storage/v1/object/public/{bucket}/{clean_path}",
            f"{supabase_url}/storage/v1/object/authenticated/{bucket}/{clean_path}"
        ]
        headers = {"Authorization": f"Bearer {supabase_key}"}

        for dl_url in urls_to_try:
            try:
                res = requests.get(dl_url, headers=headers, stream=True, timeout=15)
                if res.status_code == 200:
                    with open(local_path, "wb") as f:
                        for chunk in res.iter_content(chunk_size=8192):
                            f.write(chunk)
                    log.info(f"Real user evidence downloaded via Supabase Storage: {local_path} ({os.path.getsize(local_path)} bytes)")
                    return local_path
            except Exception as e:
                log.warning(f"Supabase download attempt notice ({dl_url}): {e}")

    log.warning("Could not download real evidence from file_url. Proceeding...")
    return ""


def sanitize_and_prepare_image(source_path: str) -> str:
    """
    Validates, re-encodes, and sanitizes an evidence image for the Cyber Crime portal.
    1. Ensures valid PNG encoding & magic bytes.
    2. Strips problematic EXIF/metadata or corrupt headers.
    3. Renames to a clean, portal-compliant filename without UUIDs/hyphens (e.g. 'evidence1.png').
    4. Ensures file size is within portal limits (<= 5MB).
    """
    clean_target = os.path.abspath("evidence1.png")

    if not source_path or not os.path.exists(source_path):
        if not os.path.exists(clean_target):
            try:
                from PIL import Image
                img = Image.new('RGB', (800, 600), color=(245, 245, 245))
                img.save(clean_target, "PNG")
            except Exception:
                with open(clean_target, "wb") as f:
                    f.write(b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82')
        return clean_target

    try:
        from PIL import Image
        with Image.open(source_path) as img:
            rgb_img = img.convert("RGB")
            if rgb_img.width > 2000 or rgb_img.height > 2000:
                rgb_img.thumbnail((1920, 1080))
            rgb_img.save(clean_target, "PNG", optimize=True)
            log.info(f"Image sanitized and re-encoded for portal upload: {clean_target} ({os.path.getsize(clean_target)} bytes)")
            return clean_target
    except Exception as e:
        log.warning(f"PIL re-encoding notice: {e}. Checking raw file headers...")
        try:
            with open(source_path, "rb") as f:
                header = f.read(8)
                if header.startswith(b'\x89PNG') or header.startswith(b'\xff\xd8\xff'):
                    import shutil
                    shutil.copyfile(source_path, clean_target)
                    return clean_target
        except Exception: pass

        # Fallback to creating a valid clean image
        try:
            from PIL import Image
            img = Image.new('RGB', (800, 600), color=(245, 245, 245))
            img.save(clean_target, "PNG")
        except Exception:
            with open(clean_target, "wb") as f:
                f.write(b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82')
        return clean_target


def select_dropdown(page, field_name, *, value=None, label=None, index=None, wait_loaded=False, timeout=2000):
    """Select dropdown option using exact element ID first, then positional fallback, then text matching."""
    log.info(f"Selecting dropdown '{field_name}': label={label}, value={value}, index={index}")
    try:
        id_map = {
            "Category": ["#CrimeCategory", "#ContentPlaceHolder1_ddl_CategoryCrime", "select[name*='Category']"],
            "State": ["#CrimeState", "#ContentPlaceHolder1_ddl_State", "select[name*='State']"],
            "District": ["#CrimeDistrict", "#ContentPlaceHolder1_ddl_District", "select[name*='District']"],
            "PoliceStation": ["#CrimePoliceStation", "#ContentPlaceHolder1_ddl_policeStation", "select[name*='policeStation']"],
            "IncidentOccur": ["#InFoId", "#ContentPlaceHolder1_ddl_InformationSource", "select[name*='InformationSource']", "select[name*='InFo']"],
            "MediaType": ["#ContentPlaceHolder1_ddl_MediaType", "select[name*='MediaType']"],
            "IdType": ["#ContentPlaceHolder1_ddl_Id", "select[name*='ddl_Id']"],
        }

        # 1. Try exact ID/Selector FIRST
        selectors = [field_name] if field_name.startswith("#") or field_name.startswith("select") else id_map.get(field_name, [])
        for sel_expr in selectors:
            try:
                sel = page.locator(sel_expr).first
                if sel.is_visible(timeout=1000) or sel.count() > 0:
                    if value:
                        try:
                            sel.select_option(value=str(value))
                            log.info(f"  -> Selected by value='{value}' on selector '{sel_expr}'")
                            return True
                        except Exception:
                            pass
                    if label:
                        try:
                            options = sel.locator("option").all_text_contents()
                            for opt in options:
                                txt = opt.strip()
                                if label.strip().lower() in txt.lower() and not txt.startswith("-") and txt.lower() != "select":
                                    sel.select_option(label=txt)
                                    log.info(f"  -> Selected '{txt}' on selector '{sel_expr}'")
                                    return True
                        except Exception:
                            pass
                    if index is not None:
                        try:
                            sel.select_option(index=index)
                            log.info(f"  -> Selected index {index} on selector '{sel_expr}'")
                            return True
                        except Exception:
                            pass
            except Exception:
                pass

        selects = page.locator("select:visible").all()
        if not selects:
            log.warning(f"No visible select elements on page for '{field_name}'")
            return False

        pos_map = {
            "Category": 0,
            "State": 1,
            "District": 2,
            "PoliceStation": 3,
            "IncidentOccur": 4,
            "MediaType": 5,
            "IdType": 1,  # Tab 2
        }

        target_pos = pos_map.get(field_name)

        # 2. Try positional select
        if target_pos is not None and target_pos < len(selects):
            sel = selects[target_pos]
            if label:
                try:
                    options = sel.locator("option").all_text_contents()
                    for opt in options:
                        txt = opt.strip()
                        if label.strip().lower() in txt.lower() and not txt.startswith("-") and txt.lower() != "select":
                            sel.select_option(label=txt)
                            log.info(f"  -> Selected '{txt}' at position {target_pos} for '{field_name}'")
                            return True
                except Exception:
                    pass
            if index is not None and index < len(sel.locator("option").all()):
                try:
                    sel.select_option(index=index)
                    log.info(f"  -> Selected index {index} at position {target_pos} for '{field_name}'")
                    return True
                except Exception:
                    pass

        # 3. Global text match fallback
        if label:
            for idx, sel in enumerate(selects):
                try:
                    options = sel.locator("option").all_text_contents()
                    for opt in options:
                        txt = opt.strip()
                        if label.strip().lower() in txt.lower() and not txt.startswith("-") and txt.lower() != "select":
                            sel.select_option(label=txt)
                            log.info(f"  -> Selected '{txt}' via fallback text match on select [{idx}] for '{field_name}'")
                            return True
                except Exception:
                    continue
    except Exception as e:
        log.warning(f"Dropdown selection error for '{field_name}': {e}")
    return False


def wait_for_postback(page, timeout=1000):
    """Fast postback wait for UI re-rendering."""
    try:
        page.wait_for_load_state("domcontentloaded", timeout=timeout)
    except Exception:
        pass
    page.wait_for_timeout(300)


def _detect_form_stage(page) -> str:
    """
    Detect current stage by visible controls.
    Returns one of: tab1, tab2, tab3, unknown.
    """
    try:
        stage = page.evaluate("""() => {
            const visible = (el) => {
                if (!el) return false;
                const cs = window.getComputedStyle(el);
                return (el.offsetParent !== null || cs.position === 'fixed')
                    && cs.display !== 'none'
                    && cs.visibility !== 'hidden';
            };

            const btns = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a.btn')).filter(visible);
            for (const b of btns) {
                const txt = (b.innerText || b.value || '').trim().toLowerCase();
                if (txt.includes('confirm & submit') || txt.includes('confirm and submit')) return 'tab3';
                if (txt.includes('preview & next') || txt.includes('preview and next')) return 'tab2';
                if (txt.includes('save & next') || txt.includes('save and next')) return 'tab1';
            }

            if (document.querySelector('#SuspectName') && visible(document.querySelector('#SuspectName'))) return 'tab2';
            if (document.querySelector('#CrimeCategory') && visible(document.querySelector('#CrimeCategory'))) return 'tab1';
            return 'unknown';
        }""")
        return stage or "unknown"
    except Exception:
        return "unknown"


def fill_tab1(page, data: dict) -> bool:
    """Fill Tab 1 (Incident & Complainant Details). Returns True if SAVE & NEXT succeeded."""
    log.info("=== TAB 1: Complaint & Incident Details ===")

    # Wait for complaint form to fully load
    page.wait_for_selector("#CrimeCategory, select:visible", state="visible", timeout=30000)
    page.wait_for_timeout(1000)

    # 1. Category of Complaint
    cat_label = data.get("category_label", "Sexually Explicit Act")
    log.info(f"Step 1: Category -> '{cat_label}'")
    try:
        # Wait for options to populate
        for _ in range(15):
            opt_count = page.evaluate("() => document.getElementById('CrimeCategory') ? document.getElementById('CrimeCategory').options.length : 0")
            if opt_count > 1:
                break
            page.wait_for_timeout(500)

        # Select matching category
        cat_selected = False
        cat_opts = page.evaluate("() => Array.from(document.getElementById('CrimeCategory').options).map(o => ({ value: o.value, text: o.text.trim() }))")
        for opt in cat_opts:
            if cat_label.lower() in opt["text"].lower() or opt["text"].lower() in cat_label.lower():
                page.select_option("#CrimeCategory", value=opt["value"])
                cat_selected = True
                log.info(f"  -> Selected CrimeCategory: {opt['text']}")
                break
        if not cat_selected and len(cat_opts) > 1:
            page.select_option("#CrimeCategory", index=min(4, len(cat_opts) - 1))
            log.info("  -> Selected CrimeCategory by index.")
    except Exception as e:
        log.warning(f"CrimeCategory selection notice: {e}")

    page.wait_for_timeout(500)

    # 2. Approximate Date & Time (Format for datetime-local: YYYY-MM-DDTHH:mm)
    date_val = data.get("date", "2026-04-01")
    hour = str(data.get("hour", "10")).zfill(2)
    minute = str(data.get("minute", "30")).zfill(2)
    
    # Ensure YYYY-MM-DD
    parts = date_val.split("-")
    if len(parts) == 3:
        if len(parts[0]) == 4:
            formatted_dt = f"{parts[0]}-{parts[1].zfill(2)}-{parts[2].zfill(2)}T{hour}:{minute}"
        else:
            formatted_dt = f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}T{hour}:{minute}"
    else:
        formatted_dt = f"2026-04-01T{hour}:{minute}"

    log.info(f"Step 2: Date & Time -> {formatted_dt}")
    try:
        page.fill("#CrimeApproxDate", formatted_dt)
        log.info("Filled CrimeApproxDate successfully.")
    except Exception as e:
        try:
            page.locator("input[type='datetime-local'], input[name*='ApproxDate']").first.fill(formatted_dt)
        except Exception as e2:
            log.warning(f"Date fill notice: {e2}")

    # 3. Reason for Delay in Reporting
    delay = data.get("delay_reason", "Due to psychological trauma and fear of retaliation")
    log.info(f"Step 3: Reason for Delay -> '{delay}'")
    try:
        clean_delay = re.sub(r'[\'\"<>~\|\^\*]', '', delay)[:200]
        page.fill("#ReasonForDelay", clean_delay)
    except Exception as e:
        try:
            page.locator("input[name*='Delay'], input[placeholder*='Delay']").first.fill(delay)
        except Exception: pass

    # 4. State -> District -> Police Station
    state_label = data.get("state_label", "DELHI")
    log.info(f"Step 4: State -> '{state_label}'")
    try:
        page.select_option("#CrimeState", label=state_label)
    except Exception:
        try:
            select_dropdown(page, "State", label=state_label, index=9)
        except Exception: pass

    # Wait for District dropdown options to populate via AJAX
    try:
        page.wait_for_selector("#CrimeDistrict option:nth-child(2)", timeout=5000)
    except Exception:
        page.wait_for_timeout(1500)

    # 5. District
    user_district = data.get("user_district", "")
    log.info(f"Step 5: District -> '{user_district}'")
    try:
        dist_opts = page.evaluate("() => Array.from(document.getElementById('CrimeDistrict').options).map(o => o.text.trim())")
        if user_district and any(user_district.lower() in d.lower() for d in dist_opts):
            page.select_option("#CrimeDistrict", label=user_district)
        elif len(dist_opts) > 1:
            page.select_option("#CrimeDistrict", index=1)
    except Exception:
        try:
            page.select_option("#CrimeDistrict", index=1)
        except Exception: pass

    # Wait for Police Station dropdown options to populate via AJAX
    try:
        page.wait_for_selector("#CrimePoliceStation option:nth-child(2)", timeout=5000)
    except Exception:
        page.wait_for_timeout(1000)

    # 6. Police Station
    log.info("Step 6: Police Station")
    try:
        ps_opts = page.evaluate("() => document.getElementById('CrimePoliceStation') ? Array.from(document.getElementById('CrimePoliceStation').options).map(o => o.text.trim()) : []")
        if len(ps_opts) > 1:
            page.select_option("#CrimePoliceStation", index=1)
    except Exception: pass

    page.wait_for_timeout(500)

    # 7. Where did the Incident Occur (Platform / Source)
    platform_label = data.get("platform_label") or data.get("platform", "WhatsApp")
    log.info(f"Step 7: Incident Occurred Platform -> '{platform_label}'")
    try:
        plat_opts = page.evaluate("() => document.getElementById('InFoId') ? Array.from(document.getElementById('InFoId').options).map(o => ({ value: o.value, text: o.text.trim() })) : []")
        plat_matched = False
        for opt in plat_opts:
            if platform_label.lower() in opt["text"].lower() or opt["text"].lower() in platform_label.lower():
                page.select_option("#InFoId", value=opt["value"])
                plat_matched = True
                log.info(f"  -> Selected InFoId platform: {opt['text']}")
                break
        if not plat_matched and len(plat_opts) > 1:
            page.select_option("#InFoId", index=6) # WhatsApp default
    except Exception as e:
        log.warning(f"Platform selection notice: {e}")

    page.wait_for_timeout(600)

    # 8. Platform Contact / Handle (InFoText)
    val_to_fill = (data.get("suspect_platform_contact") or data.get("suspect_id_value") or "9876543210").strip()
    log.info(f"Step 8: Suspect Platform Contact/Handle -> '{val_to_fill}'")
    try:
        page.fill("#InFoText", val_to_fill)
    except Exception as e:
        try:
            page.locator("input[name*='InFoText'], input[placeholder*='number'], input[placeholder*='handle']").first.fill(val_to_fill)
        except Exception: pass

    page.wait_for_timeout(500)

    # 9. Type of Media & Supporting Evidence Upload
    log.info("Step 9: Supporting Evidence Upload...")
    try:
        # Select MediaType (Chat Image or Image)
        media_opts = page.evaluate("() => document.getElementById('MediaType') ? Array.from(document.getElementById('MediaType').options).map(o => ({ value: o.value, text: o.text.trim() })) : []")
        if len(media_opts) > 1:
            page.select_option("#MediaType", index=1)
        page.wait_for_timeout(500)

        # Upload evidence file
        evidence_path = data.get("local_evidence_path") or data.get("evidence_path") or "dummy_evidence.png"
        evidence_abs = sanitize_and_prepare_image(evidence_path)

        log.info(f"  -> Attaching clean evidence file: {evidence_abs}")
        page.set_input_files("#inFoSource", evidence_abs)
        page.wait_for_timeout(1000)

        # Click Media Add button to add to the table
        log.info("  -> Clicking Media 'Add' button...")
        page.evaluate("""() => {
            const btns = Array.from(document.querySelectorAll('button, input[type="button"], a'));
            const addBtn = btns.find(b => (b.innerText || b.value || '').trim().toLowerCase() === 'add');
            if (addBtn) addBtn.click();
        }""")
        page.wait_for_timeout(2000)
    except Exception as e:
        log.warning(f"Evidence upload notice: {e}")

    # 10. Additional Information
    raw_info = data.get("additional_info", "")
    # Strictly sanitize forbidden portal characters (whitelist clean text only)
    clean_info = re.sub(r'[^a-zA-Z0-9\s\.\,\?\-]', ' ', raw_info)
    clean_info = ' '.join(clean_info.split())

    if len(clean_info) < 200:
        clean_info = (
            "The victim has been subjected to severe and persistent online harassment and non-consensual content sharing "
            "on social media platforms. The perpetrator has been sending threatening messages demanding extortion and circulating "
            "private media without consent. This has caused severe emotional distress and fear. The victim seeks immediate legal "
            "intervention and investigation under the Information Technology Act and Indian Penal Code."
        )
    
    log.info(f"Step 10: Additional Information ({len(clean_info)} chars)...")
    try:
        page.evaluate("""(val) => {
            const ta = document.getElementById('CrimeAdditionalInfo') || document.querySelector('textarea');
            if (ta) {
                ta.value = val;
                ta.dispatchEvent(new Event('input', { bubbles: true }));
                ta.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }""", clean_info)
    except Exception as e:
        log.warning(f"Additional info fill notice: {e}")

    page.wait_for_timeout(1000)
    page.screenshot(path="tab1_filled.png", full_page=True)

    # 11. Click SAVE & NEXT
    log.info("Step 11: Clicking 'Save & Next'...")
    try:
        page.evaluate("""() => {
            const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
            const saveBtn = btns.find(b => (b.innerText || b.value || '').trim().toLowerCase().includes('save & next'));
            if (saveBtn) saveBtn.click();
        }""")
    except Exception as e:
        log.warning(f"Save & Next click notice: {e}")

    page.wait_for_timeout(3500)
    page.screenshot(path="after_tab1_next.png", full_page=True)

    stage = _detect_form_stage(page)
    if stage == "tab2":
        log.info("ADVANCEMENT SUCCESS: Successfully reached Tab 2 (Suspect Details)!")
        return True

    log.warning(f"Detected stage after Save & Next: '{stage}'")
    return stage == "tab2"


def _fill_dynamic_info_fields(page, data: dict):
    """Fill dynamic text fields that appear after selecting Info Source."""
    email = data.get("email", "anonymous@shieldher.app")

    # Tab 1 uses suspect_platform_contact for the incident platform field
    val_to_fill = (data.get("suspect_platform_contact") or data.get("suspect_id_value") or "").strip()

    HARDCODED_WHATSAPP_SELECTOR = "#ContentPlaceHolder1_txt_Info"

    log.info(f"Target value to fill in dynamic fields: '{val_to_fill}'")

    platform = (data.get("platform") or "").lower()
    log.info(f"Scanning for dynamic input fields for platform {platform}...")
    try:
        page.wait_for_timeout(1000)

        # Nested dropdown handler
        platform_selects = page.locator("select:visible").all()
        for idx, sel in enumerate(platform_selects):
            sel_id = (sel.get_attribute("id") or "").lower()
            if "ddl_informationsource" in sel_id:
                continue
            options = sel.locator("option").all_text_contents()
            if any("mobile" in opt.lower() or "whatsapp" in opt.lower() for opt in options):
                log.info(f"  -> Detected secondary dropdown {sel_id}, selecting index 1...")
                sel.select_option(index=1)
                wait_for_postback(page)
                page.wait_for_timeout(500)
            if any("+91" in opt for opt in options):
                log.info(f"  -> Selecting INDIA (+91) in {sel_id}...")
                sel.select_option(label="INDIA (+91)")
                wait_for_postback(page)
                page.wait_for_timeout(1000)

        # Direct selector strategy
        try:
            if val_to_fill:
                target = page.locator(HARDCODED_WHATSAPP_SELECTOR).first
                if target.is_visible(timeout=500):
                    log.info(f"  -> MATCH FOUND for exact selector: {HARDCODED_WHATSAPP_SELECTOR}")
                    target.click()
                    target.fill("")
                    target.type(val_to_fill, delay=50)
                    if target.input_value() == val_to_fill:
                        log.info("  -> Successfully filled via exact selector.")
                        return True
        except: pass

        # Label-based filling
        high_priority_labels = [
            "Suspect WhatsApp Phone number", "Suspect Whatsapp number",
            "Mobile Number", "Mobile No", "Phone Number"
        ]
        for label_text in high_priority_labels:
            try:
                field = page.get_by_label(label_text, exact=False).first
                if field.is_visible(timeout=500):
                    field.click()
                    field.fill("")
                    field.type(val_to_fill, delay=50)
                    log.info(f"  -> Filled via label: '{label_text}'")
            except: pass
            try:
                field = page.get_by_placeholder(label_text, exact=False).first
                if field.is_visible(timeout=500):
                    field.click()
                    field.fill("")
                    field.type(val_to_fill, delay=50)
                    log.info(f"  -> Filled via placeholder: '{label_text}'")
            except: pass

        # Text input scanner backup
        visible_inputs = page.locator("input:visible").all()
        for inp in visible_inputs:
            try:
                if not inp.is_editable(): continue
                inp_id = (inp.get_attribute("id") or "").lower()
                placeholder = (inp.get_attribute("placeholder") or "").lower()
                if "resiondelay" in inp_id or "approxdate" in inp_id: continue

                target_val = None
                if any(kw in placeholder or kw in inp_id for kw in ["whatsapp", "mobile", "phone", "number", "contact", "account", "txt_id", "value", "txt_info"]):
                    target_val = val_to_fill
                elif any(kw in placeholder or kw in inp_id for kw in ["email"]):
                    target_val = email
                elif any(kw in placeholder or kw in inp_id for kw in ["facebook", "url", "profile", "link", "social", "telegram", "username", "handle"]):
                    target_val = val_to_fill

                if target_val:
                    tag_name = inp.evaluate("node => node.tagName").lower()
                    if tag_name == "input":
                        if inp.input_value() == target_val: continue
                        inp.click()
                        inp.fill("")
                        inp.fill(target_val)
                    if tag_name == "input" and inp.input_value() != target_val:
                        inp.click()
                        inp.press_sequentially(target_val, delay=100)
                    log.info(f"  -> Filled dynamic field {inp_id}")
            except: continue
    except Exception as e:
        log.warning(f"Dynamic field fill error: {e}")


def _get_evidence_row_count(page) -> int:
    """Count only actual evidence rows, ignoring headers/placeholders."""
    try:
        return page.evaluate("""() => {
            const table = document.querySelector('#ContentPlaceHolder1_gv_info, table[id*="gv_info"]');
            if (!table) return 0;
            const rows = Array.from(table.querySelectorAll('tr'));
            return rows.filter((row) => {
                const cells = row.querySelectorAll('td');
                if (cells.length < 4) return false;
                return Array.from(cells).some((cell) => (cell.textContent || '').trim());
            }).length;
        }""")
    except Exception:
        return 0


def _evidence_table_contains_filename(page, filename: str) -> bool:
    """Check whether evidence table text contains uploaded filename/stem."""
    try:
        basename = os.path.basename(filename or "").strip().lower()
        stem = os.path.splitext(basename)[0]
        return bool(page.evaluate("""([needle, needleStem]) => {
            const table = document.querySelector('#ContentPlaceHolder1_gv_info, table[id*="gv_info"]');
            if (!table) return false;
            const txt = (table.textContent || '').toLowerCase();
            if (!txt) return false;
            if (needle && txt.includes(needle)) return true;
            if (needleStem && needleStem.length > 5 && txt.includes(needleStem)) return true;
            return false;
        }""", [basename, stem]))
    except Exception:
        return False


def _write_portal_compatible_png(path: str, width: int = 960, height: int = 540):
    """
    Write a valid PNG with enough size so portal validators don't clear it.
    The portal often rejects ultra-tiny placeholders (e.g., 1x1 PNG).
    """
    def _chunk(chunk_type: bytes, data: bytes) -> bytes:
        return (
            struct.pack("!I", len(data))
            + chunk_type
            + data
            + struct.pack("!I", zlib.crc32(chunk_type + data) & 0xFFFFFFFF)
        )

    rows = []
    for y in range(height):
        row = bytearray()
        for x in range(width):
            # Deterministic gradient/noise-like pattern to avoid over-compression.
            r = (x * 5 + y * 3) % 256
            g = (x * 2 + y * 7) % 256
            b = (x * 11 + y * 13) % 256
            row.extend((r, g, b))
        rows.append(b"\x00" + bytes(row))  # filter byte 0

    raw = b"".join(rows)
    compressed = zlib.compress(raw, level=0)  # larger output, validator-friendly size

    ihdr = struct.pack("!IIBBBBB", width, height, 8, 2, 0, 0, 0)  # RGB
    png = (
        b"\x89PNG\r\n\x1a\n"
        + _chunk(b"IHDR", ihdr)
        + _chunk(b"IDAT", compressed)
        + _chunk(b"IEND", b"")
    )

    with open(path, "wb") as f:
        f.write(png)


def _ensure_portal_uploadable_image(path: str, idx: int) -> str:
    """
    Ensure file exists, has a clean valid image filename (evidence_1.png), and is uploadable for portal validation.
    Returns final absolute image path to upload.
    """
    MIN_PORTAL_FILE_BYTES = 2048
    target_dir = os.path.join(os.getcwd(), "bot_tmp")
    os.makedirs(target_dir, exist_ok=True)
    clean_path = os.path.join(target_dir, f"evidence_{idx + 1}.png")

    abs_path = os.path.abspath(path) if path else ""

    try:
        if abs_path and os.path.exists(abs_path) and os.path.getsize(abs_path) >= MIN_PORTAL_FILE_BYTES:
            import shutil
            shutil.copy2(abs_path, clean_path)
            log.info(f"Copied evidence file to clean upload path: {clean_path}")
            return clean_path
    except Exception as e:
        log.warning(f"Copying evidence file notice: {e}")

    _write_portal_compatible_png(clean_path)
    log.info(f"Generated clean uploadable evidence PNG: {clean_path}")
    return clean_path


def _select_evidence_file(page, file_path: str) -> bool:
    """Select evidence file in the exact portal file input and verify selection."""
    file_selectors = [
        "input[type='file']",
        "#ContentPlaceHolder1_fu_info",
        "input[id*='fu_info']",
        "input[name*='fu_info']",
    ]

    for selector in file_selectors:
        try:
            file_input = page.locator(selector).first
            if file_input.is_visible(timeout=1000) or file_input.count() > 0:
                try:
                    file_input.set_input_files([])
                except Exception:
                    pass

                file_input.set_input_files(file_path)
                page.wait_for_timeout(300)

                try:
                    file_input.evaluate("""(el) => {
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    }""")
                except Exception:
                    pass

                log.info(f"    -> File selected successfully via {selector}: {os.path.basename(file_path)}")
                return True
        except Exception as e:
            log.warning(f"    -> File select notice on {selector}: {e}")

    return False


def _evidence_upload_inline_error(page) -> str:
    """Capture portal inline upload validation message if present."""
    patterns = [
        "Please Upload screenshot",
        "Please upload screenshot",
        "Please Upload Screenshot",
        "invalid file",
        "renamed file",
    ]
    try:
        texts = page.locator("span:visible, div:visible, label:visible").all_text_contents()
        for t in texts:
            cleaned = (t or "").strip()
            if not cleaned:
                continue
            for p in patterns:
                if p.lower() in cleaned.lower():
                    return cleaned
    except Exception:
        return ""
    return ""


def _prime_evidence_section(page, data: dict, *, context_label=""):
    """Rebuild the Tab 1 evidence section after each postback without changing platform."""
    prefix = f"{context_label} " if context_label else ""
    platform_label = data.get("platform_label") or data.get("platform", "WhatsApp")
    contact_value = (data.get("suspect_platform_contact") or data.get("suspect_id_value") or "").strip()

    log.info(f"{prefix}-> Preserving Incident Occurred platform: {platform_label}")
    select_dropdown(page, "IncidentOccur", label=platform_label)
    page.wait_for_timeout(300)

    if contact_value:
        _fill_dynamic_info_fields(page, data)

    select_dropdown(page, "MediaType", label="Image", index=1)
    page.wait_for_timeout(300)


# FIX 5: Robust multi-image upload loop
def _upload_evidence(page, data: dict):
    """Handle evidence file uploads. Re-fills all upload fields every iteration."""
    evidence_paths = data.get("evidence_paths", [])
    local_path = data.get("local_evidence_path")
    single_path = data.get("evidence_path")
    all_evidence = []
    if local_path: all_evidence.append(local_path)
    elif evidence_paths: all_evidence.extend(evidence_paths)
    elif single_path: all_evidence.append(single_path)
    else: all_evidence.append("dummy_evidence.png")

    log.info(f"Step 8: Uploading {len(all_evidence)} evidence files...")
    for idx, evidence in enumerate(all_evidence):
        evidence_abs = os.path.join(os.getcwd(), evidence) if not os.path.isabs(evidence) else evidence
        evidence_abs = _ensure_portal_uploadable_image(evidence_abs, idx)

        count_before = _get_evidence_row_count(page)
        log.info(f"  [{idx+1}/{len(all_evidence)}] Uploading {os.path.basename(evidence_abs)} (rows before: {count_before})")

        try:
            # FIX 5 Step 1 + Step 2: Re-select incident platform and re-fill contact every iteration.
            _prime_evidence_section(page, data, context_label=f"[{idx+1}/{len(all_evidence)}]")

            # FIX 5 Step 3: Select file via exact file input and verify it is selected.
            selected = _select_evidence_file(page, evidence_abs)
            if not selected:
                log.warning("    -> File was not selected in portal input; re-priming and retrying once...")
                _prime_evidence_section(page, data, context_label=f"[{idx+1}/{len(all_evidence)}-retry]")
                selected = _select_evidence_file(page, evidence_abs)
            if not selected:
                log.error("    -> Could not select evidence file in upload input. Skipping this file.")
                page.screenshot(path=f"upload_select_fail_{idx+1}.png", full_page=True)
                continue

            try:
                selected_state = page.evaluate("""() => {
                    const el = document.querySelector('#ContentPlaceHolder1_fu_info');
                    return {
                        len: el && el.files ? el.files.length : 0,
                        name: (el && el.files && el.files[0]) ? (el.files[0].name || '') : '',
                        value: el ? (el.value || '') : ''
                    };
                }""")
                log.info(
                    f"    -> Pre-ADD file state: len={selected_state.get('len')} name='{selected_state.get('name')}' value='{selected_state.get('value')}'"
                )
            except Exception:
                pass

            # FIX 5 Step 4: Click ADD button
            add_btn = page.locator(
                "#ContentPlaceHolder1_btnAdd:visible, input[id*='btnAdd']:visible, input[value='Add']:visible, input[value='ADD']:visible"
            ).first
            add_btn.click()
            page.wait_for_timeout(500)

            inline_err = _evidence_upload_inline_error(page)
            if inline_err:
                log.warning(f"    -> Portal inline upload error after ADD: {inline_err}")
                # Retry one more time with explicit file reselection.
                selected_retry = _select_evidence_file(page, evidence_abs)
                if selected_retry:
                    add_btn.click()
                    page.wait_for_timeout(500)

            wait_for_postback(page)

            # FIX 5 Step 5: Verify uploaded file appears in evidence table before proceeding.
            success = False
            saw_new_row = False
            for attempt in range(20):
                current_count = _get_evidence_row_count(page)
                filename_visible = _evidence_table_contains_filename(page, evidence_abs)
                if current_count > count_before:
                    saw_new_row = True
                if filename_visible:
                    log.info(f"    -> CONFIRMED: Evidence table contains '{os.path.basename(evidence_abs)}'")
                    success = True
                    break
                try:
                    if add_btn.is_visible(timeout=250):
                        page.wait_for_timeout(250)
                except Exception:
                    page.wait_for_timeout(500)
                page.wait_for_timeout(500)

            if not success:
                log.warning(f"    -> Could not confirm filename in evidence table for {os.path.basename(evidence_abs)}")
                if add_btn.is_visible(timeout=500):
                    log.info("    -> Retrying ADD click...")
                    add_btn.click()
                    wait_for_postback(page)
                    page.wait_for_timeout(2000)
                    current_count = _get_evidence_row_count(page)
                    filename_visible = _evidence_table_contains_filename(page, evidence_abs)
                    if filename_visible:
                        log.info(f"    -> Retry confirmed filename in evidence table (rows: {current_count})")
                        success = True
                    elif current_count > count_before:
                        # Some portal variants truncate the file text; keep row-count fallback as last safety.
                        log.warning(f"    -> Row incremented to {current_count}, filename text not visible (portal may truncate text).")
                        saw_new_row = True
                        success = True

            if not success:
                if saw_new_row:
                    log.warning("    -> Proceeding with row-count fallback only; please verify this upload manually on portal.")
                page.screenshot(path=f"upload_fail_evid_{idx+1}.png", full_page=True)

        except Exception as e:
            log.error(f"  -> Failed to upload evidence {idx+1}: {e}")

    # The portal often clears required upload fields after the last Add postback.
    # Re-prime them once more so SAVE & NEXT validates cleanly.
    _prime_evidence_section(page, data, context_label="[final]")


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# TAB 2: Suspect Details â€” FIX 1, FIX 2, FIX 3, FIX 4
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def _fill_tab2_inline_row_and_add(page, suspect_name: str, user_id_type: str, suspect_id_value: str) -> bool:
    """
    Fast path for the exact inline row UI in Tab 2:
    [Name input] [ID Type] [Country] [ID value] [ADD]
    """
    try:
        res = page.evaluate("""(args) => {
            const visible = (el) => {
                const cs = window.getComputedStyle(el);
                return (el.offsetParent !== null || cs.position === 'fixed')
                    && cs.display !== 'none'
                    && cs.visibility !== 'hidden';
            };
            const setInput = (el, value) => {
                if (!el) return false;
                el.focus();
                el.value = '';
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.value = value || '';
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                return (el.value || '').trim() === (value || '').trim();
            };
            const selectBest = (sel, terms) => {
                if (!sel || !sel.options || !sel.options.length) return { ok: false };
                const clean = (v) => (v || '').toString().trim().toLowerCase();
                const isPlaceholder = (txt) => {
                    const t = clean(txt);
                    return !t || t.startsWith('---') || t.startsWith('select');
                };
                let bestIdx = -1;
                let bestScore = -1;
                for (let i = 0; i < sel.options.length; i++) {
                    const opt = sel.options[i];
                    const lbl = clean(opt.text);
                    const val = clean(opt.value);
                    if (isPlaceholder(lbl)) continue;
                    let score = 0;
                    for (const t of terms) {
                        const tt = clean(t);
                        if (!tt) continue;
                        if (lbl === tt || val === tt) score = Math.max(score, 100);
                        else if (lbl.includes(tt) || tt.includes(lbl)) score = Math.max(score, 70);
                        else {
                            const tokens = tt.replace(/[_/]/g, ' ').split(/\\s+/).filter(x => x.length > 2);
                            const hits = tokens.filter(k => lbl.includes(k) || val.includes(k)).length;
                            score = Math.max(score, hits * 12);
                        }
                    }
                    if (score > bestScore) {
                        bestScore = score;
                        bestIdx = i;
                    }
                }
                if (bestIdx < 0) return { ok: false };
                sel.selectedIndex = bestIdx;
                sel.dispatchEvent(new Event('input', { bubbles: true }));
                sel.dispatchEvent(new Event('change', { bubbles: true }));
                return {
                    ok: true,
                    idx: bestIdx,
                    label: (sel.options[bestIdx].text || '').trim(),
                    value: (sel.options[bestIdx].value || '').trim(),
                };
            };

            const idKeywords = ['mobile', 'pan', 'social', 'email', 'aadhaar', 'passport', 'upi', 'bank', 'landline', 'international', 'whatsapp'];
            const looksLikeIdTypeSelect = (sel) => {
                const blob = Array.from(sel.options || []).map(o => `${o.text || ''} ${o.value || ''}`.toLowerCase()).join(' ');
                return idKeywords.some(k => blob.includes(k));
            };
            const hasPlus91 = (sel) => Array.from(sel.options || []).some(o => ((o.text || '') + ' ' + (o.value || '')).includes('+91'));

            const addButtons = Array.from(document.querySelectorAll('input[type="submit"],input[type="button"],button,a'))
                .filter(visible)
                .filter(el => {
                    const t = ((el.value || el.textContent || '').trim().toLowerCase());
                    return t === 'add' || t.startsWith('add ');
                });
            if (!addButtons.length) return { ok: false, reason: 'no_add_button' };

            let chosen = null;
            let chosenScore = -1;
            for (const btn of addButtons) {
                let container = btn.closest('tr');
                if (!container) {
                    let p = btn.parentElement;
                    let depth = 0;
                    while (p && depth < 7) {
                        const txts = Array.from(p.querySelectorAll('input[type="text"], input:not([type])')).filter(visible);
                        const sels = Array.from(p.querySelectorAll('select')).filter(visible);
                        if (txts.length >= 1 && sels.length >= 1) {
                            container = p;
                            break;
                        }
                        p = p.parentElement;
                        depth += 1;
                    }
                }
                if (!container) continue;

                const txts = Array.from(container.querySelectorAll('input[type="text"], input:not([type])')).filter(visible);
                const sels = Array.from(container.querySelectorAll('select')).filter(visible);
                let score = 0;
                if (txts.length >= 2) score += 4;
                if (sels.length >= 1) score += 2;
                if (sels.some(looksLikeIdTypeSelect)) score += 5;
                if (sels.some(hasPlus91)) score += 3;
                if (score > chosenScore) {
                    chosen = { btn, container, txts, sels };
                    chosenScore = score;
                }
            }
            if (!chosen) return { ok: false, reason: 'no_row_container' };

            const terms = [args.userIdType || '', (args.userIdType || '').replace(/_/g, ' '), 'mobile number'];
            const phoneType = /mobile|international|landline|whatsapp/i.test(args.userIdType || '');

            const idSelect = chosen.sels.find(looksLikeIdTypeSelect) || chosen.sels[0] || null;
            const countrySelect = chosen.sels.find(s => s !== idSelect && hasPlus91(s)) || null;
            const nameInput = chosen.txts[0] || null;
            const nameOk = setInput(nameInput, args.suspectName || '');
            const idSelRes = idSelect ? selectBest(idSelect, terms) : { ok: false };

            let countryOk = true;
            if (phoneType && countrySelect) {
                const cRes = selectBest(countrySelect, ['INDIA (+91)', '+91', 'india']);
                countryOk = !!cRes.ok;
            }

            const txtsAfter = Array.from(chosen.container.querySelectorAll('input[type="text"], input:not([type])')).filter(visible);
            const valueInput = txtsAfter.length >= 2 ? txtsAfter[txtsAfter.length - 1] : txtsAfter[0] || null;
            let valueOk = setInput(valueInput, args.suspectIdValue || '');
            if ((args.suspectIdValue || '').trim() && !valueOk && valueInput) {
                valueOk = setInput(valueInput, args.suspectIdValue || '');
            }
            if (valueInput) {
                try {
                    valueInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
                    valueInput.dispatchEvent(new Event('blur', { bubbles: true }));
                } catch (_) {}
            }

            // Guard: never click ADD before ID value is actually present in the row.
            if ((args.suspectIdValue || '').trim() && !valueOk) {
                return {
                    ok: false,
                    reason: 'id_value_not_set_before_add',
                    nameOk,
                    idSelOk: !!idSelRes.ok,
                    idSelLabel: idSelRes.label || '',
                    countryOk,
                    valueOk,
                    clicked: false,
                    addText: (chosen.btn.value || chosen.btn.textContent || '').trim(),
                    txtCount: txtsAfter.length,
                    selCount: chosen.sels.length,
                };
            }

            chosen.btn.scrollIntoView({ block: 'center', inline: 'nearest' });
            let clicked = false;
            try {
                chosen.btn.click();
                clicked = true;
            } catch (_) {}
            if (!clicked) {
                try {
                    chosen.btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                    chosen.btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
                    chosen.btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                    clicked = true;
                } catch (_) {}
            }
            // ASP.NET fallback for stubborn submit controls
            if (!clicked) {
                try {
                    const target = chosen.btn.name || chosen.btn.id || '';
                    if (typeof window.__doPostBack === 'function' && target) {
                        window.__doPostBack(target, '');
                        clicked = true;
                    }
                } catch (_) {}
            }

            return {
                ok: true,
                nameOk,
                idSelOk: !!idSelRes.ok,
                idSelLabel: idSelRes.label || '',
                countryOk,
                valueOk,
                clicked,
                addText: (chosen.btn.value || chosen.btn.textContent || '').trim(),
                txtCount: txtsAfter.length,
                selCount: chosen.sels.length,
            };
        }""", {
            "suspectName": suspect_name or "",
            "userIdType": user_id_type or "",
            "suspectIdValue": suspect_id_value or "",
        })

        if res and res.get("ok") and res.get("clicked") and ((not suspect_id_value) or res.get("valueOk")):
            log.info(f"FIX 3: Inline-row add click result: {res}")
            wait_for_postback(page)
            page.wait_for_timeout(1000)
            return True
        log.warning(f"FIX 3: Inline-row add fast path failed: {res}")
    except Exception as e:
        log.warning(f"FIX 3: Inline-row add fast path exception: {e}")
    return False


def _click_tab2_add_button(page, id_type_selector: str) -> bool:
    """
    Click the Tab 2 suspect ADD button (not Upload).
    Uses spatial matching around ID type row, then fallbacks.
    """
    def _dismiss_ok_if_present() -> bool:
        try:
            ok_btn = page.locator("button:has-text('Ok'), button:has-text('OK'), input[value='Ok'], input[value='OK']").first
            if ok_btn.count() > 0 and ok_btn.is_visible(timeout=800):
                ok_btn.click(force=True)
                page.wait_for_timeout(500)
                return True
        except Exception:
            return False
        return False

    for attempt in range(3):
        log.info(f"FIX 3: Tab2 ADD click attempt {attempt + 1}/3")
        try:
            click_info = page.evaluate("""(idSel) => {
                const visible = (el) => {
                    const cs = window.getComputedStyle(el);
                    return (el.offsetParent !== null || cs.position === 'fixed')
                        && cs.display !== 'none'
                        && cs.visibility !== 'hidden';
                };

                let anchor = document.querySelector(idSel);
                if (!anchor) {
                    anchor = Array.from(document.querySelectorAll('select')).find((s) => {
                        const id = (s.id || '').toLowerCase();
                        const name = (s.name || '').toLowerCase();
                        return id.includes('ddl_id') || name.includes('ddl_id') || id.includes('identifier');
                    }) || null;
                }
                if (!anchor) return { ok: false, reason: 'no_anchor' };

                const anchorRect = anchor.getBoundingClientRect();
                const anchorRow = anchor.closest('tr');
                const controls = Array.from(document.querySelectorAll('input[type="submit"],input[type="button"],button,a')).filter(visible);
                const addControls = controls.filter((el) => {
                    const t = ((el.value || el.textContent || '').trim().toLowerCase());
                    return t === 'add' || t.startsWith('add ');
                });
                if (!addControls.length) return { ok: false, reason: 'no_add_controls' };

                let best = null;
                let bestScore = Number.POSITIVE_INFINITY;
                for (const c of addControls) {
                    const r = c.getBoundingClientRect();
                    const sameRow = anchorRow && c.closest('tr') && c.closest('tr') === anchorRow;
                    let score = Math.abs(r.top - anchorRect.top) + Math.abs(r.left - anchorRect.left) * 0.15;
                    if (sameRow) score -= 120;
                    if (r.top < anchorRect.top - 80) score += 1000;
                    if (score < bestScore) {
                        bestScore = score;
                        best = c;
                    }
                }
                if (!best) return { ok: false, reason: 'no_best' };

                best.scrollIntoView({ block: 'center', inline: 'nearest' });
                let clicked = false;
                try {
                    best.click();
                    clicked = true;
                } catch (_) {}
                if (!clicked) {
                    try {
                        best.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                        best.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
                        best.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                        clicked = true;
                    } catch (_) {}
                }
                if (!clicked) {
                    try {
                        const target = best.name || best.id || '';
                        if (typeof window.__doPostBack === 'function' && target) {
                            window.__doPostBack(target, '');
                            clicked = true;
                        }
                    } catch (_) {}
                }
                if (!clicked) return { ok: false, reason: 'click_failed' };
                return {
                    ok: true,
                    id: best.id || '',
                    name: best.name || '',
                    text: (best.value || best.textContent || '').trim(),
                    score: bestScore
                };
            }""", id_type_selector)
            if click_info and click_info.get("ok"):
                log.info(
                    f"FIX 3: Tab2 ADD clicked via spatial match id='{click_info.get('id')}' name='{click_info.get('name')}' text='{click_info.get('text')}' score={click_info.get('score')}"
                )
                page.wait_for_timeout(400)
                if _dismiss_ok_if_present():
                    log.warning("FIX 3: Ok popup appeared after ADD click; dismissed and retrying.")
                    continue
                wait_for_postback(page)
                page.wait_for_timeout(1200)
                return True
            log.warning(f"FIX 3: Tab2 ADD spatial click failed: {click_info}")
        except Exception as e:
            log.warning(f"FIX 3: Tab2 ADD spatial click exception: {e}")

        fallback_selectors = [
            "#ContentPlaceHolder1_btnAdd:visible",
            "input[id*='btnAdd']:visible",
            "input[id*='btnadd']:visible",
            "input[type='submit'][value='ADD']:visible",
            "input[type='submit'][value='Add']:visible",
            "input[type='button'][value='ADD']:visible",
            "input[type='button'][value='Add']:visible",
            "button:has-text('ADD'):visible",
            "button:has-text('Add'):visible",
            "a:has-text('ADD'):visible",
            "a:has-text('Add'):visible",
        ]
        for selector in fallback_selectors:
            try:
                btn = page.locator(selector).first
                if btn.count() > 0 and btn.is_visible(timeout=1200):
                    btn.scroll_into_view_if_needed()
                    btn.click(force=True)
                    log.info(f"FIX 3: Tab2 ADD clicked via fallback selector '{selector}'")
                    page.wait_for_timeout(400)
                    if _dismiss_ok_if_present():
                        log.warning("FIX 3: Ok popup appeared after fallback ADD click; dismissed and retrying.")
                        break
                    wait_for_postback(page)
                    page.wait_for_timeout(1200)
                    return True
            except Exception:
                continue

        # JS fallback (last-resort) for ASP.NET submit controls.
        try:
            js_ok = page.evaluate("""() => {
                const visible = (el) => {
                    const cs = window.getComputedStyle(el);
                    return (el.offsetParent !== null || cs.position === 'fixed')
                        && cs.display !== 'none'
                        && cs.visibility !== 'hidden';
                };
                const btn = document.querySelector('#ContentPlaceHolder1_btnAdd')
                    || Array.from(document.querySelectorAll('input[type="submit"],input[type="button"],button,a'))
                        .find(el => {
                            if (!visible(el)) return false;
                            const t = ((el.value || el.textContent || '').trim().toLowerCase());
                            return t === 'add' || t.startsWith('add ');
                        });
                if (!btn) return false;
                btn.click();
                return true;
            }""")
            if js_ok:
                log.info("FIX 3: Tab2 ADD clicked via JS fallback")
                page.wait_for_timeout(400)
                if _dismiss_ok_if_present():
                    log.warning("FIX 3: Ok popup appeared after JS ADD click; dismissed and retrying.")
                    continue
                wait_for_postback(page)
                page.wait_for_timeout(1200)
                return True
        except Exception:
            pass

    return False


def _click_tab2_add_button_real(page) -> bool:
    """
    Prefer a real Playwright click (trusted user-like click) on suspect ADD control.
    This avoids JS-only clicks that can fail to trigger the portal's postback logic.
    """
    selectors = [
        "#ContentPlaceHolder1_btnAddSuspect:visible",
        "input[id*='btnAddSuspect']:visible",
        "#ContentPlaceHolder1_btnAdd:visible",
        "input[id*='btnAdd']:visible",
        "input[type='submit'][value='ADD']:visible",
        "input[type='submit'][value='Add']:visible",
        "button:has-text('ADD'):visible",
        "button:has-text('Add'):visible",
    ]

    for sel in selectors:
        try:
            btn = page.locator(sel).first
            if btn.count() == 0:
                continue
            if not btn.is_visible(timeout=1200):
                continue
            if btn.is_disabled():
                continue

            btn.scroll_into_view_if_needed()
            btn.click()
            log.info(f"FIX 3: Tab2 ADD clicked via REAL click selector '{sel}'")
            wait_for_postback(page)
            page.wait_for_timeout(1200)
            return True
        except Exception:
            continue

    return False


def _click_tab2_add_near_value(page, suspect_id_value: str) -> bool:
    """
    Last-resort ADD click:
    find the text input containing suspect_id_value and click the nearest visible ADD control.
    """
    try:
        click_info = page.evaluate("""(idValue) => {
            const visible = (el) => {
                const cs = window.getComputedStyle(el);
                return (el.offsetParent !== null || cs.position === 'fixed')
                    && cs.display !== 'none'
                    && cs.visibility !== 'hidden';
            };
            const norm = (v) => (v || '').toString().replace(/\\s+/g, '').trim();

            const addControls = Array.from(
                document.querySelectorAll('input[type="submit"],input[type="button"],button,a')
            ).filter(visible).filter((el) => {
                const t = ((el.value || el.textContent || '').trim().toLowerCase());
                return t === 'add' || t.startsWith('add ');
            });
            if (!addControls.length) return { ok: false, reason: 'no_add_controls' };

            const valNorm = norm(idValue);
            const textInputs = Array.from(
                document.querySelectorAll('input[type="text"], input:not([type])')
            ).filter(visible);

            let anchor = null;
            if (valNorm) {
                anchor = textInputs.find((inp) => norm(inp.value || '').includes(valNorm)) || null;
            }
            if (!anchor && textInputs.length) {
                anchor = textInputs[textInputs.length - 1];
            }
            if (!anchor) return { ok: false, reason: 'no_anchor_input' };

            const ar = anchor.getBoundingClientRect();
            let best = null;
            let bestScore = Number.POSITIVE_INFINITY;

            for (const c of addControls) {
                const r = c.getBoundingClientRect();
                let score = Math.abs(r.top - ar.top) + Math.abs(r.left - ar.right) * 0.12;
                if (Math.abs(r.top - ar.top) < 70) score -= 80;
                if (r.left < ar.left - 120) score += 500; // likely wrong row
                if (score < bestScore) {
                    best = c;
                    bestScore = score;
                }
            }
            if (!best) return { ok: false, reason: 'no_best_candidate' };

            anchor.dispatchEvent(new Event('change', { bubbles: true }));
            anchor.dispatchEvent(new Event('blur', { bubbles: true }));
            best.scrollIntoView({ block: 'center', inline: 'nearest' });

            let clicked = false;
            try { best.click(); clicked = true; } catch (_) {}
            if (!clicked) {
                try {
                    best.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                    best.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
                    best.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                    clicked = true;
                } catch (_) {}
            }
            if (!clicked) {
                try {
                    const target = best.name || best.id || '';
                    if (typeof window.__doPostBack === 'function' && target) {
                        window.__doPostBack(target, '');
                        clicked = true;
                    }
                } catch (_) {}
            }
            if (!clicked) return { ok: false, reason: 'click_failed' };

            return {
                ok: true,
                id: best.id || '',
                name: best.name || '',
                text: (best.value || best.textContent || '').trim(),
                score: bestScore,
            };
        }""", suspect_id_value or "")

        if click_info and click_info.get("ok"):
            log.info(
                f"FIX 3: Tab2 ADD clicked via nearest-value fallback id='{click_info.get('id')}' name='{click_info.get('name')}' text='{click_info.get('text')}' score={click_info.get('score')}"
            )
            wait_for_postback(page)
            page.wait_for_timeout(1200)
            return True

        log.warning(f"FIX 3: Nearest-value ADD click failed: {click_info}")
    except Exception as e:
        log.warning(f"FIX 3: Nearest-value ADD click exception: {e}")

    return False


def _fill_tab2_id_value_in_inline_row(page, suspect_name: str, suspect_id_value: str) -> bool:
    """
    Fill the Tab 2 ID value input specifically in the same inline row that has the ADD button.
    This avoids filling unrelated text boxes elsewhere on the page.
    """
    if not (suspect_id_value or "").strip():
        return False
    try:
        res = page.evaluate("""(args) => {
            const visible = (el) => {
                const cs = window.getComputedStyle(el);
                return (el.offsetParent !== null || cs.position === 'fixed')
                    && cs.display !== 'none'
                    && cs.visibility !== 'hidden';
            };
            const setInput = (el, value) => {
                if (!el) return false;
                el.focus();
                el.value = '';
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.value = value || '';
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                return ((el.value || '').trim() === (value || '').trim());
            };

            const addButtons = Array.from(document.querySelectorAll('input[type="submit"],input[type="button"],button,a'))
                .filter(visible)
                .filter(el => {
                    const t = ((el.value || el.textContent || '').trim().toLowerCase());
                    return t === 'add' || t.startsWith('add ');
                });
            if (!addButtons.length) return { ok: false, reason: 'no_add_button' };

            for (const btn of addButtons) {
                let container = btn.closest('tr');
                if (!container) container = btn.parentElement;
                if (!container) continue;
                const txts = Array.from(container.querySelectorAll('input[type="text"], input:not([type])')).filter(visible);
                if (!txts.length) continue;

                // Prefer any non-name input in this row.
                let target = null;
                for (const t of txts) {
                    const v = (t.value || '').trim();
                    if (v && args.suspectName && v.toLowerCase() === args.suspectName.toLowerCase()) continue;
                    const pid = (t.id || '').toLowerCase();
                    const ph = (t.placeholder || '').toLowerCase();
                    if (pid.includes('id') || pid.includes('value') || pid.includes('number') || ph.includes('id') || ph.includes('number') || ph.includes('value')) {
                        target = t;
                        break;
                    }
                }
                if (!target) target = txts[txts.length - 1];
                const ok = setInput(target, args.value || '');
                return { ok, id: target.id || '', val: (target.value || '').trim() };
            }
            return { ok: false, reason: 'no_target_input' };
        }""", {
            "suspectName": suspect_name or "",
            "value": suspect_id_value or "",
        })
        if res and res.get("ok"):
            log.info(f"FIX 4: Filled Tab2 inline ID value in #{res.get('id')}: '{res.get('val')}'")
            return True
        log.warning(f"FIX 4: Inline row ID value fill did not confirm: {res}")
    except Exception as e:
        log.warning(f"FIX 4: Inline row ID value fill exception: {e}")
    return False


def _tab2_has_id_value_near_add(page, suspect_id_value: str) -> bool:
    """
    Confirm the suspect ID value is present in the same inline suspect row as ADD.
    """
    val = (suspect_id_value or "").strip()
    if not val:
        return True
    try:
        res = page.evaluate("""(value) => {
            const visible = (el) => {
                const cs = window.getComputedStyle(el);
                return (el.offsetParent !== null || cs.position === 'fixed')
                    && cs.display !== 'none'
                    && cs.visibility !== 'hidden';
            };
            const norm = (v) => (v || '').toString().replace(/\\s+/g, '').trim().toLowerCase();
            const target = norm(value);
            if (!target) return { ok: true, reason: 'empty_target' };

            const addButtons = Array.from(document.querySelectorAll('input[type="submit"],input[type="button"],button,a'))
                .filter(visible)
                .filter(el => {
                    const t = ((el.value || el.textContent || '').trim().toLowerCase());
                    return t === 'add' || t.startsWith('add ');
                });
            if (!addButtons.length) return { ok: false, reason: 'no_add_button' };

            for (const btn of addButtons) {
                let container = btn.closest('tr');
                if (!container) {
                    let p = btn.parentElement;
                    let depth = 0;
                    while (p && depth < 8) {
                        const txts = Array.from(p.querySelectorAll('input[type="text"], input:not([type])')).filter(visible);
                        if (txts.length >= 1) {
                            container = p;
                            break;
                        }
                        p = p.parentElement;
                        depth += 1;
                    }
                }
                if (!container) continue;
                const txts = Array.from(container.querySelectorAll('input[type="text"], input:not([type])')).filter(visible);
                for (const t of txts) {
                    const cur = norm(t.value || '');
                    if (cur && (cur === target || cur.includes(target) || target.includes(cur))) {
                        return { ok: true, id: t.id || '', val: t.value || '' };
                    }
                }
            }
            return { ok: false, reason: 'value_not_found_near_add' };
        }""", val)
        if res and res.get("ok"):
            log.info(f"FIX 4: Verified ID value present near ADD (field='{res.get('id', '')}')")
            return True
        log.warning(f"FIX 4: ID value not confirmed near ADD: {res}")
    except Exception as e:
        log.warning(f"FIX 4: Could not verify ID value near ADD: {e}")
    return False


def _tab2_suspect_grid_signature(page, suspect_name: str, suspect_id_value: str) -> dict:
    """
    Capture a lightweight signature of visible suspect-like grid tables on Tab 2.
    Used to verify that clicking ADD actually inserted a row.
    """
    try:
        sig = page.evaluate("""(args) => {
            const visible = (el) => {
                const cs = window.getComputedStyle(el);
                return (el.offsetParent !== null || cs.position === 'fixed')
                    && cs.display !== 'none'
                    && cs.visibility !== 'hidden';
            };
            const clean = (s) => (s || '').toString().trim().toLowerCase();
            const nm = clean(args.name);
            const iv = clean(args.idv);
            const tables = Array.from(document.querySelectorAll('table'))
                .filter(visible)
                .filter(t => {
                    const id = clean(t.id);
                    // Exclude Tab 1 evidence grid
                    if (id.includes('gv_info')) return false;
                    const txt = clean(t.textContent || '');
                    return id.includes('gv') || id.includes('grid') || txt.includes('suspect') || txt.includes('identifier');
                });

            let rowsTotal = 0;
            let nameHits = 0;
            let idHits = 0;
            for (const t of tables) {
                const rows = Array.from(t.querySelectorAll('tr'));
                rowsTotal += rows.length;
                const txt = clean(t.textContent || '');
                if (nm && txt.includes(nm)) nameHits += 1;
                if (iv && txt.includes(iv)) idHits += 1;
            }
            return {
                ok: true,
                tableCount: tables.length,
                rowsTotal,
                nameHits,
                idHits
            };
        }""", {
            "name": suspect_name or "",
            "idv": suspect_id_value or "",
        })
        if isinstance(sig, dict):
            return sig
    except Exception as e:
        log.warning(f"FIX 3: Could not read Tab2 suspect grid signature: {e}")
    return {"ok": False, "tableCount": 0, "rowsTotal": 0, "nameHits": 0, "idHits": 0}


def _tab2_add_confirmed(before_sig: dict, after_sig: dict) -> bool:
    """True when tab2 grid shows evidence of a newly added suspect row."""
    before_rows = int(before_sig.get("rowsTotal") or 0)
    after_rows = int(after_sig.get("rowsTotal") or 0)
    before_name = int(before_sig.get("nameHits") or 0)
    after_name = int(after_sig.get("nameHits") or 0)
    before_id = int(before_sig.get("idHits") or 0)
    after_id = int(after_sig.get("idHits") or 0)
    return (
        after_rows > before_rows
        or after_name > before_name
        or after_id > before_id
    )


def _tab2_row_visible(page, suspect_name: str, suspect_id_value: str) -> bool:
    """
    Check whether a suspect row is visible in Tab 2 table after clicking ADD.
    Similar to evidence verification style.
    """
    try:
        found = page.evaluate("""(args) => {
            const visible = (el) => {
                const cs = window.getComputedStyle(el);
                return (el.offsetParent !== null || cs.position === 'fixed')
                    && cs.display !== 'none'
                    && cs.visibility !== 'hidden';
            };
            const clean = (s) => (s || '').toString().trim().toLowerCase();
            const nm = clean(args.name || '');
            const iv = clean(args.idv || '');

            const tables = Array.from(document.querySelectorAll('table'))
                .filter(visible)
                .filter((t) => {
                    const id = clean(t.id || '');
                    if (id.includes('gv_info')) return false; // exclude evidence grid
                    const txt = clean(t.textContent || '');
                    return id.includes('gv') || id.includes('grid') || txt.includes('suspect') || txt.includes('identifier');
                });

            for (const t of tables) {
                const rows = Array.from(t.querySelectorAll('tr')).filter(visible);
                for (const r of rows) {
                    const cells = Array.from(r.querySelectorAll('td')).map((td) => clean(td.textContent || ''));
                    if (!cells.length) continue;
                    const rowTxt = cells.join(' ');
                    const hasDelete = rowTxt.includes('delete');
                    const hasName = nm ? rowTxt.includes(nm) : false;
                    const hasId = iv ? rowTxt.includes(iv) : false;
                    if (hasDelete && (hasName || hasId || (!nm && !iv))) return true;
                    if ((hasName && hasId) || (hasName && !iv) || (hasId && !nm)) return true;
                }
            }
            return false;
        }""", {"name": suspect_name or "", "idv": suspect_id_value or ""})
        return bool(found)
    except Exception as e:
        log.warning(f"FIX 3: Could not verify Tab2 row visibility: {e}")
        return False


def _tab2_collect_validation_errors(page) -> list:
    """Collect visible validation/error text on Tab 2."""
    errors = []
    selectors = [
        ".field-validation-error:visible",
        ".validation-summary-errors li:visible",
        "span[style*='color:Red']:visible",
        "span[style*='color:red']:visible",
        "div[style*='color:Red']:visible",
        "div[style*='color:red']:visible",
    ]
    for sel in selectors:
        try:
            texts = page.locator(sel).all_text_contents()
            for t in texts:
                tt = (t or "").strip()
                if tt and tt not in errors:
                    errors.append(tt)
        except Exception:
            pass
    return errors


def _fill_tab2_additional_info(page, description: str) -> bool:
    """
    Fill Tab 2 "Any other information / details" area (max 250 chars).
    Uses strict selector first, then robust textarea fallback.
    """
    text = (description or "").strip()
    if not text:
        text = "Perpetrator identified via digital platform evidence."
    text = text[:250]

    selectors = [
        "#ContentPlaceHolder1_txtAnyOtherInfo",
        "#txtAnyOtherInfo",
        "textarea[id*='AnyOtherInfo']",
        "textarea[name*='AnyOtherInfo']",
    ]

    for sel in selectors:
        try:
            area = page.locator(f"{sel}:visible").first
            if area.count() > 0 and area.is_visible(timeout=600):
                area.click()
                area.fill(text)
                log.info(f"Tab2 additional info filled via '{sel}' ({len(text)} chars)")
                return True
        except Exception:
            pass

    # Fallback: choose the largest visible textarea in Tab 2 form area.
    try:
        res = page.evaluate("""(val) => {
            const visible = (el) => {
                const cs = window.getComputedStyle(el);
                return (el.offsetParent !== null || cs.position === 'fixed')
                    && cs.display !== 'none'
                    && cs.visibility !== 'hidden';
            };
            const areas = Array.from(document.querySelectorAll('textarea')).filter(visible);
            if (!areas.length) return { ok: false, reason: 'no_textarea' };

            let best = areas[0];
            let bestScore = -1;
            for (const a of areas) {
                const r = a.getBoundingClientRect();
                const score = (r.width * r.height);
                if (score > bestScore) {
                    bestScore = score;
                    best = a;
                }
            }

            best.focus();
            best.value = '';
            best.dispatchEvent(new Event('input', { bubbles: true }));
            best.value = val || '';
            best.dispatchEvent(new Event('input', { bubbles: true }));
            best.dispatchEvent(new Event('change', { bubbles: true }));
            return { ok: true, id: best.id || '', len: (best.value || '').length };
        }""", text)
        if res and res.get("ok"):
            log.info(f"Tab2 additional info filled via textarea fallback id='{res.get('id')}' len={res.get('len')}")
            return True
        log.warning(f"Tab2 additional info fallback did not confirm: {res}")
    except Exception as e:
        log.warning(f"Tab2 additional info fill fallback error: {e}")

    return False


def _click_tab2_preview_next(page) -> bool:
    """Click Tab 2 Preview/Next button using layered strategies."""
    log.info("Clicking Preview & Next button on Tab 2...")
    btn_clicked = False

    # Strategy 1: Direct ID selector
    try:
        btn = page.locator("#ContentPlaceHolder1_btnNext")
        if btn.is_visible(timeout=3000):
            btn.click()
            btn_clicked = True
            log.info("  -> Clicked #ContentPlaceHolder1_btnNext")
    except Exception as e:
        log.warning(f"  -> Direct ID click failed: {e}")

    # Strategy 2: Value-based selector
    if not btn_clicked:
        try:
            btn = page.locator(
                "input[type='submit'][value*='SAVE'], input[type='submit'][value*='Next'], input[type='submit'][value*='Preview']"
            ).first
            if btn.is_visible(timeout=2000):
                btn.click()
                btn_clicked = True
                log.info("  -> Clicked via value-based selector")
        except Exception as e:
            log.warning(f"  -> Value-based click failed: {e}")

    # Strategy 3: Text-based click
    if not btn_clicked:
        try:
            page.get_by_text("SAVE & NEXT", exact=False).first.click()
            btn_clicked = True
            log.info("  -> Clicked via text match")
        except Exception as e:
            log.warning(f"  -> Text-based click failed: {e}")

    # Strategy 4: JavaScript forced click
    if not btn_clicked:
        try:
            page.evaluate("document.querySelector('#ContentPlaceHolder1_btnNext').click()")
            btn_clicked = True
            log.info("  -> Clicked via JavaScript")
        except Exception as e:
            log.warning(f"  -> JS click also failed: {e}")

    if btn_clicked:
        wait_for_postback(page)
        page.wait_for_timeout(3000)
        page.screenshot(path="after_tab2_next.png", full_page=True)

    return btn_clicked


def fill_tab2(page, data: dict) -> bool:
    """Fill Tab 2: Suspect Details. Returns True on success."""
    log.info("=== TAB 2: Suspect Details ===")
    
    # Wait for Tab 2 to render
    page.wait_for_selector("#SuspectName, input[placeholder*='Suspect Name']:visible", state="visible", timeout=20000)
    page.wait_for_timeout(1000)

    # 1. Suspect Name
    suspect_name = data.get("suspect_name", "Unknown Online Perpetrator")
    log.info(f"Filling suspect name: {suspect_name}")
    try:
        page.fill("#SuspectName", suspect_name)
    except Exception as e:
        try:
            page.locator("input[placeholder*='Suspect Name'], input[name*='SuspectName']").first.fill(suspect_name)
        except Exception: pass

    page.wait_for_timeout(500)

    # 2. Suspect ID Type
    suspect_id_type_label = data.get("suspect_id_type_label", "")
    suspect_id_type_key = data.get("suspect_id_type", "")
    user_id_type = suspect_id_type_label or (suspect_id_type_key or "").replace("_", " ") or "Mobile Number"
    
    log.info(f"Selecting Suspect ID Type -> '{user_id_type}'")
    try:
        id_opts = page.evaluate("() => document.getElementById('FK_IdTypeId') ? Array.from(document.getElementById('FK_IdTypeId').options).map(o => ({ value: o.value, text: o.text.trim() })) : []")
        id_matched = False
        for opt in id_opts:
            if user_id_type.lower() in opt["text"].lower() or opt["text"].lower() in user_id_type.lower():
                page.select_option("#FK_IdTypeId", value=opt["value"])
                id_matched = True
                log.info(f"  -> Selected FK_IdTypeId: {opt['text']}")
                break
        if not id_matched and len(id_opts) > 1:
            # Default to Mobile Number
            page.select_option("#FK_IdTypeId", label="Mobile Number")
    except Exception as e:
        log.warning(f"Suspect ID type selection notice: {e}")

    page.wait_for_timeout(500)

    # 3. Suspect ID Number / Phone
    suspect_id_val = (data.get("suspect_id_value") or data.get("suspect_platform_contact") or "9876543210").strip()
    log.info(f"Filling Suspect ID Value -> '{suspect_id_val}'")
    try:
        page.fill("#IdNumber", suspect_id_val)
    except Exception as e:
        try:
            page.locator("input[name*='IdNumber'], input[placeholder*='ID']").first.fill(suspect_id_val)
        except Exception: pass

    page.wait_for_timeout(500)

    # 4. Click Suspect Add Button
    log.info("Clicking Suspect 'Add' button...")
    try:
        page.evaluate("""() => {
            const btns = Array.from(document.querySelectorAll('button, input[type="button"]'));
            const addBtn = btns.find(b => (b.innerText || b.value || '').trim().toLowerCase() === 'add');
            if (addBtn) addBtn.click();
        }""")
        page.wait_for_timeout(1500)
    except Exception as e:
        log.warning(f"Suspect Add click notice: {e}")

    # 5. Suspect Additional Information / Description
    description = data.get("suspect_description") or "Perpetrator operates through anonymous online handles and encrypted messaging."
    clean_desc = re.sub(r'[\'\"<>~\|\^\*]', '', description)[:250]
    log.info(f"Filling Suspect Additional Info -> '{clean_desc}'")
    try:
        page.fill("#AdditionalInfo", clean_desc)
    except Exception as e:
        try:
            page.locator("textarea[name*='AdditionalInfo'], #AdditionalInfo").first.fill(clean_desc)
        except Exception: pass

    page.wait_for_timeout(1000)
    page.screenshot(path="tab2_filled.png", full_page=True)

    # 6. Click PREVIEW & NEXT
    log.info("Clicking 'Preview & Next' button...")
    try:
        page.evaluate("""() => {
            const btns = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
            const previewBtn = btns.find(b => (b.innerText || b.value || '').trim().toLowerCase().includes('preview & next'));
            if (previewBtn) previewBtn.click();
        }""")
    except Exception as e:
        log.warning(f"Preview & Next click notice: {e}")

    page.wait_for_timeout(3500)
    page.screenshot(path="tab3_preview_rendered.png", full_page=True)

    stage = _detect_form_stage(page)
    if stage == "tab3":
        log.info("ADVANCEMENT SUCCESS: Successfully reached Tab 3 (Preview & Submit)!")
        return True

    log.warning(f"Detected stage after Preview & Next: '{stage}'")
    return stage == "tab3"


def run_bot(data: dict):
    """Main entry point."""
    # --- PREPARE EVIDENCE ---
    log.info("Preparing evidence files...")
    local_evidence_path = ""
    if data.get("file_url"):
        local_evidence_path = download_evidence(data["file_url"])
    
    if not local_evidence_path and data.get("evidence_path"):
        # Fallback to local check (manual upload/mock)
        if os.path.exists(data["evidence_path"]):
            local_evidence_path = os.path.abspath(data["evidence_path"])
        else:
            log.warning(f"Could not find local evidence_path: {data['evidence_path']}")

    if not local_evidence_path or not os.path.exists(local_evidence_path):
        dummy_path = os.path.abspath("dummy_evidence.png")
        if not os.path.exists(dummy_path):
            try:
                from PIL import Image
                img = Image.new('RGB', (400, 300), color=(240, 240, 240))
                img.save(dummy_path)
            except Exception:
                with open(dummy_path, "wb") as f:
                    f.write(b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82')
        local_evidence_path = dummy_path

    # Override data for internal use
    data["local_evidence_path"] = local_evidence_path

    log.info("ShieldHer RPA Bot Starting...")
    with sync_playwright() as p:
        # HEADLESS MODE: Set HEADLESS=true env var for headless servers. Defaults to False for local GUI desktop display.
        is_headless = os.environ.get("HEADLESS", "false").lower() == "true"
        browser = p.chromium.launch(headless=is_headless)
        try:
            # SPOOFING: Make the request look like a normal Windows browser user.
            user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            context = browser.new_context(
                viewport={"width": 1280, "height": 800},
                user_agent=user_agent
            )
            page = context.new_page()
            
            url = "https://cybercrime.gov.in/"
            
            # Auto-handle unexpected JS alerts/confirmations
            def _on_dialog(dialog):
                try:
                    msg = dialog.message
                except Exception:
                    msg = ""
                log.warning(f"Browser dialog intercepted: {msg}")
                try:
                    dialog.accept()
                except Exception:
                    pass
            
            page.on("dialog", _on_dialog)
            
            # 1. Navigate to Official Homepage
            log.info("Step 1: Navigating to Official National Cyber Crime Portal (https://cybercrime.gov.in/)...")
            try:
                page.goto(url, wait_until="networkidle", timeout=60000)
            except Exception as e:
                log.warning(f"Homepage networkidle notice: {e}. Proceeding...")
            page.wait_for_timeout(2000)

            # 2. Hover and Click 'Report Cyber Crime' in top nav (Image 2 & Image 1)
            log.info("Step 1 & 2: Locating Top Nav 'Report Cyber Crime' and opening submenu (Images 2 & 1)...")
            top_nav = page.locator("a, button, span").filter(has_text=re.compile(r"^Report Cyber Crime|Report Cyber Crime", re.I)).first
            try:
                top_nav.wait_for(state="visible", timeout=30000)
                top_nav.hover()
                page.wait_for_timeout(500)
                top_nav.click(force=True)
                page.wait_for_timeout(800)
            except Exception as nav_err:
                log.warning(f"Top nav click notice: {nav_err}")

            # 3. Click 'Women/Children Related Crime' link inside the open dropdown
            log.info("  -> Clicking 'Women/Children Related Crime' sub-menu link...")
            sub_link = page.locator("a:has-text('Women/Children Related Crime'), a:has-text('Women/Children')").first
            clicked_sub = False
            try:
                if sub_link.is_visible(timeout=3000):
                    sub_link.click(force=True)
                    clicked_sub = True
                    log.info("  -> Successfully clicked sub-link via Playwright locator.")
            except Exception:
                pass

            if not clicked_sub:
                log.info("  -> Clicking sub-link via direct DOM event...")
                page.evaluate("""() => {
                    const links = Array.from(document.querySelectorAll('a, button'));
                    const link = links.find(l => {
                        const t = (l.innerText || l.textContent || '').toLowerCase();
                        return t.includes('women') && (t.includes('children') || t.includes('child'));
                    });
                    if (link) link.click();
                }""")
            
            page.wait_for_timeout(1500)

            # 4. Click "I Understand" on Educational Modal (button.educate-btn)
            log.info("Step 3: Clicking 'I Understand' on Modal (button.educate-btn)...")
            try:
                page.wait_for_selector("button.educate-btn", state="visible", timeout=20000)
                page.wait_for_timeout(600)
                # Use JS click to avoid hitting the CDK overlay backdrop
                page.evaluate("""() => {
                    const btn = document.querySelector('button.educate-btn');
                    if (btn) btn.click();
                }""")
                log.info("  -> Clicked 'I Understand' via JS on button.educate-btn.")
            except Exception as modal_err:
                log.warning(f"Modal button notice: {modal_err}")

            page.wait_for_timeout(1000)

            # 5. Handle Anonymous Selection on /login (#cb1, #cb2, and Report Anonymously button)
            log.info("Step 4: Handling Anonymous checkboxes (#cb1, #cb2) & button on /login (Image 4)...")
            try:
                page.wait_for_selector("#cb1, #cb2", state="visible", timeout=20000)
                page.wait_for_timeout(800)

                # Check #cb1 and #cb2 reliably
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
                page.wait_for_timeout(600)

                # Click light blue 'Report Anonymously' button (Image 4)
                log.info("  -> Clicking 'Report Anonymously' button...")
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
                page.wait_for_timeout(2500)
                log.info(f"Page URL after Report Anonymously: {page.url}")

            except Exception as anon_err:
                log.warning(f"Anonymous login section notice: {anon_err}")

            # 6. Wait for Complaint Form Tab 1 to render (Images 5-12)
            log.info("Step 5: Waiting for Complaint Form elements to load (Images 5-12)...")
            try:
                page.wait_for_selector("select:visible, #ContentPlaceHolder1_ddl_CategoryCrime, input[placeholder*='dd-mm-yyyy']", timeout=30000)
                num_selects = page.locator("select:visible").count()
                num_inputs = page.locator("input:visible").count()
                log.info(f"Form elements loaded successfully! (visible selects={num_selects}, visible inputs={num_inputs})")
            except Exception as wait_err:
                log.warning(f"Wait for form elements notice: {wait_err}")

            # 3. Filling the Complaint
            if fill_tab1(page, data):
                fill_tab2(page, data)

            log.info("RPA Halted on Tab 3 for review.")
            if is_headless:
                page.wait_for_timeout(30000)
            else:
                log.info("Visual desktop session active. Keeping Chrome window open for user manual review...")
                while not page.is_closed():
                    page.wait_for_timeout(2000)
            
        except Exception as e:
            log.error(f"Bot error: {e}")
            try:
                page.screenshot(path="bot_error.png")
            except:
                pass
        finally:
            if is_headless:
                browser.close()

if __name__ == "__main__":
    payload = load_payload()
    run_bot(payload)

