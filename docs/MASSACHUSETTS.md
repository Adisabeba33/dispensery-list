# Massachusetts — what a second state costs

> **Decided 2026-10-16.** The owner wanted to know what it costs to carry the
> register into a second state, and what gets in the way. Boston was chosen
> over Los Angeles, Detroit and Chicago because its state publishes open data,
> as New York does. A page went up straight away: `/massachusetts/`.
>
> **The plan is staged.** The register covers the whole state at once, because
> the state publishes one file, so 37 shops cost the same as 455. Menus are read
> in three stages: the city of Boston, then Greater Boston, then the state. Each
> stage records the figures in §5.

`docs/STATEWIDE-PLAN.md` §5 asked how many lines of code change, set against how
many hours of research. This is the first measurement against a state that is
not New York.

---

## 1. Stage 0: the register, 2026-10-16

| | |
|---|---:|
| Licences in the Commission's file, every type | 952 |
| Marijuana Retailer licences: **the register** | **455** |
| Of those, operations commenced (`openedOn`) | **405** |
| Counties | 14 of 14 |
| Phone or website matched from the state's own store locator | 59 |
| City of Boston: licences / opened / with a website | 47 / 37 / **0** |
| Greater Boston (Suffolk, Middlesex, Norfolk, Essex): licences / opened / with a website | 185 / 160 / 20 |

For scale: New York City and Westchester hold about 330 open shops, and 239 of
their shelves are read. At 405 open shops, Massachusetts is the comparable
size. Greater Boston alone is half of it.

Built by `scripts/ingest/ma-run.ts`. Both source files are kept verbatim in
`data/raw/` (`ma-ccc-licenses-*.json`, `ma-ccc-where-to-buy-*.js`), and a rebuild
from them is identical to the live run (checked).

### What is in scope, and what is not

Only **Marijuana Retailer** licences are in scope. Three other licence types sell
cannabis in some form, and each is left out for its own reason:

- **Medical Marijuana Treatment Centers (94).** They serve registered patients
  only. A treatment centre that also sells to adults holds a separate MR
  licence, and that licence is in scope. Counting both would list the same
  door twice.
- **Microbusinesses (25).** Here they grow or make product. They do not run
  shops.
- **Delivery operators and couriers.** They have no door to send anyone to.

---

## 2. What broke: assumptions that only hold in New York

As with upstate (STATEWIDE-PLAN §7), none of these was in a plan. Running the
state is what found them.

| # | The assumption | How it showed up | Now |
|---|---|---|---|
| 1 | The state runs a Socrata API | `opendata.mass-cannabis-control.com` no longer completes a TLS handshake. The same data is now plain files under `masscannabiscontrol.com/resource/`, with no query API and no paging. | A new adapter (`sources/ma-ccc.ts`). Nothing in `ny-ocm-socrata.ts` could be reused. |
| 2 | The source is JSON | Both files start with a UTF-8 byte-order mark, which `JSON.parse` rejects. The store locator is JavaScript, and one shop in it is titled `"b\well"`: a browser reads that escape, JSON refuses it. | The mark is stripped. The array is cut out of the script and parsed as data, never run. |
| 3 | A county name identifies a place | Suffolk, Essex and Franklin are counties in **both** New York and Massachusetts. Checked by county alone, a Boston shop counts as part of Long Island. Upstate is defined by the counties it excludes, so it would have taken in every Middlesex shop. | Every territory names its `state`, and membership is state **and** county (`inTerritory`). |
| 4 | The schema describes New York | The licence-number pattern accepted only OCM and MM forms, and `address.state` had to be `NY`. | The pattern also accepts `MR` plus six digits, and `state` may be `NY` or `MA`. |
| 5 | Every territory is a New York territory | `run.ts --territory massachusetts` would read the New York registry, match nothing, and **write an empty register over Massachusetts**. `opt-out.ts` would read New York's LOCAL map for Massachusetts towns. | Both refuse any territory outside New York. |
| 6 | The premises state field is the premises state | Four licences print the licensee's head-office state (FL, CA, DE) next to a Massachusetts ZIP and county. | Recorded as MA, with a warning on the record that quotes what the register printed. |
| 7 | The registry carries the website | It does not. There is no website, no trading name (except 3 written into the name field as "D/B/A") and no shop phone. `BUSINESS_PHONE` is the licensee's office: Cresco's Leicester shop shows a Chicago number. | The Commission's store locator fills 59 of 455, joined on street address and ZIP and only where both sides match exactly one. Everything else stays null. |
| 8 | The page copy is New York law | The territory pages said "Under the MRTA…". | The copy is chosen by state (`GAP_COPY`). The New York sentences are unchanged. |
| 9 | Every address is in NY | The card, and the maps link, ended every address with ", NY". | Both use the record's state. |
| 10 | Every shelf is checked against New York brands | The collector refuses a shelf whose brands are mostly unknown (the Ohio shelf filed under Farmingdale). Its known brands came from **every** territory, so New York and Massachusetts shelves would have vouched for each other. | Known brands are now counted within one state. **This leaves a gap: see §4.** |

Found along the way, not caused by Massachusetts: on a phone, territory cards
were wider than the screen on all three territory pages (upstate scrolled to
468 px on a 390 px screen). The grid track could not shrink below the cards'
unwrapped text. Fixed: `grid-cols-1`.

Left as they are, and named here so they are not rediscovered:

- `geo` in the schema is bounded to New York City (lat 40.4–41.4). Massachusetts
  coordinates would fail it. Nothing has been geocoded yet, as with upstate.
- `seeCategory` holds New York's equity categories, so Massachusetts records it
  as null. `verification.checkedAgainstOcmTool` is named after New York's
  regulator, so it is also null here.
- The collector's refusal record calls the figure `shareSeenInNewYork`.

### Where the register is better than New York's

- Every row carries its county.
- The commencement date is filled in for every opened shop.
- No licence lacks an address. Upstate had 152 without one.
- No licence appears twice. New York lists some shops under two location IDs.

Two addresses do hold two active retail licences each: 1021 South Street in
Pittsfield and 380 Dwight Street in Holyoke. Both are kept as published,
because one licence is one record. Neither address gets a phone or website from
the locator, since that join would have to pick a licence by guessing.

---

## 3. Two things looked for and not found

**Terpenes.** The Commission publishes every lab result: 354,562 rows for 2025
alone. It looked like the source New York lacks. It is not one:

- the only potency figures are THC and THCA percentages;
- the rest of the rows are contaminant tests;
- the labs are anonymised (`Lab_A` to `Lab_O`);
- METRC IDs are hashed, so a result cannot be traced to a product, a brand or a
  shop.

There are no terpenes in it. For SŌMA, measured terpenes in Massachusetts would
have to come from certificates of analysis, as they do in New York.

**Municipal opt-out.** The Commission keeps a Municipal Zoning Tracker covering
all 351 cities and towns. It is loaded into its web page by script, and the
Commission states that it "does not constitute an official or comprehensive
legal determination". It is frozen on the same terms as upstate
(`docs/FROZEN-municipal-opt-out.md`): the territory declares `NOT_ESTABLISHED`
and the page shows "not checked".

---

## 4. Stage 1, Boston's menus: what is in the way

1. **No websites.** Boston has 37 open shops and the state links none of them
   to a website. The locator matched no shop in the city. Before the collector
   can visit anything, someone has to find 37 websites, the same work as
   `AGENT_UPSTATE_WEBSITES_BRIEF.md`. That makes this stage a research job, not
   a CI run.
2. **The first shelf in a new state has nothing to be checked against.** The
   foreign-shelf test (item 10 above) asks whether a shelf's brands have already
   been seen on another shelf in the same state. In a state with no shelves
   yet, the answer is always no, so every Boston shelf with ten or more brands
   would be refused. Before this change the answer was the same, because
   Boston brands are not New York brands. The test fails safe, and it means
   **this stage collects nothing until a decision is made.** Proposal: run the
   first Boston collection with the test switched off for Massachusetts only,
   review each shelf's brand list by hand, and keep the reviewed shelves as the
   state's baseline. From then on the test works as it does in New York.
3. **Menu platforms are unknown.** New York's endpoint study (`menu-endpoints.json`)
   covers New York shops only. Boston's mix of Dutchie, Jane, Sweed, first-party
   stores and other platforms has not been measured.

---

## 5. The figures, per stage

| Stage | Shops (opened) | Code changed | Research | Shelves read |
|---|---:|---|---|---:|
| 0: register + page, whole state | 405 | 19 files, +629 / −33 lines. The adapter is about 450 of them; changes to shared code about 180. One working session. | none: no municipal research, no website research | — |
| 1: Boston menus | 37 | | 37 websites to find (§4) | |
| 2: Greater Boston | 160 | | about 140 websites to find (20 from the locator) | |
| 3: the state | 405 | | about 345 websites to find (59 from the locator) | |

The early result matches what STATEWIDE-PLAN §5 predicted, with one change:
**the engineering is cheap, and the research is not municipal this time. It is
websites.** New York's registry publishes a website for most shops: 374 of
upstate's 518 licences came with one. Massachusetts publishes none, so in this
state the funnel is
`405 open → ? with a website → ? menus`, and the first step is the expensive one.

---

## Reproduce

```bash
NODE_USE_ENV_PROXY=1 npx tsx scripts/ingest/ma-run.ts --dry-run    # live, write nothing
npx tsx scripts/ingest/ma-run.ts \
  --from-raw data/raw/ma-ccc-licenses-2026-10-16.json \
  --locator-raw data/raw/ma-ccc-where-to-buy-2026-10-16.js        # rebuild from snapshots
npm run validate
```

`NODE_USE_ENV_PROXY` is needed only behind a proxy that Node's fetch would not
otherwise use, such as a Claude Code cloud session. CI does not need it.
