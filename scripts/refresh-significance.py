#!/usr/bin/env python3
"""
Does this week's refresh need a person, or only a commit?

The weekly job pushed a branch and opened a pull request whenever `git diff`
saw anything under data/. Every run sees something: `lastUpdated`,
`retrievedAt` and `verifiedAt` are stamped with the run's clock on every record
whether or not the record moved. So the answer was always "a person", five
branches piled up with nobody looking at them, and the one week that might
matter would have arrived looking exactly like the four that did not.

This decides it explicitly instead.

SUBSTANTIVE — a person should look:
  * a licence appears in the registry, or disappears from it
  * a municipality appears or disappears
  * an opt-out verdict changes: retailOptOut, onsiteConsumptionOptOut, optOutDate
  * anything about an existing shop changes except its timestamps — its
    address, its status, its licence type, its verification verdict
  * the validator's own count of anything moves

PROVENANCE — commit it and say so:
  * timestamps: lastUpdated, retrievedAt, verifiedAt
  * producer brand tallies, which are listing and shop counts recomputed off
    the shelf. They move every day the collector runs and there is nothing to
    decide about them; the report names how many moved so the number is not
    hidden, but a pull request asking somebody to approve arithmetic is how a
    weekly review becomes something people close without reading.

Usage:
  python scripts/refresh-significance.py --previous-dir /tmp/before
Exit code is always 0. The verdict is on stdout as JSON.
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Stamped every run regardless of whether anything moved.
TIMESTAMPS = {"lastUpdated"}
# Inside verification: the date and the free-text note travel with the run.
# status and confidence are verdicts and do NOT.
VERIFICATION_PROVENANCE = {"verifiedAt", "notes"}

OPT_OUT_FIELDS = ("retailOptOut", "onsiteConsumptionOptOut", "optOutDate")


def load(path: Path):
    if not path.exists():
        return None
    return json.loads(path.read_text())


def key_of(record, kind):
    if kind == "municipalities":
        return record.get("id")
    return record.get("licenseNumber")


def substantive_fields(before: dict, after: dict, kind: str) -> list[str]:
    """Fields that differ and are not provenance."""
    out = []
    for field in sorted(set(before) | set(after)):
        if field in TIMESTAMPS:
            continue
        if field == "sources":
            # Timestamps aside, what matters is whether the record is still
            # verified by the same authorities.
            #
            # A BUSINESS_WEBSITE source comes and goes with the registry's own
            # website column, which it fills and empties between weeks. The
            # website itself is enrichment and survives — 345 records assert
            # one, and only four of them were ever cited this way — so its
            # source appearing or disappearing leaves a reviewer nothing to
            # decide. Flagging it would put a pull request in front of somebody
            # every week for a non-question, which is how the last five went
            # unread.
            #
            # An OFFICIAL_REGISTRY or REGULATOR_PAGE source moving is different:
            # that is what VERIFIED_OFFICIAL rests on.
            def authorities(record):
                return sorted(
                    (s.get("type"), s.get("url"), s.get("label"))
                    for s in record.get("sources") or []
                    if s.get("type") != "BUSINESS_WEBSITE"
                )

            if authorities(before) != authorities(after):
                out.append("sources")
            continue
        if field == "verification":
            b = {k: v for k, v in (before.get(field) or {}).items() if k not in VERIFICATION_PROVENANCE}
            a = {k: v for k, v in (after.get(field) or {}).items() if k not in VERIFICATION_PROVENANCE}
            if b != a:
                out.append("verification")
            continue
        if field == "brands" and kind == "producers":
            # Derived from the shelf. Counted, not judged. See the docstring.
            continue
        if before.get(field) != after.get(field):
            out.append(field)
    return out


def compare(kind: str, rel: str, previous_dir: Path) -> dict:
    after = load(ROOT / rel)
    before = load(previous_dir / Path(rel).name)
    if after is None or before is None:
        return {"file": rel, "comparable": False}

    b = {key_of(r, kind): r for r in before}
    a = {key_of(r, kind): r for r in after}
    added = sorted(k for k in a if k not in b)
    removed = sorted(k for k in b if k not in a)

    changed: dict[str, list[str]] = {}
    optout_changed: list[str] = []
    brands_moved = 0
    for k in a:
        if k not in b or a[k] == b[k]:
            continue
        if kind == "municipalities" and any(b[k].get(f) != a[k].get(f) for f in OPT_OUT_FIELDS):
            optout_changed.append(k)
        if kind == "producers" and (b[k].get("brands") != a[k].get("brands")):
            brands_moved += 1
        fields = substantive_fields(b[k], a[k], kind)
        if fields:
            changed[k] = fields

    return {
        "file": rel,
        "comparable": True,
        "count": {"before": len(b), "after": len(a)},
        "added": added,
        "removed": removed,
        "optOutChanged": optout_changed,
        "changed": changed,
        "brandTalliesMoved": brands_moved,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--previous-dir", required=True)
    args = ap.parse_args()
    previous = Path(args.previous_dir)

    reports = [
        compare("dispensaries", "data/dispensaries.json", previous),
        compare("producers", "data/producers.json", previous),
        compare("municipalities", "data/municipalities.json", previous),
    ]

    reasons: list[str] = []
    for r in reports:
        if not r["comparable"]:
            reasons.append(f"{r['file']}: could not be compared — treat as needing review")
            continue
        name = r["file"]
        if r["added"]:
            reasons.append(f"{name}: {len(r['added'])} new — {', '.join(r['added'][:6])}")
        if r["removed"]:
            reasons.append(f"{name}: {len(r['removed'])} gone — {', '.join(r['removed'][:6])}")
        if r["optOutChanged"]:
            reasons.append(
                f"{name}: {len(r['optOutChanged'])} opt-out verdict(s) changed — "
                f"{', '.join(r['optOutChanged'][:6])}"
            )
        if r["changed"]:
            sample = list(r["changed"].items())[:5]
            reasons.append(
                f"{name}: {len(r['changed'])} record(s) changed beyond timestamps — "
                + "; ".join(f"{k} ({', '.join(v)})" for k, v in sample)
            )

    verdict = "substantive" if reasons else "provenance"
    derived = sum(r.get("brandTalliesMoved", 0) for r in reports if r["comparable"])
    print(json.dumps({"verdict": verdict, "reasons": reasons, "brandTalliesMoved": derived,
                      "detail": reports}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
