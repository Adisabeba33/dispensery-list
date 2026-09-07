#!/usr/bin/env python3
"""Which producers to approach first, and what to say we need from them.

A register is a list. This turns it into an argument: for each licensee whose
product is on collected shelves, how many shops carry it, and which of its
strains nothing anywhere describes. That last column is the ask — a grower can
answer it and nobody else can.

    python scripts/producer-outreach.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

producers = json.loads((DATA / "producers.json").read_text())
listings = json.loads((DATA / "flower-listings.json").read_text())
shops = {d["licenseNumber"]: (d.get("dbaName") or d["legalName"])
         for d in json.loads((DATA / "dispensaries.json").read_text())}

# SOMA's catalogue, read the way SOMA reads it, so "undescribed" means the
# engine would genuinely fail to place the strain.
soma_src = (ROOT.parent / "Soma" / "src" / "lib" / "strain-data.ts")
index = set()
if soma_src.exists():
    text = soma_src.read_text()
    for m in re.finditer(r'^\s{4}name:\s*"((?:[^"\\]|\\.)*)",\s*\n(?:\s{4}aliases:\s*\[([^\]]*)\],\s*\n)?',
                         text, re.M):
        names = [m.group(1)] + [a.strip().strip('"') for a in (m.group(2) or "").split(",") if a.strip()]
        for n in names:
            index.add(re.sub(r"[^a-z0-9]", "", n.lower()))

def known(name: str) -> bool:
    key = re.sub(r"[^a-z0-9]", "", name.lower())
    if not key:
        return True
    if key in index:
        return True
    # SOMA's loose match: a catalogue name followed by non-letter noise.
    return any(len(k) >= 4 and key.startswith(k) and not re.search(r"[a-z]", key[len(k):])
               for k in index)

# Trade dressing is not a strain name; a grower asked about "Premium Flower"
# would rightly wonder what we are doing.
NOISE = re.compile(r"\b(dime bag|smalls|jar|pouch|bag|indoor|premium|exotic|reserve|deal|special|mix|sample|flower)\b", re.I)

by_brand = {}
for l in listings:
    if not l.get("brand"):
        continue
    e = by_brand.setdefault(l["brand"], {"strains": {}, "shops": set()})
    e["shops"].add(l["licenseNumber"])
    e["strains"].setdefault(l["strainNameRaw"], set()).add(l["licenseNumber"])

rows = []
for p in producers:
    if not p["brands"]:
        continue
    strains, shop_set, listing_count = {}, set(), 0
    for b in p["brands"]:
        info = by_brand.get(b["name"])
        if not info:
            continue
        shop_set |= info["shops"]
        listing_count += b["listingCount"]
        for name, where in info["strains"].items():
            strains.setdefault(name, set()).update(where)

    undescribed = sorted(
        (n for n in strains if not known(n) and not NOISE.search(n)),
        key=lambda n: (-len(strains[n]), n.lower()),
    )
    rows.append({
        "licenseNumber": p["licenseNumber"],
        "entityName": p["entityName"],
        "licenseType": p["licenseType"],
        "counties": p["counties"],
        "regions": p["regions"],
        "brands": [b["name"] for b in p["brands"]],
        "brandMatch": sorted({b["match"] for b in p["brands"]}),
        "shopCount": len(shop_set),
        "listingCount": listing_count,
        "strainCount": len(strains),
        "undescribedCount": len(undescribed),
        "undescribedStrains": undescribed[:40],
        "shops": sorted(shops.get(s, s) for s in shop_set)[:12],
    })

rows.sort(key=lambda r: (-r["shopCount"], -r["undescribedCount"], r["entityName"].lower()))
out = ROOT / "enrichment-output" / "producer-outreach.json"
out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n")

print(f"{len(rows)} producers whose product is on a collected shelf\n")
print(f"{'магазинов':>10} {'сортов':>7} {'неописанных':>12}  производитель")
for r in rows[:20]:
    star = "" if r["brandMatch"] == ["EXACT"] else "  (связь по словам — проверить)"
    print(f"{r['shopCount']:>10} {r['strainCount']:>7} {r['undescribedCount']:>12}  {r['entityName']}{star}")
print(f"\nwrote {out.relative_to(ROOT)}")
