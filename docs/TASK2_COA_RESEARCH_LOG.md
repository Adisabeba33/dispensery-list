# Task 2 — COA research log

Working branch: `agent/menu-endpoints-nyc`

This file is a running evidence log for `docs/AGENT_MENU_ENDPOINTS_BRIEF.md` Task 2. It is not a substitute for `data/strain-reference.json`; only direct COA-backed results should graduate into that file.

## Current rule

- Prefer a direct laboratory/brand-hosted COA PDF.
- A product page that names prominent terpenes is discovery evidence only, not enough for numeric strain-reference data.
- Do not coerce ND / <LOQ / <MRL values to zero.
- One COA remains LOW confidence. Multiple independent batches are aggregated by median of quantified detections only.
- Do not overwrite newer branch work without refetching the current blob SHA first.

## Verified direct COA archive discovered

ElectraLeaf publishes a human-facing flower lab-test index with direct PDF links:

- `https://electraleaf.com/3-5-flower-and-5-pack-joints-lab-test/`

The index exposes direct flower COAs including, among many others:

- Bubble Bath — `https://electraleaf.com/wp-content/uploads/2025/09/Bubble-Bath-3.5-NY-081125-05.pdf`
- Pineapple Punch — `https://electraleaf.com/wp-content/uploads/2025/09/Pineapple-Punch-3.5-NY-801125-03.pdf`
- Alien OG — `https://electraleaf.com/wp-content/uploads/2025/09/Alien-OG-3.5-NY-081125-04.pdf`
- Blue Dream — `https://electraleaf.com/wp-content/uploads/2025/08/Blue-Dream-3.5-NY-051925-12.pdf`
- Blue Lobster — `https://electraleaf.com/wp-content/uploads/2025/07/Blue-Lobster-3.5-NY-051925-20.pdf`
- White Runtz — `https://electraleaf.com/wp-content/uploads/2025/07/White-Runtz-3.5-NY-051925-22.pdf`
- Permanent Marker — `https://electraleaf.com/wp-content/uploads/2025/07/Permanent-Marker-3.5-NY-051925-10.pdf`
- Cereal Milk — `https://electraleaf.com/wp-content/uploads/2025/07/20250701-ELEC-005-Cereal-Milk-3.5.pdf`
- Gelonade — `https://electraleaf.com/wp-content/uploads/2025/07/20250701-ELEC-001-Gelonade-3.5.pdf`
- Purple Haze — `https://electraleaf.com/wp-content/uploads/2025/06/Purple-Haze-3.5-NY-051925-01.pdf`
- Super Lemon Diesel — `https://electraleaf.com/wp-content/uploads/2025/06/Super-Lemon-Diesel-3.5-NY-051925-04.pdf`
- Gelato 33 — `https://electraleaf.com/wp-content/uploads/2025/04/Gelato-33-NY-030325-16.pdf`
- Gary Payton — `https://electraleaf.com/wp-content/uploads/2025/05/Gary-Payton-3.5-NY-030325-19.pdf`
- Lemon Cherry Gelato — `https://electraleaf.com/wp-content/uploads/2025/04/Lemon-Cherry-Gelato-3.5-NY-030325-04.pdf`
- Godzilla Glue — `https://electraleaf.com/wp-content/uploads/2025/04/Godzilla-Glue-3.5-NY-030325-09.pdf`
- Wedding Cake — direct current batch file `https://electraleaf.com/wp-content/uploads/2025/06/AL50614001-013-Original.pdf`

## Wedding Cake second-batch verification

Direct Kaycha Labs COA `AL50614001-013`, batch / harvest lot `NY-051925-05`, sampled 2025-06-13, flower-cured, 3.5 g, Lifted NY Corp.

Quantified terpene panel from the certificate:

| terpene | % |
|---|---:|
| LIMONENE | 0.36 |
| BETA-CARYOPHYLLENE | 0.30 |
| LINALOOL | 0.28 |
| BETA-MYRCENE | 0.23 |
| ALPHA-HUMULENE | 0.09 |
| BETA-PINENE | 0.06 |
| ALPHA-TERPINEOL | 0.05 |
| FENCHYL ALCOHOL | 0.04 |
| ALPHA-BISABOLOL | 0.03 |
| ALPHA-PINENE | 0.03 |
| OCIMENE | 0.02 |
| VALENCENE | 0.02 |
| CAMPHENE | 0.01 |
| CARYOPHYLLENE OXIDE | 0.01 |

The COA reports total terpenes 1.53%. Farnesene is `<0.1000`; terpinolene, geraniol, guaiol and others shown below LOQ are not treated as zero.

This gives Wedding Cake a second direct ElectraLeaf/Lifted NY COA and should upgrade its `sampleCount` from 1 to 2 after recomputing medians.

## Current branch coordination note

The branch changed while this research was running (a newer `Muffin Grease` reference appeared). Before modifying `data/strain-reference.json`, refetch the current file SHA and preserve all newer entries. This log exists specifically to avoid losing concurrent work while the COA evidence continues to accumulate.
