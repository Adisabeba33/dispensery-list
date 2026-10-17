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
| 11 | The shelf schema describes New York | `flower-listing.schema.json` accepted only OCM and MM licence numbers, so the first Boston shelf would have failed validation. | It also accepts `MR` plus six digits. |
| 12 | A shop's "no thanks" leaves you on its menu | High Profile asks for marketing consent after the age question, and its "NO THANK YOU" sends the visitor to google.com. The collector pressed it at three shops, filed 215 listings with `https://www.google.com/` as their source, and lost their paging when the page left. | A decline that changes the host is undone and never pressed again at that shop (`offerLeftSite` in the run summary). The three shelves were read again: 127, 125 and 100 listings, each sourced to its own store page. New York's 32,669 listings were checked for the same defect, and none has it. |

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

## 4. Stage 1, Boston's menus: done 2026-10-16

```
37 opened → 34 websites found → 33 on the register → 33 menu endpoints → 29 shelves read, 2,016 listings
```

**Websites.** Four parallel research passes found 37 websites, each tied to its
licence by the street address on the shop's own site, never by name. Every
address was then fetched again here, by plain request or, where a script draws
it, in a browser. The one exception is Curaleaf's, which sits behind its age
gate; it was read there by the research pass, and the store's own URL names
Milk St. The rows, with how each site was tied to its licence, are in
`data/massachusetts/website-research.json`. Three websites were not established:

- **Apothca, Jamaica Plain.** The operator's site no longer shows the address,
  and the shop may be closed.
- **New Dia.** Its site gives 71 Lansdowne St, but the licence is for 48–62
  Brookline Ave. It is probably the same building, but that is inference.
- **AYR, formerly Sira Naturals, on Boylston St.** The site is behind a
  Cloudflare challenge, which is not worked around.

A fourth website was found but is deliberately **not** on the register. Kush
Groove's site shows the Boston address, but its online menu serves only its
Cambridge and Brockton stores, so the collector would have read another
branch's shelf.

**What Boston has that New York did not.**

- **Rebrands and ownership changes run through the register.** Union Twist and
  Uptop are now Dutchess, Sira is now AYR, and Curaleaf opened in Cannabist's
  old space. The licensee's legal name almost never names the shop.
- **New menu platforms: Flowhub, Joint Commerce and Mosaic.** The collector
  read Flowhub and Joint without changes. It read nothing from Mosaic (East
  Boston Cannabis), WooCommerce (SEED) or a Dutchie embed on a PHP page (Baked).
- **Rooted In's robots.txt answers 403.** By the register's rule that stops
  the reader, and it did.

**Partial shelves.** Seven shelves came back small:

| Shop | Listings |
|---|---:|
| Cannabis Healing | 1 |
| Boutiq | 3 |
| Apex Noire | 6 |
| Firehouse | 7 |
| 617 THC | 9 |
| Rebelle | 19 |
| Xhale | 19 |

Most of these are Dutchie embeds and Flowhub storefronts, where the collector
reads the first payload only. They are kept, as partial New York shelves are,
and are the next thing to fix.

**The baseline review.** As decided, the first run was made with
`--state-baseline`. That run skips the foreign-shelf test, marks every shelf
`stateBaseline`, and is refused once a state has any shelf. Each of the 29
shelves was then reviewed by hand, brand by brand:

- Every shelf carries brands that only Massachusetts has: Bostica, Happy
  Valley, Harbor House, Cape Cod Grow Lab, Coastal Healing, Nature's Heritage,
  INSA, Theory, Berkshire Roots, Native Sun, Farmer's Cut, SeCHe, The Bank, and
  others.
- Dutchess also trades in Illinois, so its two shelves were checked further.
  Farmer's Cut sells only in Massachusetts, and SeCHe and The Bank are Jushi's
  Massachusetts flower lines. The two shelves are different (51 items shared),
  and each was read from its own Massachusetts store page.

No shelf was refused. From here on, the test applies to Massachusetts as it
does to New York.

**How far apart the two markets are.**

- **Brands.** Of 165 Boston brands, only 12 are also on a New York shelf: Find,
  Grassroots, Rythm, Old Pal, Botanist, Cheech & Chong, Dark Heart, Good Green,
  ish, &Shine, Tical and Vacation. All are multi-state licences. Judged against
  New York's brands, every Boston shelf would have been refused.
- **Strain names.** 222 of Boston's 1,382 strain names are also sold in New
  York, by different growers. SŌMA's rule that the strain name is not evidence
  (`BRAND-TRUST.md`) is the right rule here too.
- **Terpenes.** 138 listings (7%) carry menu-listed terpenes. None has a lab
  panel.

**Kept apart.** Boston's shelf is
`data/massachusetts/flower-listings.json`. The site's strain index and SŌMA
read only `data/flower-listings.json`, which is New York's, so nothing from
Boston reaches either until someone decides it should.

**Shown, 2026-10-17.** The owner opened `/massachusetts/` and could not find the
shelves: the cards led nowhere. Each shop with a shelf now has a page,
`/massachusetts/<id>/`, and the list has a "Shelf read" filter. The page says
the shelf was read once and is not refreshed daily. It shows only what the
shop's menu said: New York's strain references are not borrowed, because a
Boston jar under the same name is another grower's. The 34 shops whose
trading names research established now carry them in `dbaName` ("Dutchess",
not "Union Twist, Inc."). `ma-run.ts` keeps a researched name unless the
register prints one of its own.

### What stood in the way, as found before the run

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
| 1: Boston menus | 37 | Two fixes: the shelf schema (11) and the decline that left the site (12). The baseline flag, about 30 lines. Same session. | 37 websites researched: four agents, about 10 minutes of wall time, each address verified again here (Curaleaf's behind its age gate excepted) | **29** (2,016 listings) |
| 2: Greater Boston | 160 | | about 140 websites to find (20 from the locator) | |
| 3: the state | 405 | | about 345 websites to find (59 from the locator) | |

The early result matches what STATEWIDE-PLAN §5 predicted, with one change:
**the engineering is cheap, and the research is not municipal this time. It is
websites.** New York's registry publishes a website for most shops: 374 of
upstate's 518 licences came with one. Massachusetts publishes none, so in this
state the funnel is
`405 open → ? with a website → ? menus`, and the first step is the expensive one.

---

## 6. Lab certificates — the question that decides SŌMA, 2026-10-17

SŌMA works in New York because it holds measured terpene panels, filed per
grower (about 5,000 of them). Whether Boston can join it depends on one
question: are Massachusetts certificates of analysis (COAs) published, and do
they carry terpenes? The owner asked for that answer before anything else.

**The short answer.** The certificates exist, and they carry terpenes.
Brands do not publish them, though. They reach the public through other
channels, and only one of those channels is open to this register today.

### What was checked

- **Brands.** The 30 brands with the most listings on Boston's shelves, which
  account for 60% of all 2,016 listings, plus two more. Each brand is recorded
  in `data/massachusetts/coa-research.json`.
- **Labs.** All ten licensed testing labs.
- **Rules.** The Commission's testing rules.
- **Method.** Five research passes worked under the register's rules: only
  what is published, robots.txt kept, walls not passed, no identifier guessed,
  no form submitted.

### What was found

- **Brands publish nothing usable.** Of 32 brands, 25 have no certificate on
  their own site and 6 are behind a wall or robots refusal. Happy Valley does
  publish certificates, but they are for R&D phenotypes from its seed business,
  not for retail batches.
- **Terpene testing is optional in Massachusetts but common.** 935 CMR
  500.160 and the Commission's testing protocol require cannabinoids and
  contaminants only, and a label need not show terpenes. Even so, every
  retailer-published flower certificate seen carried a full terpene panel:
  30 of 30, across 9 of the 10 labs. That sample is biased toward retailers
  who publish, so it says terpenes are common, not universal.
- **Where the certificates actually are:**
  1. **A menu's own link.** Berkshire Roots' Dutchie menu linked a Kaycha
     certificate on `ma.yourcoa.com` for Ice Cream Kush, flower, with its
     Metrc tag, licence MP281427 and 11 terpenes. This is the channel the
     collector already reads, but in Boston it gave 1 link in 2,016 listings.
     Dutchie marks Boston products `certificateOfAnalysisEnabled: true` and
     still leaves `canonicalLabResultUrl` empty.
  2. **Shops whose point-of-sale system hosts certificates.** Alleaves
     (`app.alleaves.com/api/inventory/batch/<shop>/coa/<n>.pdf`) hosts them.
     The collector already reads Alleaves' `coa` field in New York. None of
     Boston's 29 shops is on Alleaves; at least two Massachusetts retailers
     elsewhere are.
  3. **Lab links, one per certificate.** These come from the producer or from
     the QR code printed on the certificate.
     - Public: Kaycha (`ma.yourcoa.com`), Smithers (QBench), Green Valley
       (LabWare) and ProVerde.
     - Public but blocked for this reader: Analytics Labs and Assured use
       Confident LIMS, whose robots.txt answers 403, and that stops the
       reader.
     - None: G7 and SafeTiva offer no public link.
     - Browsable: MCR, but only the reports its clients choose to make public.
  4. **The state.** Since 16 June 2025 every lab must upload every
     certificate to Metrc (Administrative Order No. 5). The Commission says
     certificates are "immediately accessible through the Commission's
     Product Catalog" (`catalog.metrc.com`), a search form. Its own release of
     22 May 2026 says it is still "working with Metrc to make those COAs
     available". This was not tested, because using it means submitting a
     form.
- **What the menus give.** 1,305 of Boston's 2,016 listings (65%) carry a
  package ID, and most of those are Metrc tags (`1A40A…`). 1,088 listings
  (54%) carry a total-terpene figure from the menu, against 33% in New York.
  Only 138 listings (7%) carry a terpene profile.
- **What the reader can read.** `scripts/coa-panel.py`'s coverage of
  Massachusetts certificates, after a two-line change:
  - **Kaycha:** read in full. All four Kaycha certificates seen were read:
    terpenes, total terpenes, THC and the client's MA licence.
  - **MCR:** THC is read, the terpene table is not.
  - **G7, Analytics Labs, Green Valley, SafeTiva, Assured, ProVerde,
    Smithers:** no layout yet, so nothing is read.
  - In the sample of 30, G7 (10) and Analytics Labs (6) were the most common
    labs.

**Potency is contested here, and that bears on Boston's lower THC (§4).**
- In 2024 and 2025 the Commission moved against THC inflation and lab
  shopping: one lab per sample since April 2025, and a standard for how
  potency is reported.
- In January 2025 MCR sued eight rival labs, alleging inflated results.
- Assured was the first lab ever suspended, in June 2025, for misreported
  yeast and mold.
- In August 2026 the state's own potency audit found 13 of 63 flower
  products labelled higher than they tested.

### What would open it, in order of value

1. **The state catalogue, by Metrc tag.** The menus already hand over the
   Metrc tag for most jars. The state's catalogue keyed on that tag would give
   one certificate per jar, from the source of record. It is a search form,
   though, and the register's rule is never to submit one. **The owner's
   decision.**
2. **Massachusetts shops on Alleaves.** Find them and read their menus; the
   collector already takes the `coa` field there.
3. **Reader layouts for G7, Analytics Labs, Green Valley and MCR's
   Massachusetts table.** Add them as certificates arrive. Every layout is
   pinned in `coa-panel-check.py`, as Kaycha MA now is.

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
