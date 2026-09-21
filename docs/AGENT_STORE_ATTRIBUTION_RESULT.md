# Store attribution result — 2026-09-20

Source brief: `docs/AGENT_STORE_ATTRIBUTION_BRIEF.md`
Working branch: `claude/sync-varieties-repos-jdu0q7`

## Delivered

15 new, store-specific rows were appended to `data/menu-endpoints.json`. Existing rows were left untouched.

Added licences:
- OCM-RETL-24-000064 — Green Flower Wellness, Oakland Gardens
- OCM-RETL-24-000233 — Green Flower Wellness, Glen Oaks / New Hyde Park
- OCM-RETL-25-000438 — Green Flower Wellness, Ozone Park
- OCM-CAURD-23-000020 — Terp Bros, Astoria
- OCM-CAURD-25-000294 — Terp Bros, Ozone Park
- OCM-CAURD-24-000102 — Hii, Williamsburg
- OCM-CAURD-26-000330 — Hii, Bay Ridge
- OCM-CAURD-24-000046 — Cannabis Realm, White Plains
- OCM-RETL-24-000244 — Cannabis Realm, Queens / Comfort Care licence entity
- OCM-RETL-25-000319 — Dankley, Queens
- OCM-RETL-25-000450 — Dankley, Manhattan
- OCM-CAURD-25-000291 — NYC Bud Midtown
- OCM-RETL-26-000511 — Hibernica Central Park
- OCM-CAURD-23-000021 — CONBUD LES
- OCM-CAURD-24-000080 — The Cannabis Place, New York

Existing Hibernica Bronx row OCM-CAURD-24-000131 was not modified.

## Deliberately left empty

### The Flowery — six licences in the brief

The first-party site proves the individual stores and licence/address mappings, but the public shop uses a shared `/shop/category/flower` route after a “shop this location” state selection. No stable per-store flower URL was proven for the six queued licences. Per the brief, no URL was fabricated.

### Gotham — three licences

The first-party site proves Bowery, Williamsburg and Chelsea as separate licensed locations, but the public cannabis menu is shared and location is selected as site/order state. No stable location-specific flower URL was proven. No rows were added.

## Queue B

Cannabis Realm / Comfort Care: the shared registry website is not merely a bad registry attribution. The first-party Cannabis Realm site exposes distinct White Plains and Queens menus. OCM-RETL-24-000244 is the licence entity at the Queens/Jamaica store, while Cannabis Realm is the customer-facing store identity. Separate White Plains and Queens flower endpoints were added.

CONBUD: the collector had followed a blog article. A first-party LES storefront was found and added.

The Cannabis Place: the generic New York landing was replaced by the first-party Flower/store URL.

Smoking Scholars (OCM-CAURD-24-000200): the current first-party site now exposes its product catalogue and Flower category directly on the normal storefront. The stale `35-flower-sale` Dispense slice from coverage is not used as a curated endpoint; no endpoint override was added.

## Queue C — paging evidence

The brief requires the *observed second-page network request* (parameter and change) for ENFLOR, Stashmaster, Mello Tymes, Studio57NY and Emerald Dispensary. That evidence could not be truthfully produced from static HTTP/search results. The available research surface does not expose browser DevTools XHR/fetch traces, and the execution container has no outbound DNS/network access, so `menu-render.mjs --dump-requests` cannot be run against the live sites here.

Accordingly, no `page=2`, `offset`, cursor, or POST field was guessed. These five paging values remain deliberately unresolved rather than fabricated.

## robots.txt

Direct `/robots.txt` retrieval for the newly researched origins was attempted, but the available web fetch surface returned the files as inaccessible. Therefore `robotsAllows` remains `null` on the new rows. It is intentionally not set to `true` or `false` without an actual read.

## Validation status

The branch commit is deployed successfully by Vercel. Full brief acceptance commands (`npm run validate` and live `menu-render.mjs` checks) could not be executed locally because the available execution container cannot resolve external hosts and the repository is not mounted there. The repository's endpoint-audit GitHub Action is configured to run on `agent/menu-endpoints-nyc`, not on this working branch.

No collector code was changed.

---

# Verified against live menus — collection run #45, 2026-09-20

Not written by the research agent. This is what happened when the fifteen
addresses above were actually collected from, in a one-off diagnostic run
(`Menu collect`, `only=` the fifteen licences), which by design reads and
reports without writing anything back to the register.

Run: https://github.com/Adisabeba33/dispensery-list/actions/runs/35493923038

All fifteen used their researched address — the report marks each with `*`.
`npm run validate` passed inside the run.

| Shop | Before, from a shared page | This run | |
|---|---:|---:|---|
| Cannabis Realm of New York | 10 | **494** | +484 |
| Comfort Care Services inc. | 10 | **430** | +420 |
| The Cannabis Place | 20 | 79 | +59 |
| Green Flower Wellness, New Hyde Park | 151 | 204 | +53 |
| CONBUD LES | 0 | 36 | +36 |
| Terp Bros, Ozone Park | 170 | 183 | +13 |
| Green Flower Wellness, Oakland Gardens | 159 | 164 | +5 |
| Hii, Williamsburg | 238 | 241 | +3 |
| Terp Bros, Astoria | 170 | 169 | −1 |
| NYC Bud, Midtown | 33 | 23 | −10 |
| Hibernica, Central Park | 113 | 86 | −27 |
| Hii, Bay Ridge | 238 | 184 | −54 |
| Green Flower Wellness, Ozone Park | 159 | 104 | −55 |
| Dankley, Queens | 121 | **8** | −113 |
| Dankley, Manhattan | 121 | **0** | −121 |
| | **1,713** | **2,405** | **+692** |

## The test that mattered

The brief's rejection rule was that two licences in one group coming back with
identical shelves means the store picker never switched stores. Every group
now differs:

- Hii 241 / 184, where both read 238
- Terp Bros 169 / 183, where both read 170
- Green Flower 164 / 204 / 104, where they read 159 / 151 / 159
- Cannabis Realm 494 / Comfort Care 430, where both read 10

**A smaller number here is the correction, not a regression.** Hii Bay Ridge
was reading Williamsburg's shelf, Hibernica Central Park was reading the
Bronx's, NYC Bud Midtown was reading the Queens store's. Each now reads its
own, and its own is smaller. The brief's "no licence should come back with
fewer listings" was written for a shop whose page was already its own; it does
not apply to a licence being taken off somebody else's page.

Cannabis Realm, the shop that started all of this, went from ten strains to
494 — 777 products seen across 29 scroll rounds, 235 of them dropped as the
same strain in another size. That is a real shelf.

## Two rows removed

`OCM-RETL-25-000450` and `OCM-RETL-25-000319`, both Dankley, are deleted from
`data/menu-endpoints.json` and queued in `data/menu-endpoints.todo.json` with
what the run showed:

- **Manhattan** returned 8 payloads and no products at all.
- **Queens** redirected to `/queens-store/dankley-main/` and the
  `dtche[category]` parameter did not apply: 97 products seen, 8 flower, 32
  dropped as another category, 57 by title. It read the whole menu.

Dankley embeds Dutchie and the category parameter reached neither store, so
the menu is likely served from an iframe or a path the parameter cannot filter.
Removing the rows returns both licences to hunting, which is the state they
were in before — one shelf shared between them, marked as shared — rather than
the empty shelf the rows produced.

## One row kept but still wrong

**CONBUD LES** landed on `/stores/conbud-les`, the store page rather than the
flower category: 244 products seen, 36 kept, 130 dropped as another category.
It used to follow a blog article and read nothing, so 36 is a large
improvement and the row stays. It is still not the shelf, and the existing
todo entry for this licence has been updated to say so.

---

# Checked by hand against the shop's own menu — Cannabis Realm, White Plains

2026-09-20. Not a script: a person opened
`cannabisrealmny.com/white-plains/menu/categories/flower`, went through it, and
compared it to what the register holds for `OCM-CAURD-24-000046`.

**Every weight matched, item for item**, except 3.5g, which has 401 listings
and was too many to read by eye. What was checked: 1g, 2g, 4g, 7g, 14g, 28g and
the bulk sizes above it.

**The exclusions were right.** Infused, Moonrocks and ground flower were all
kept off the shelf, which is the harder half of the job — a collector that
takes everything is easy to write and useless.

This is the first independent check of the collector against a live shop, and
it is worth more than any of the fixture tests, because a fixture only ever
asks whether the parser still does what it did yesterday.

## What it found anyway

Two listings from The Bulk Boys, on that same shelf:

| | |
|---|---|
| `Bulky's Ground` | 56g |
| `Bulky's Blend of Bits` | 84g |

Both are bulk shake. The rule refusing shake was the phrase `ground flower`, so
a shop writing "Bulky's Ground" walked past it — as did "Pluto - Indica
Ground", "Ground - Tahoe OG" and every "Pre Ground" on any shelf.

The word appears 98 times across 22,289 collected listings and is a product
every single time; no name in SŌMA's catalog carries it. So the rule is now the
word on its own, on a word boundary, and "Playground Punch" keeps its place.
98 listings were removed from the collected files: 85 from New York City, 10
upstate, 3 on Long Island.

`Bulky's Blend of Bits` is still there. It is one listing, "bits" names nothing
in particular, and a vocabulary entry invented for a single product is how a
filter starts eating real cultivars. It stays until there is a second one.
