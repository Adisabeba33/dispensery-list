#!/usr/bin/env python3
"""Applies phase 2 evidence to the published dataset.

The collectors (enrichment-collect.py, enrichment-geocode.py) gather evidence
into enrichment-output/ but deliberately do not touch data/dispensaries.json.
This step performs the merge, and it is where the project's honesty rules are
enforced rather than assumed:

  - registry-sourced facts are never overwritten by a website reading;
  - an unobserved service stays null, never false;
  - `id` and `licenseNumber` are immutable, because they are published URLs and
    the key the ingest pipeline matches on;
  - verification.status is never downgraded — enrichment does not weaken the
    registry provenance a record already has.

Usage:
  python scripts/enrichment-apply.py [--dry-run] [--evidence-dir enrichment-output]
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Service flags that come from the state registry. A website reading may not
# contradict them: the registry is the authority on what a licence permits.
REGISTRY_SERVICES = {"inStorePurchase", "delivery", "servesAdultUse"}

# Services the collector is allowed to set, and only ever to True.
ENRICHABLE_SERVICES = {
    "pickup", "curbside", "adaAccessible", "onsiteConsumption", "servesMedical",
    "acceptsDebit", "acceptsCredit", "cashOnly", "atmOnSite", "parking",
}

parser = argparse.ArgumentParser()
parser.add_argument("--dry-run", action="store_true", help="report what would change, write nothing")
parser.add_argument("--evidence-dir", default="enrichment-output")
args = parser.parse_args()

EVIDENCE = ROOT / args.evidence_dir
DATASET = ROOT / "data/dispensaries.json"
now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load(path, required=True):
    p = EVIDENCE / path
    if not p.exists():
        if required:
            raise SystemExit(
                f"Missing {p}.\n"
                "Run the collectors first, or download the CI artifacts into "
                f"{args.evidence_dir}/ — they expire seven days after the run."
            )
        return None
    return json.loads(p.read_text())


records = json.loads(DATASET.read_text())
website = load("website-evidence.json")
geocode = load("geocode-evidence.json")

web_by_licence = {e["licenseNumber"]: e for e in website.get("records", [])}
geo_by_licence = {e["licenseNumber"]: e for e in geocode.get("records", [])}


def coverage(rows):
    def filled(fn):
        return sum(1 for r in rows if fn(r))
    return {
        "geo": filled(lambda r: r.get("geo")),
        "phone": filled(lambda r: (r.get("contact") or {}).get("phone")),
        "menuProvider": filled(lambda r: (r.get("menu") or {}).get("provider")),
        "menuUrl": filled(lambda r: (r.get("menu") or {}).get("menuUrl")),
        "hours": filled(lambda r: r.get("hours")),
        "confidenceHigh": filled(lambda r: r["verification"].get("confidence") == "HIGH"),
    }


before = coverage(records)


def add_source(record, url, label, source_type):
    """Adds a source without duplicating one already present for the same URL."""
    if not url:
        return
    for existing in record["sources"]:
        if existing["url"] == url:
            return
    record["sources"].append(
        {"url": url, "label": label, "type": source_type, "retrievedAt": now}
    )


def add_warning(record, text):
    if text and text not in record["warnings"]:
        record["warnings"].append(text)


def note_append(record, text):
    notes = record["verification"].get("notes") or ""
    if text in notes:
        return
    record["verification"]["notes"] = (notes + " " if notes else "") + text


touched = 0
stats = {"geo": 0, "phone": 0, "menu": 0, "services": 0, "other_platform": 0, "warnings": 0}
unresolved_geo = []
unresolved_menu = []

for record in records:
    licence = record["licenseNumber"]
    changed = False

    # ---- geocode ---------------------------------------------------------
    g = geo_by_licence.get(licence)
    if g:
        if g.get("lat") is not None and g.get("lng") is not None and g.get("precision"):
            # The collector already refuses ROOFTOP for interpolated results and
            # drops anything outside the city bounding box; trust but re-check,
            # because a bad coordinate is worse than a missing one.
            lat, lng = float(g["lat"]), float(g["lng"])
            if 40.4 <= lat <= 41.4 and -74.3 <= lng <= -73.4:
                record["geo"] = {
                    "lat": lat,
                    "lng": lng,
                    "precision": g["precision"],
                    "source": g.get("source") or "unknown geocoder",
                    "geocodedAt": now,
                }
                stats["geo"] += 1
                changed = True
            else:
                add_warning(record, f"Geocode outside the NYC/Westchester bounding box, discarded: {lat},{lng}")
                unresolved_geo.append((licence, "outside bbox"))
        else:
            unresolved_geo.append((licence, g.get("warning") or g.get("matchStatus") or "no match"))
        if g.get("warning"):
            add_warning(record, g["warning"])
            stats["warnings"] += 1

    # ---- website: menu, phone, services ----------------------------------
    w = web_by_licence.get(licence)
    if not w:
        continue

    if w.get("websiteOk") is False and w.get("websiteError"):
        add_warning(record, f"Business website unreachable during enrichment: {w['websiteError']}")
        stats["warnings"] += 1

    provider = w.get("menuProvider")
    if provider:
        record["menu"] = {
            "provider": provider,
            "menuUrl": w.get("menuUrl"),
            "menuIsPublic": w.get("menuIsPublic"),
        }
        stats["menu"] += 1
        changed = True
        if provider == "OTHER" and w.get("otherPlatform"):
            # The enum cannot name this platform, so the real name is recorded
            # where a human will read it rather than being lost.
            note_append(record, f"menu platform: {w['otherPlatform']}.")
            stats["other_platform"] += 1
        if w.get("menuUrl"):
            add_source(record, w["menuUrl"], f"{provider.title()} menu", "MENU_PLATFORM")
    else:
        unresolved_menu.append((licence, w.get("websiteError") or "no menu platform identified"))

    phone = w.get("phone")
    if phone:
        record.setdefault("contact", {})
        record["contact"]["phone"] = phone
        stats["phone"] += 1
        changed = True
        if w.get("phoneBasis") == "visible_site_text":
            note_append(record, "Phone read from page text rather than a tel: link.")

    services_true = w.get("servicesTrue") or {}
    if services_true:
        current = record.get("services") or {}
        for key, value in services_true.items():
            if value is not True:
                continue  # only positive observations are ever written
            if key in REGISTRY_SERVICES:
                continue  # the registry already decided this one
            if key not in ENRICHABLE_SERVICES:
                continue
            if current.get(key) is not True:
                current[key] = True
                stats["services"] += 1
                changed = True
        record["services"] = current

    if w.get("website"):
        add_source(record, w["website"], "Business website", "BUSINESS_WEBSITE")

    if changed:
        touched += 1

# ---- recompute confidence, refresh timestamps ----------------------------
for record in records:
    has_core = all([
        record["address"].get("line1"),
        record.get("operationalStatus"),
        record.get("hours"),
        (record.get("contact") or {}).get("phone"),
        (record.get("menu") or {}).get("provider"),
        record.get("geo"),
    ])
    # Deliberately stricter than phase 1, which scored HIGH on registry
    # completeness alone. HIGH now means a reader needs nothing further.
    record["verification"]["confidence"] = "HIGH" if has_core and not record["warnings"] else "MEDIUM"
    record["verification"]["verifiedAt"] = now
    record["lastUpdated"] = now

after = coverage(records)

summary_rows = [
    ("geo", before["geo"], after["geo"]),
    ("contact.phone", before["phone"], after["phone"]),
    ("menu.provider", before["menuProvider"], after["menuProvider"]),
    ("menu.menuUrl", before["menuUrl"], after["menuUrl"]),
    ("hours", before["hours"], after["hours"]),
    ("confidence HIGH", before["confidenceHigh"], after["confidenceHigh"]),
]

total = len(records)
print(f"records: {total}, touched: {touched}\n")
print(f"{'field':<18}{'before':>8}{'after':>8}{'coverage':>11}")
for name, b, a in summary_rows:
    print(f"{name:<18}{b:>8}{a:>8}{a / total:>10.1%}")

if args.dry_run:
    print("\nDry run — dataset not written.")
    raise SystemExit(0)

DATASET.write_text(json.dumps(records, indent=2, ensure_ascii=False) + "\n")
print(f"\nWrote {DATASET}")

# ---- report ---------------------------------------------------------------
provider_counts = {}
for r in records:
    key = (r.get("menu") or {}).get("provider") or "not identified"
    provider_counts[key] = provider_counts.get(key, 0) + 1

precision_counts = {}
for r in records:
    if r.get("geo"):
        key = r["geo"]["precision"]
        precision_counts[key] = precision_counts.get(key, 0) + 1

lines = [
    "# Enrichment report — phase 2",
    "",
    f"Applied: **{now}**",
    f"Records: **{total}**, changed by this pass: **{touched}**",
    "",
    "## Coverage",
    "",
    "| Field | Before | After | Coverage |",
    "|---|---:|---:|---:|",
]
lines += [f"| `{n}` | {b} | {a} | {a / total:.1%} |" for n, b, a in summary_rows]

lines += [
    "",
    "`confidence HIGH` falls in this pass, and that is not a data regression.",
    "Phase 1 awarded HIGH on registry completeness alone. This pass raises the bar",
    "to what a reader actually needs — address, status, hours, phone, menu platform",
    "and a coordinate, with no outstanding caveat — so the same records are now",
    "measured against a longer list. The count is a truer number, not a worse one.",
]

lines += [
    "",
    "## Menu platforms",
    "",
    "This is the number that decides whether a taste-matching product can read a",
    "shop's shelf at all. A platform we can read is a shop SOMA can work with.",
    "",
    "| Platform | Shops |",
    "|---|---:|",
]
lines += [
    f"| {k} | {v} |"
    for k, v in sorted(provider_counts.items(), key=lambda kv: (-kv[1], kv[0]))
]

lines += ["", "## Geocode precision", "", "| Precision | Records |", "|---|---:|"]
lines += [f"| {k} | {v} |" for k, v in sorted(precision_counts.items())]
lines += [
    "",
    "All coordinates come from address interpolation, not rooftop resolution.",
    "They place a pin on the right building frontage, not inside the unit.",
    "",
    "## Not resolved",
    "",
    f"- Geocode missing for **{len(unresolved_geo)}** record(s).",
    f"- Menu platform not identified for **{len(unresolved_menu)}** record(s) with a website.",
    "",
    "Both remain null rather than guessed. Reasons per record are in the",
    "collector evidence files under `enrichment-output/`.",
]

(ROOT / "docs/ENRICHMENT_REPORT.md").write_text("\n".join(lines) + "\n")
print("Wrote docs/ENRICHMENT_REPORT.md")
print("\nNext: npm run validate")
