#!/usr/bin/env python3
"""Forensic harvest layer for public NY Retail ID / COA evidence.

This script deliberately does NOT modify lot-twins.py or its output.  It turns
already-discovered package tags into a durable, normalized evidence dataset
that later detectors can consume.

Sources, in priority order:
  * data/lot-twins.json cards (rich Retail ID cards already fetched)
  * data/retail-id.json packages (dates / identity)
  * data/flower-listings.json packageIds (discovery queue)
  * optional live app.1a4.com fetches for known tags (--network)

Outputs:
  data/forensics/retail-cards.jsonl
  data/forensics/fingerprints.jsonl
  data/forensics/harvest-state.json

No sequential tag guessing is done here. Discovery provenance is retained.
"""
import argparse
import hashlib
import importlib.util
import json
import re
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "data/forensics"
TAG = re.compile(r"^1A4[0-9A-F]{21}$")
LINK = re.compile(r"^https://1a4\.com/(\S+)$", re.I)
API = "https://app.1a4.com/api/landingpage/data"

ALIASES = {
    "betacaryophyllene": "beta_caryophyllene", "bcaryophyllene": "beta_caryophyllene",
    "caryophyllene": "beta_caryophyllene",
    "betamyrcene": "beta_myrcene", "myrcene": "beta_myrcene",
    "alphapinene": "alpha_pinene", "apinene": "alpha_pinene",
    "betapinene": "beta_pinene", "bpinene": "beta_pinene",
    "alphahumulene": "alpha_humulene", "humulene": "alpha_humulene",
    "deltalimonene": "limonene", "dlimonene": "limonene",
    "totalthc": "total_thc", "thc": "total_thc",
    "totalcbd": "total_cbd", "cbd": "total_cbd",
}


def load(path, default):
    try:
        return json.loads(path.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def norm_name(value):
    s = str(value or "").strip().lower()
    s = s.replace("α", "alpha").replace("β", "beta").replace("δ", "delta")
    key = re.sub(r"[^a-z0-9]+", "", s)
    if key in ALIASES:
        return ALIASES[key]
    return re.sub(r"[^a-z0-9]+", "_", s).strip("_")


def number(value):
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        m = re.search(r"-?\d+(?:\.\d+)?", value.replace(",", ""))
        return float(m.group()) if m else None
    return None


def measurement_map(raw):
    """Normalize common 1a4 measurement shapes without inventing ND/LOQ values."""
    out = {}
    if not isinstance(raw, dict):
        return out
    for key, item in raw.items():
        label, value, qualifier = key, None, None
        if isinstance(item, dict):
            label = item.get("label") or item.get("name") or key
            value = item.get("percent")
            if value is None:
                value = item.get("value")
            qualifier = item.get("qualifier") or item.get("resultText")
        else:
            value = item
        n = number(value)
        name = norm_name(label)
        if name and n is not None:
            out[name] = {"value": round(n, 6), "qualifier": qualifier}
    return dict(sorted(out.items()))


def compact(data, tag):
    coa = (data.get("coaCard") or {}).get("data") or {}
    while isinstance(coa, str):
        coa = json.loads(coa)
    if isinstance(coa, list):
        coa = coa[0] if coa else {}
    if not isinstance(coa, dict):
        coa = {}
    totals = measurement_map(coa.get("totals") or {})
    cannabinoids = measurement_map(coa.get("cannabinoids") or coa.get("cannabinoid") or {})
    terpenes = measurement_map(coa.get("terpenes") or {})
    lab = coa.get("lab") or {}
    manufacturer = coa.get("manufacturer") or {}
    product = data.get("productCard") or {}
    return {
        "tag": tag,
        "found": True,
        "facility": data.get("facilityName"),
        "facilityLicense": data.get("facilityLicense"),
        "product": product.get("productName") or coa.get("productName") or coa.get("title"),
        "strain": coa.get("strainName") or coa.get("strain") or product.get("strain"),
        "batchTag": coa.get("batchTag"),
        "sourcePackage": coa.get("sourcePackage"),
        "lotNumber": coa.get("lotNumber"),
        "category": coa.get("category"),
        "packaged": day(coa.get("packagedDate") or coa.get("packageDate")),
        "tested": day(coa.get("testedDate") or coa.get("dateTested")),
        "harvested": day(coa.get("harvestDate")),
        "lab": lab.get("name") if isinstance(lab, dict) else lab,
        "manufacturer": manufacturer.get("name") if isinstance(manufacturer, dict) else None,
        "manufacturerLicense": manufacturer.get("licenseNumber") if isinstance(manufacturer, dict) else None,
        "totals": totals,
        "cannabinoids": cannabinoids,
        "terpenes": terpenes,
    }


def day(value):
    return value[:10] if isinstance(value, str) and re.match(r"\d{4}-\d{2}-\d{2}", value) else None


def fingerprint(card):
    """Stable chemistry fingerprint. Identity fields are intentionally excluded."""
    chemistry = {}
    for family in ("totals", "cannabinoids", "terpenes"):
        vals = card.get(family) or {}
        chemistry[family] = {k: v["value"] if isinstance(v, dict) else v for k, v in sorted(vals.items())}
    payload = json.dumps(chemistry, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(payload.encode()).hexdigest(), chemistry


def discovered():
    sources = defaultdict(set)
    listings = load(ROOT / "data/flower-listings.json", [])
    rows = listings if isinstance(listings, list) else listings.get("listings", [])
    retail = load(ROOT / "data/retail-id.json", {})
    links = {str(k).upper(): v for k, v in retail.get("links", {}).items()}
    for row in rows:
        for raw in row.get("packageIds") or []:
            text = str(raw).strip()
            tag = text.upper()
            if TAG.match(tag):
                sources[tag].add("flower-listings")
            elif LINK.match(text):
                resolved = links.get(text.upper())
                if resolved and TAG.match(resolved.upper()):
                    sources[resolved.upper()].add("flower-listings:retail-link")
    for tag in retail.get("packages", {}):
        if TAG.match(tag.upper()):
            sources[tag.upper()].add("retail-id-cache")
    twins = load(ROOT / "data/lot-twins.json", {})
    for tag in (twins.get("cards") or {}):
        if TAG.match(tag.upper()):
            sources[tag.upper()].add("lot-twins-cache")
    return sources


def cached_cards():
    out = {}
    twins = load(ROOT / "data/lot-twins.json", {})
    for tag, card in (twins.get("cards") or {}).items():
        if card.get("found"):
            c = dict(card)
            c["tag"] = tag.upper()
            # Old cache has exact terpenes but not normalized measurement objects.
            c["terpenes"] = {norm_name(k): {"value": float(v), "qualifier": None}
                             for k, v in (c.get("terpenes") or {}).items() if number(v) is not None}
            totals = {}
            if number(c.get("thc")) is not None:
                totals["total_thc"] = {"value": float(c["thc"]), "qualifier": None}
            if number(c.get("cbd")) is not None:
                totals["total_cbd"] = {"value": float(c["cbd"]), "qualifier": None}
            c["totals"] = totals
            c.setdefault("cannabinoids", {})
            out[tag.upper()] = c
    retail = load(ROOT / "data/retail-id.json", {})
    for tag, card in retail.get("packages", {}).items():
        if card.get("found") and tag.upper() not in out:
            c = dict(card)
            c["tag"] = tag.upper()
            c.setdefault("totals", {})
            c.setdefault("cannabinoids", {})
            c.setdefault("terpenes", {})
            out[tag.upper()] = c
    return out


def fetch_live(tag):
    spec = importlib.util.spec_from_file_location("retail_id", ROOT / "scripts/retail-id.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    body, code = mod.curl(f"{API}?id={tag.lower()}&index=0")
    if code == "404":
        return {"tag": tag, "found": False}
    if code != "200":
        return {"tag": tag, "found": None, "error": f"HTTP {code}"}
    try:
        return compact(json.loads(body), tag)
    except Exception as exc:
        return {"tag": tag, "found": None, "error": f"{type(exc).__name__}: {str(exc)[:100]}"}


def write_jsonl(path, rows):
    path.write_text("".join(json.dumps(r, ensure_ascii=False, sort_keys=True) + "\n" for r in rows))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--network", action="store_true", help="fetch known uncached tags from public Retail ID")
    ap.add_argument("--budget", type=int, default=100, help="maximum live requests; no tag guessing")
    args = ap.parse_args()
    OUTDIR.mkdir(parents=True, exist_ok=True)

    sources = discovered()
    cards = cached_cards()
    requested = found = missing = errors = 0
    if args.network:
        for tag in sorted(sources):
            if tag in cards or requested >= max(0, args.budget):
                continue
            requested += 1
            card = fetch_live(tag)
            if card.get("found") is True:
                cards[tag] = card
                found += 1
            elif card.get("found") is False:
                missing += 1
            else:
                errors += 1

    evidence, fps = [], []
    for tag in sorted(cards):
        card = cards[tag]
        row = {**card, "discoveredFrom": sorted(sources.get(tag, []))}
        fp, chemistry = fingerprint(row)
        if any(chemistry.values()):
            row["fingerprint"] = fp
        evidence.append(row)
        if any(chemistry.values()):
            fps.append({
                "tag": tag, "fingerprint": fp, "chemistry": chemistry,
                "lab": row.get("lab"), "tested": row.get("tested"),
                "batchTag": row.get("batchTag"), "product": row.get("product"),
                "strain": row.get("strain"), "facility": row.get("facility"),
            })

    write_jsonl(OUTDIR / "retail-cards.jsonl", evidence)
    write_jsonl(OUTDIR / "fingerprints.jsonl", fps)
    state = {
        "day": date.today().isoformat(), "knownTags": len(sources), "cards": len(evidence),
        "fingerprints": len(fps), "network": {
            "enabled": args.network, "budget": args.budget, "requested": requested,
            "found": found, "notFound": missing, "errors": errors,
        },
        "about": "Forensic evidence layer. Known tags only; discovery provenance retained; no sequential tag guessing.",
    }
    (OUTDIR / "harvest-state.json").write_text(json.dumps(state, ensure_ascii=False, indent=1) + "\n")
    print(f"forensics: {len(sources)} known tags, {len(evidence)} cards, {len(fps)} fingerprints; "
          f"network {requested} requests/{found} found/{missing} 404/{errors} errors")


if __name__ == "__main__":
    main()
