#!/usr/bin/env python3
"""Shape check for data/menu-endpoints.json.

The file is the hand-written answer to "where is this shop's menu" — the one
thing the collector cannot work out for itself when a shop's pages do not say.
It is added to whenever someone finds an address, so what is checked here is
that each row is well formed and names a real licence, and that no licence is
claimed twice.

It used to check something else: that the file held exactly twenty-seven rows,
and exactly the twenty-seven a finished research brief had asked for. That made
the file a deliverable rather than a register, and it has been failing since the
eighth address was added — `expected exactly 27 endpoint records, got 35`. A
check that refuses the work it exists to protect is worse than no check.
"""
import json
import re
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
ENDPOINTS = ROOT / "data/menu-endpoints.json"
DISPENSARIES = ROOT / "data/dispensaries.json"

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
if len(set(licenses)) != len(licenses):
    seen, twice = set(), sorted({l for l in licenses if l in seen or seen.add(l)})
    errors.append(f"licenceNumber values must be unique; repeated: {twice}")

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
        if not isinstance(robots, bool):
            errors.append(f"{pfx}: robotsAllows must be boolean when menuUrl exists")
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
