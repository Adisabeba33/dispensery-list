# Forensic provenance layer v1

This layer is intentionally separate from `scripts/lot-twins.py`. Lot Twins is
unfinished and remains the consumer/detector; these files acquire and
normalize evidence, and turn it into cases for people to verify. Lot Twins'
name rules (`norm_name`, `same_name`) are reused, its code is not changed.

A case is a candidate relationship with what it takes to reproduce it — IDs,
values compared, source URLs, why it fired, what it cannot tell. It is never a
finding of misconduct: bulk flower is legally repacked and sold under other
names.

## Pipeline

```
data/shelf-terpenes.json (certificate links)     flower-listings / retail-id.json / lot-twins.json
            |                                                 |
   scripts/coa-harvest.py ──── Metrc tags printed ───> scripts/forensic-harvest.py
            |                  in certificates                |
      coa-index.json                         retail-cards.jsonl, fingerprints.jsonl,
            |                                retail-history.json, harvest-state.json
            +──────────────────────+──────────────────────────+
                                   |
                     scripts/forensic-collisions.py ──> collisions.json
                                   |
     data/forensic-reviews.json ──>+
                                   |
                       scripts/forensic-cases.py ──> cases.json (+ --dossier FX-…)
```

Offline:

```sh
python scripts/forensic-harvest-check.py && python scripts/coa-forensics-check.py
python scripts/coa-harvest-check.py && python scripts/forensic-collisions-check.py
python scripts/forensic-cases-check.py
python scripts/forensic-harvest.py && python scripts/forensic-collisions.py && python scripts/forensic-cases.py
```

Live, bounded (the pilot workflow does this on every push to the forensic
scripts, and on demand):

```sh
python scripts/coa-harvest.py --network --budget 50
python scripts/forensic-harvest.py --network --budget 100
```

The budget is a ceiling, not a target.

## Live Retail ID requests

No sequential guessing, no adjacent-number enumeration. A tag is asked only
with evidence that it is a public card:

| tier | what | why |
|---|---|---|
| lead | a menu's 1a4.com link, or the tag of a Retail ID page a shop saved as its "COA", that no collector has answered | a public page points at it (5 of 5 public in run 9) |
| enrich | a public card the caches hold slim (`retail-id.py` keeps dates only) | chemistry, package chain, recall flag and test state; expected hit rate 100% |
| source | a found card's `sourcePackage`, or the package a lab certificate says it sampled, that no collector has answered | often a bulk or sample package never enrolled (23 of 25, and 17 of 17, answered 404) |
| reobserve | the public card observed live longest ago | a changed card shows up in the history |

Never asked: a raw menu package ID (`retail-id.py` asks each one under its own
14-day recheck; most answer 404), a tag any collector has seen 404, a tag
known only from Lot Twins' probing (`lot-twins:probe-only`), and a lead this
harvest got 404 for in the last 30 days. Requests are paced 0.5 s apart and
stop after five failures in a row, as Lot Twins.

Runs 1–8 spent all 100 requests on 404s. The first fix (commit `0e3196a`)
admitted tags "with Retail-ID provenance" — but `retail-id-cache` and
`lot-twins-cache` mean *a collector holds an answer*, including 404: all 5,754
tags passed (`skippedRawDiscovery: 0`), and the queue was 428 tags Lot Twins
had already seen 404 as neighbours of known tags. Eligibility now reads the
answer (found / missing), not cache membership. With Lot Twins v1.27.0's card
cache (2026-09-30) that leaves 1,491 of 6,462 tags for a first run: 505 cards
to enrich, 281 source packages, 705 to re-observe, and the leads its
certificates give.

## History across runs

`data/forensics/retail-history.json` keeps, per tag, every distinct identity
its public card has shown (`versions`, each with `observedAt`, `lastSeen`,
sources, identity fields, chemistry, the SHA-256 of the live response) and the
days menus printed the tag (`menu`: first/last seen, shops, names). A new
observation that agrees on every field both know confirms the latest version
(a slim card does not contradict a full one); one that disagrees appends a
version with `changed`. A stale cache snapshot never reopens a superseded
identity. A card once found that answers 404 is marked `missing`.
`coa-index.json` keeps every document version per URL the same way.

Generated data is not committed. The pilot restores both files from the
Actions cache at the start and saves them at the end; a cache unused for
seven days is evicted, and the run summary then says **started over**. The
pilot runs every night from main (00:47 New York in summer, 23:47 in winter),
which keeps the cache in use, and also on pushes to the forensic scripts on
the working branch and by hand. A branch's runs keep their own cache: the
nightly history on main is the one that grows.

## What the sources mean (learned, with the case that taught it)

- **A Retail ID card's 0 is not a measurement.** Cards carry a fixed slate of
  twenty terpenes and fill the ones the certificate lacks with 0 (six to
  fifteen per card). Kept as qualifier `reported_zero`, never compared: two
  unrelated cards share a dozen zeros, which would pass "four shared
  terpenes". The same holds for 0% on a printed Retail ID page.
- **Equal chemistry within one batch is one certificate, not two proofs.**
  Retail ID shows the batch's certificate on every package, so the two HIGH
  collision cases were entailed by their shared batch tag. The package chain
  (`sourcePackage`) is the stronger evidence: in both, the name changes along
  it.
- **`cultivationDate` is not the harvest.** On Fela's Farm's Applescotti
  (`1A41203000004F0000000735`) it equals the packaging day, two months after
  the test. Only `harvestDate` is read as a harvest; `cultivationDate` is kept
  as `cultivated`.
- **Packaged before tested is ordinary**: the lab samples the packed lot (280 of
  the 722 cards whose two dates differ). Only harvest-after-test, harvest-after-packaging and dates
  after the day we observed them are impossible.
- **Many "COA" links are saved Retail ID pages**, not certificates (43 of 786 in
  `coa-dates.json` are read as "Metrc"). They print the package tag — a lead no
  menu gives: Good Money's "Zeven Up" certificate is package `…870` of batch
  `…014`, reached without enumeration (Lot Twins' neighbour probing reached it
  the same day).
- **All 780 certificate links on today's shelves are one shop's POS**
  (`app.alleaves.com/.../buddega/`). The COA index covers what that shop links.
  It stores one PDF under several product records (135 documents at 273 URLs),
  and six of those serve lots of different names *and* different THC: one
  certificate cannot be both lots', so those links are data errors, not twins.

## Evidence rules

1. Keep discovery provenance for every package tag.
2. Never use a commercial name, brand or facility in the chemical fingerprint.
3. Preserve full precision supplied by the source; rounding belongs in a
   detector, not in evidence storage. (The Retail fingerprint writes values to
   1e-4 %, Lot Twins' cache precision, so a card hashes the same from either
   collector; stored values keep the source's.)
4. Never coerce ND, <LOD, <LOQ — or a reported 0 — to a number a detector
   matches on.
5. A fingerprint match is a candidate identity signal, not an accusation.
6. Same Package/Batch UID is stronger evidence than chemistry similarity.
7. Third-party indexes may discover a candidate, but confirmation should retain
   the original Retail ID / COA evidence.
8. Generated evidence is append/archive material. If a public document or card
   changes, retain the old SHA-256 and first/last-seen dates rather than
   silently replacing history.

## COA index

`scripts/coa-harvest.py` walks the certificate links of `data/shelf-terpenes.json`
— never-fetched first, then the longest unchecked (runs 1–8 re-read the same
first 50 of 780 each time) — and keeps per URL every document version: SHA-256
of the bytes, SHA-256 of the extracted text (new bytes, same text = a
re-rendered PDF), first/last seen, the parsed record. A version parsed by an
older parser is re-parsed when its bytes come back. PDFs are not stored.

`scripts/coa-forensics.py` (parser v3) reads:

- `docType`: `lab-coa`, or `metrc-retail-id` for a saved Retail ID page (both
  page layouts);
- identifiers with a digit only — the labels also head columns ("Lot Size",
  "Is Production Batch false", "Sample ID # Sample Name" gave `Size`, `false`,
  `Sample` before);
- `metrcTag`, the package the certificate is about ("Seed to sale", "TEST PKG",
  the page's package tag);
- dates by label per lab (Report Created, Completed, Date Released …);
- analytes only from lines that are "name value unit" and nothing else, and
  never across a line break. Kaycha, DRS and Green Analytics print LOQ and mg
  columns beside the percentage, in different orders; a generic reader would
  take the LOQ. Per-lab readers are the next step if certificate chemistry
  turns out to be needed (see below).

## Collision triage

```sh
python scripts/forensic-collisions-check.py
python scripts/forensic-collisions.py
```

`data/forensics/collisions.json` is a review queue, **not a misconduct list**.
Only measured values are compared (no qualifiers, no reported zeros), sums
(total terpenes, total cannabinoids) are not dimensions, and "terpene" is an
explicit family: a card's own terpene section, `TERPENES` for a certificate.
Exact hashes and near-clones both need five shared analytes, four of them
terpenes, and no shared analyte outside its tolerance. Equal THC alone is
explicitly insufficient. Names are compared with Lot Twins' rules, strain
before product code. One package seen twice (its card and a printout of it,
or two versions of one URL) is not a relationship.

High: same batch and different commercial identity. Medium: chemistry match
and different identity without the same batch. Review: chemistry without
identity divergence (stays in `collisions.json`, not in cases).

## Cases

`scripts/forensic-cases.py` writes `data/forensics/cases.json`; each case has
`caseId` (stable, from what the case is about), `signals`, `priority`,
`verificationStatus`, `summary`, `entities` (per package: names, facility and
manufacturer with licences, batch, source package, lab, dates, THC, menu
sightings, source URL, response hash), and as they apply `lineage`,
`chemistry`, `coa`, `timeline`, `changes`, `sources`, `confidence`,
`limitations`, `related`.

| signal | fires on | priority |
|---|---|---|
| SAME_BATCH_DIFFERENT_NAME | one batch tag under names Lot Twins keeps apart, one certificate (lab, test day, THC agree) | high; medium if the certificate is unknown |
| MIXED_BATCH | one batch number over different certificates (a packager's production lot) | review |
| RENAMED_IN_LINEAGE | a package made from another under another name | with its batch case, else medium |
| CHEMICAL_CLONE | collisions without a shared batch | medium |
| SAME_COA_DIFFERENT_IDENTITY | one certificate URL, or one document at several URLs, cited for lots with different names and one THC; a certificate's own package named otherwise | medium (the lot's link is the shop's) |
| COA_MISATTACHED | the same with THC that differ: one certificate prints one THC, so a lot's link or THC belongs to another lot | review — a data error; the crawl of all 780 found six |
| COA_MUTATION | one URL served another document | high if parsed fields changed, medium if only text, review if a re-render |
| RETAIL_ID_MUTATION | one card showed another identity, or stopped answering | high for a material field or chemistry, review for spelling |
| IMPOSSIBLE_TIMELINE | harvest after test or packaging; a date after we saw it; a tag on a menu before its package existed; within one certificate, report or receipt before the sample | medium (card), review (parsed certificate) |
| RECALL_FLAG | the card's `isOnRecall` | high, externally confirmed |

Soft ages (tested long before packaging, old harvests) are not here: Lot Twins
reports old tests, and SŌMA reads freshness.

`verificationStatus` is `candidate` unless `data/forensic-reviews.json` (committed,
edited by hand) records `source_verified`, `externally_confirmed` or
`dismissed`, with what was checked and the SHA-256 of what was received. Any
other status stops the run. `python scripts/forensic-cases.py --dossier FX-…`
prints one case as markdown.

`cases.json` does not feed Lot Twins or the site. Verified cases are for
people — and for SŌMA's curation, where a batch sold under several names is
not evidence for any one of them.

## Not done, on purpose or not yet

- Per-lab certificate chemistry readers (Kaycha, DRS, Green Analytics …).
  Menus already print the certificate's panel (`shelf-terpenes.json`), and the
  certificate's unique contribution here is identity: SHA-256, identifiers,
  the tested package's tag.
- A durable archive of the PDFs themselves (only hashes are kept).
- OCM recall and enforcement notices. The card's own recall flag is read;
  notices would say why.
- A separate processor/manufacturer mismatch detector: the package chain and
  licences are in each case's entities, and cross-licence repacking is
  ordinary.
- Lot Twins still asks neighbours of known tags (±8/±24). That is
  enumeration; this layer does not do it and does not re-ask its 404s.
