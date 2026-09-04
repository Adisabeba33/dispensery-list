# Research report — NYC + Westchester dispensaries

Snapshot time: **2026-09-04T09:16:19.670Z**

## Result

Published current-license records: **456**.
- OPEN: **325**
- APPROVED_NOT_OPEN: **115**
- UNKNOWN: **16**
- VERIFIED_OFFICIAL: **456 / 456 (100%)**

### By county

| County | Total | Open | Approved not open | Unknown |
|---|---:|---:|---:|---:|
| New York | 120 | 98 | 20 | 2 |
| Kings | 116 | 86 | 27 | 3 |
| Queens | 118 | 79 | 34 | 5 |
| Bronx | 34 | 22 | 11 | 1 |
| Richmond | 21 | 14 | 5 | 2 |
| Westchester | 47 | 26 | 18 | 3 |

## Source integrity findings

The official OCM public-open page text advertises 717 adult-use dispensaries statewide, while the HTML table snapshot parsed into **716 data rows**. This mismatch is preserved as a source inconsistency; no synthetic 717th row was created.

The raw Current OCM Licenses snapshot contains **2958** rows. The first-pass six-county retail-ish filter produced **466** OCM-format licensed rows: **458 Active** and **8 Inactive/expired** before geography sanity filtering.

Two rows are tagged `county=New York` / `region=Manhattan` in the official registry but have clearly upstate addresses and ZIPs; they are excluded from the NYC/Westchester deliverable and kept in the raw evidence:
- `OCM-MICR-24-000199` — Copperhead Grow, LLC — 10242 State Route 12, Remsen NY 13438.
- `OCM-RETL-26-000482` — Forage Dispensaries, LLC — 734 NY-32A, Palenville NY 12414.

Expired/inactive OCM-format retail licenses excluded from the current directory: **8**.
- `OCM-RETL-24-000121` — Altitude NY LLC — expired 2026-07-10.
- `OCM-MICR-24-000043` — BKL Flowers LLC — expired 2026-04-08.
- `OCM-CAURD-24-000158` — DISCO HERBATORY LLC — expired 2026-06-28.
- `OCM-CAURD-24-000049` — Culture House — expired 2026-01-12.
- `OCM-RETL-24-000006` — HUDSON ECONOMICS LLC — expired 2026-02-28.
- `OCM-CAURD-24-000182` — Juniper NY LLC — expired 2026-08-02.
- `OCM-RETL-24-000067` — MamitaJoy LLC — expired 2026-04-18.
- `OCM-CAURD-23-000015` — Statis Cannabis Co — expired 2025-06-27.

## Contract conflict: Registered Organizations

There are **10** in-scope Registered Organization / Adult-Use Registered Organization Dispensary rows in the official registry, but OCM publishes them with legacy IDs such as `MM0906D`, not the repository-required `OCM-XXX-YY-NNNNNN` pattern. They cannot be represented without changing the current schema/brief, so they are not silently coerced. This is a known completeness gap that needs a contract decision before publication as 'all dispensaries'.

## Operational unknowns

These licenses are `Active` and the registry operating-address status is `Active`, but no confident match was found on the current OCM public-open list. They remain `UNKNOWN` rather than being guessed open:
- `OCM-CAURD-25-000276` — Weed Land Inc. — 1260 Castle Hill Ave, Bronx 10462
- `OCM-RETL-26-000497` — BASHIRA INTERNATIONAL CORPORATION — 133 Wyckoff Ave, Brooklyn 11237
- `OCM-CAURD-25-000315` — DIAMOND DISPENSARY LLC — 455 Graham Ave, Brooklyn 11222
- `OCM-CAURD-25-000250` — Sunset Cannabis Club — 512 55th St, Brooklyn 11220
- `OCM-RETL-25-000338` — Fire Escape — 103 Avenue A, New York 10009
- `OCM-RETL-24-000262` — Free Thinkers LLC — 2 Coenties Slip, New York 10004
- `OCM-RETL-25-000369` — M & M Neighborhood Convenience Inc. — 246-01 Jamaica Ave, Bellerose 11426
- `OCM-RETL-24-000175` — Canna Blooms — 16220 Northern Blvd, Flushing 11358
- `OCM-CAURD-25-000231` — Token Retail Inc — 9229 Queens Blvd, Rego Park 11374
- `OCM-CAURD-26-000326` — Gaia Operations LLC — 10412 Lefferts Blvd, South Richmond Hill 11419
- `OCM-RETL-24-000046` — KiKi Buddz Corp. — 50-12 72nd Street, Woodside 11377
- `OCM-CAURD-25-000273` — A Cannaful Life LLC — 1547 Arthur Kill Road, Staten Island 10312
- `OCM-RETL-25-000443` — Quality Control Dispensary Staten Island — 1172 Victory Blvd # 4, Staten Island 10301
- `OCM-RETL-24-000013` — Lucky Leaf — 50 N Highland Ave, Ossining 10562
- `OCM-CAURD-26-000342` — Peek Buds — 1719 Main St, Peekskill 10566
- `OCM-RETL-24-000152` — RSSQ Holding LLC — 1200 Mamaroneck Ave, White Plains 10605

## OCM public-open-list address discrepancies

Five current public-open entries were matched only after manual review because the OCM public-open table carries a ZIP different from the registry for the same storefront address/identity. Each affected record carries a warning; the registry address remains canonical.

## Municipal opt-out audit

`data/municipalities.json` was rebuilt from OCM's current official opt-out workbook, not the older secondary 22-municipality list. The workbook currently contains **34 Westchester opt-out rows**, of which **27** include Retail Dispensary opt-out and **34** include On-Site Consumption opt-out. The file also includes the five NYC borough geographic records and all 45 Westchester local-government units; the three coextensive town/villages (Harrison, Mount Kisco, Scarsdale) are represented as separate town/village schema records because OCM's workbook lists both municipality types.

## What we still do not know

- `geo` is still null; no rooftop coordinates were invented.
- Phone numbers are still null unless a later website-enrichment pass verifies them.
- Menu provider/order URL is still null pending website-by-website menu-platform enrichment.
- Pickup/curbside/ADA/payment/parking fields remain null unless explicitly sourced.
- The 16 operational UNKNOWN records above need a future OCM public-list appearance or other regulator-level reconciliation before they can be called OPEN.
- Registered Organization storefronts require a schema/contract decision for legacy `MM...D` license numbers.
