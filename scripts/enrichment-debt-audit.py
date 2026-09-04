#!/usr/bin/env python3
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from difflib import SequenceMatcher

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "research-output"
OUT = ROOT / "enrichment-output"
OUT.mkdir(parents=True, exist_ok=True)

current = json.loads((ROOT / "data/dispensaries.json").read_text())
raw = json.loads((SRC / "ocm-licenses.json").read_text())
verification_html = (SRC / "ocm-verification.html").read_text(errors="replace")
summary = json.loads((SRC / "summary.json").read_text())
retrieved = summary["generatedAt"]

COUNTIES = {"New York", "Kings", "Queens", "Bronx", "Richmond", "Westchester"}
RO_TYPES = {"Registered Organization", "Adult-Use Registered Organization Dispensary License"}


def clean(value):
    s = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode().lower()
    s = s.replace("&", " and ").replace("’", "").replace("'", "")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9#]+", " ", s)).strip()


def canon_addr(value):
    s = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode().lower()
    s = re.split(r"\b(?:suite|ste|unit|apt|apartment|floor|fl|store|shop|space)\b|#", s)[0].strip()
    s = s.replace("avenue", "ave").replace("street", "st").replace("road", "rd").replace("boulevard", "blvd")
    return clean(s)


def sim(a, b):
    return SequenceMatcher(None, clean(a), clean(b)).ratio()


# Parse current OCM public-open table.
soup = BeautifulSoup(verification_html, "html.parser")
open_rows = []
table = soup.find("table")
if table:
    for tr in table.find_all("tr")[1:]:
        cells = tr.find_all("td")
        if len(cells) < 4:
            continue
        vals = [" ".join(td.stripped_strings) for td in cells]
        anchor = cells[4].find("a", href=True) if len(cells) > 4 else None
        open_rows.append({
            "entity": vals[0], "address": vals[1], "city": vals[2], "zip": vals[3],
            "website": anchor["href"] if anchor else (vals[4] if len(vals) > 4 else None)
        })

# Phase-1 unknowns: identify confident current appearances on OCM open list.
unknowns = [r for r in current if r.get("operationalStatus") == "UNKNOWN"]
unknown_audit = []
for r in unknowns:
    addr = canon_addr(r["address"]["line1"])
    city = clean(r["address"]["city"])
    z = r["address"]["zip"]
    name = r.get("dbaName") or r.get("legalName") or ""
    candidates = []
    for row in open_rows:
        addr_score = sim(addr, canon_addr(row["address"]))
        name_score = sim(name, row["entity"])
        city_score = sim(city, row["city"])
        zip_equal = z == row["zip"]
        if addr_score >= 0.90 or (addr_score >= 0.78 and name_score >= 0.75):
            score = 0.60 * addr_score + 0.25 * name_score + 0.10 * city_score + (0.05 if zip_equal else 0)
            candidates.append((score, addr_score, name_score, city_score, zip_equal, row))
    candidates.sort(reverse=True, key=lambda x: x[0])
    best = candidates[0] if candidates else None
    confident = bool(best and (best[1] >= 0.96 or (best[1] >= 0.88 and best[2] >= 0.82)))
    unknown_audit.append({
        "licenseNumber": r["licenseNumber"],
        "name": name,
        "registryAddress": f"{r['address']['line1']}, {r['address']['city']} {z}",
        "confidentOpenMatch": confident,
        "bestMatch": None if not best else {
            "score": round(best[0], 4), "addressScore": round(best[1], 4), "nameScore": round(best[2], 4),
            "cityScore": round(best[3], 4), "zipEqual": best[4], **best[5]
        }
    })

# Registered Organizations in scope, now representable by the phase-2 schema.
ro_rows = []
for row in raw:
    if row.get("county") not in COUNTIES or row.get("license_type") not in RO_TYPES:
        continue
    lic = row.get("license_number") or ""
    if not re.fullmatch(r"MM[0-9]{3,5}[A-Z]", lic):
        continue
    ro_rows.append({
        k: row.get(k) for k in [
            "license_number", "license_type", "license_status", "operational_status", "entity_name", "dba",
            "address_line_1", "address_line_2", "city", "county", "zip_code", "business_website",
            "hours_of_operation", "retail_activities_sales_with", "retail_activities_sales_no",
            "issued_date", "effective_date", "expiration_date", "retail_date_opened_to_public", "application_number"
        ]
    })

# ACTIVE records whose published expiration date is in the past.
today = datetime.now(timezone.utc).date().isoformat()
expired_active = []
for r in current:
    exp = (r.get("dates") or {}).get("licenseExpiration")
    if r.get("licenseStatus") == "ACTIVE" and exp and exp < today:
        live = next((x for x in raw if x.get("license_number") == r.get("licenseNumber")), None)
        expired_active.append({
            "licenseNumber": r.get("licenseNumber"), "publishedExpiration": exp,
            "freshRegistryStatus": live.get("license_status") if live else None,
            "freshRegistryExpiration": (live.get("expiration_date") or "")[:10] if live else None
        })

# Preserve the phase-1 ZIP warnings for targeted reconciliation.
zip_warning_rows = []
for r in current:
    warnings = r.get("warnings") or []
    if any("public-open list address differs" in w for w in warnings):
        zip_warning_rows.append({"licenseNumber": r["licenseNumber"], "name": r.get("dbaName") or r.get("legalName"), "address": r["address"], "warnings": warnings})

result = {
    "retrievedAt": retrieved,
    "currentCount": len(current),
    "publicOpenRows": len(open_rows),
    "registeredOrganizations": ro_rows,
    "registeredOrganizationCount": len(ro_rows),
    "unknownOperationalAudit": unknown_audit,
    "unknownCount": len(unknowns),
    "unknownNowConfidentOpen": [x["licenseNumber"] for x in unknown_audit if x["confidentOpenMatch"]],
    "expiredActiveAudit": expired_active,
    "expiredActiveCount": len(expired_active),
    "zipDiscrepancyAudit": zip_warning_rows,
    "zipDiscrepancyCount": len(zip_warning_rows)
}
(OUT / "debt-audit.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
print(json.dumps({k: v for k, v in result.items() if k not in {"registeredOrganizations", "unknownOperationalAudit", "expiredActiveAudit", "zipDiscrepancyAudit"}}, indent=2))
