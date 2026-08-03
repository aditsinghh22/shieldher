import json
import re
import difflib

STATE_ALIASES = {
    "delhi": ["delhi", "nct of delhi", "national capital territory of delhi", "delhi ut", "central delhi", "new delhi"],
    "andaman and nicobar islands": ["andaman & nicobar", "andaman and nicobar", "andaman & nicobar islands", "a & n islands", "nicobar"],
    "andaman & nicobar": ["andaman & nicobar", "andaman and nicobar", "andaman and nicobar islands", "a & n islands"],
    "jammu and kashmir": ["jammu & kashmir", "jammu and kashmir", "j&k", "jammu", "kashmir"],
    "jammu & kashmir": ["jammu & kashmir", "jammu and kashmir", "j&k"],
    "dadra and nagar haveli and daman and diu": ["dadra & nagar haveli and daman & diu", "dadra and nagar haveli", "daman and diu", "daman & diu", "dadra & nagar haveli"],
    "dadra & nagar haveli and daman & diu": ["dadra and nagar haveli and daman and diu", "dadra and nagar haveli", "daman and diu", "daman & diu"],
    "dadra and nagar haveli": ["dadra & nagar haveli and daman & diu", "dadra and nagar haveli and daman and diu", "dadra & nagar haveli"],
    "daman and diu": ["dadra & nagar haveli and daman & diu", "dadra and nagar haveli and daman and diu", "daman & diu"],
    "odisha": ["odisha", "orissa"],
    "orissa": ["odisha", "orissa"],
    "puducherry": ["puducherry", "pondicherry"],
    "pondicherry": ["puducherry", "pondicherry"],
    "uttarakhand": ["uttarakhand", "uttaranchal"],
    "uttaranchal": ["uttarakhand", "uttaranchal"],
    "telangana": ["telangana", "telangana state"],
    "tamil nadu": ["tamil nadu", "tamilnadu"],
    "ladakh": ["ladakh", "ut of ladakh"],
    "chandigarh": ["chandigarh", "chandigarh ut"],
}

DISTRICT_SPECIAL_MAPPINGS = {
    # Delhi Districts
    "south east delhi": ["SOUTH-EAST", "SOUTH", "SOUTH WEST"],
    "southeast delhi": ["SOUTH-EAST", "SOUTH", "SOUTH WEST"],
    "south west delhi": ["SOUTH WEST", "SOUTH", "SOUTH-EAST"],
    "southwest delhi": ["SOUTH WEST", "SOUTH", "SOUTH-EAST"],
    "south delhi": ["SOUTH", "SOUTH-EAST", "SOUTH WEST"],
    "north west delhi": ["NORTH WEST", "NORTH", "NORTH EAST", "OUTER NORTH"],
    "northwest delhi": ["NORTH WEST", "NORTH", "NORTH EAST", "OUTER NORTH"],
    "north east delhi": ["NORTH EAST", "NORTH", "NORTH WEST"],
    "northeast delhi": ["NORTH EAST", "NORTH", "NORTH WEST"],
    "north delhi": ["NORTH", "NORTH EAST", "NORTH WEST", "OUTER NORTH"],
    "central delhi": ["CENTRAL", "NEW DELHI"],
    "east delhi": ["EAST", "NORTH EAST", "SHAHDARA"],
    "west delhi": ["WEST", "SOUTH WEST", "DWARKA"],
    "new delhi": ["NEW DELHI", "CENTRAL"],
    "shahdara": ["SHAHDARA", "EAST"],
    "dwarka": ["DWARKA", "SOUTH WEST", "WEST"],
    "rohini": ["ROHINI", "NORTH WEST", "OUTER NORTH"],
    "outer north": ["OUTER NORTH", "NORTH WEST", "NORTH"],

    # Maharashtra Districts
    "mumbai suburban": ["BRIHAN MUMBAI CITY", "NAVI MUMBAI"],
    "mumbai sub": ["BRIHAN MUMBAI CITY", "NAVI MUMBAI"],
    "mumbai city": ["BRIHAN MUMBAI CITY", "NAVI MUMBAI"],
    "mumbai": ["BRIHAN MUMBAI CITY", "NAVI MUMBAI"],
    "pune": ["PUNE CITY", "PUNE RURAL"],
    "pune city": ["PUNE CITY", "PUNE RURAL"],
    "pune rural": ["PUNE RURAL", "PUNE CITY"],
    "thane": ["THANE CITY", "THANE RURAL"],
    "thane city": ["THANE CITY", "THANE RURAL"],
    "thane rural": ["THANE RURAL", "THANE CITY"],
    "navi mumbai": ["NAVI MUMBAI", "THANE CITY"],
    "nagpur": ["NAGPUR CITY", "NAGPUR RURAL"],
    "nashik": ["NASHIK CITY", "NASHIK RURAL"],
    "aurangabad": ["AURANGABAD CITY", "AURANGABAD RURAL"],

    # Karnataka Districts
    "bengaluru urban": ["BANGALORE CITY", "Bengaluru South District", "BANGALORE RURAL"],
    "bangalore urban": ["BANGALORE CITY", "Bengaluru South District", "BANGALORE RURAL"],
    "bengaluru rural": ["BANGALORE RURAL", "Bengaluru South District", "BANGALORE CITY"],
    "bangalore rural": ["BANGALORE RURAL", "Bengaluru South District", "BANGALORE CITY"],
    "bengaluru": ["BANGALORE CITY", "BANGALORE RURAL", "Bengaluru South District"],
    "bangalore": ["BANGALORE CITY", "BANGALORE RURAL", "Bengaluru South District"],
    "mysuru": ["MYSURU CITY", "MYSURU DISTRICT"],
    "mysore": ["MYSURU CITY", "MYSURU DISTRICT"],

    # West Bengal Districts
    "kolkata": ["KOLKATA CENTRAL DIVISION", "KOLKATA POLICE CYBER HQ", "Kolkata", "KOLKATA SOUTH DIVISION", "KOLKATA NORTH AND NORTH SUBURBAN DIVISION"],
    "howrah": ["HOWRAH POLICE COMMISSIONERATE", "Howrah Rural", "HOWRAH GRP"],
    "north 24 parganas": ["Barasat Police District", "BARRACKPORE POLICE COMMISSIONERATE", "BIDHANNAGAR POLICE COMMISSIONERATE", "Basirhat Police District", "Bongaon Police District"],
    "south 24 parganas": ["Baruipur Police District", "DIAMOND HARBOUR POLICE DISTRICT", "SUNDARBAN POLICE DISTRICT"],

    # Tamil Nadu Districts
    "chennai": ["CHENNAI - CCB", "CHENNAI - PEW EAST", "CHENNAI - PEW SOUTH", "CHENNAI - PEW NORTH", "CHENNAI - PEW WEST", "ADYAR", "ANNA NAGAR", "MYLAPORE", "T NAGAR"],
    "coimbatore": ["COIMBATORE CITY", "COIMBATORE", "CSCID-COIMBATORE"],
    "madurai": ["MADURAI CITY", "MADURAI", "CSCID - MADURAI"],

    # Uttar Pradesh Districts
    "lucknow": ["Lucknow Central- Commissionerate Lucknow", "Lucknow East- Commissionerate Lucknow", "Lucknow North- Commissionerate Lucknow", "Lucknow South- Commissionerate Lucknow", "Lucknow West- Commissionerate Lucknow", "GRP LUCKNOW"],
    "kanpur nagar": ["Central -Commissionerate Kanpur Nagar", "East- Commissionerate Kanpur Nagar", "South- Commissionerate Kanpur Nagar", "West- Commissionerate Kanpur Nagar"],
    "kanpur": ["Central -Commissionerate Kanpur Nagar", "East- Commissionerate Kanpur Nagar", "South- Commissionerate Kanpur Nagar"],
    "gautam buddha nagar": ["Commissionerate Gautam Buddha Nagar", "Central Commissionerate Gautam Buddha Nagar", "Greater Noida - Commissionerate Gautam Buddha Nagar"],
    "noida": ["Commissionerate Gautam Buddha Nagar", "Central Commissionerate Gautam Buddha Nagar", "Greater Noida - Commissionerate Gautam Buddha Nagar"],
    "ghaziabad": ["City - Commissionerate Ghaziabad", "Rural - Commissionerate Ghaziabad", "Trans Hindon - Commissionerate Ghaziabad"],
    "varanasi": ["Kashi Commissionerate Varanasi", "Gomati -Commissionerate Varanasi", "Varuna- Commissionerate Varanasi"],
    "prayagraj": ["City - Commissionerate Prayagraj", "Ganganagar - Commissionerate Prayagraj", "Yamunanagar - Commissionerate Prayagraj"],
    "agra": ["City - Commissionerate Agra", "East - Commissionerate Agra", "West - Commissionerate Agra"],
}

def clean_str(s: str) -> str:
    return re.sub(r'[^a-zA-Z0-9]', '', (s or '').lower())

def match_state(target_raw: str, options: list[dict]) -> dict | None:
    target_lower = (target_raw or '').strip().lower()
    target_clean = clean_str(target_lower)
    valid_opts = [o for o in options if o['index'] > 0 and o['text'] and not o['text'].startswith('-') and not o['text'].lower().startswith('select')]
    
    # Tier 1: Exact
    for opt in valid_opts:
        if opt['text'].strip().lower() == target_lower:
            return opt
    # Tier 2: Clean alphanumeric
    for opt in valid_opts:
        if clean_str(opt['text']) == target_clean:
            return opt
    # Tier 3: Aliases
    aliases = STATE_ALIASES.get(target_lower, [])
    for alias in aliases:
        alias_clean = clean_str(alias)
        for opt in valid_opts:
            opt_clean = clean_str(opt['text'])
            if opt_clean == alias_clean:
                return opt
        for opt in valid_opts:
            opt_clean = clean_str(opt['text'])
            if alias_clean in opt_clean or opt_clean in alias_clean:
                return opt
    # Tier 4: Longest Substring
    sorted_opts = sorted(valid_opts, key=lambda o: len(o['text']), reverse=True)
    for opt in sorted_opts:
        opt_clean = clean_str(opt['text'])
        if target_clean in opt_clean or (len(opt_clean) >= 4 and opt_clean in target_clean):
            return opt
    # Tier 5: Fuzzy
    best_ratio = 0.0
    best_cand = None
    for opt in valid_opts:
        ratio = difflib.SequenceMatcher(None, target_lower, opt['text'].lower()).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_cand = opt
    if best_cand and best_ratio >= 0.70:
        return best_cand
    return None

def match_district(target_raw: str, options: list[dict]) -> dict | None:
    valid_opts = [o for o in options if o['index'] > 0 and o['text'] and not o['text'].startswith('-') and not o['text'].lower().startswith('select')]
    if not valid_opts:
        return None
    if not target_raw or not target_raw.strip():
        return valid_opts[0]
    
    target_lower = target_raw.strip().lower()
    target_clean = clean_str(target_lower)

    # Tier 1: Exact case-insensitive match
    for opt in valid_opts:
        if opt['text'].strip().lower() == target_lower:
            return opt

    # Tier 2: Normalized alphanumeric match
    for opt in valid_opts:
        if clean_str(opt['text']) == target_clean:
            return opt

    # Tier 3: Special mappings (exact match on candidate first)
    mapped_cands = DISTRICT_SPECIAL_MAPPINGS.get(target_lower, [])
    for cand in mapped_cands:
        cand_clean = clean_str(cand)
        for opt in valid_opts:
            if clean_str(opt['text']) == cand_clean:
                return opt

    for cand in mapped_cands:
        cand_clean = clean_str(cand)
        for opt in valid_opts:
            opt_clean = clean_str(opt['text'])
            if len(cand_clean) >= 3 and cand_clean in opt_clean:
                return opt

    # Tier 4: Longest Substring Match (sorted descending so "SOUTH-EAST" matches before "SOUTH")
    sorted_opts = sorted(valid_opts, key=lambda o: len(o['text']), reverse=True)
    for opt in sorted_opts:
        opt_clean = clean_str(opt['text'])
        if len(opt_clean) >= 3 and (opt_clean in target_clean or target_clean in opt_clean):
            return opt

    # Tier 5: Token Overlap
    stop_words = {'district', 'city', 'rural', 'urban', 'commissionerate', 'police', 'dist', 'distt', 'division', 'hq', 'circle'}
    target_words = [w for w in re.findall(r'[a-zA-Z0-9]+', target_lower) if w not in stop_words]
    best_cand = None
    best_score = 0
    for opt in valid_opts:
        opt_words = [w for w in re.findall(r'[a-zA-Z0-9]+', opt['text'].lower()) if w not in stop_words]
        overlap = set(target_words).intersection(set(opt_words))
        score = len(overlap)
        for directional in ('east', 'west', 'north', 'south', 'central', 'sub', 'suburban', 'outer', 'inner'):
            if directional in target_words and directional in opt_words:
                score += 3
        if score > best_score:
            best_score = score
            best_cand = opt
    if best_cand and best_score > 0:
        return best_cand

    # Tier 6: Fuzzy
    best_ratio = 0.0
    best_cand = None
    for opt in valid_opts:
        ratio = difflib.SequenceMatcher(None, target_lower, opt['text'].lower()).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_cand = opt
    if best_cand and best_ratio >= 0.60:
        return best_cand

    return valid_opts[0]

def run_tests():
    with open("d:/shieldher/bot/cybercrime_districts.json", "r", encoding="utf-8") as f:
        all_districts = json.load(f)
    
    state_names = list(all_districts.keys())
    state_options = [{"index": 0, "value": "", "text": "--Select State--"}] + [
        {"index": i+1, "value": f"VAL_{i+1}", "text": name} for i, name in enumerate(state_names)
    ]

    print("=== TESTING STATE MATCHING ===")
    test_states = [
        ("DELHI", "DELHI"),
        ("Delhi", "DELHI"),
        ("NCT of Delhi", "DELHI"),
        ("ANDAMAN AND NICOBAR ISLANDS", "ANDAMAN & NICOBAR"),
        ("Jammu and Kashmir", "JAMMU & KASHMIR"),
        ("Dadra and Nagar Haveli and Daman and Diu", "DADRA & NAGAR HAVELI AND DAMAN & DIU"),
        ("Odisha", "ODISHA"),
        ("Orissa", "ODISHA"),
        ("Uttarakhand", "UTTARAKHAND"),
        ("Uttaranchal", "UTTARAKHAND"),
        ("MAHARASHTRA", "MAHARASHTRA"),
        ("Karnataka", "KARNATAKA"),
        ("Tamil Nadu", "TAMIL NADU"),
        ("West Bengal", "WEST BENGAL"),
        ("Uttar Pradesh", "UTTAR PRADESH"),
    ]

    state_passed = 0
    for input_st, expected in test_states:
        matched = match_state(input_st, state_options)
        if matched and matched['text'] == expected:
            state_passed += 1
            print(f"  [PASS] '{input_st}' -> '{matched['text']}'")
        else:
            actual = matched['text'] if matched else 'None'
            print(f"  [FAIL] '{input_st}' -> Expected '{expected}', got '{actual}'")

    print(f"\nState Tests: {state_passed}/{len(test_states)} passed.\n")

    print("=== TESTING DISTRICT MATCHING ===")
    test_cases = [
        # (State, User Input District, Expected Substring/Exact Match)
        ("DELHI", "South Delhi", "SOUTH"),
        ("DELHI", "South East Delhi", "SOUTH-EAST"),
        ("DELHI", "North West Delhi", "NORTH WEST"),
        ("DELHI", "North East Delhi", "NORTH EAST"),
        ("DELHI", "New Delhi", "NEW DELHI"),
        ("DELHI", "Central Delhi", "CENTRAL"),
        ("DELHI", "Shahdara", "SHAHDARA"),
        ("DELHI", "Dwarka", "DWARKA"),
        ("DELHI", "Rohini", "ROHINI"),
        ("MAHARASHTRA", "Mumbai Suburban", "MUMBAI"),
        ("MAHARASHTRA", "Mumbai City", "MUMBAI"),
        ("MAHARASHTRA", "Pune", "PUNE CITY"),
        ("MAHARASHTRA", "Pune Rural", "PUNE RURAL"),
        ("MAHARASHTRA", "Thane", "THANE CITY"),
        ("KARNATAKA", "Bengaluru Urban", "BANGALORE CITY"),
        ("KARNATAKA", "Bangalore", "BANGALORE CITY"),
        ("KARNATAKA", "Mysuru", "MYSURU CITY"),
        ("WEST BENGAL", "Kolkata", "KOLKATA"),
        ("TAMIL NADU", "Chennai", "CHENNAI"),
        ("TAMIL NADU", "Coimbatore", "COIMBATORE"),
        ("UTTAR PRADESH", "Lucknow", "Lucknow"),
        ("UTTAR PRADESH", "Noida", "Commissionerate Gautam Buddha Nagar"),
        ("UTTAR PRADESH", "Ghaziabad", "Commissionerate Ghaziabad"),
        ("GUJARAT", "Ahmedabad", "AHMEDABAD"),
    ]

    dist_passed = 0
    for state_key, user_dist, expected_needle in test_cases:
        actual_state_opts = all_districts.get(state_key, [])
        options = [{"index": 0, "value": "", "text": "--Select District--"}] + [
            {"index": i+1, "value": f"D_{i+1}", "text": d} for i, d in enumerate(actual_state_opts)
        ]
        matched = match_district(user_dist, options)
        if matched and (expected_needle.lower() in matched['text'].lower()):
            dist_passed += 1
            print(f"  [PASS] {state_key}: '{user_dist}' -> '{matched['text']}'")
        else:
            actual = matched['text'] if matched else 'None'
            print(f"  [FAIL] {state_key}: '{user_dist}' -> Expected contains '{expected_needle}', got '{actual}'")

    print(f"\nDistrict Tests: {dist_passed}/{len(test_cases)} passed.\n")

    if state_passed == len(test_states) and dist_passed == len(test_cases):
        print("ALL TESTS PASSED 100%!")
    else:
        print("SOME TESTS FAILED - PLEASE REVIEW")

if __name__ == "__main__":
    run_tests()
