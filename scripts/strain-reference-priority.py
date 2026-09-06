#!/usr/bin/env python3
"""Rank brands and strain/brand pairs already present in flower-listings.json.

Research helper for Task 2 of AGENT_MENU_ENDPOINTS_BRIEF.md. It never infers
chemistry; it only prioritises which verified COAs would cover the most shelf
listings. Brand spelling variants are also grouped for research prioritisation
without rewriting the source listings.
"""
from collections import Counter, defaultdict
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
rows = json.loads((ROOT / "data/flower-listings.json").read_text())


def brand_key(value: str) -> str:
    # Research-only grouping: case/punctuation/spacing differences such as
    # Find vs Find. and mini mart vs miniMART should not split COA discovery.
    return re.sub(r"[^a-z0-9]+", "", value.casefold())

brand_counts = Counter()
normalized_brand_counts = Counter()
brand_display = {}
pair_counts = Counter()
strain_counts = Counter()
shops_by_pair = defaultdict(set)
strains_by_normalized_brand = defaultdict(Counter)
raw_brands_by_normalized = defaultdict(Counter)

for r in rows:
    brand = (r.get("brand") or "").strip()
    strain = (r.get("strainNameCanonical") or r.get("strainNameRaw") or "").strip()
    if brand:
        brand_counts[brand] += 1
        key = brand_key(brand)
        normalized_brand_counts[key] += 1
        raw_brands_by_normalized[key][brand] += 1
        brand_display.setdefault(key, brand)
        if strain:
            strains_by_normalized_brand[key][strain] += 1
    if strain:
        strain_counts[strain] += 1
    if brand and strain:
        pair_counts[(brand, strain)] += 1
        if r.get("licenseNumber"):
            shops_by_pair[(brand, strain)].add(r["licenseNumber"])

normalized_top = []
for key, n in normalized_brand_counts.most_common(40):
    variants = [b for b, _ in raw_brands_by_normalized[key].most_common()]
    normalized_top.append({
        "researchBrand": variants[0],
        "variants": variants,
        "listings": n,
        "strains": [
            {"strain": s, "listings": c}
            for s, c in strains_by_normalized_brand[key].most_common()
        ],
    })

summary = {
    "listingCount": len(rows),
    "distinctBrandsRaw": len(brand_counts),
    "distinctBrandsNormalized": len(normalized_brand_counts),
    "distinctStrains": len(strain_counts),
    "topBrandsRaw": [
        {"brand": b, "listings": n}
        for b, n in brand_counts.most_common(40)
    ],
    "topBrandsNormalized": normalized_top,
    "topBrandStrainPairsRaw": [
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
