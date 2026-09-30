# Pierre McClain batches under several names — source check, 2026-09-30

Cases `FX-792EF427C5` (batch …042), `FX-DAB81472EB` (batch …014) and
`FX-A2DEA3390D` (batch …012), `source_verified` in `data/forensic-reviews.json`
with the SHA-256 of every response read. The machine dossier of a case, as the
latest pilot data has it: `python scripts/forensic-cases.py --dossier FX-…`.

**What this is.** Three Metrc batches, each sold under two or three names,
read from the regulator's Retail ID system as the packagers entered it. **What
it is not.** A finding that anyone broke a rule. Bulk flower is legally
repacked and sold under other names; which name belongs to the plant, and
whether a rename was allowed, is not established here.

## How the packages connect

Batches `1A41203000026BA…` are Pierre McClain LLC's (the public cards with
that prefix, …002 and …033, are at its facility). Packages `…2719…` are Pierre McClain
LLC's, some since transferred to Harlem Blossoms LLC; `…1E8C…` are Harlem
Blossoms LLC's. Each card names its **source package**, the package it was
made from — so the chain, and where a name changes along it, is on the
record.

### Batch …042 — Blue Dream, then Gelato 41 (`FX-792EF427C5`)

| package | name (product) | facility · manufacturer | made from | packaged |
|---|---|---|---|---|
| `1A41203000026BA000000041` | — no public card (404) | | | |
| `1A4120300002719000000823` | Blue Dream (SCC350) | Harlem Blossoms LLC, received from Pierre McClain LLC · Pierre McClain LLC `OCM-MICR-25-000246-P1` | …041 | 2026-04-06 |
| `1A4120300001E8C000000582` | Gelato 41 (SCC350-G41) | Harlem Blossoms LLC `OCM-MICR-24-000040-DX1` | **…823 (Blue Dream)** | 2026-05-27 |
| `1A4120300001E8C000000586` | Gelato 41 (SCC350-G41) | Harlem Blossoms LLC | **…823 (Blue Dream)** | 2026-05-28 |

One certificate on all three: Keystone State Testing (`OCM-CPL-24-00007-L1`),
tested 2025-12-22, THC 24.16 %; β-caryophyllene 1.181, limonene 0.7225,
α-humulene 0.2768, terpineol 0.1676, linalool 0.1518, β-pinene 0.1513, fenchol
0.1192, α-pinene 0.1112, valencene 0.1072, CBD 0.0972. TestPassed, not on
recall. The equal chemistry is that one certificate shown on each card, not a
second proof: the evidence is the batch tag and the chain.

### Batch …014 — Candy Gelato, The Wrap Up, Zeven Up (`FX-DAB81472EB`)

| package | name (product) | facility · manufacturer | made from | packaged |
|---|---|---|---|---|
| `1A41203000026BA000000013` | — no public card (404) | | | |
| `1A4120300002719000000819` | Candy Gelato (SCC201) | Harlem Blossoms LLC, received from Pierre McClain LLC · Pierre McClain LLC | …013 | 2026-04-06 |
| `1A4120300001E8C000000583` | The Wrap Up (SCC201-TWU) | Harlem Blossoms LLC | **…819 (Candy Gelato)** | 2026-05-28 |
| `1A4120300002719000000870` | Zeven Up | Pierre McClain LLC `OCM-MICR-25-000246-DX1` | …013 | 2026-06-11 |

One certificate: Keystone, tested 2025-10-28, THC 26.1 %; β-myrcene 0.4265,
limonene 0.4226, linalool 0.3408, β-caryophyllene 0.302, terpineol 0.1031.

Package …870 is on no menu and in no collector's cache. It was found printed
in Good Money's "Zeven Up" certificate links —
[coa/30902.pdf](https://app.alleaves.com/api/inventory/batch/buddega/coa/30902.pdf) and
[coa/30965.pdf](https://app.alleaves.com/api/inventory/batch/buddega/coa/30965.pdf),
which are saved Retail ID pages of that package — and its card then asked.

### Batch …012 — Cherry Runtz, then 03' Sour x Runrz (`FX-A2DEA3390D`)

| package | name (product) | facility · manufacturer | made from | packaged |
|---|---|---|---|---|
| `1A41203000026BA000000002` | Cherry Runtz (Cherry Runtz 3.5g) | Pierre McClain LLC | — | 2025-10-28 |
| `1A4120300002719000000817` | Cherry Runtz (Cherry Runtz 3.5g) | Pierre McClain LLC | …002 | 2026-04-06 |
| `1A4120300002719000000872` | 03' Sour x Runrz *(sic)* | Pierre McClain LLC `OCM-MICR-25-000246-DX1` | **…002 (Cherry Runtz)** | 2026-06-11 |

One certificate: Keystone, tested 2025-10-21, THC 25.97 %; β-caryophyllene
0.2938, β-myrcene 0.2878, linalool 0.2705, limonene 0.2439. Package …872 was
found printed in Good Money's certificate link
[coa/30964.pdf](https://app.alleaves.com/api/inventory/batch/buddega/coa/30964.pdf).
The case appears in `cases.json` once the pilot has read that certificate and
asked Retail ID for …872.

## On the shelves (register, 2026-09-30)

| lot (brand · name · THC) | shops | certificate link | on shelves |
|---|---|---|---|
| Hi · The Wrap Up · 26.1 | 1 | — | since 2026-09-06; its menu prints …583 |
| HI MY NAME IS · THE WRAP UP · 26.1 | 1 | — | since 2026-09-24 |
| Good Money · Zeven Up · 26.1 | 2 | 30902, 30965 → …870 | since 2026-09-24 |
| GoodMoney · 03' sour X Runtz · 25.97 | 3 | 30964 → …872 | since 2026-09-24 |
| Hi / HI MY NAME IS · CANDY SHOP · 25.97 | 1 + 1 | — | since 2026-09-06 |
| Good Money · Zowah · 24.16 | 5 | 37885 (see below) | since 2026-09-24 |

Lot Twins had reached most of these names from matching shelf panels (its
signal C); the certificate links now tie Zeven Up and 03' Sour x Runtz to
their packages by tag.

**Open lead.** Good Money's "Zowah" (five shops) links
[coa/37885.pdf](https://app.alleaves.com/api/inventory/batch/buddega/coa/37885.pdf),
a saved Retail ID page printed without its package block: no tag, no batch.
Its shelf panel equals batch …042's certificate on THC and nine terpenes at the
menus' two decimals (24.16; β-caryophyllene 1.18, limonene 0.72, α-humulene
0.28, terpineol 0.17, β-pinene 0.15, linalool 0.15, fenchol 0.12, α-pinene 0.11,
valencene 0.11). That is the strongest chemistry short of an identifier — and
still not an identifier: open until a tag is found. Lot Twins does not tie it
to …042 today.

**Data quality.** The shelves print GoodMoney's "03' sour X Runtz" panel at a
tenth of its certificate (β-caryophyllene 0.0294 against 0.2938, and so on):
its lot's `totalPercent` in `shelf-terpenes.json` is ten times too low. SŌMA
reads a panel as shares of its total (`aromaFromTerpenes`), which a uniform
tenfold error leaves unchanged — until the lot is averaged with a correctly
scaled lot of the same grower and name.

Not checked here: batch …024 (Caviar Chop Cheese, …818), which Lot Twins ties
to shelf names Grape Soda and K Lab — one public card, no second name on a
card yet.

## For SŌMA

Good Money's Zeven Up, 03' sour X Runtz and Zowah lots reach SŌMA as measured
panels (certificate links, two or more shops). The panels are real
measurements of these batches; the names are the question. As with 1Off,
Excelsior Legacy and HM OPS in `docs/curation/SHELF-MEASUREMENTS.md`, a lot
from this family should not be a second source for a sensory tag of the name
it is sold under.

## Reproduce

```sh
curl -s "https://app.1a4.com/api/landingpage/data?id=1a4120300002719000000823&index=0" | sha256sum
```

and compare with `checked` in `data/forensic-reviews.json`; a different hash
means the card's JSON changed since, not necessarily its identity — the
pilot's `retail-history.json` says which fields did.
