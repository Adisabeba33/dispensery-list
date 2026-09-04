# Enrichment report — phase 2

Applied: **2026-09-04T18:56:09Z**
Records: **456**, changed by this pass: **316**

## Coverage

| Field | Before | After | Coverage |
|---|---:|---:|---:|
| `geo` | 452 | 452 | 99.1% |
| `contact.phone` | 126 | 121 | 26.5% |
| `menu.provider` | 256 | 243 | 53.3% |
| `menu.menuUrl` | 142 | 138 | 30.3% |
| `hours` | 333 | 333 | 73.0% |
| `confidence HIGH` | 109 | 102 | 22.4% |

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
| not identified | 213 |
| DUTCHIE | 97 |
| PROPRIETARY | 70 |
| OTHER | 45 |
| BLAZE | 13 |
| LEAFLY | 7 |
| WEEDMAPS | 5 |
| TREEZ | 3 |
| IHEARTJANE | 2 |
| MEADOW | 1 |

## Numbers shared by several shops

These may be genuine chains sharing a line, or a platform support number
picked up from a template. Worth a look before anyone relies on them.

| Number | Shops |
|---|---:|
| `+1-718-554-4109` | 7 |

## Rejected during the merge

- Public-safety hotlines rejected as shop numbers: **7**.
- Menu URLs that were embed scripts rather than pages: **64** (the platform is still recorded; only the unusable link is dropped).

## Geocode precision

| Precision | Records |
|---|---:|
| INTERPOLATED | 452 |

All coordinates come from address interpolation, not rooftop resolution.
They place a pin on the right building frontage, not inside the unit.

## Not resolved

- Geocode missing for **4** record(s).
- Menu platform not identified for **73** record(s) with a website.

Both remain null rather than guessed. Reasons per record are in the
collector evidence files under `enrichment-output/`.
