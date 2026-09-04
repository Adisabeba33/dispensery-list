# Data sources

Ranked by authority. Anything lower may enrich a record but may never establish
that a business is licensed.

## Primary — the state registry

**Current OCM Licenses**, New York State Office of Cannabis Management, on Open
Data NY. Resource id `jskf-tt3q`.

| | |
|---|---|
| Dataset page | https://data.ny.gov/Economic-Development/Current-OCM-Licenses/jskf-tt3q |
| SODA JSON | `https://data.ny.gov/resource/jskf-tt3q.json` |
| CSV | `https://data.ny.gov/resource/jskf-tt3q.csv` |
| Full export | `https://data.ny.gov/api/views/jskf-tt3q/rows.csv?accessType=DOWNLOAD` |
| Catalog mirror | https://catalog.data.gov/dataset/current-ocm-licenses |

Known fields include licence number, entity name, DBA, licence type, licence
status, issued / effective / expiration dates, application number, SEE category,
address, city, county, ZIP, region, business website, operational status and
hours of operation. **The exact snake_case column names have not been verified
from inside this repo** — the ingest adapter resolves them at runtime and prints
the real list when a required field is missing.

Caveat that matters: the dataset contains *licensees* **and** *applicants who
have obtained proximity protection*. Applicants are not licensed and must be
filtered out.

Rate limits apply without an app token. Register one at data.ny.gov and pass it
as `NY_APP_TOKEN`; the adapter sends it as `X-App-Token`.

## Secondary lead, unverified

`https://data.ny.gov/api/views/gttd-5u6y/rows.csv` surfaced while researching
and may be a related OCM dataset. Not yet inspected — check before relying on it.

There is also a **NYS Registered Retail Dealers of Adult-use Cannabis Products**
dataset on catalog.data.gov, which covers a different registration than retail
dispensary licensing. Do not conflate the two.

## Verification that a shop is real and trading

- OCM dispensary location verification: https://cannabis.ny.gov/dispensary-location-verification
- OCM licensing overview: https://cannabis.ny.gov/licensing

Licensed dispensaries must display a QR-coded verification decal near the main
entrance. Licence numbers follow the shape `OCM-CAURD-YY-NNNNNN` for conditional
adult-use retail, and other prefixes for later licence classes.

## Municipal opt-out status

- OCM localities: https://cannabis.ny.gov/localities
- OCM local government: https://cannabis.ny.gov/local-government
- OCM release of filed opt-out data: https://cannabis.ny.gov/news/new-york-state-office-cannabis-management-releases-filed-local-opt-out-data
- Rockefeller Institute opt-out tracker: https://rockinst.org/issue-areas/state-local-government/municipal-opt-out-tracker/

Municipalities had until 31 December 2021 to opt out of retail dispensaries
and/or on-site consumption. A municipality that did not opt out by then can no
longer do so.

## Enrichment only

Operator websites, and menu platforms (Dutchie, I Heart Jane, Meadow, Blaze,
Treez). Google Maps for hours and phone, flagged in `verification.notes`.

## Never used to establish licensing

Weedmaps, Leafly, and consumer aggregators such as bestdispensaries or
nyscannabisguide. They list unlicensed businesses alongside licensed ones, which
is the exact confusion this register exists to remove. They may only be used for
soft detail after the licence is already confirmed.
