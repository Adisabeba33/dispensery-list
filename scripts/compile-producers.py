#!/usr/bin/env python3
"""Builds data/producers.json from the OCM licence snapshot already in the repo.

The register of shops answers "where can I buy this". This one answers "who
made it" — and that is the half the shops cannot supply. A dispensary resells;
terpene profiles, aroma and the description of a cultivar that exists nowhere
in any encyclopedia originate with the licensee who grew it.

Same discipline as the dispensary register: only licences the state publishes
as active, licence numbers verbatim, nothing inferred that the registry does
not state, and every record carrying its source.

    python scripts/compile-producers.py
"""
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
RAW = DATA / "raw"

REG_URL = "https://data.ny.gov/Economic-Development/Current-OCM-Licenses/jskf-tt3q"

TYPE_MAP = {
    "Adult-Use Cultivator License": "CULTIVATOR",
    "Adult-Use Processor License": "PROCESSOR",
    "Adult-Use Processor Type Three-Branding": "PROCESSOR_BRANDING",
    "Adult-Use Processor Type Three-Flower": "PROCESSOR_FLOWER",
    "Adult-Use Microbusiness License": "MICROBUSINESS",
}
STATUS_MAP = {
    "Active": "ACTIVE",
    "Provisional": "PROVISIONAL",
    "Pending": "PENDING",
    "Suspended": "SUSPENDED",
    "Expired": "EXPIRED",
    "Surrendered": "SURRENDERED",
    "Revoked": "REVOKED",
}
LIC_RE = re.compile(r"^OCM-[A-Z0-9]{2,10}-\d{2}-\d{4,8}$")

# Words that identify nothing: every second licensee is an LLC in cannabis.
STOP = {
    "llc", "inc", "co", "company", "corp", "corporation", "ltd", "the", "ny",
    "nys", "newyork", "cannabis", "farms", "farm", "gardens", "garden",
    "holdings", "group", "and", "of", "enterprises", "brands",
}


def slug(value: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (value or "").lower())
    return s.strip("-")[:80].strip("-")


def tokens(value: str) -> set:
    words = [w for w in re.sub(r"[^a-z0-9 ]", " ", (value or "").lower()).split() if w]
    significant = [w for w in words if w not in STOP]
    return set(significant or words)


def flag(value):
    """The registry writes these as "0"/"1" strings, absent when it knows nothing."""
    if value is None or value == "":
        return None
    return str(value).strip() in {"1", "true", "True"}


def date_only(value):
    return value[:10] if isinstance(value, str) and len(value) >= 10 else None


snapshots = sorted(RAW.glob("ocm-licenses-*.json"))
if not snapshots:
    raise SystemExit("No registry snapshot in data/raw. Run scripts/research-bootstrap.mjs first.")
snapshot = snapshots[-1]
raw = json.loads(snapshot.read_text())
retrieved = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
snapshot_date = snapshot.stem.replace("ocm-licenses-", "")

producers = []
skipped = {"not_a_producer": 0, "no_licence_number": 0, "not_active": 0, "extra_location": 0}
seen = {}

for row in raw:
    licence_type = TYPE_MAP.get(row.get("license_type"))
    if not licence_type:
        skipped["not_a_producer"] += 1
        continue

    licence = (row.get("license_number") or "").strip()
    if not LIC_RE.fullmatch(licence):
        # Applicants awaiting a number are not licensees yet.
        skipped["no_licence_number"] += 1
        continue
    if row.get("license_status") != "Active":
        skipped["not_active"] += 1
        continue
    if licence in seen:
        # The same licence appears once per location, differing only in county
        # and region. Those are further sites, not repeats: fold them in.
        existing = seen[licence]
        for field, key in (("counties", "county"), ("regions", "region")):
            value = row.get(key)
            if value and value not in existing[field]:
                existing[field].append(value)
        existing["locationCount"] += 1
        skipped["extra_location"] += 1
        continue

    entity = (row.get("entity_name") or "").strip()
    if not entity:
        continue

    cultivation = None
    if flag(row.get("cultivation_indoor")) is not None:
        cultivation = {
            "indoor": bool(flag(row.get("cultivation_indoor"))),
            "outdoor": bool(flag(row.get("cultivation_outdoor"))),
            "mixedLight": bool(flag(row.get("cultivation_mixed_light"))),
            "combination": bool(flag(row.get("cultivation_combination"))),
        }
    processing = None
    if flag(row.get("processing_activities")) is not None:
        processing = {
            "any": bool(flag(row.get("processing_activities"))),
            "blending": bool(flag(row.get("processing_activities_blending"))),
            "branding": bool(flag(row.get("processing_activities_branding"))),
        }

    operational = row.get("operational_status")
    record = {
        # The licence-type code belongs in the id: one company holding a
        # cultivator and a processor licence gets the same tail on both, and
        # without it the two records collapse into one.
        "id": slug(f"{entity}-{licence.split('-')[1]}-{licence[-6:]}"),
        "licenseNumber": licence,
        "applicationNumber": row.get("application_number") or None,
        "licenseType": licence_type,
        "licenseStatus": STATUS_MAP.get(row.get("license_status"), "ACTIVE"),
        "operationalStatus": (
            "ACTIVE" if operational == "Active"
            else "NON_OPERATIONAL" if operational
            else "UNKNOWN"
        ),
        "entityName": entity,
        "counties": [row["county"]] if row.get("county") else [],
        "regions": [row["region"]] if row.get("region") else [],
        "locationCount": 1,
        "businessPurpose": row.get("business_purpose") or None,
        "tier": row.get("tier_type") or None,
        "cultivation": cultivation,
        "processing": processing,
        "primaryContactName": row.get("primary_contact_name") or None,
        "dates": {
            "licenseIssued": date_only(row.get("issued_date")),
            "licenseEffective": date_only(row.get("effective_date")),
            "licenseExpiration": date_only(row.get("expiration_date")),
        },
        "brands": [],
        "sources": [{
            "url": REG_URL,
            "label": "New York State Open Data — Current OCM Licenses",
            "type": "OFFICIAL_REGISTRY",
            "retrievedAt": retrieved,
        }],
        "verification": {
            "status": "VERIFIED_OFFICIAL",
            "verifiedAt": retrieved,
            "notes": f"Registry snapshot {snapshot_date}. Operational status as published: {operational or 'not published'}.",
        },
        "warnings": [],
        "lastUpdated": retrieved,
    }
    producers.append(record)
    seen[licence] = record

# ---- Which shelf brands belong to which licensee ---------------------------
#
# A brand is not a licence. Some brands are the licensee's own name; others are
# national brands made under contract by a New York processor registered under
# something else entirely. So a link is recorded with how it was made, and the
# weakest kind is offered for review rather than asserted.
listings = json.loads((DATA / "flower-listings.json").read_text())
shops = {}
for listing in listings:
    brand = listing.get("brand")
    if not brand:
        continue
    entry = shops.setdefault(brand, {"listings": 0, "shops": set()})
    entry["listings"] += 1
    entry["shops"].add(listing["licenseNumber"])

by_exact = {}
by_tokens = []
for producer in producers:
    key = re.sub(r"[^a-z0-9]", "", producer["entityName"].lower())
    by_exact.setdefault(key, producer)
    by_tokens.append((tokens(producer["entityName"]), producer))

linked = 0
for brand, stats in shops.items():
    key = re.sub(r"[^a-z0-9]", "", brand.lower())
    target, kind = by_exact.get(key), "EXACT"
    if not target:
        brand_tokens = tokens(brand)
        if brand_tokens:
            for entity_tokens, producer in by_tokens:
                if brand_tokens <= entity_tokens or entity_tokens <= brand_tokens:
                    target, kind = producer, "TOKEN_SUBSET"
                    break
    if not target:
        continue
    target["brands"].append({
        "name": brand,
        "match": kind,
        "listingCount": stats["listings"],
        "shopCount": len(stats["shops"]),
    })
    linked += 1

for producer in producers:
    producer["brands"].sort(key=lambda b: (-b["listingCount"], b["name"]))

producers.sort(key=lambda p: (p["entityName"].lower(), p["licenseNumber"]))
(DATA / "producers.json").write_text(json.dumps(producers, indent=2, ensure_ascii=False) + "\n")

from collections import Counter
print(f"Wrote {len(producers)} producers from {snapshot.name}.")
print("  by type:", dict(Counter(p['licenseType'] for p in producers)))
print("  skipped:", skipped)
print(f"  brands on shelves: {len(shops)}; linked to a licensee: {linked}")
print(f"  producers with at least one brand: {sum(1 for p in producers if p['brands'])}")
