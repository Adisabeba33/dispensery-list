# Terpene research log — NY flower

Research date: 2026-09-11

Assignment: `docs/AGENT_TERPENE_BRIEF.md` from `claude/dispensary-list-research-tz13hl`.
Working branch: `agent/terpenes-ny`.

## Evidence rules used

- Flower only. Pre-rolls, vapes, concentrates and edibles were excluded.
- Numeric profiles graduate only from a batch-specific laboratory certificate / certificate PDF. Menu text and general strain pages are discovery evidence only.
- `ND`, `<LOQ`, and `<MRL` are omitted, never converted to zero.
- One COA remains `LOW` confidence. Multiple batches use the median of quantified detections only and `observations` is the number of batches that actually quantified that analyte.
- Same-name variants are not collapsed. In particular, `Gelato`, `Gelato 33`, and `Gelato 41` were treated as different names.
- No potency, lineage, or terpene value was inferred from strain reputation.

## Schema / brief mismatch found

The brief says an analyte outside the project terpene vocabulary should be stored as `OTHER` plus `rawName`. The current `data/schema/strain-reference.schema.json` does not permit `rawName` in profile items (`additionalProperties: false`); profile items currently permit only `name`, `medianPercent`, and `observations`.

For new rows in this branch I therefore did **not** invent an unsupported shape. Quantified analytes that are outside the brief vocabulary are omitted from the strain-reference profile and noted here. The common example in the certificates is `CARYOPHYLLENE OXIDE`. Kaycha also reports compounds such as `MENTHOL` / `ALPHA-TERPINENE` on some panels. Existing legacy rows are left untouched even where they already contain names outside the brief vocabulary.

Kaycha's `FENCHYL ALCOHOL` is normalized to the project's existing `FENCHOL` token, matching the convention already present in `data/strain-reference.json`.

## COA archives / publication surfaces

### ElectraLeaf — useful NY flower archive

Index: https://electraleaf.com/3-5-flower-and-5-pack-joints-lab-test/

The page separates 3.5 g flower from 5-pack joints and exposes many direct PDF links, spanning several harvest/testing waves. It includes priority names such as Blue Dream, Blue Lobster, Permanent Marker, Cereal Milk, Lemon Cherry Gelato and an older Sour Diesel certificate. The flower section contains dozens of direct certificates; it is the strongest human-readable producer archive found in this pass.

Direct PDFs: **yes**.

robots.txt: **not independently retrievable in this agent environment**. DNS/egress prevented a direct robots fetch, so no automated crawl of the host was performed. Research used the already-indexed public archive page and individually known certificate URLs only.

### Grams Brooklyn — large retailer COA index

Index: https://www.gramsbk.com/coa

The page states that it indexes **154 Certificates of Analysis**, has a Flower filter, exposes batch IDs, and links each record to a complete report. This is a useful discovery surface, but it is a retailer archive rather than a single-grower reference set, so no values were promoted from it in this pass.

Direct report links: **yes** (many resolve to hosted document/PDF links).

robots.txt: **not independently retrievable in this agent environment**. No automated crawl was run.

### Nanticoke — direct lab-result files, no human index established

Multiple Nanticoke cured-flower PDFs are directly hosted under `https://nanticoke.co/image/catalog/lab-results/` and existing reference rows already use them. This pass found another direct flower COA there for Amnesia Haze. I did not establish a public human-readable index equivalent to ElectraLeaf's, so this is recorded as a useful direct-file publication surface rather than a confirmed archive index.

robots.txt: **not independently retrievable in this agent environment**. No automated crawl was run.

### Back Home — exact flower COAs, no brand archive established

Exact flower COAs were found for Northern Lights and Gorilla Glue through the direct Alleaves batch-certificate endpoint. The PDFs themselves are laboratory certificates (DRS / Keystone), but no public Back Home human-readable COA archive was established in this pass.

### Kaycha / YourCOA — direct laboratory certificates, not a browse archive

Known sample URLs resolve directly to Kaycha NY certificates and were used for White Widow, Ice Cream Cake, Super Boof, Gorilla Glue and Blue Zushi. This is valuable certificate hosting, but this pass did not find a safe public browse-all endpoint, so it was not crawled.

### Golden Gardens — archive found but rejected as out of scope

Index: https://www.goldengardens.co/pages/certificates-of-analysis

The page has direct COAs and a THCa Flower section, but its own page says the products are not shipped to New York. It is not evidence for the licensed New York adult-use shelves this repository tracks. No profile was imported from it.

robots.txt: **not independently retrievable in this agent environment**. No automated crawl was run.

## Priority outcome board

| stores in brief | strain | result this pass |
|---:|---|---|
| 69 | Blue Dream | existing 4-COA Nanticoke reference strengthened with a fifth ElectraLeaf/Lifted NY flower COA from Kaycha |
| 65 | Northern Lights | added from one Back Home / DRS flower COA (`LOW`) |
| 51 | Sour Diesel | already covered by 3 Nanticoke flower COAs; additionally found a Night Owl / Keystone flower COA, retained here as corroboration without silently recomputing the existing row |
| 44 | Jack Herer | **withheld** — exact DRS flower certificate was located only through a third-party mirror plus matching menu numbers; no direct lab/brand certificate URL was confirmed in this environment |
| 44 | Blue Lobster | already present from direct Kaycha flower COA |
| 43 | Permanent Marker | already present from two ElectraLeaf/Kaycha flower COAs |
| 42 | White Widow | added from one HPI Canna / Kaycha flower COA (`LOW`) |
| 41 | Gelato | **withheld** — searches surfaced Gelato 33 / Gelato 41 and other named variants, not a defensible plain-`Gelato` certificate |
| 40 | Ice Cream Cake | added from one Skyrose Farms / Kaycha flower COA (`LOW`) |
| 40 | Super Boof | added from one Roemer Farms / Kaycha flower COA (`LOW`) |
| 36 | Cereal Milk | already present from one ElectraLeaf / Green Analytics flower COA |
| 35 | Gorilla Glue | added from two exact `Gorilla Glue` flower COAs across Back Home/Keystone and HPI Canna/Kaycha; kept `LOW` because two batches are still thin evidence |
| 34 | Lemon Cherry Gelato | added from one ElectraLeaf / Kaycha flower COA (`LOW`) |
| 30 | Blue Zushi | added from one Budding Bliss / Kaycha flower COA (`LOW`) |
| 29 | Amnesia Haze | added from one Nanticoke / Keystone flower COA (`LOW`) |

After this pass, 13 of the 15 priority names have a direct-COA-backed strain reference in the dataset. Jack Herer and plain Gelato remain intentionally blank at this evidence level.

## New / strengthened certificate evidence

### Blue Dream — fifth batch, independent producer

Direct flower COA:
https://electraleaf.com/wp-content/uploads/2025/08/Blue-Dream-3.5-NY-051925-12.pdf

Kaycha Labs, Lifted NY / ElectraLeaf, sample `AL50712002-002`, batch `NY-051925-12`, cured flower.

Quantified project-vocabulary analytes (%):
- CARYOPHYLLENE 0.55
- LIMONENE 0.34
- LINALOOL 0.23
- MYRCENE 0.20
- HUMULENE 0.17
- BISABOLOL 0.08
- TERPINEOL 0.05
- FENCHOL 0.04 (`FENCHYL ALCOHOL` on the certificate)
- PINENE_BETA 0.04
- PINENE_ALPHA 0.02
- VALENCENE 0.01

`CARYOPHYLLENE OXIDE` 0.01% is quantified on the certificate but omitted from the new normalized profile because it is outside the brief vocabulary and the current schema cannot carry `OTHER + rawName`.

Recomputed five-batch medians use the four existing Nanticoke raw panels plus this batch; only quantified detections participate.

### Northern Lights

Direct flower COA:
https://app.alleaves.com/api/inventory/batch/buddega/coa/23042.pdf

Back Home Cannabis Co.; DRS Testing; sample `2601RLI0053-0247`; batch `NL1410`; 14 g cured flower; report 2026-01-24.

Quantified (%): CARYOPHYLLENE 0.24, LIMONENE 0.17, PINENE_ALPHA 0.01. Other listed project-vocabulary terpenes are ND.

### Sour Diesel — corroborating independent batch (not folded into the row in this commit)

Direct laboratory COA:
https://ny-keystonestatetesting.grow.labware.cloud/COA?guid=125DCAD9-AE68-4690-B0AA-67D3DEB91695

Night Owl Farm LLC; Keystone State Testing of New York; report 27041; sample 6524; cured flower; batch `FL0016`; collected 2024-10-10.

Quantified (%): LIMONENE 0.6158, MYRCENE 0.1882, CARYOPHYLLENE 0.1479, LINALOOL 0.1357.

The existing dataset row already aggregates three Nanticoke batches. Rather than merge a fourth value without re-reading all three underlying raw panels during the same write, this independent batch is logged for the next aggregation pass.

### White Widow

Direct flower COA:
https://app.alleaves.com/api/inventory/batch/buddega/coa/15183.pdf

HPI Canna / Platinum Reserve; Kaycha Labs; sample `AL51014001-007`; batch `PLAT-25128-WW`; cured flower.

Quantified (%): CARYOPHYLLENE 0.50, MYRCENE 0.33, HUMULENE 0.24, LINALOOL 0.13, LIMONENE 0.09, BISABOLOL 0.04, VALENCENE 0.02, PINENE_BETA 0.01.

`CARYOPHYLLENE OXIDE` 0.01% is omitted for the schema/vocabulary reason above.

### Ice Cream Cake

Direct laboratory COA:
https://ny.yourcoa.com/coa/coa-download/AL60210005-001?is_view=1

Skyrose Farms; Kaycha Labs; sample `AL60210005-001`; batch `ICC-25`; cured flower; sampled 2026-02-10.

Quantified (%): CARYOPHYLLENE 0.45, LIMONENE 0.37, HUMULENE 0.18, MYRCENE 0.12, LINALOOL 0.09, FARNESENE 0.08, BISABOLOL 0.07, PINENE_BETA 0.07, OCIMENE 0.05, FENCHOL 0.04, PINENE_ALPHA 0.04, TERPINEOL 0.03, CAMPHENE 0.01, VALENCENE 0.01.

`CARYOPHYLLENE OXIDE` 0.02% is omitted.

### Super Boof

Direct laboratory COA:
https://ny.yourcoa.com/coa/coa-download/AL50802002-003?is_view=1&mrk=0

Roemer Farms LLC; Kaycha Labs; sample `AL50802002-003`; batch `RFSB253`; cured flower; sampled 2025-08-02.

Quantified (%): MYRCENE 0.96, OCIMENE 0.54, LIMONENE 0.28, CARYOPHYLLENE 0.24, LINALOOL 0.22, HUMULENE 0.11, PINENE_ALPHA 0.10, BISABOLOL 0.09, PINENE_BETA 0.09, FENCHOL 0.04, TERPINEOL 0.03, VALENCENE 0.02, CAMPHENE 0.01.

`CARYOPHYLLENE OXIDE` 0.02% is omitted; farnesene was `<LOQ` and is not zero-filled.

### Gorilla Glue — two exact-name flower batches

Batch A:
https://app.alleaves.com/api/inventory/batch/buddega/coa/13079.pdf

Back Home Farm; Keystone State Testing of New York; sample 18506; batch/source package `GG09`; cured flower; released 2025-09-04.

Quantified (%): LIMONENE 0.3062, CARYOPHYLLENE 0.2580, VALENCENE 0.1563, LINALOOL 0.1310, MYRCENE 0.1233. Remaining listed project-vocabulary analytes were ND.

Batch B:
https://ny.yourcoa.com/coa/coa-download/AL50722001-017?is_view=1&mrk=0&wl_id=0

HPI Canna / Dank; Kaycha Labs; sample `AL50722001-017`; batch `DANK-23225-GG`; cured flower; sampled 2025-07-21.

Quantified (%): CARYOPHYLLENE 0.42, LIMONENE 0.41, MYRCENE 0.35, LINALOOL 0.22, HUMULENE 0.17, BISABOLOL 0.08, PINENE_BETA 0.07, TERPINEOL 0.05, FENCHOL 0.05, VALENCENE 0.03, PINENE_ALPHA 0.03, CAMPHENE 0.01.

`CARYOPHYLLENE OXIDE` 0.01% is omitted. These are exact `Gorilla Glue` certificates; `GG4` / `Gorilla Glue #4` certificates were not mixed into this row.

### Lemon Cherry Gelato

Direct flower COA:
https://electraleaf.com/wp-content/uploads/2025/04/Lemon-Cherry-Gelato-3.5-NY-030325-04.pdf

Lifted NY / ElectraLeaf; Kaycha Labs; sample `AL50412002-003`; batch `NY-030325-04`; cured flower.

Quantified (%): LIMONENE 0.83, CARYOPHYLLENE 0.35, LINALOOL 0.31, MYRCENE 0.18, PINENE_BETA 0.13, TERPINEOL 0.10, BISABOLOL 0.10, HUMULENE 0.10, FENCHOL 0.08, PINENE_ALPHA 0.08, OCIMENE 0.06, CAMPHENE 0.02, GERANIOL 0.02, TERPINOLENE 0.01, VALENCENE 0.01.

`CARYOPHYLLENE OXIDE` 0.01% is omitted; farnesene was below its reporting threshold.

### Blue Zushi

Direct laboratory COA:
https://ny.yourcoa.com/coa/coa-download/AL51212001-001?is_view=1&mrk=1&wl_id=0

Budding Bliss; Kaycha Labs; sample `AL51212001-001`; batch `DEC-25-BBF-ZUSHI-001`; cured flower.

Quantified (%): LIMONENE 0.70, MYRCENE 0.54, LINALOOL 0.37, CARYOPHYLLENE 0.22, PINENE_BETA 0.12, FENCHOL 0.08, TERPINEOL 0.07, HUMULENE 0.06, PINENE_ALPHA 0.06, FARNESENE 0.05, CAMPHENE 0.02, VALENCENE 0.02, TERPINOLENE 0.01, BISABOLOL 0.01.

`CARYOPHYLLENE OXIDE` 0.01% is omitted.

### Amnesia Haze

Direct flower COA:
https://nanticoke.co/image/catalog/lab-results/Amnesia%20Haze%203.5g%20Whl%20Flwr%20Pouch%20ML1005085BP.pdf

Nanticoke Hemp; Keystone State Testing of New York; sample 12794; batch `ML1005085BP`; cured flower; released 2025-03-21.

Quantified (%): TERPINOLENE 0.4036, FARNESENE 0.1428, CARYOPHYLLENE 0.1224, OCIMENE 0.1132. Other listed project-vocabulary terpenes were ND.

## Withheld / failed searches

### Jack Herer

An exact Back Home / DRS flower certificate for batch `JH11`, sample `2603RLI0269-1381`, was located through a third-party PDF mirror. A current menu listing prints a matching numeric panel, which strongly suggests the document is genuine. That is still not the evidence class requested by this assignment: the direct lab/brand certificate URL was not confirmed. No strain-reference row was added.

This is intentionally a failure record so the next pass knows the missing piece is **provenance URL**, not discovery of a panel.

### Gelato

Searches repeatedly surfaced `Gelato 33`, `Gelato 41`, `Waffle Cone Gelato`, and other qualified names. Those are not safe substitutes for an unqualified `Gelato` row. No plain-Gelato certificate with defensible product identity was confirmed; no row was added.

### producer-outreach.json

`enrichment-output/producer-outreach.json` is generated output and was not present on the branch at the start of this assignment. The research therefore followed the explicit 15-strain priority table in the brief and the known ElectraLeaf archive first, rather than pretending a missing generated ranking had been read.

## Bottom line

COA publication in New York is fragmented, but it is not limited to one producer. This pass confirmed usable exact flower certificates across ElectraLeaf/Lifted NY, Nanticoke, Back Home, HPI Canna, Skyrose Farms, Roemer Farms, Budding Bliss, Kaycha Labs, Keystone State Testing, DRS, and Green Analytics material already in the project.

The limiting problem is discoverability, not the absence of testing: many exact PDFs exist without a convenient producer archive. ElectraLeaf is the clearest archive found; Grams provides a large retailer index; other certificates are commonly reachable only after discovering a batch/sample URL elsewhere. That makes direct grower links or a durable certificate-index workflow the likely next step if coverage is to move beyond the first priority set without lowering evidence quality.
