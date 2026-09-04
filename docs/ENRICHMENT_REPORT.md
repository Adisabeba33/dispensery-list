# Enrichment report — phase 2

Applied: **2026-09-04T18:47:28Z**
Records: **456**, changed by this pass: **316**

## Coverage

| Field | Before | After | Coverage |
|---|---:|---:|---:|
| `geo` | 0 | 452 | 99.1% |
| `contact.phone` | 0 | 135 | 29.6% |
| `menu.provider` | 0 | 256 | 56.1% |
| `menu.menuUrl` | 0 | 209 | 45.8% |
| `hours` | 333 | 333 | 73.0% |
| `confidence HIGH` | 309 | 116 | 25.4% |

`confidence HIGH` falls in this pass, and that is not a data regression.
Phase 1 awarded HIGH on registry completeness alone. This pass raises the bar
to what a reader actually needs — address, status, hours, phone, menu platform
and a coordinate, with no outstanding caveat — so the same records are now
measured against a longer list. The count is a truer number, not a worse one.

## Menu platforms

This is the number that decides whether a taste-matching product can read a
shop's shelf at all. A platform we can read is a shop SOMA can work with.

| Platform | Shops |
|---|---:|
| not identified | 200 |
| DUTCHIE | 106 |
| PROPRIETARY | 72 |
| OTHER | 46 |
| BLAZE | 13 |
| LEAFLY | 9 |
| WEEDMAPS | 4 |
| TREEZ | 3 |
| IHEARTJANE | 2 |
| MEADOW | 1 |

## Geocode precision

| Precision | Records |
|---|---:|
| INTERPOLATED | 452 |

All coordinates come from address interpolation, not rooftop resolution.
They place a pin on the right building frontage, not inside the unit.

## Not resolved

- Geocode missing for **4** record(s).
- Menu platform not identified for **60** record(s) with a website.

Both remain null rather than guessed. Reasons per record are in the
collector evidence files under `enrichment-output/`.
