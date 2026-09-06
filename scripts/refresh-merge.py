#!/usr/bin/env python3
"""Merges a freshly compiled registry snapshot with the enrichment already held.

compile-research.py rebuilds dispensaries.json from the state registry and knows
nothing about the previous file. Run alone on a schedule it would erase every
geocode, phone number and menu platform collected in phase 2 — the registry does
not carry those and never will.

So the refresh is a merge with a clear ownership rule:

  the registry owns    what a licence is: status, type, dates, address, names,
                       trading status, opening hours
  we own               what we went and found: coordinates, phone, menu
                       platform, the service flags the registry does not state,
                       neighbourhood

And one thing neither owns: `id`. A licence that already has one keeps it,
because those are published URLs.

Usage: python scripts/refresh-merge.py --previous <file> [--dry-run]
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATASET = ROOT / "data/dispensaries.json"
LISTINGS = ROOT / "data/flower-listings.json"

parser = argparse.ArgumentParser()
parser.add_argument("--previous", required=True, help="dispensaries.json as it was before the refresh")
parser.add_argument("--dry-run", action="store_true")
args = parser.parse_args()

now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

fresh = json.loads(DATASET.read_text())
previous = json.loads(Path(args.previous).read_text())
old_by_licence = {r["licenseNumber"]: r for r in previous}

# Enrichment we go out and collect; the registry publishes none of it.
CARRIED = ["geo", "menu"]
CARRIED_CONTACT = ["phone", "email", "orderOnlineUrl", "instagram"]
# The registry states these three; everything else in services was observed.
REGISTRY_SERVICES = {"inStorePurchase", "delivery", "servesAdultUse"}

added, removed, status_changed, moved, carried = [], [], [], [], 0

for record in fresh:
    licence = record["licenseNumber"]
    old = old_by_licence.get(licence)

    if not old:
        added.append(f'{record.get("dbaName") or record["legalName"]} — {record["address"]["city"]}')
        continue

    # Published URLs must not move under readers or search engines.
    record["id"] = old.get("id", record["id"])

    for field in CARRIED:
        if old.get(field) and not record.get(field):
            record[field] = old[field]

    contact = record.get("contact") or {}
    old_contact = old.get("contact") or {}
    for field in CARRIED_CONTACT:
        if old_contact.get(field) and not contact.get(field):
            contact[field] = old_contact[field]
    if contact:
        record["contact"] = contact

    services = record.get("services") or {}
    old_services = old.get("services") or {}
    for field, value in old_services.items():
        # Never let a stale observation overwrite what the registry now says.
        if field in REGISTRY_SERVICES:
            continue
        if value is not None and services.get(field) is None:
            services[field] = value
    if services:
        record["services"] = services

    if old.get("address", {}).get("neighborhood") and not record["address"].get("neighborhood"):
        record["address"]["neighborhood"] = old["address"]["neighborhood"]

    carried += 1

    # What a human reviewing the pull request needs to look at.
    if old.get("licenseStatus") != record.get("licenseStatus") or \
       old.get("operationalStatus") != record.get("operationalStatus"):
        status_changed.append(
            f'{record.get("dbaName") or record["legalName"]}: '
            f'{old.get("licenseStatus")}/{old.get("operationalStatus")} → '
            f'{record.get("licenseStatus")}/{record.get("operationalStatus")}'
        )
    if old.get("address", {}).get("line1") != record["address"].get("line1"):
        status_changed.append(
            f'{record.get("dbaName") or record["legalName"]}: moved from '
            f'{old.get("address", {}).get("line1")} to {record["address"]["line1"]}'
        )

fresh_licences = {r["licenseNumber"] for r in fresh}
for licence, old in old_by_licence.items():
    if licence not in fresh_licences:
        removed.append(f'{old.get("dbaName") or old["legalName"]} — {old["address"]["city"]} ({licence})')

# A shelf cannot outlive the shop it sits in: the validator requires every
# listing's licence to exist, and a listing for a delisted shop is a claim we
# can no longer support.
dropped_listings = 0
if LISTINGS.exists():
    listings = json.loads(LISTINGS.read_text())
    kept = [l for l in listings if l["licenseNumber"] in fresh_licences]
    dropped_listings = len(listings) - len(kept)
    if not args.dry_run and dropped_listings:
        LISTINGS.write_text(json.dumps(kept, indent=2, ensure_ascii=False) + "\n")

summary = {
    "records": len(fresh),
    "carriedEnrichment": carried,
    "added": len(added),
    "removed": len(removed),
    "statusOrAddressChanged": len(status_changed),
    "listingsDropped": dropped_listings,
    "withGeo": sum(1 for r in fresh if r.get("geo")),
    "withPhone": sum(1 for r in fresh if (r.get("contact") or {}).get("phone")),
    "withMenuPlatform": sum(1 for r in fresh if (r.get("menu") or {}).get("provider")),
}

if not args.dry_run:
    DATASET.write_text(json.dumps(fresh, indent=2, ensure_ascii=False) + "\n")

# A change report a person can read in the pull request, rather than a diff of
# forty thousand lines of JSON.
lines = [
    "## Registry refresh",
    "",
    f"Snapshot taken {now}.",
    "",
    f"- **{summary['records']}** licences, **{summary['carriedEnrichment']}** kept their enrichment",
    f"- **{summary['added']}** new, **{summary['removed']}** gone from the registry",
    f"- **{summary['statusOrAddressChanged']}** changed status or address",
    f"- coverage after merge: geo {summary['withGeo']}, phone {summary['withPhone']}, menu {summary['withMenuPlatform']}",
]
if dropped_listings:
    lines += ["", f"Dropped **{dropped_listings}** flower listings belonging to delisted shops."]
for title, items in (("New in the registry", added), ("Gone from the registry", removed),
                     ("Status or address changed", status_changed)):
    if items:
        lines += ["", f"### {title}", ""] + [f"- {i}" for i in items[:40]]
        if len(items) > 40:
            lines.append(f"- …and {len(items) - 40} more")

(ROOT / "refresh-report.md").write_text("\n".join(lines) + "\n")
print(json.dumps(summary, indent=2))
print(f"\nReport written to refresh-report.md")
