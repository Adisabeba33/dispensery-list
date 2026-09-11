#!/usr/bin/env python3
"""Turn the SOMA gap into work queues, sorted by what each hour of research buys.

`soma-strain-gap.py` answers "what is on the shelves that SOMA cannot describe".
This answers the next question: *in what order, and by what method*.

The gap does not have one shape, it has four, and each wants a different kind of
work. Handing a researcher one flat list of 2,500 names guarantees they spend
the first week on names that a one-line alias would have closed, and never
reach the cultivator page that would have closed forty at once.

    python scripts/soma-gap-triage.py
    python scripts/soma-gap-triage.py --min-shops 2   # the researchable head only

Reads SOMA/enrichment-output/shelf-tiers.json when it exists — that file is
written by `npx tsx scripts/shelf-coverage.ts --json` in the SOMA repo and
carries the tier each name resolves at according to the REAL engine, including
the lineage-registry and terpene tiers this script cannot see from here. Without
it the script falls back to reading the catalog out of strain-data.ts by regex,
which knows only the curated tier and will therefore overstate the gap.

Writes, into enrichment-output/ (none of it committed — all of it derived):

  soma-queue-cultivators.json  brands ranked by the unknown shelf presence they
                               own. THE PRIMARY QUEUE: one first-party cultivar
                               page closes tens of names at the top of the
                               source hierarchy, and 50 brands cover ~46% of it.
  soma-queue-aliases.json      names one edit from a catalog entry. Cheapest
                               possible fix, and the most dangerous to get
                               wrong. Split into two grades, NEITHER of which
                               is safe to apply in bulk: batch 04 found 5 of 42
                               "orthographic" candidates to be different plants
                               (Purple Cream is not Purple Dream). Every row is
                               a candidate for judgement, never a fix.
  soma-queue-crosses.json      names that state their own parentage ("A x B").
                               No research needed; SOMA reads these already, so
                               anything here is a parent it cannot resolve.
  soma-queue-terpenes.json     unknown names the register already holds a menu
                               terpene panel for — a measured tier-C record
                               that needs transcription, not investigation.
  soma-queue-strains.json      everything else, ranked by shelf presence.
"""
import argparse
import difflib
import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = ROOT / "enrichment-output"
SOMA = ROOT.parent / "Soma"

ap = argparse.ArgumentParser()
ap.add_argument("--min-shops", type=int, default=1,
                help="only names carried by at least this many shops")
args = ap.parse_args()

listings = json.loads((DATA / "flower-listings.json").read_text())
shops = {d["licenseNumber"]: (d.get("dbaName") or d["legalName"])
         for d in json.loads((DATA / "dispensaries.json").read_text())}

NOISE = re.compile(
    r"\b(dime bag|smalls|jar|pouch|bag|indoor|outdoor|greenhouse|premium|exotic|"
    r"reserve|deal|special|mix|mixed|sample|assorted|flower|bud|buds|preroll)\b", re.I)


def key(s: str) -> str:
    """Collapse to the shape SOMA's resolver compares on."""
    return re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFKD", s or "").lower())


# ------------------------------------------------- what SOMA already answers
# Preferred: the tier map written by SOMA's own engine. It is authoritative
# because it ran findStrain, deriveFromLineage and measuredAromaFor rather than
# approximating them.
tiers_file = SOMA / "enrichment-output" / "shelf-tiers.json"
catalog_names: dict = {}
if tiers_file.exists():
    tiers = json.loads(tiers_file.read_text())
    tier_of = {r["name"]: r["tier"] for r in tiers["rows"]}
    basis = f"SOMA tier map ({tiers['generatedAt'][:10]}, all four tiers)"
else:
    tier_of = {}
    basis = "strain-data.ts read by regex — CURATED TIER ONLY, gap overstated"

# The catalog's own names are needed either way, for the alias search.
src = SOMA / "src" / "lib" / "strain-data.ts"
if not src.exists():
    raise SystemExit(f"SOMA's catalogue is not here: {src}\n"
                     "Clone the Soma repository next to this one.")
for m in re.finditer(
    r'^\s{4}name:\s*"((?:[^"\\]|\\.)*)",\s*\n(?:\s{4}aliases:\s*\[([^\]]*)\],\s*\n)?',
    src.read_text(), re.M,
):
    main = m.group(1)
    for n in [main] + [a.strip().strip('"')
                       for a in (m.group(2) or "").split(",") if a.strip()]:
        catalog_names[key(n)] = main

catalog_keys = list(catalog_names)


def fallback_known(name: str) -> bool:
    k = key(name)
    if not k or k in catalog_names:
        return True
    return any(len(c) >= 4 and k.startswith(c) and not re.search(r"[a-z]", k[len(c):])
               for c in catalog_keys)


def is_gap(name: str) -> bool:
    t = tier_of.get(name)
    if t is not None:
        return t == "guess"
    return not fallback_known(name)


# ---------------------------------------------------------------- the gap
# Brands are normalised before grouping. The register captures a cultivator's
# name exactly as each shop prints it, so "Electraleaf", "ElectraLeaf" and
# "ELECTRALEAF" arrive as three brands — and a queue built on the raw strings
# splits one outreach target into three entries and buries it.
def brand_key(b: str) -> str:
    b = unicodedata.normalize("NFKD", b or "")
    b = "".join(c for c in b if not unicodedata.combining(c))
    b = re.sub(r"[^a-z0-9 ]", " ", b.lower())
    b = re.sub(r"\b(cannabis|co|company|farms?|labs?|brands?|nyc?|llc|inc)\b", " ", b)
    return re.sub(r"\s+", "", b)


# Brands per shelf spelling across every listing. The alias search needs the
# catalog target's brands, and the target is by definition NOT in the gap — so
# this cannot be built from `gap`.
shelf_brands = defaultdict(set)
for l in listings:
    nm = (l.get("strainNameRaw") or "").strip()
    if nm and l.get("brand"):
        shelf_brands[key(nm)].add(l["brand"])

gap = defaultdict(lambda: {"shops": set(), "brands": Counter(), "terp": [], "lineage": Counter()})
for l in listings:
    name = (l.get("strainNameRaw") or "").strip()
    if not name or NOISE.search(name) or len(key(name)) < 3:
        continue
    if not is_gap(name):
        continue
    e = gap[name]
    e["shops"].add(l["licenseNumber"])
    if l.get("brand"):
        e["brands"][l["brand"]] += 1
    e["lineage"][l["lineage"]] += 1
    if l["terpenes"]["profile"]:
        e["terp"].append({
            "licenseNumber": l["licenseNumber"],
            "brand": l.get("brand"),
            "capturedAt": l["capturedAt"],
            "source": l["terpenes"]["source"],
            "profile": l["terpenes"]["profile"],
            "sourceUrl": (l["sources"] or [{}])[0].get("url"),
        })

gap = {n: v for n, v in gap.items() if len(v["shops"]) >= args.min_shops}
presence = {n: len(v["shops"]) for n, v in gap.items()}
total_presence = sum(presence.values())


def row(n):
    v = gap[n]
    return {
        "strain": n,
        "shopCount": len(v["shops"]),
        "brands": [b for b, _ in v["brands"].most_common()],
        "menuLineage": [k for k, _ in v["lineage"].most_common() if k != "UNKNOWN"],
        "shops": sorted(shops.get(s, s) for s in v["shops"]),
    }


# ------------------------------------------------ 1. the cultivator queue
# The strain distribution has almost no head — the top 50 names are 6% of the
# gap. The BRAND distribution has a real one, because a cultivator names its
# own crosses and a shop just resells them. Researching by cultivator also
# lands at the top of the source hierarchy: a brand's own cultivar page is
# rule 1, where a strain-by-strain search ends up on aggregators at rule 4.
brands = defaultdict(lambda: {"labels": Counter(), "names": set()})
for n, v in gap.items():
    for b, c in v["brands"].items():
        e = brands[brand_key(b)]
        e["labels"][b] += c
        e["names"].add(n)

cultivators = sorted(
    ({"cultivator": e["labels"].most_common(1)[0][0],
      "spellingsSeen": [b for b, _ in e["labels"].most_common()],
      "unknownNames": len(e["names"]),
      "shelfPresence": sum(presence[n] for n in e["names"]),
      "strains": sorted(e["names"], key=lambda n: (-presence[n], n.lower()))}
     for e in brands.values()),
    key=lambda r: (-r["shelfPresence"], -r["unknownNames"]),
)

# ------------------------------------------------------ 2. alias candidates
# Two grades, because they carry very different risk. Merging two cultivars
# into one record is irreversible in practice — it splits nothing and joins
# everything, permanently pooling the feedback and matches of two plants.
ORTHO = re.compile(r"^(sherbert|sherbet)$")
aliases = {"orthographic": [], "needsDistinctnessCheck": []}
for n in gap:
    k = key(n)
    m = difflib.get_close_matches(k, catalog_keys, n=1, cutoff=0.87)
    if not m or m[0] == k:
        continue
    target = catalog_names[m[0]]
    ratio = round(difflib.SequenceMatcher(None, k, m[0]).ratio(), 3)
    # An orthographic variant has the same number of words and no word the
    # other lacks — "Crunch Berrys"/"Crunch Berries", "Sunset Sherbert"/
    # "Sunset Sherbet". Anything that ADDS or REPLACES a word ("Gelato Z" vs
    # "Gelato", "Durban Z" vs "Durban Poison") is a different claim about a
    # plant and has to be established, not assumed.
    #
    # This separates the two grades; it does NOT certify either. Word shape is
    # blind to a swap between two real words of similar shape, so "Purple Cream"
    # lands here against "Purple Dream" and "Apple Pie" against "Grapple Pie" —
    # both rejected by hand in batch 04. Read the grade as "how much checking",
    # not "whether".
    wn = re.sub(r"[^a-z0-9 ]", " ", n.lower()).split()
    wt = re.sub(r"[^a-z0-9 ]", " ", target.lower()).split()
    same_shape = len(wn) == len(wt) and all(
        difflib.SequenceMatcher(None, a, b).ratio() >= 0.75 for a, b in zip(wn, wt))
    # The strongest offline evidence for a merge, and what carried 17 of batch
    # 04's 30 accepted aliases: the register stores a cultivator's name exactly
    # as each shop prints it, so one brand appearing under BOTH spellings means
    # one product transcribed two ways rather than two plants.
    variant_brands = {brand_key(b) for b in gap[n]["brands"]}
    target_brands = {brand_key(b) for b in shelf_brands.get(key(target), ())}
    entry = {"strain": n, "catalogTarget": target, "similarity": ratio,
             "shopCount": presence[n], "brands": [b for b, _ in gap[n]["brands"].most_common()],
             "sharedCultivators": sorted(variant_brands & target_brands),
             "catalogTargetOnShelf": key(target) in shelf_brands}
    aliases["orthographic" if same_shape else "needsDistinctnessCheck"].append(entry)
for v in aliases.values():
    v.sort(key=lambda r: (-r["shopCount"], -r["similarity"]))

# --------------------------------------------------- 3. self-stated crosses
# SOMA's crossParentsFromName() already reads "A x B" off a menu string. A name
# of this shape still in the gap means at least one PARENT is unresolvable —
# so the work is on the parent, not on this name, and closing one parent may
# close several children.
CROSS = re.compile(r"\s(?:x|×)\s", re.I)
crosses = []
for n in sorted(gap, key=lambda n: -presence[n]):
    if not CROSS.search(n):
        continue
    parts = [p.strip() for p in re.split(r"\s(?:x|×)\s", n, flags=re.I) if p.strip()]
    crosses.append({
        "strain": n, "shopCount": presence[n],
        "statedParents": parts,
        "parentsInCatalog": [catalog_names.get(key(p)) for p in parts],
        "unresolvedParents": [p for p in parts if key(p) not in catalog_names],
    })

# ------------------------------------------------------ 4. terpene readings
# A panel the register already collected. These are tier-C records waiting to
# be transcribed — the cheapest measured evidence in the whole pipeline, since
# the collection already happened.
terpenes = sorted(
    ({"strain": n, "shopCount": presence[n],
      "brands": [b for b, _ in gap[n]["brands"].most_common()],
      "readings": gap[n]["terp"]}
     for n in gap if gap[n]["terp"]),
    key=lambda r: (-len(r["readings"]), -r["shopCount"]),
)

# ----------------------------------------------------------- 5. everything
strains = sorted((row(n) for n in gap), key=lambda r: (-r["shopCount"], r["strain"].lower()))

OUT.mkdir(exist_ok=True)
for fname, payload in [
    ("soma-queue-cultivators.json", cultivators),
    ("soma-queue-aliases.json", aliases),
    ("soma-queue-crosses.json", crosses),
    ("soma-queue-terpenes.json", terpenes),
    ("soma-queue-strains.json", strains),
]:
    (OUT / fname).write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")

# ------------------------------------------------------------------ report
print(f"основа: {basis}")
print(f"неизвестных названий: {len(gap)}   присутствие на полках: {total_presence}\n")

print("1. КУЛЬТИВАТОРЫ — главная очередь")
print(f"   {len(cultivators)} брендов держат этот пробел\n")
print("      присутств.  сортов  культиватор")
for r in cultivators[:20]:
    print(f"      {r['shelfPresence']:>7}   {r['unknownNames']:>6}   {r['cultivator'][:44]}")
for N in (10, 25, 50, 100, 200):
    if N > len(cultivators):
        break
    # Deduplicated: a strain two cultivators both carry is one piece of work,
    # and summing per-brand presence would push the total past 100%.
    covered = set()
    for r in cultivators[:N]:
        covered.update(r["strains"])
    s = sum(presence[n] for n in covered)
    print(f"      топ-{N:<4} = {len(covered):>5} названий = {100*s/max(total_presence,1):5.1f}% пробела")

shared = sum(1 for r in aliases["orthographic"] if r["sharedCultivators"])
print(f"\n2. АЛИАСЫ — {len(aliases['orthographic'])} орфографических + "
      f"{len(aliases['needsDistinctnessCheck'])} со сменой слова.")
print(f"   НИ ОДИН не применять пачкой: в батче 04 пятеро из 42 «орфографических»")
print(f"   оказались другими растениями (Purple Cream != Purple Dream).")
print(f"   у {shared} из {len(aliases['orthographic'])} общий культиватор с целью — самое сильное доказательство слияния")
for r in aliases["orthographic"][:10]:
    print(f"      {r['shopCount']:>3} маг.  {r['strain'][:32]:<32} -> {r['catalogTarget']}")
if aliases["needsDistinctnessCheck"]:
    print("   требуют проверки (НЕ склеивать без доказательства):")
    for r in aliases["needsDistinctnessCheck"][:6]:
        print(f"      {r['shopCount']:>3} маг.  {r['strain'][:32]:<32} ~ {r['catalogTarget']}")

print(f"\n3. КРЕСТЫ В НАЗВАНИИ — {len(crosses)} шт.; работа идёт по родителю, не по названию")
unresolved = Counter(p for c in crosses for p in c["unresolvedParents"])
for p, c in unresolved.most_common(10):
    print(f"      {c:>3} раз  нераспознанный родитель: {p[:44]}")

print(f"\n4. ГОТОВЫЕ ТЕРПЕНОВЫЕ ПАНЕЛИ — {len(terpenes)} сортов, "
      f"{sum(len(r['readings']) for r in terpenes)} снимков; транскрипция, не поиск")
for r in terpenes[:8]:
    print(f"      {len(r['readings'])} панел.  {r['strain'][:40]:<40} {', '.join(r['brands'][:2])}")

print(f"\n5. ОСТАЛЬНОЕ — {len(strains)} названий по убыванию присутствия")
print(f"\nзаписано в enrichment-output/: soma-queue-{{cultivators,aliases,crosses,terpenes,strains}}.json")
