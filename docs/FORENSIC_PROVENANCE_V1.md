# Forensic provenance layer v1

This layer is intentionally separate from `scripts/lot-twins.py`. Lot Twins is
unfinished and remains the consumer/detector; these files only acquire and
normalize evidence.

## Pipeline

```
flower-listings / Retail-ID links / existing caches
                    |
                    v
          scripts/forensic-harvest.py
                    |
          +---------+----------+
          |                    |
retail-cards.jsonl      fingerprints.jsonl
          |                    |
          +---------+----------+
                    |
             future detectors
                    |
              lot-twins.py
```

Run offline first:

```sh
python scripts/forensic-harvest-check.py
python scripts/forensic-harvest.py
```

Then, when live public Retail ID requests are wanted:

```sh
python scripts/forensic-harvest.py --network --budget 100
```

The network mode requests **known tags only**. It does not enumerate adjacent
package numbers. Existing Lot Twins probing remains untouched until that work is
finished.

## Evidence rules

1. Keep discovery provenance for every package tag.
2. Never use a commercial name, brand or facility in the chemical fingerprint.
3. Preserve full precision supplied by the source; rounding belongs in a
   detector, not in evidence storage.
4. Never coerce ND, <LOD or <LOQ to zero.
5. A fingerprint match is a candidate identity signal, not an accusation.
6. Same Package/Batch UID is stronger evidence than chemistry similarity.
7. Third-party indexes may discover a candidate, but confirmation should retain
   the original Retail ID / COA evidence.
8. Generated evidence is append/archive material conceptually. If a public
   document changes, retain its old SHA-256 and first/last-seen dates rather
   than silently replacing history.

## Current v1 outputs

`data/forensics/retail-cards.jsonl`
: One normalized public Retail-ID card per line, including the source(s) that
  discovered the package tag.

`data/forensics/fingerprints.jsonl`
: Chemistry-only SHA-256 plus normalized chemistry and enough identity metadata
  to investigate a collision.

`data/forensics/harvest-state.json`
: Coverage and request accounting for the run.

These files are generated locally/CI; do not wire them into the daily workflow
until the offline check and a bounded live pilot have passed.

## COA v2 contract

The next stage should archive every original COA as immutable evidence outside
the normal small Git history (artifact/object storage), with an index row:

```json
{
  "sourceUrl": "...",
  "sha256": "...",
  "firstSeen": "YYYY-MM-DD",
  "lastSeen": "YYYY-MM-DD",
  "lab": "...",
  "sampleId": "...",
  "batchTag": "...",
  "lotNumber": "...",
  "sampled": "...",
  "reported": "...",
  "cannabinoids": {},
  "terpenes": {},
  "moisture": {},
  "waterActivity": {},
  "metals": {},
  "pesticides": {},
  "microbials": {},
  "parser": {"name": "...", "version": 1, "confidence": 0.0}
}
```

Lab-specific parsers are preferred over generic OCR. Existing
`scripts/coa-dates.py` already downloads COAs and uses `pdftotext`; it should
eventually call the shared COA evidence layer instead of downloading and
discarding the PDF. Do not change it until the new parser has regression
fixtures for the labs already documented there (Kaycha, Green Analytics, DRS,
Keystone, ACT, Smithers).

## Planned detector additions after acquisition is stable

- exact chemistry collision under normalized-different names;
- near chemistry collision using analyte-aware tolerances;
- same COA SHA under different package/product identities;
- Retail-ID identity mutation across snapshots;
- COA mutation: same URL, new SHA;
- impossible/implausible harvest -> test -> package -> shelf timelines;
- processor/manufacturer mismatch;
- recall/quarantine joins.

All detector outputs must preserve the underlying evidence references so a
human can reproduce the finding.


## Collision triage

After Retail-ID and COA evidence exist, run:

```sh
python scripts/forensic-collisions-check.py
python scripts/forensic-collisions.py
```

`data/forensics/collisions.json` is a review queue, **not a misconduct list**.
Exact chemistry hashes are surfaced, while near-clones require at least five
shared numeric analytes, including four terpene-like measurements, with no
shared measurement outside its tolerance. Equal THC alone is explicitly
insufficient.

High priority currently means the records expose the same batch identifier and
different commercial identity. Medium priority means chemistry matches and a
different commercial identity is visible without the same-batch confirmation.
These candidates are intended to feed the unfinished Lot Twins detector only
after human/source verification.
