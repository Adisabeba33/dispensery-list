# FROZEN: municipal opt-out, outside NYC + Westchester

**Status: deliberately not collected. Decided 2026-09-19.**
**Nothing is broken and nothing is half-done. Read §3 before unfreezing.**

---

## 1. What this is

New York's MRTA let every city, town and village ban retail cannabis on its own
territory, with a deadline of 31 December 2021. Roughly a third of the state's
municipalities did. The ban is local; the licence is the state's. So a licence
can be perfectly valid while the address on it sits in a town where retail is
prohibited.

The register records this in `data/municipalities.json` — one record per city,
town and village, with `retailOptOut: true | false | null`.

## 2. Why it is frozen

It was never collected outside the original scope, and freezing it is a choice
rather than a backlog item, for two reasons.

**It does not exist for NYC + Westchester in any meaningful sense.** No borough
opted out. Westchester is recorded in full, by hand. The field is settled there
and always read `false`.

**It contributes nothing to SOMA.** SOMA is fed by shop MENUS. Opt-out status
does not touch a single menu line, strain, or match — shelf coverage is
identical with it and without it. It matters only if the register is published
as a directory a person uses to decide where to go.

So: as long as the register is internal feedstock for SOMA, this work buys
nothing. The moment it becomes a public directory, it is required.

## 3. What is true right now, and must stay true

Upstate and Long Island declare `NOT_ESTABLISHED` in `data/territories.json`:

```json
"municipalOptOut": { "status": "NOT_ESTABLISHED", "file": null }
```

That is enforced, not decorative. `npm run validate` fails if a
`municipalities.json` appears under a territory still declaring
NOT_ESTABLISHED — a partial collection cannot quietly start being read as a
complete one — and fails equally if a territory claims coverage it has no file
for.

**The rule that follows for every page built on these territories:**

> Opt-out renders as **"not checked"**. Never as "no ban", never omitted.
> `null` is not `false`. Use `optOutIsKnown(territory)` from
> `scripts/ingest/territory.ts` — do not test for the file's existence.

Omitting the field is the failure mode to watch: a reader who sees nothing
assumes there is nothing to see, and that is the same lie as printing `false`.

## 4. How to unfreeze — the whole procedure

The adapter is written, reviewed and committed: `scripts/ingest/opt-out.ts`.
OCM's LOCAL map (Legal Online Cannabis Activities Locator) is an ArcGIS
Experience Builder app, so the status is machine-readable. This is one command
per territory, not the weeks of municipal research `docs/STATEWIDE-PLAN.md`
originally budgeted.

**Network requirement.** `arcgis.com`, `cannabis.ny.gov` and `data.ny.gov` are
blocked by the agent proxy in Claude Code sessions. Run this where outbound
HTTPS is open — a laptop, or a session on an environment with an open network
policy. The adapter fails loudly rather than writing nulls, so a blocked run
cannot corrupt anything; it just stops.

### Step 1 — prove the adapter agrees with a person (MANDATORY)

```bash
npx tsx scripts/ingest/opt-out.ts --verify
```

This re-derives the ORIGINAL scope from the map and diffs it against
`data/municipalities.json`, which was checked by hand, one municipality at a
time. It writes nothing. (The adapter refuses outright to overwrite the
hand-checked file — that file is the measuring stick, not a target.)

**Required outcome: zero disagreements and zero absences.** Anything else means
either a stale hand record or a misread field, and which one it is decides
whether the map or the person was right. Reconcile every line before going
further. Do not skip this because the numbers "look about right" — this is the
only evidence we will ever have that the machine and a human agree on data a
human actually checked.

### Step 2 — collect the frozen territories

```bash
npx tsx scripts/ingest/opt-out.ts --territory upstate --dry-run   # look first
npx tsx scripts/ingest/opt-out.ts --territory upstate
npx tsx scripts/ingest/opt-out.ts --territory long-island
```

Expect roughly 1,500 municipalities statewide, of which around a third opted
out of retail. The run prints `status not established: N  ← left null, never
false`; if N is large, the layer changed shape and the output is not
trustworthy.

### Step 3 — flip the declaration

Edit `data/territories.json` for each collected territory:

```json
"municipalOptOut": {
  "status": "MAP_INGESTED",
  "file": "data/upstate/municipalities.json"
}
```

### Step 4 — validate

```bash
npm run validate
```

The declaration check now requires the file to exist. Pages that call
`optOutIsKnown()` start rendering the real status on their own, with no page
change.

## 5. If the map moves

The adapter discovers its layer instead of hard-coding one, precisely so a
republish does not break it silently. If OCM restructures anyway:

- `--app <arcgis item id>` points it at a new Experience Builder item; the
  current default is `230c52db6b0746c69c587599aa119273`.
- `--layer <FeatureServer url>` skips discovery when the right layer is already
  known.
- If neither works, the script prints every layer it found and how each scored
  on the fields an opt-out layer must carry, rather than guessing. That printout
  is the starting point, not a bug report.

Fallback if ArcGIS is gone entirely: OCM also publishes the opt-out list as a
page at <https://cannabis.ny.gov/ocm-local-opt-out-data>, and the Socrata
adapter pattern in `scripts/ingest/run.ts` covers `data.ny.gov` datasets.

## 6. Cost, so the decision can be re-made honestly

| | |
|---|---|
| Work already done | adapter written, discovery, `--verify` mode, declaration check, this document |
| Work remaining | run three commands on an open network; reconcile whatever `--verify` disagrees on |
| Realistic time | under an hour if `--verify` comes back clean |
| Blocked on | network access only — no research, no judgement calls |
| Value to SOMA | none |
| Value to a published directory | required; without it the directory cannot claim a shop may legally operate where it says it does |

## 7. See also

- `scripts/ingest/opt-out.ts` — the adapter, and the reasoning in its header
- `data/territories.json` — the per-territory declaration
- `data/schema/municipality.schema.json` — the record shape
- `scripts/validate-data.ts` → `checkOptOutDeclaration` — the enforcement
- `docs/STATEWIDE-PLAN.md` §7 — the original (wrong, too pessimistic) estimate
