#!/usr/bin/env python3
import csv
import io
import json
import re
from pathlib import Path
from urllib.parse import quote_plus

import requests

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "enrichment-output"
OUT.mkdir(parents=True, exist_ok=True)
records = json.loads((ROOT / "data/dispensaries.json").read_text())

UA = "Mozilla/5.0 (compatible; dispensary-list-geocoder/1.0; +https://github.com/Adisabeba33/dispensery-list)"
CENSUS = "https://geocoding.geo.census.gov/geocoder/locations/addressbatch"
NYC = "https://geosearch.planninglabs.nyc/v2/search"
NYC_COUNTIES = {"New York", "Kings", "Queens", "Bronx", "Richmond"}


def in_bbox(lat, lng):
    return 40.4 <= lat <= 41.4 and -74.3 <= lng <= -73.4


def street_for_geocode(r):
    # Suites/units can reduce Census match quality; line1 still remains canonical in the dataset.
    s = r["address"]["line1"]
    s = re.split(r"\b(?:suite|ste|unit|apt|apartment|floor|fl|store|shop|space)\b|#", s, flags=re.I)[0].strip(" ,")
    return s or r["address"]["line1"]


# Census batch CSV: id, street, city, state, zip.
buf = io.StringIO()
w = csv.writer(buf, lineterminator="\n")
by_id = {}
for i, r in enumerate(records, 1):
    rid = str(i)
    by_id[rid] = r
    a = r["address"]
    w.writerow([rid, street_for_geocode(r), a["city"], "NY", a["zip"]])

session = requests.Session()
resp = session.post(
    CENSUS,
    data={"benchmark": "Public_AR_Current"},
    files={"addressFile": ("addresses.csv", buf.getvalue(), "text/csv")},
    headers={"User-Agent": UA},
    timeout=90,
)
resp.raise_for_status()

results = {}
reader = csv.reader(io.StringIO(resp.text))
for row in reader:
    if len(row) < 7:
        continue
    rid = row[0]
    r = by_id.get(rid)
    if not r:
        continue
    match_status = row[2]
    match_type = row[3]
    matched_address = row[4]
    coords = row[5]
    evidence = {
        "id": r["id"],
        "licenseNumber": r["licenseNumber"],
        "input": f"{street_for_geocode(r)}, {r['address']['city']}, NY {r['address']['zip']}",
        "source": "US Census Geocoder",
        "precision": None,
        "lat": None,
        "lng": None,
        "matchStatus": match_status,
        "matchType": match_type,
        "matchedAddress": matched_address or None,
        "warning": None,
    }
    if match_status.lower() == "match" and coords:
        try:
            lng_s, lat_s = coords.split(",", 1)
            lat, lng = float(lat_s), float(lng_s)
            if in_bbox(lat, lng):
                evidence.update({"lat": lat, "lng": lng, "precision": "INTERPOLATED"})
            else:
                evidence["warning"] = f"Census geocode outside bbox: {lat},{lng}"
        except Exception as e:
            evidence["warning"] = f"Could not parse Census coordinates: {e}"
    results[r["licenseNumber"]] = evidence

# Fallback for unmatched NYC addresses. We conservatively label these INTERPOLATED;
# we do not claim ROOFTOP because GeoSearch does not explicitly make that guarantee here.
for r in records:
    lic = r["licenseNumber"]
    cur = results.get(lic)
    if cur and cur.get("lat") is not None:
        continue
    if r["address"]["county"] not in NYC_COUNTIES:
        continue
    text = f"{street_for_geocode(r)}, {r['address']['city']}, NY {r['address']['zip']}"
    try:
        rr = session.get(NYC, params={"text": text}, headers={"User-Agent": UA}, timeout=15)
        rr.raise_for_status()
        payload = rr.json()
        features = payload.get("features") or []
        if features:
            coords = features[0].get("geometry", {}).get("coordinates") or []
            if len(coords) >= 2:
                lng, lat = float(coords[0]), float(coords[1])
                if in_bbox(lat, lng):
                    props = features[0].get("properties") or {}
                    results[lic] = {
                        "id": r["id"], "licenseNumber": lic, "input": text,
                        "source": "NYC GeoSearch", "precision": "INTERPOLATED",
                        "lat": lat, "lng": lng, "matchStatus": "Match",
                        "matchType": props.get("layer") or props.get("source") or "NYC GeoSearch first result",
                        "matchedAddress": props.get("label") or props.get("name"), "warning": None,
                    }
    except Exception as e:
        if cur:
            cur["warning"] = ((cur.get("warning") + "; ") if cur.get("warning") else "") + f"NYC GeoSearch fallback failed: {type(e).__name__}: {e}"

# Ensure every record has an evidence row.
for r in records:
    if r["licenseNumber"] not in results:
        results[r["licenseNumber"]] = {
            "id": r["id"], "licenseNumber": r["licenseNumber"],
            "input": f"{street_for_geocode(r)}, {r['address']['city']}, NY {r['address']['zip']}",
            "source": None, "precision": None, "lat": None, "lng": None,
            "matchStatus": "No_Match", "matchType": None, "matchedAddress": None,
            "warning": "No usable geocode returned",
        }

ordered = [results[r["licenseNumber"]] for r in records]
filled = [x for x in ordered if x.get("lat") is not None]
source_counts = {}
for x in filled:
    source_counts[x["source"]] = source_counts.get(x["source"], 0) + 1
summary = {
    "recordCount": len(records),
    "geoFilled": len(filled),
    "geoCoverage": round(len(filled) / len(records), 4) if records else 0,
    "sourceCounts": source_counts,
    "precisionCounts": {"INTERPOLATED": sum(1 for x in filled if x.get("precision") == "INTERPOLATED")},
    "failed": len(records) - len(filled),
}
(OUT / "geocode-evidence.json").write_text(json.dumps({"summary": summary, "records": ordered}, indent=2, ensure_ascii=False) + "\n")
print(json.dumps(summary, indent=2))
