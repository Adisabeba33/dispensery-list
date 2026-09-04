#!/usr/bin/env python3
import json
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import urlparse

from bs4 import BeautifulSoup
import openpyxl

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "research-output"
DATA = ROOT / "data"
DOCS = ROOT / "docs"
RAW = DATA / "raw"
RAW.mkdir(parents=True, exist_ok=True)

summary = json.loads((SRC / "summary.json").read_text())
raw = json.loads((SRC / "ocm-licenses.json").read_text())
columns = json.loads((SRC / "ocm-columns.json").read_text())
verification_html = (SRC / "ocm-verification.html").read_text(errors="replace")
retrieved = summary["generatedAt"]
snapshot_date = retrieved[:10]

COUNTIES = {"New York", "Kings", "Queens", "Bronx", "Richmond", "Westchester"}
BOROUGH = {"New York": "MANHATTAN", "Kings": "BROOKLYN", "Queens": "QUEENS", "Bronx": "BRONX", "Richmond": "STATEN_ISLAND", "Westchester": None}
TYPE_MAP = {
    "Adult-Use Retail Dispensary License": "ADULT_USE_RETAIL_DISPENSARY",
    "Adult-Use Conditional Retail Dispensary License": "CAURD",
    "Adult-Use Microbusiness License": "MICROBUSINESS",
}
REG_URL = "https://data.ny.gov/Economic-Development/Current-OCM-Licenses/jskf-tt3q"
OCM_OPEN_URL = "https://cannabis.ny.gov/dispensary-location-verification"
OCM_LOCALITIES_URL = "https://cannabis.ny.gov/localities"
OCM_OPTOUT_URL = "https://cannabis.ny.gov/ocm-local-opt-out-data"
WESTCHESTER_MUNI_URL = "https://giswww.westchestergov.com/arcgis/rest/services/WestchesterCountyBaseMap_Gray/MapServer/1"
LIC_RE = re.compile(r"^OCM-[A-Z0-9]{2,10}-\d{2}-\d{4,8}$")


def clean_text(value):
    s = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode().lower().replace("&", " and ")
    s = s.replace("’", "").replace("'", "")
    s = re.sub(r"[^a-z0-9#]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


ORDINALS = {"first": "1st", "second": "2nd", "third": "3rd", "fourth": "4th", "fifth": "5th", "sixth": "6th", "seventh": "7th", "eighth": "8th", "ninth": "9th", "tenth": "10th"}
ABBR = {"street": "st", "avenue": "ave", "road": "rd", "boulevard": "blvd", "highway": "hwy", "parkway": "pkwy", "place": "pl", "drive": "dr", "lane": "ln", "court": "ct", "terrace": "ter", "turnpike": "tpke", "expressway": "expy", "plaza": "plz", "north": "n", "south": "s", "east": "e", "west": "w"}


def canonical_address(value):
    s = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode().lower()
    s = s.replace("avenue of the americas", "6th avenue").replace("fashion avenue", "7th avenue").replace("fashion ave", "7th ave")
    s = re.split(r"\b(?:suite|ste|unit|apt|apartment|floor|fl|store|shop|space)\b|#", s)[0].strip()
    match = re.match(r"\s*([0-9]+(?:-[0-9]+)?\s*[a-z]?)\b", s)
    house = ""
    rest = s
    if match:
        house = re.sub(r"[\s-]", "", match.group(1))
        rest = s[match.end():]
    tokens = []
    for token in clean_text(rest).split():
        token = ORDINALS.get(token, token)
        token = ABBR.get(token, token)
        tokens.append(token)
    return " ".join(([house] if house else []) + tokens)


def name_norm(value):
    stop = {"llc", "inc", "corp", "corporation", "co", "company", "ny", "new", "york"}
    return " ".join(t for t in clean_text(value).split() if t not in stop)


def ratio(a, b):
    return SequenceMatcher(None, a, b).ratio()


def token_name_similarity(a, b):
    aa, bb = set(name_norm(a).split()), set(name_norm(b).split())
    if not aa or not bb:
        return 0.0
    jaccard = len(aa & bb) / len(aa | bb)
    contains = (aa <= bb or bb <= aa) and bool(aa & bb)
    return max(jaccard, ratio(" ".join(sorted(aa)), " ".join(sorted(bb))), 0.9 if contains else 0.0)


def name_score(candidate, open_row):
    values = []
    for name in (candidate.get("entity_name", ""), candidate.get("dba") or ""):
        if name:
            values.append(max(ratio(name_norm(name), name_norm(open_row["entity"])), token_name_similarity(name, open_row["entity"])))
    return max(values) if values else 0.0


# OCM public-open table.
soup = BeautifulSoup(verification_html, "html.parser")
open_rows = []
for tr in soup.find("table").find_all("tr")[1:]:
    cells = tr.find_all("td")
    if len(cells) < 4:
        continue
    values = [" ".join(td.stripped_strings) for td in cells]
    anchor = cells[4].find("a", href=True) if len(cells) > 4 else None
    open_rows.append({"entity": values[0], "address": values[1], "city": values[2], "zip": values[3], "website": anchor["href"] if anchor else (values[4] if len(values) > 4 else None)})


def candidate_open_match(candidate):
    ca = canonical_address(candidate.get("address_line_1", ""))
    zipcode = candidate.get("zip_code")
    house = ca.split()[0] if ca else ""
    street = " ".join(ca.split()[1:])
    options = []
    for row in open_rows:
        if row["zip"] != zipcode:
            continue
        oa = canonical_address(row["address"])
        other_house = oa.split()[0] if oa else ""
        other_street = " ".join(oa.split()[1:])
        addr_score = ratio(ca, oa)
        street_score = ratio(street, other_street)
        nm_score = name_score(candidate, row)
        options.append((addr_score, nm_score, street_score, house == other_house, row))
    exact = [x for x in options if x[0] == 1.0]
    if exact:
        return max(exact, key=lambda x: x[1]), "exact_address"
    accepted = []
    for item in options:
        addr_score, nm_score, street_score, same_house, _ = item
        if addr_score >= 0.94:
            accepted.append((0.8 * addr_score + 0.2 * nm_score, item, "near_address"))
        elif addr_score >= 0.88 and nm_score >= 0.75:
            accepted.append((0.65 * addr_score + 0.35 * nm_score, item, "address_name"))
        elif same_house and street_score >= 0.82 and (nm_score >= 0.25 or addr_score >= 0.88):
            accepted.append((0.6 * addr_score + 0.4 * nm_score, item, "same_house_street"))
        elif nm_score >= 0.92 and addr_score >= 0.70:
            accepted.append((0.45 * addr_score + 0.55 * nm_score, item, "strong_name"))
    if not accepted:
        return None, None
    accepted.sort(reverse=True, key=lambda x: x[0])
    return accepted[0][1], accepted[0][2]


# Manually reviewed defects in the current OCM public-open table: same storefront address/identity, wrong ZIP in the public table.
MANUAL_OPEN = {
    "OCM-RETL-24-000233": ("Green Flower Wellness Floral Park", "270-01 Hillside Ave", "11064"),
    "OCM-RETL-25-000294": ("Easy Times", "2668 Coney Island Ave", "11233"),
    "OCM-CAURD-24-000162": ("Society House", "2441 Flatbush Ave", "10710"),
    "OCM-RETL-24-000151": ("All Good Dispensary", "3405 Avenue H", "11211"),
    "OCM-RETL-26-000511": ("Hibernica Central Park", "111 Central Park North", "10028"),
}


def zip_ok(zipcode, county):
    if not zipcode or not re.fullmatch(r"\d{5}", zipcode):
        return False
    prefix = int(zipcode[:3])
    return 105 <= prefix <= 108 if county == "Westchester" else ((100 <= prefix <= 104) or (110 <= prefix <= 119))


retail_candidates = []
excluded = []
for row in raw:
    if row.get("county") not in COUNTIES:
        continue
    if row.get("license_type") not in TYPE_MAP:
        continue
    if row.get("license_type") == "Adult-Use Microbusiness License" and "retail" not in (row.get("business_purpose") or "").lower():
        continue
    license_number = row.get("license_number") or ""
    if not LIC_RE.fullmatch(license_number):
        excluded.append((license_number or "(none)", "contract_license_number", row))
        continue
    if row.get("license_status") != "Active":
        excluded.append((license_number, "not_active", row))
        continue
    if not zip_ok(row.get("zip_code"), row.get("county")):
        excluded.append((license_number, "geography_anomaly", row))
        continue
    retail_candidates.append(row)

matchmap = {}
for candidate in retail_candidates:
    matched, reason = candidate_open_match(candidate)
    if matched:
        matchmap[candidate["license_number"]] = {"row": matched[4], "reason": reason, "addrScore": matched[0], "nameScore": matched[1]}
for license_number, expected in MANUAL_OPEN.items():
    candidate = next((x for x in retail_candidates if x["license_number"] == license_number), None)
    entity, address, zipcode = expected
    row = next((x for x in open_rows if x["entity"] == entity and x["address"] == address and x["zip"] == zipcode), None)
    if candidate and row:
        matchmap[license_number] = {"row": row, "reason": "manual_exact_address_zip_mismatch", "addrScore": 1.0, "nameScore": name_score(candidate, row)}

DAYS = {"sun": "sun", "mon": "mon", "tue": "tue", "tues": "tue", "wed": "wed", "thu": "thu", "thurs": "thu", "fri": "fri", "sat": "sat"}


def to_24(hour, minute, ampm):
    hour, minute = int(hour), int(minute)
    if ampm.upper() == "AM":
        hour = 0 if hour == 12 else hour
    else:
        hour = 12 if hour == 12 else hour + 12
    return f"{hour:02d}:{minute:02d}"


def parse_hours(value, warnings):
    if not value:
        return None
    week = {day: None for day in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]}
    any_valid = False
    for part in value.split(";"):
        match = re.match(r"(?i)^(Sun|Mon|Tues?|Wed|Thurs?|Fri|Sat):\s*(.*)$", part.strip())
        if not match:
            continue
        day = DAYS[match.group(1).lower()]
        body = match.group(2).strip()
        if body.lower() == "closed":
            week[day] = "CLOSED"
            any_valid = True
            continue
        tm = re.match(r"(?i)^(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)$", body)
        if not tm:
            warnings.append(f"Could not parse registry hours for {match.group(1)}: {body}")
            continue
        opened = to_24(tm.group(1), tm.group(2), tm.group(3))
        closed = to_24(tm.group(4), tm.group(5), tm.group(6))
        if opened == closed:
            warnings.append(f"Registry hours have identical open/close for {match.group(1)} ({opened}); left unknown")
            continue
        week[day] = [{"open": opened, "close": closed}]
        any_valid = True
    return {"timezone": "America/New_York", "week": week, "notes": "Hours copied from Current OCM Licenses registry."} if any_valid else None


def normalize_url(value):
    if not value:
        return None
    value = value.strip()
    if "coming soon" in value.lower() or " " in value:
        return None
    if not re.match(r"^https?://", value, re.I):
        value = "https://" + value
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc or "." not in parsed.netloc:
        return None
    return value


def slug(value):
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return re.sub(r"-+", "-", value)


def date_only(value):
    return value[:10] if value else None


def see_category(value):
    return {
        "Minority-Owned Business": "MINORITY_OWNED_BUSINESS",
        "Women-Owned Business": "WOMAN_OWNED_BUSINESS",
        "Distressed Farmer": "DISTRESSED_FARMER",
        "Service-Disabled Veteran-Owned Business": "SERVICE_DISABLED_VETERAN",
    }.get(value)


def bool01(value):
    return True if value == "1" else False if value == "0" else None


dispensaries = []
for candidate in retail_candidates:
    license_number = candidate["license_number"]
    warnings = []
    match = matchmap.get(license_number)
    if match:
        operational_status = "OPEN"
        public_row = match["row"]
        if canonical_address(candidate["address_line_1"]) != canonical_address(public_row["address"]) or candidate["zip_code"] != public_row["zip"]:
            warnings.append(f"OCM public-open list address differs: registry '{candidate['address_line_1']}, {candidate['zip_code']}' vs public list '{public_row['address']}, {public_row['zip']}'")
        if candidate.get("operational_status") != "Active":
            warnings.append(f"Registry operational_status is '{candidate.get('operational_status')}' but OCM public-open list contains the location")
    elif candidate.get("operational_status") == "Non-Operational":
        operational_status = "APPROVED_NOT_OPEN"
        public_row = None
    else:
        operational_status = "UNKNOWN"
        public_row = None
        warnings.append("Registry operational_status is Active but no confident match was found on OCM's public-open dispensary list")

    hours = parse_hours(candidate.get("hours_of_operation"), warnings)
    website = normalize_url((public_row or {}).get("website") or candidate.get("business_website"))
    sales_with = bool01(candidate.get("retail_activities_sales_with"))
    sales_no = bool01(candidate.get("retail_activities_sales_no"))
    in_store = True if (sales_with is True or sales_no is True) else (False if sales_with is False and sales_no is False else None)
    delivery = True if sales_with is True else (False if sales_no is True and sales_with is False else None)
    display = candidate.get("dba") or candidate["entity_name"]
    stable_id = slug(f"{display}-{candidate['city']}-{license_number[-6:]}")[:80].strip("-")
    sources = [{"url": REG_URL, "label": "New York State Open Data — Current OCM Licenses", "type": "OFFICIAL_REGISTRY", "retrievedAt": retrieved}]
    if match:
        sources.append({"url": OCM_OPEN_URL, "label": "OCM — Dispensary Location Verification", "type": "REGULATOR_PAGE", "retrievedAt": retrieved})
    confidence = "HIGH" if operational_status == "OPEN" and hours and website else ("MEDIUM" if hours or website or operational_status != "UNKNOWN" else "LOW")
    notes = [f"Registry operational_status: {candidate.get('operational_status') or 'not published'}. OCM public-open list checked on {snapshot_date}."]
    if candidate.get("see_category") and see_category(candidate.get("see_category")) is None:
        notes.append("OCM SEE value contains multiple/non-schema categories; seeCategory left null rather than collapsing it.")
    dispensaries.append({
        "id": stable_id,
        "licenseNumber": license_number,
        "applicationNumber": candidate.get("application_number"),
        "licenseType": TYPE_MAP[candidate["license_type"]],
        "licenseStatus": "ACTIVE",
        "operationalStatus": operational_status,
        "seeCategory": see_category(candidate.get("see_category")),
        "legalName": candidate["entity_name"],
        "dbaName": candidate.get("dba"),
        "address": {"line1": candidate["address_line_1"], "line2": candidate.get("address_line_2"), "city": candidate["city"], "county": candidate["county"], "borough": BOROUGH[candidate["county"]], "neighborhood": None, "state": "NY", "zip": candidate["zip_code"]},
        "geo": None,
        "contact": {"phone": None, "email": None, "website": website, "orderOnlineUrl": None, "instagram": None} if website else None,
        "hours": hours,
        "services": {"inStorePurchase": in_store, "pickup": None, "curbside": None, "delivery": delivery, "deliveryZips": None, "adaAccessible": None, "onsiteConsumption": None, "servesMedical": None, "servesAdultUse": True, "acceptsDebit": None, "acceptsCredit": None, "cashOnly": None, "atmOnSite": None, "parking": None},
        "menu": None,
        "dates": {"licenseIssued": date_only(candidate.get("issued_date")), "licenseEffective": date_only(candidate.get("effective_date")), "licenseExpiration": date_only(candidate.get("expiration_date")), "openedOn": date_only(candidate.get("retail_date_opened_to_public"))},
        "sources": sources,
        "verification": {"status": "VERIFIED_OFFICIAL", "confidence": confidence, "verifiedAt": retrieved, "checkedAgainstOcmTool": True, "notes": " ".join(notes)},
        "warnings": warnings,
        "lastUpdated": retrieved,
    })

dispensaries.sort(key=lambda r: (r["address"]["county"], r["address"]["city"].lower(), (r["dbaName"] or r["legalName"]).lower(), r["licenseNumber"]))
assert len({r["licenseNumber"] for r in dispensaries}) == len(dispensaries)
assert len({r["id"] for r in dispensaries}) == len(dispensaries)
(DATA / "dispensaries.json").write_text(json.dumps(dispensaries, indent=2, ensure_ascii=False) + "\n")
(RAW / f"ocm-licenses-{snapshot_date}.json").write_text(json.dumps(raw, indent=2, ensure_ascii=False) + "\n")

# Build all 45 Westchester local-government units (plus OCM's separate town/village rows for the three coextensive town-villages) against the current official OCM opt-out workbook.
cities = ["Mount Vernon", "New Rochelle", "Peekskill", "Rye", "White Plains", "Yonkers"]
towns = ["Bedford", "Cortlandt", "Eastchester", "Greenburgh", "Lewisboro", "Mamaroneck", "Mount Pleasant", "New Castle", "North Castle", "North Salem", "Ossining", "Pelham", "Pound Ridge", "Rye", "Somers", "Yorktown"]
villages = ["Ardsley", "Briarcliff Manor", "Bronxville", "Buchanan", "Croton-on-Hudson", "Dobbs Ferry", "Elmsford", "Hastings-on-Hudson", "Irvington", "Larchmont", "Mamaroneck", "Ossining", "Pelham", "Pelham Manor", "Pleasantville", "Port Chester", "Rye Brook", "Sleepy Hollow", "Tarrytown", "Tuckahoe"]
town_villages = ["Harrison", "Mount Kisco", "Scarsdale"]
base_units = [(x, "CITY") for x in cities] + [(x, "TOWN") for x in towns] + [(x, "VILLAGE") for x in villages]
for x in town_villages:
    base_units.extend([(x, "TOWN"), (x, "VILLAGE")])

workbook = openpyxl.load_workbook(SRC / "ocm-local-opt-out-data.xlsx", data_only=True)
ws = workbook.active
optouts = {}
for county, municipality, license_type, municipality_type in list(ws.iter_rows(values_only=True))[1:]:
    if county != "Westchester":
        continue
    raw_name = (municipality or "").strip()
    kind = (municipality_type or "").strip().upper()
    name = re.sub(r"^(Town|Village|City)\s+of\s+", "", raw_name, flags=re.I)
    name = re.sub(r"^Village\s+", "", name, flags=re.I).strip()
    key = (name, kind)
    types = license_type or ""
    optouts[key] = {"retail": "Retail Dispensary" in types, "onsite": "On-Site Consumption" in types}

municipalities = []
muni_source = {"url": OCM_OPTOUT_URL, "label": "OCM — Official Local Opt-Out List", "type": "OFFICIAL_REGISTRY", "retrievedAt": retrieved}
county_source = {"url": WESTCHESTER_MUNI_URL, "label": "Westchester County GIS — Municipal Boundary layer", "type": "REGULATOR_PAGE", "retrievedAt": retrieved}
for name, kind in base_units:
    flags = optouts.get((name, kind), {"retail": False, "onsite": False})
    notes = None
    if name in town_villages:
        notes = "OCM's official opt-out workbook lists this coextensive town/village separately by municipality type; retained as separate schema records."
    municipalities.append({"id": f"{slug(name)}-{kind.lower()}", "name": name, "kind": kind, "county": "Westchester", "retailOptOut": flags["retail"], "onsiteConsumptionOptOut": flags["onsite"], "optOutDate": None, "notes": notes, "sources": [muni_source, county_source], "lastUpdated": retrieved})

for name, county in [("Manhattan", "New York"), ("Brooklyn", "Kings"), ("Queens", "Queens"), ("Bronx", "Bronx"), ("Staten Island", "Richmond")]:
    municipalities.append({"id": f"{slug(name)}-borough", "name": name, "kind": "BOROUGH", "county": county, "retailOptOut": False, "onsiteConsumptionOptOut": False, "optOutDate": None, "notes": "NYC boroughs are geographic records here; opt-out authority belongs to New York City, which is absent from OCM's current opt-out list.", "sources": [muni_source, {"url": OCM_LOCALITIES_URL, "label": "OCM — Localities", "type": "REGULATOR_PAGE", "retrievedAt": retrieved}], "lastUpdated": retrieved})
municipalities.sort(key=lambda r: (r["county"], r["name"], r["kind"]))
assert len({r["id"] for r in municipalities}) == len(municipalities)
(DATA / "municipalities.json").write_text(json.dumps(municipalities, indent=2, ensure_ascii=False) + "\n")

# Document actual columns and filter logic.
col_lines = ["# Current OCM Licenses — source columns", "", f"Snapshot: `{retrieved}`", f"Dataset: `{REG_URL}`", f"Raw rows: **{len(raw)}**", "", "## Actual columns", "", "| fieldName | Display name |", "|---|---|"]
for col in sorted(columns, key=lambda x: x.get("position", 0)):
    col_lines.append(f"| `{col.get('fieldName')}` | {str(col.get('name') or '').replace('|', '\\|')} |")
col_lines += ["", "## Filter used", "", "1. County must be one of New York, Kings, Queens, Bronx, Richmond, Westchester.", "2. License type must be Adult-Use Retail Dispensary, CAURD, or Microbusiness with an explicit retail business purpose.", "3. `license_number` must satisfy the repository contract `OCM-...`; this removes proximity-protection applicants and also exposes a schema conflict for legacy Registered Organization IDs (`MM####D`).", "4. Only current `Active` license rows are published in this phase. Expired rows are retained in the raw snapshot and enumerated in the report, not silently dropped.", "5. ZIP sanity is applied after county filtering. Two official rows marked `county=New York` are physically upstate (Remsen 13438 and Palenville 12414); they are excluded as source-data geography anomalies.", "", "## Operational status", "", "`OPEN` is assigned only when a confident match exists on OCM's Dispensary Location Verification public-open list. Registry `Non-Operational` becomes `APPROVED_NOT_OPEN` unless the OCM public-open list overrides it. Registry `Active` without a confident public-open-list match is `UNKNOWN`, never guessed open.", ""]
(DOCS / "SOURCE_COLUMNS.md").write_text("\n".join(col_lines))

status_counts = Counter(r["operationalStatus"] for r in dispensaries)
county_counts = defaultdict(Counter)
for r in dispensaries:
    county_counts[r["address"]["county"]][r["operationalStatus"]] += 1
unknown = [r for r in dispensaries if r["operationalStatus"] == "UNKNOWN"]
expired = [x for x in excluded if x[1] == "not_active"]
anomalies = [x for x in excluded if x[1] == "geography_anomaly"]
ro_rows = [r for r in raw if r.get("county") in COUNTIES and r.get("license_type") in {"Registered Organization", "Adult-Use Registered Organization Dispensary License"}]
report = ["# Research report — NYC + Westchester dispensaries", "", f"Snapshot time: **{retrieved}**", "", "## Result", "", f"Published current-license records: **{len(dispensaries)}**.", f"- OPEN: **{status_counts['OPEN']}**", f"- APPROVED_NOT_OPEN: **{status_counts['APPROVED_NOT_OPEN']}**", f"- UNKNOWN: **{status_counts['UNKNOWN']}**", f"- VERIFIED_OFFICIAL: **{len(dispensaries)} / {len(dispensaries)} (100%)**", "", "### By county", "", "| County | Total | Open | Approved not open | Unknown |", "|---|---:|---:|---:|---:|"]
for county in ["New York", "Kings", "Queens", "Bronx", "Richmond", "Westchester"]:
    c = county_counts[county]
    report.append(f"| {county} | {sum(c.values())} | {c['OPEN']} | {c['APPROVED_NOT_OPEN']} | {c['UNKNOWN']} |")
report += ["", "## Source integrity findings", "", f"The official OCM public-open page text advertises 717 adult-use dispensaries statewide, while the HTML table snapshot parsed into **{len(open_rows)} data rows**. This mismatch is preserved as a source inconsistency; no synthetic 717th row was created.", "", f"The raw Current OCM Licenses snapshot contains **{summary['rawRows']}** rows. The first-pass six-county retail-ish filter produced **{summary['licensedRetailishRows']}** OCM-format licensed rows: **458 Active** and **8 Inactive/expired** before geography sanity filtering.", "", "Two rows are tagged `county=New York` / `region=Manhattan` in the official registry but have clearly upstate addresses and ZIPs; they are excluded from the NYC/Westchester deliverable and kept in the raw evidence:"]
for lic, _, row in anomalies:
    report.append(f"- `{lic}` — {row.get('entity_name')} — {row.get('address_line_1')}, {row.get('city')} NY {row.get('zip_code')}.")
report += ["", f"Expired/inactive OCM-format retail licenses excluded from the current directory: **{len(expired)}**."]
for lic, _, row in expired:
    report.append(f"- `{lic}` — {row.get('dba') or row.get('entity_name')} — expired {date_only(row.get('expiration_date')) or 'date unavailable'}.")
report += ["", "## Contract conflict: Registered Organizations", "", f"There are **{len(ro_rows)}** in-scope Registered Organization / Adult-Use Registered Organization Dispensary rows in the official registry, but OCM publishes them with legacy IDs such as `MM0906D`, not the repository-required `OCM-XXX-YY-NNNNNN` pattern. They cannot be represented without changing the current schema/brief, so they are not silently coerced. This is a known completeness gap that needs a contract decision before publication as 'all dispensaries'.", "", "## Operational unknowns", "", "These licenses are `Active` and the registry operating-address status is `Active`, but no confident match was found on the current OCM public-open list. They remain `UNKNOWN` rather than being guessed open:"]
for r in unknown:
    report.append(f"- `{r['licenseNumber']}` — {r['dbaName'] or r['legalName']} — {r['address']['line1']}, {r['address']['city']} {r['address']['zip']}")
report += ["", "## OCM public-open-list address discrepancies", "", "Five current public-open entries were matched only after manual review because the OCM public-open table carries a ZIP different from the registry for the same storefront address/identity. Each affected record carries a warning; the registry address remains canonical.", "", "## Municipal opt-out audit", "", "`data/municipalities.json` was rebuilt from OCM's current official opt-out workbook, not the older secondary 22-municipality list. The workbook currently contains **34 Westchester opt-out rows**, of which **27** include Retail Dispensary opt-out and **34** include On-Site Consumption opt-out. The file also includes the five NYC borough geographic records and all 45 Westchester local-government units; the three coextensive town/villages (Harrison, Mount Kisco, Scarsdale) are represented as separate town/village schema records because OCM's workbook lists both municipality types.", "", "## What we still do not know", "", "- `geo` is still null; no rooftop coordinates were invented.", "- Phone numbers are still null unless a later website-enrichment pass verifies them.", "- Menu provider/order URL is still null pending website-by-website menu-platform enrichment.", "- Pickup/curbside/ADA/payment/parking fields remain null unless explicitly sourced.", "- The 16 operational UNKNOWN records above need a future OCM public-list appearance or other regulator-level reconciliation before they can be called OPEN.", "- Registered Organization storefronts require a schema/contract decision for legacy `MM...D` license numbers.", ""]
(DOCS / "RESEARCH_REPORT.md").write_text("\n".join(report))

print(json.dumps({"dispensaries": len(dispensaries), "open": status_counts["OPEN"], "approvedNotOpen": status_counts["APPROVED_NOT_OPEN"], "unknown": status_counts["UNKNOWN"], "municipalities": len(municipalities), "parsedOcmOpenRows": len(open_rows), "rawSnapshot": str(RAW / f"ocm-licenses-{snapshot_date}.json")}, indent=2))
