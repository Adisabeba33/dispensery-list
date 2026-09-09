#!/usr/bin/env python3
import json
import re
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
ENDPOINTS = ROOT / "data/menu-endpoints.json"
DISPENSARIES = ROOT / "data/dispensaries.json"

EXPECTED = {
    "OCM-CAURD-25-000281", "OCM-CAURD-24-000165", "OCM-CAURD-24-000051",
    "OCM-RETL-25-000360", "OCM-CAURD-24-000145", "OCM-RETL-24-000063",
    "OCM-RETL-25-000285", "OCM-RETL-24-000144", "OCM-CAURD-26-000336",
    "OCM-CAURD-24-000196", "OCM-RETL-24-000171", "OCM-RETL-24-000260",
    "OCM-CAURD-24-000131", "OCM-RETL-24-000008", "OCM-CAURD-25-000304",
    "OCM-RETL-24-000261", "OCM-RETL-24-000189", "OCM-RETL-24-000151",
    "OCM-CAURD-26-000325", "OCM-RETL-24-000055", "OCM-CAURD-25-000305",
    "OCM-RETL-26-000488", "OCM-CAURD-25-000292", "OCM-CAURD-25-000284",
    "OCM-RETL-24-000133", "OCM-CAURD-25-000324", "OCM-RETL-25-000466",
}
PLATFORMS = {"DUTCHIE", "BLAZE", "TREEZ", "IHEARTJANE", "MEADOW", "PROPRIETARY", "OTHER"}
GATES = {"none", "simple-button", "date-of-birth-form", "login"}
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

errors = []
rows = json.loads(ENDPOINTS.read_text())
shops = json.loads(DISPENSARIES.read_text())
known_licenses = {r["licenseNumber"] for r in shops}

if not isinstance(rows, list):
    errors.append("data/menu-endpoints.json must be a JSON array")
    rows = []

licenses = [r.get("licenseNumber") for r in rows if isinstance(r, dict)]
if len(rows) != 27:
    errors.append(f"expected exactly 27 endpoint records, got {len(rows)}")
if len(set(licenses)) != len(licenses):
    errors.append("licenseNumber values must be unique")
if set(licenses) != EXPECTED:
    missing = sorted(EXPECTED - set(licenses))
    extra = sorted(set(licenses) - EXPECTED)
    if missing:
        errors.append(f"missing target licences: {missing}")
    if extra:
        errors.append(f"unexpected licences: {extra}")

for i, row in enumerate(rows):
    pfx = f"row {i + 1} ({row.get('licenseNumber')})"
    lic = row.get("licenseNumber")
    if lic not in known_licenses:
        errors.append(f"{pfx}: licence does not exist in data/dispensaries.json")
    for key in ("licenseNumber", "menuUrl", "platform", "robotsAllows", "flowerVisibleWithoutLogin", "ageGate", "checkedAt", "notes"):
        if key not in row:
            errors.append(f"{pfx}: missing field {key}")
    url = row.get("menuUrl")
    platform = row.get("platform")
    robots = row.get("robotsAllows")
    flower = row.get("flowerVisibleWithoutLogin")
    if url is None:
        # The brief's global rule says unknown must stay null. With no menu host,
        # robots/platform cannot honestly be converted to booleans/enums.
        if platform is not None:
            errors.append(f"{pfx}: platform must be null when menuUrl is null")
        if robots is not None:
            errors.append(f"{pfx}: robotsAllows must be null when there is no menu host")
        if flower is not False:
            errors.append(f"{pfx}: flowerVisibleWithoutLogin must be false when menuUrl is null")
    else:
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            errors.append(f"{pfx}: invalid menuUrl {url!r}")
        if platform not in PLATFORMS:
            errors.append(f"{pfx}: invalid platform {platform!r}")
        if robots is None:
            # Unknown has to be sayable. A host that answers 403 to
            # /robots.txt has stated no crawl rule, and the audit already
            # recorded once (docs/MENU_ENDPOINTS_REPORT.md, Dutchie) how a
            # 403 read as a prohibition takes a human to undo. Null is
            # allowed, but only with the reason written down.
            if "robots" not in (row.get("notes") or "").lower():
                errors.append(
                    f"{pfx}: robotsAllows may be null only if notes say why robots.txt could not be read"
                )
        elif not isinstance(robots, bool):
            errors.append(f"{pfx}: robotsAllows must be true, false or null when menuUrl exists")
        if not isinstance(flower, bool):
            errors.append(f"{pfx}: flowerVisibleWithoutLogin must be boolean")
    if row.get("ageGate") not in GATES:
        errors.append(f"{pfx}: invalid ageGate {row.get('ageGate')!r}")
    if not isinstance(row.get("checkedAt"), str) or not DATE_RE.fullmatch(row["checkedAt"]):
        errors.append(f"{pfx}: checkedAt must be YYYY-MM-DD")
    if not isinstance(row.get("notes"), str) or not row["notes"].strip():
        errors.append(f"{pfx}: notes must be a non-empty string")

if errors:
    print("Menu endpoint validation FAILED")
    for e in errors:
        print("ERROR:", e)
    raise SystemExit(1)

print(f"Menu endpoint validation OK: {len(rows)} records, {sum(r['menuUrl'] is not None for r in rows)} endpoints, {sum(r['menuUrl'] is None for r in rows)} unresolved/no-menu")
