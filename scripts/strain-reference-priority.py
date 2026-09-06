#!/usr/bin/env python3
"""Rank brands and strain/brand pairs already present in flower-listings.json.

This is a research helper for Task 2 of AGENT_MENU_ENDPOINTS_BRIEF.md. It does
not invent chemistry: it only tells the researcher where one verified COA can
cover the most existing shelf listings.
"""
from collections import Counter, defaultdict
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
rows = json.loads((ROOT / "data/flower-listings.json").read_text())

brand_counts = Counter()
pair_counts = Counter()
strain_counts = Counter()
shops_by_pair = defaultdict(set)

for r in rows:
    brand = (r.get("brand") or "").strip()
    strain = (r.get("strainNameCanonical") or r.get("strainNameRaw") or "").strip()
    if brand:
        brand_counts[brand] += 1
    if strain:
        strain_counts[strain] += 1
    if brand and strain:
        pair_counts[(brand, strain)] += 1
        if r.get("licenseNumber"):
            shops_by_pair[(brand, strain)].add(r["licenseNumber"])

summary = {
    "listingCount": len(rows),
    "distinctBrands": len(brand_counts),
    "distinctStrains": len(strain_counts),
    "topBrands": [
        {"brand": b, "listings": n}
        for b, n in brand_counts.most_common(40)
    ],
    "topBrandStrainPairs": [
        {
            "brand": b,
            "strain": s,
            "listings": n,
            "shops": len(shops_by_pair[(b, s)]),
        }
        for (b, s), n in pair_counts.most_common(100)
    ],
}

out = ROOT / "enrichment-output"
out.mkdir(parents=True, exist_ok=True)
(out / "strain-reference-priority.json").write_text(
    json.dumps(summary, indent=2, ensure_ascii=False) + "\n"
)

print(json.dumps(summary, indent=2, ensure_ascii=False))
