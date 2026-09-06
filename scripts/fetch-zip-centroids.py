#!/usr/bin/env python3
"""Writes data/zip-centroids.json: a point for every ZIP in scope.

Nearby search is for the reader who is standing somewhere with no dispensary —
that is the whole question. Deriving ZIP centres from the shops we hold answers
it only where a shop already is, which covers 160 of roughly 270 ZIPs in the
five boroughs and Westchester and misses precisely the ones that matter.

So the centres come from the US Census Gazetteer's ZCTA file, which is a work
of the federal government and in the public domain. Only the ZIPs in scope are
kept; the national file is thirty thousand rows and none of the rest is ours to
carry.

    python scripts/fetch-zip-centroids.py
"""
import io
import json
import sys
import zipfile
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "zip-centroids.json"

# Tried newest first: the Census publishes a new vintage each year and retires
# nothing, so an older one is a correct answer rather than a failure.
YEARS = [2024, 2023, 2022]
URL = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/{y}_Gazetteer/{y}_Gaz_zcta_national.zip"
UA = "dispensary-list/1.0 (+https://github.com/Adisabeba33/dispensery-list)"


def in_scope(zip_code: str) -> bool:
    """The same rule compile-research.py filters licences with."""
    if not zip_code or not zip_code.isdigit() or len(zip_code) != 5:
        return False
    prefix = int(zip_code[:3])
    # Westchester 105-108; New York City 100-104 and 110-119.
    return 105 <= prefix <= 108 or 100 <= prefix <= 104 or 110 <= prefix <= 119


def fetch():
    for year in YEARS:
        url = URL.format(y=year)
        try:
            response = requests.get(url, headers={"User-Agent": UA}, timeout=120)
        except requests.RequestException as exc:
            print(f"{year}: {exc}")
            continue
        if response.status_code != 200:
            print(f"{year}: HTTP {response.status_code}")
            continue
        return year, response.content
    return None, None


year, payload = fetch()
if payload is None:
    sys.exit("No Census gazetteer vintage could be fetched; nothing written.")

archive = zipfile.ZipFile(io.BytesIO(payload))
name = next(n for n in archive.namelist() if n.lower().endswith(".txt"))
text = archive.read(name).decode("utf-8-sig", errors="replace")

lines = text.splitlines()
header = [h.strip() for h in lines[0].split("\t")]
try:
    i_zip = header.index("GEOID")
    i_lat = header.index("INTPTLAT")
    i_lng = header.index("INTPTLONG")
except ValueError:
    sys.exit(f"Unexpected gazetteer columns: {header}")

centroids = {}
for line in lines[1:]:
    parts = line.split("\t")
    if len(parts) <= max(i_zip, i_lat, i_lng):
        continue
    zip_code = parts[i_zip].strip()
    if not in_scope(zip_code):
        continue
    try:
        centroids[zip_code] = [round(float(parts[i_lat]), 5), round(float(parts[i_lng]), 5)]
    except ValueError:
        continue

if len(centroids) < 200:
    sys.exit(f"Only {len(centroids)} ZIPs in scope — that is too few to be right. Nothing written.")

OUT.write_text(
    json.dumps(
        {
            "source": URL.format(y=year),
            "sourceLabel": f"US Census Bureau {year} Gazetteer, ZIP Code Tabulation Areas",
            "licence": "Public domain (work of the United States federal government)",
            "centroids": dict(sorted(centroids.items())),
        },
        indent=2,
    )
    + "\n"
)
print(f"Wrote {len(centroids)} ZIP centroids from the {year} gazetteer.")
