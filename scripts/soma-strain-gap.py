#!/usr/bin/env python3
"""What is on New York shelves that SOMA cannot describe.

SOMA can only speak about a strain it holds a profile for. Everything else on
a shelf is a name it would shrug at. This lists those names, and then ranks
them the only way that matters for deciding what to write next: by how many
shops carry the strain. A cultivar on one shelf is one shop's problem; a
cultivar on nine is a hole in the product.

    python scripts/soma-strain-gap.py            # all of it
    python scripts/soma-strain-gap.py --min 3    # only what 3+ shops carry

Writes enrichment-output/soma-strain-gap.json (the whole gap, with where each
strain is sold) and soma-strain-gap.txt (bare names, one per line, ready to
paste). Neither is committed: both are regenerated from the register.
"""
import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = ROOT / "enrichment-output"

ap = argparse.ArgumentParser()
ap.add_argument("--min", type=int, default=1,
                help="only strains carried by at least this many shops")
args = ap.parse_args()

listings = json.loads((DATA / "flower-listings.json").read_text())
shops = {d["licenseNumber"]: (d.get("dbaName") or d["legalName"])
         for d in json.loads((DATA / "dispensaries.json").read_text())}

# ---------------------------------------------------------------- SOMA's index
# Read the way SOMA reads it, so "missing" means the engine would genuinely
# fail to place the strain — not that our spelling differs from its spelling.
soma_src = ROOT.parent / "Soma" / "src" / "lib" / "strain-data.ts"
if not soma_src.exists():
    raise SystemExit(f"SOMA's catalogue is not here: {soma_src}\n"
                     "Clone the Soma repository next to this one.")

index = set()
for m in re.finditer(
    r'^\s{4}name:\s*"((?:[^"\\]|\\.)*)",\s*\n(?:\s{4}aliases:\s*\[([^\]]*)\],\s*\n)?',
    soma_src.read_text(), re.M,
):
    for n in [m.group(1)] + [a.strip().strip('"')
                             for a in (m.group(2) or "").split(",") if a.strip()]:
        index.add(re.sub(r"[^a-z0-9]", "", n.lower()))

def known(name: str) -> bool:
    """SOMA's findStrain(), including its loose trailing-noise match."""
    key = re.sub(r"[^a-z0-9]", "", name.lower())
    if not key or key in index:
        return True
    return any(len(k) >= 4 and key.startswith(k)
               and not re.search(r"[a-z]", key[len(k):]) for k in index)

# Trade dressing is not a cultivar. "Premium Flower" and "Dime Bag" are how a
# shop dresses a jar, and putting them on a list of strains to research would
# waste the reader's time.
NOISE = re.compile(
    r"\b(dime bag|smalls|jar|pouch|bag|indoor|outdoor|greenhouse|premium|exotic|"
    r"reserve|deal|special|mix|mixed|sample|assorted|flower|bud|buds|preroll)\b", re.I)

# ------------------------------------------------------------------- the gap
gap = defaultdict(lambda: {"shops": set(), "brands": set(), "sizes": set()})
on_sale = set()
for l in listings:
    # Каноническое имя, а не сырое: в сыром сидят гровер, упаковка, артикул
    # магазина и цифра с анализа, и SOMA спотыкается о них, а не о сорте.
    name = (l.get("strainNameCanonical") or l.get("strainNameRaw") or "").strip()
    if not name:
        continue
    on_sale.add(name.lower())
    if known(name) or NOISE.search(name) or len(re.sub(r"[^a-z0-9]", "", name.lower())) < 3:
        continue
    e = gap[name]
    e["shops"].add(l["licenseNumber"])
    if l.get("brand"):
        e["brands"].add(l["brand"])
    e["sizes"].update(l.get("availableSizesGrams") or [])

rows = sorted(
    ({"strain": n,
      "shopCount": len(v["shops"]),
      "brands": sorted(v["brands"]),
      "sizesGrams": sorted(v["sizes"]),
      "shops": sorted(shops.get(s, s) for s in v["shops"])}
     for n, v in gap.items() if len(v["shops"]) >= args.min),
    key=lambda r: (-r["shopCount"], r["strain"].lower()),
)

OUT.mkdir(exist_ok=True)
suffix = f"-min{args.min}" if args.min > 1 else ""
(OUT / f"soma-strain-gap{suffix}.json").write_text(
    json.dumps(rows, indent=2, ensure_ascii=False) + "\n")
(OUT / f"soma-strain-gap{suffix}.txt").write_text(
    "\n".join(r["strain"] for r in rows) + "\n")

print(f"сортов на полках (уникальных названий): {len(on_sale)}")
print(f"из них SOMA не знает: {len(gap)}")
print(f"в списке (порог {args.min}+ магазинов): {len(rows)}\n")
buckets = defaultdict(int)
for r in gap.values():
    buckets[min(len(r["shops"]), 10)] += 1
print("во скольких магазинах встречается неизвестный сорт:")
for n in sorted(buckets):
    label = f"{n}+" if n == 10 else str(n)
    print(f"   {label:>3} магазин(ов): {buckets[n]:>4}")
print(f"\nтоп-25 по числу магазинов:")
for r in rows[:25]:
    print(f"   {r['shopCount']:>3}  {r['strain'][:52]}")
print(f"\nзаписано: enrichment-output/soma-strain-gap{suffix}.json и .txt")
