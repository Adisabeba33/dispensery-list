# Covering the rest of New York

> **Decided 2026-09-18: three territories, kept apart.** NYC + Westchester,
> Upstate, and Long Island are separate datasets, separate collection runs and
> separate pages. Nothing merges. The original scope keeps its files at
> `data/*.json` — nothing moved, nothing added to it — and each new territory
> owns a directory beside it. See `data/territories.json`.
>
> **Stage 0 is done for both new territories.** Built offline from the
> 2026-09-06 snapshot, so all three are cut from one source and are exactly
> comparable: **Upstate 517 shops, Long Island 45.** `npm run validate` passes
> on all three, and `data/dispensaries.json` is byte-identical to before.
>
> What stage 0 cost, and what it found, is §7.

The register holds NYC's five boroughs and Westchester: 468 licences, 328 of
them open, 157 with a menu collected. This is the plan for the other 56
counties — and, because that is the real reason to do it, for learning what a
**second state** would cost.

Every number below is measured from `data/raw/ocm-licenses-2026-09-06.json`,
which already contains the whole state. Reproduce with the snippets inline.

---

## 1. What is actually out there

| | Active retail licences | Of those, opened to the public |
|---|---:|---:|
| Current scope (6 counties) | 505 | 334 |
| **Rest of the state** | **807** | **369** |
| — of which Long Island (Suffolk, Nassau) | 58 | 17 |
| — of which upstate | 749 | 352 |

**The expansion roughly DOUBLES the open set — it does not triple it.** 807
sounds like 2.6× today's register, but licence ≠ shop: only 369 of them have a
public opening date, against 334 in scope. Upstate has many more licences that
have not opened.

### One scope decision to make deliberately

"Everything above Westchester up to Canada" is upstate — **749 licences, 352
open**. It excludes Long Island, which is 58 licences and only 17 open. Long
Island is neither upstate nor currently covered, so it falls through unless
someone names it. Cheap either way; just decide rather than discover.

### Where the shops are, by the registry's own region field

| Region | Active retail outside current scope |
|---|---:|
| Capital District | 148 |
| Western NY | 143 |
| Mid-Hudson | 142 |
| Finger Lakes | 97 |
| Southern Tier | 78 |
| Central NY | 60 |
| Long Island | 58 |
| Mohawk Valley | 48 |
| North Country | 31 |

---

## 2. The funnel, as measured on the six counties we have

```
468 licences  →  328 open  →  319 with a website (97%)  →  157 menus (48%)
```

Applied to the 352 open upstate shops, the expected landing is **~170 new
menus** and a shelf of roughly **19,000 listings**, about double today's 9,542.

That 48 % is the number to watch, and it is not guaranteed to hold. It was
earned in a city where menu platforms are concentrated, and
`docs/MENU_ENDPOINTS_REPORT.md` records that fifteen of twenty-five shops were
once lost to age gates and the browser path alone. Upstate will have more
one-off proprietary storefronts and possibly more of the standard platforms;
which way that cuts is unknown until the first region is run.

**The bottleneck is not collection, it is the endpoint study.** 35 endpoints
have been characterised and `data/menu-endpoints.todo.json` still holds 131
for the current scope alone. That is the step that costs attention; the
browser run costs only CI minutes (40 shops per run, ~9 runs for a doubled
register).

---

## 3. What is free, what is cheap, and what is the actual work

### Free — the ingest

`SCOPE_COUNTIES` in `scripts/ingest/sources/ny-ocm-socrata.ts` is a
six-element array. The raw snapshot already holds every county, and the US
Census geocoder that gave 97 % coverage does not care where a street is. The
statewide register is **one constant away**, today, and the record shape needs
nothing new.

### Cheap — menu collection

Mechanical, and already automated end to end. It costs CI browser minutes and
the endpoint study above.

### The actual work — municipalities

`data/municipalities.json` holds **53 records**: five NYC boroughs and 48
Westchester towns and villages. New York State has on the order of **1,500**
cities, towns and villages, and its opt-out regime is real — a large number of
upstate municipalities opted out of retail entirely.

This is the register's whole claim to correctness. The README's rule — *an
empty field beats a plausible guess* — bites hardest here: recording a shop in
a town that opted out, or marking a town opted-out when it never voted, is
precisely the fabricated record the project exists to refuse. Opt-out status
comes from municipal records and the state's own opt-out list, one municipality
at a time.

**Budget the expansion as municipal research, not as engineering.**

---

## 4. Three things that break, and must be decided before the switch

### 4a. The ratchet baseline — the one that matters

`Soma/tests/fixtures/ny-shelf-names.json` is the frozen NYC shelf, and
`tests/shelf-coverage.test.ts` floors absolute counts against it: 3,968
answered, 3,772 curated. Doubling the shelf invalidates every one of those
numbers, and **coverage will probably fall** — upstate cultivators are
different cultivators, so a fresh crop of unknown names arrives at once.

A drop that arrives silently makes months of ratcheting unreadable. So:

> **Keep the NYC fixture frozen as its own ratchet. Add a second, statewide
> one beside it. Never merge them.** The NYC number goes on measuring the work
> that has been done; the statewide number starts its own history at whatever
> it starts at.

### 4b. The site is NYC-shaped

`src/app/westchester/` is a hard-coded route and the directory groups by
borough. Statewide needs region as a first-class dimension — and the raw feed
already carries a `region` field, so it is available rather than inventable.

### 4c. `address.borough` is NYC-only

Fine as a nullable NYC extra; it must not be the grouping key statewide.

---

## 5. What this trial teaches about a second state — the real point

Be precise about what would carry over, because it decides whether state #2 is
a week or a quarter.

**Carries over (~90 % of the repo):** the schemas, the validator, the menu
collector and its browser path, the terpene mapping, the producer model, the
SŌMA gap triage, the whole curation pipeline. None of it is New York-specific.

**Does not carry over:** the ingest adapter. `scripts/ingest/sources/ny-ocm-socrata.ts`
is bespoke to New York's Socrata dataset `jskf-tt3q`. Another state means
another source with another shape — and several states publish no
machine-readable licence registry at all, which turns ingest from an adapter
into a scraping-and-verification project.

**And the municipality research does not carry over at all.** It is the
dominant cost in both states.

So the measurement to take from this trial is not "did it work". It is:

> **How many lines of code changed, against how many hours of municipal
> research.** If the answer is "one constant and three weeks of opt-out
> checking", then a new state costs research-days, not engineering-days — and
> that is the number that decides whether this scales to fifty states or to
> three.

Write both figures down when stage 1 finishes.

---

## 6. Staged, and the recommendation

**Do one region first, not the whole state.** The point is to learn the cost,
and a region answers that in a week where the state takes a quarter.

**Capital District** is the right first region: 148 licences, the largest
block, self-contained, and Albany gives a dense urban core to compare against
NYC behaviour.

| Stage | Work | Cost |
|---|---|---|
| **0** | Widen `SCOPE_COUNTIES` to the Capital District's counties, re-run ingest, geocode. **Touch no ratchet.** Report what arrived. | hours |
| **1** | Municipal opt-out research for that region — the real work, and the thing to time carefully. | the unknown |
| **2** | Endpoint study, then menu collection for the region. | CI + attention |
| **3** | Stand up the statewide ratchet beside the frozen NYC one. Re-measure coverage and expect it to fall; decide what the new floor means before reading it. | half a day |
| **4** | Repeat by region, largest first: Western NY (143), Mid-Hudson (142), Finger Lakes (97)… | linear |

Only after stage 3 is there an honest answer to the question this trial was
run to ask.

---

## Reproduce

```bash
cd dispensery-list && python3 -c "
import json, collections
R = json.load(open('data/raw/ocm-licenses-2026-09-06.json'))
SCOPE = {'New York','Kings','Queens','Bronx','Richmond','Westchester'}
RETAIL = {'Adult-Use Retail Dispensary License','Adult-Use Conditional Retail Dispensary License','Adult-Use Registered Organization Dispensary License','Adult-Use Microbusiness License'}
act = [r for r in R if r.get('license_type') in RETAIL and r.get('license_status') == 'Active']
out = [r for r in act if (r.get('county') or '').strip() not in SCOPE]
opened = lambda rs: sum(1 for r in rs if r.get('retail_date_opened_to_public'))
print(len(act), len(out), opened(out))
print(collections.Counter((r.get('region') or '?').strip() for r in out).most_common())
"
```


---

## 7. What stage 0 actually cost — the trial's first real numbers

Five NYC-shaped assumptions had to be found and removed. None was in the plan
above, and that is the point of running a region rather than estimating one.

| # | The assumption | How it showed up |
|---|---|---|
| 1 | `canonicalCounty` was a six-county **whitelist** | First upstate run returned **0 records** from a snapshot holding 807. Every unknown county resolved to null and was filtered out as unreadable. Now an alias table with a title-case fallback. |
| 2 | `address.county` was an **enum of six** in the shared schema | 562 records rejected. County membership is a territory question, so the check moved to the validator, where each territory is checked against its own scope. A Brooklyn file still cannot hold an Erie shop. |
| 3 | ZIP-range check returned **false** for any county it did not know | 562 fabricated failures — Erie and Delaware reported "outside the range" by a function never told what their range is. Returns `null` now, and the caller skips rather than inventing a verdict. |
| 4 | One licence = one row | The state publishes some shops **twice**, under two `location_id` values with two spellings of one address. 99 upstate, 3 Long Island, and 10 hiding in the original six. Collapsed at ingest, deterministically. |
| 5 | Every licence has a premises address | **152 upstate microbusinesses have none at all**, against zero in NYC. Dropped rather than published addressless — a directory whose job is to send someone to a licensed door cannot list a shop with no door — and counted in the run so the gap is visible. |

Plus two smaller ones: a slug of name + city collides for a real two-shop
operator in one town (disambiguated by the licence tail, the shape the original
scope already carries), and one licensee publishes its DBA as the literal
string `N/A`.

### The ratio this trial exists to measure

**Code: five assumptions, four files, roughly 120 lines.** One afternoon.

**Municipal research: not started, and unchanged in size** — 53 records on file
against roughly 1,500 statewide.

So the early read is the one §5 predicted: **the engineering is cheap and the
research is not.** A second state would pay the ingest-adapter cost again
(§5) plus the whole municipal cost, and almost nothing else.

### What stage 0 deliberately did NOT do

- **No menus.** Neither new territory has `flower-listings.json`; the validator
  skips a file a territory has not collected, because an empty placeholder
  would claim coverage nobody has done.
- **No municipalities**, so **opt-out status upstate is unknown**. Every record
  carries a licence number and an address from the state registry and nothing
  more. That must be said on the page before it is published.
- **No geocodes.** The Census geocoder pass has not been run for them.
- **No site pages.** `/upstate` and `/long-island` are next.
- **Nothing touched in the original scope.** `data/dispensaries.json` is
  byte-identical, and re-running NYC ingest is deliberately avoided: today's
  snapshot would legitimately add 40 shops and reshape `contact`, and that is a
  decision to take on purpose rather than as a side effect of this work.


---

## 8. Municipalities — an adapter, not a research project

> **FROZEN 2026-09-19.** The adapter below is finished and committed; it has
> deliberately **not been run**. Upstate and Long Island declare
> `municipalOptOut: NOT_ESTABLISHED` in `data/territories.json`, the validator
> enforces that declaration, and the pages must render opt-out as *not checked*
> rather than *no ban*. The reason is in §2 of
> **[`FROZEN-municipal-opt-out.md`](FROZEN-municipal-opt-out.md)**: opt-out
> status contributes nothing to SOMA's shelf coverage and is required only if
> the register is published as a directory. That document is the thaw
> procedure — read it instead of improvising from this section.

The plan above budgeted this as the dominant cost: 53 records on file against
~1,500 statewide, checked one municipality at a time. **That estimate was
wrong, in a useful direction.**

OCM publishes opt-out status in **LOCAL**, its Legal Online Cannabis Activities
Locator. LOCAL is an ArcGIS Experience Builder application, and every one of
those is backed by FeatureServer layers that answer JSON over REST. So the
statewide opt-out list is a fetch, not a phone call.

`scripts/ingest/opt-out.ts` is that adapter.

### How it behaves

- **It discovers rather than hard-codes.** It walks the app's own
  configuration to find its layers, scores each one on the fields a municipal
  opt-out layer must carry, and when it cannot decide it prints what it found
  instead of emitting plausible nulls. Same posture as the Socrata adapter, for
  the same reason: an id written down today breaks silently tomorrow.
- **Unknown is null, never false.** A municipality the map does not cover, or
  a value it encodes in a way the reader does not recognise, comes back null.
  `false` means "we established it did not opt out"; sending somebody to a shop
  in a town that banned retail is the fabricated record this register refuses,
  and the two are one careless default apart. The run prints the null count.
- **A village is never inferred from its town.** They opt out independently —
  the schema already records Mamaroneck, which is both — so each stays its own
  record.
- **It refuses to overwrite the original scope.** `data/municipalities.json`
  was checked by hand; a first machine run does not get to replace it.

### The step that decides whether to trust it

```bash
npx tsx scripts/ingest/opt-out.ts --verify
```

Runs the adapter against the **six original counties** and diffs it against the
53 hand-checked records, writing nothing. It reports agreements,
disagreements, municipalities the map does not carry, and ones it carries that
nobody checked.

**Run this before trusting the adapter upstate.** A disagreement is either a
stale hand record or a misread field, and which one it is decides whether the
map or the person was right. Zero disagreements is the only result that earns
a statewide run.

### Not run here — and now frozen on purpose

The proxy in this environment blocks `arcgis.com`, `cannabis.ny.gov` and
`data.ny.gov` alike, so the adapter is written and its failure path verified,
but no municipal data has been fetched. Sequence, wherever the network is open:

```bash
npx tsx scripts/ingest/opt-out.ts --verify                      # must agree
npx tsx scripts/ingest/opt-out.ts --territory upstate --dry-run # inspect
npx tsx scripts/ingest/opt-out.ts --territory upstate           # write
npx tsx scripts/ingest/opt-out.ts --territory long-island
npm run validate
```

…then flip each territory's `municipalOptOut` to `MAP_INGESTED` with its file
path, which is what makes the validator and the pages believe it. The full
procedure, including the reconciliation rule for `--verify` and what to do if
OCM moves the map, is **[`FROZEN-municipal-opt-out.md`](FROZEN-municipal-opt-out.md)**.

### What this does to §5's ratio

The engineering side grew by one adapter. The research side — the part that
was supposed to dominate — may collapse to a verification pass. If `--verify`
comes back clean, the honest read of the trial changes: **a new state costs an
ingest adapter per public dataset, and municipal research only where the state
does not publish one.** New York publishes one. Not every state will.
