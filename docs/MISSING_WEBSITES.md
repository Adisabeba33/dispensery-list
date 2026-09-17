# Open shops with no website in the register

The daily menu sweep starts from `contact.website`. A shop the state registry
lists with no website is therefore invisible to it — not refused, just never
begun. On 17 September 2026 that was ten of New York's 330 open dispensaries.

This is the record of looking for those ten, so that the six still empty are
not looked for again from scratch, and so the four that were filled can be
checked by anyone who doubts them.

## The standard applied

A URL was written into the register only where something tied it to **this
licence or this address** — the licence number printed on the page that named
the site, or the registered street address matching what the site states. A
dispensary name alone is not evidence: several of these trade under names that
other shops, in other boroughs, also use.

Pages could not be fetched from the research environment, only searched, so
"confirmed" here means confirmed from search results that quote an address or a
licence — not from reading the site. Where that fell short, the field stays
empty. An empty field beats a plausible guess.

## Filled — 4

| Licence | Shop | Website | What tied it |
|---|---|---|---|
| OCM-RETL-24-000234 | Flower Shak, Rockaway Park | `flowershak.com` | Site states 114-19 Rockaway Beach Blvd — the registered address |
| OCM-CAURD-25-000322 | Hudson Haze, Brooklyn | `hudsonhaze.com` | Site states 3043 Fulton St, 11208 — the registered address |
| OCM-MICR-24-000204 | Pacha Products NY, Brooklyn | `pachadispensary.com` | 44 Wyckoff Ave, and a directory naming licence OCM-MICR-24-000204 |
| OCM-RETL-25-000449 | Purple Buds, Jackson Heights | `pbuds.com` | 75-20 Roosevelt Ave, and a listing naming licence OCM-RETL-25-000449 |

Two of the four (Hudson Haze, Purple Buds) also publish a Dutchie menu, which
the collector recognises without further help.

## Still empty — 6

| Licence | Shop | What was found |
|---|---|---|
| OCM-RETL-24-000164 | Upscale Cannabis, Bronx | Opening covered by local press at 3042B Fenton Ave; no site of its own found |
| OCM-RETL-25-000309 | NSH LLC, Brooklyn | Trades as "NSH Cannabis Dispensary" at 2280 Flatbush Ave; directory listings only |
| OCM-CAURD-25-000244 | Paint Puff N' Peace, Manhattan | **Do not guess this one.** Directories place the name at three different addresses (2119 Frederick Douglass Blvd, 2037 Third Ave, E Tremont Ave in the Bronx), and one search result claims the registered address now trades as another business with its own site. Nothing ties any of it to this licence |
| OCM-RETL-25-000442 | High Class Smokes, Jackson Heights | Directory and licence-tracker entries at 88-20 Roosevelt Ave; no site of its own found |
| OCM-RETL-24-000018 | Venus Cannabis Shop, Little Neck | Licence approval on the record at 248-06 Northern Blvd; no site found |
| OCM-RETL-25-000327 | Brow & Body, Ossining | Village of Ossining planning documents for 345 N Highland Ave, describing it as "The Flower Shop"; opened this month, no site found |

Four of these six are recently licensed, and a new shop often has an Instagram
before it has a website. Worth re-checking in a month; worth checking by
telephone at any time, which this environment cannot do.

## The refresh would have erased them

`scripts/refresh-merge.py` carries hand-collected contact fields across the
weekly registry refresh — phone, email, order-online URL, Instagram — and did
not carry `website`, because the registry publishes that field itself. For a
shop the registry leaves blank, that meant a researched website survived until
the following Monday and no longer. `website` now carries under the same rule
as the rest: a value the registry states always wins, and what we found
survives only where the registry states none.
