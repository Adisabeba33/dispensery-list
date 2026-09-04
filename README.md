# NY Dispensary Register

A directory of **state-licensed** cannabis dispensaries in New York City and
Westchester County.

New York has a licensed cannabis market and a much larger unlicensed one. The
value of this project is not the size of the list — it is that every entry
carries its OCM licence number and the sources behind it, so a reader can check
our work. One fabricated record would send someone to an unlicensed shop
believing we had verified it, and that would make the whole register worthless.

That is why one rule outranks everything else in this repo:

> **An empty field beats a plausible guess.** Unknown is `null`, never `false`.

## Layout

```
data/
  schema/dispensary.schema.json    the data contract — read it before touching data
  schema/municipality.schema.json  opt-out status of cities, towns and villages
  dispensaries.json                the delivered dataset (empty until research lands)
  dispensaries.demo.json           7-record sample so the site has something to show
  municipalities.json              Westchester opt-outs + NYC boroughs
  raw/                             raw registry snapshots, kept as provenance
docs/
  AGENT_RESEARCH_BRIEF.md          phase 1 — collecting the register from the state
  AGENT_ENRICHMENT_BRIEF.md        phase 2 — menus, geocodes, phones, services
  RESEARCH_REPORT.md               what phase 1 found, and what it could not
  SOURCE_COLUMNS.md                the registry's real columns and the filter used
scripts/
  validate-data.ts                 schema + semantic validation (runs in CI)
  ingest/                          pulls the state registry into the schema
  build-preview.ts                 renders everything into one shareable HTML file
src/                               the Next.js site
preview/index.html                 generated single-file snapshot
```

## Commands

```bash
npm install

npm run dev        # site at http://localhost:3000
npm run build      # static export to out/
npm run validate   # check the datasets against schema + semantic rules
npm run ingest     # pull the NY OCM registry into data/dispensaries.json
npm run ingest:dry # same, but write nothing
npm run preview    # regenerate preview/index.html
npm test           # typecheck + validate
```

## How data gets in

1. **`npm run ingest`** pulls the state registry
   ([Current OCM Licenses](https://data.ny.gov/Economic-Development/Current-OCM-Licenses/jskf-tt3q),
   resource `jskf-tt3q`), filters it to retail licences in the six in-scope
   counties, and writes the skeleton records.
2. **Enrichment** adds what the registry does not hold — geocodes, phone
   numbers, opening hours, services, menu platform. This is the research
   agent's job; see `docs/AGENT_RESEARCH_BRIEF.md`.
3. **`npm run validate`** must pass with zero errors before anything ships.

Re-running ingest refreshes the registry facts and carries enrichment forward
for licences already in the file, so hand-collected detail is not lost.

The ingest adapter does not hard-code Socrata column names. It resolves each
logical field against the columns actually present and, when a required one is
missing, prints the real column list rather than silently emitting nulls.

## Repository size

Raw registry snapshots in `data/raw/` are the provenance for every record, and
they are large in line count — one snapshot is about 4.5 MB across ~117k lines
of pretty-printed JSON. That reads alarming and is not: JSON of this shape
compresses to roughly 9%, so git stores a snapshot in about 0.6 MB, and the
whole repository including history is under 10 MB.

The thing to watch is not any single snapshot but the rate. Git history is
permanent — a large file committed weekly cannot be shrunk later by deleting
it. At roughly 0.6 MB per snapshot, weekly ingest adds about 30 MB of history
a year, which is comfortable; keep that cadence in mind rather than committing
a snapshot on every experimental run.

Nothing here is slow: validation of 456 records takes under a second, the
static build of 462 pages takes about 25 seconds.

## Scope

Phase 1 covers six counties: New York (Manhattan), Kings (Brooklyn), Queens,
Bronx, Richmond (Staten Island) and Westchester. Adding a region means adding a
source adapter under `scripts/ingest/sources/` and widening the county enums in
the schemas.

## Relationship to SŌMA

SŌMA matches a person's sensory taste profile against strains on a dispensary
menu. It needs to know which shops are real and which of them publish a
machine-readable menu — which is what the `menu.provider` field in this schema
records. This register is the location layer under that product.

## What this is not

Not a shop, not a ranking, and not affiliated with or endorsed by the Office of
Cannabis Management. A shop missing from the list is not proof it is illegal,
and a listing here is not a substitute for checking the QR verification decal at
the door or the state tool at
[cannabis.ny.gov/dispensary-location-verification](https://cannabis.ny.gov/dispensary-location-verification).
