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
