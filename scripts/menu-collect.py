#!/usr/bin/env python3
"""Reads flower off real dispensary shelves.

The probe runs established the route: these storefronts server-render their
menu into __NEXT_DATA__, and pageProps.products is a dict whose `data` key
holds the product array. No browser is needed.

Field names inside a product are not hard-coded. As with the registry adapter
in phase 1, each logical field lists candidates, they are resolved against the
payload actually received, and an unresolved one prints the real key list
rather than silently producing nulls.

Access discipline is the same as the probe: robots.txt obeyed per host, one
request at a time per host with a pause, a User-Agent naming the project, and
no logins, age-gate bypasses or captcha handling.

Usage: python scripts/menu-collect.py [--limit N] [--dry-run]
"""
import argparse
import json
import re
import time
import urllib.robotparser
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
UA = ("Mozilla/5.0 (compatible; dispensary-list-menu/1.0; "
      "+https://github.com/Adisabeba33/dispensery-list)")
TIMEOUT = 15
PER_HOST_PAUSE = 1.0
NOW = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

parser = argparse.ArgumentParser()
parser.add_argument("--limit", type=int, default=120)
parser.add_argument("--dry-run", action="store_true")
args = parser.parse_args()

records = json.loads((ROOT / "data/dispensaries.json").read_text())
by_licence = {r["licenseNumber"]: r for r in records}

# Shops whose menu sits on a third party (Leafly, Weedmaps) are excluded: that
# is someone else's site under someone else's terms, not the shop's own menu.
OWN_SITE_PROVIDERS = {"DUTCHIE", "BLAZE", "TREEZ", "IHEARTJANE", "MEADOW", "PROPRIETARY", "OTHER"}

targets = [
    r for r in records
    if r.get("operationalStatus") == "OPEN"
    and (r.get("menu") or {}).get("provider") in OWN_SITE_PROVIDERS
    and (r.get("contact") or {}).get("website")
][: args.limit]

FLOWER_URL = re.compile(r"(flower|/bud\b|category=flower|categories/flower)", re.I)
MENU_WORDS = re.compile(r"\b(menu|shop|order|browse|products?)\b", re.I)

# Product field candidates, most likely first.
FIELDS = {
    "name": ["name", "productName", "title", "displayName"],
    "brand": ["brandName", "brand", "producer", "vendor", "cultivator"],
    "category": ["category", "productCategory", "type", "kind", "categoryName"],
    "subcategory": ["subcategory", "subCategory", "productSubcategory"],
    "lineage": ["strainType", "lineage", "cannabisType", "classification", "strain_type"],
    "thc": ["thcContent", "potencyThc", "thc", "thcPercent", "THC"],
    "cbd": ["cbdContent", "potencyCbd", "cbd", "cbdPercent", "CBD"],
    "terpenes": ["terpenes", "terpeneProfile", "terps"],
    "variants": ["variants", "prices", "weights", "options", "sizes", "priceOptions"],
    "inStock": ["inStock", "available", "isAvailable", "inventory", "stock"],
    "productId": ["id", "_id", "productId", "slug"],
    "url": ["url", "productUrl", "permalink"],
}

TERPENE_MAP = {
    "myrcene": "MYRCENE", "limonene": "LIMONENE", "caryophyllene": "CARYOPHYLLENE",
    "bcaryophyllene": "CARYOPHYLLENE", "betacaryophyllene": "CARYOPHYLLENE",
    "alphapinene": "PINENE_ALPHA", "apinene": "PINENE_ALPHA", "pinene": "PINENE_ALPHA",
    "betapinene": "PINENE_BETA", "bpinene": "PINENE_BETA",
    "linalool": "LINALOOL", "terpinolene": "TERPINOLENE", "humulene": "HUMULENE",
    "ocimene": "OCIMENE", "bisabolol": "BISABOLOL", "alphabisabolol": "BISABOLOL",
    "nerolidol": "NEROLIDOL", "valencene": "VALENCENE", "camphene": "CAMPHENE",
    "eucalyptol": "EUCALYPTOL", "guaiol": "GUAIOL", "farnesene": "FARNESENE",
    "geraniol": "GERANIOL", "borneol": "BORNEOL", "terpineol": "TERPINEOL",
    "phellandrene": "PHELLANDRENE", "carene": "CARENE", "sabinene": "SABINENE",
    "fenchol": "FENCHOL",
}

LINEAGE_MAP = {
    "indica": "INDICA", "sativa": "SATIVA", "hybrid": "HYBRID",
    "indicadominant": "INDICA_DOMINANT", "indicahybrid": "INDICA_DOMINANT",
    "sativadominant": "SATIVA_DOMINANT", "sativahybrid": "SATIVA_DOMINANT",
    "cbd": "CBD", "highcbd": "CBD",
}

robots_cache: dict = {}
unresolved_keys = Counter()
raw_terpene_names = Counter()


def host_of(url):
    return urlparse(url).netloc.lower()


def robots_allows(url):
    host = host_of(url)
    if host not in robots_cache:
        rp = urllib.robotparser.RobotFileParser()
        rp.set_url(f"{urlparse(url).scheme}://{host}/robots.txt")
        try:
            rp.read()
            robots_cache[host] = rp
        except Exception:
            robots_cache[host] = None
    rp = robots_cache[host]
    if rp is None:
        return True
    try:
        return bool(rp.can_fetch(UA, url))
    except Exception:
        return True


def fetch(session, url):
    try:
        r = session.get(url, timeout=TIMEOUT, allow_redirects=True,
                        headers={"User-Agent": UA, "Accept": "text/html,*/*"})
        return {"ok": 200 <= r.status_code < 400, "status": r.status_code,
                "url": r.url, "text": r.text[:3_000_000]}
    except Exception as e:
        return {"ok": False, "status": None, "url": url, "text": "", "error": str(e)}


def pick(obj, field):
    """Resolves a logical field against whatever the payload actually calls it."""
    for candidate in FIELDS[field]:
        if candidate in obj:
            return obj[candidate]
    return None


def flatten(value):
    """Products carry values plainly, as {value, unit} or as a nested name."""
    if isinstance(value, dict):
        for key in ("value", "name", "amount", "percent", "label", "title"):
            if key in value:
                return value[key]
        return None
    return value


def as_number(value):
    value = flatten(value)
    if isinstance(value, (int, float)):
        return round(float(value), 2)
    if isinstance(value, str):
        m = re.search(r"(\d+(?:\.\d+)?)", value)
        if m:
            return round(float(m.group(1)), 2)
    return None


def normalise_terpene(raw):
    key = re.sub(r"[^a-z]", "", str(raw).lower())
    return TERPENE_MAP.get(key)


def extract_products(html):
    """Returns the product array from __NEXT_DATA__, whatever wraps it."""
    soup = BeautifulSoup(html, "html.parser")
    tag = soup.find("script", id="__NEXT_DATA__")
    if not (tag and tag.string):
        return []
    try:
        props = (json.loads(tag.string).get("props") or {}).get("pageProps") or {}
    except Exception:
        return []

    for key in ("products", "menuItems", "items", "productList"):
        value = props.get(key)
        # The probes showed this is a dict keyed `data`, sometimes JSON:API shaped.
        if isinstance(value, dict):
            for inner in ("data", "products", "items", "edges", "results"):
                if isinstance(value.get(inner), list):
                    value = value[inner]
                    break
        if isinstance(value, list) and value:
            out = []
            for item in value:
                if isinstance(item, dict):
                    # JSON:API puts the fields under `attributes`.
                    if isinstance(item.get("attributes"), dict):
                        item = {**item, **item["attributes"]}
                    if isinstance(item.get("node"), dict):
                        item = item["node"]
                    out.append(item)
            return out
    return []


def is_flower(product):
    """Whole bud only. Pre-rolls are made of flower but are a different product."""
    parts = [str(flatten(pick(product, "category")) or ""),
             str(flatten(pick(product, "subcategory")) or "")]
    text = " ".join(parts).lower()
    if not text.strip():
        return False
    if re.search(r"pre[\s-]?roll|infused|blunt|joint", text):
        return False
    return bool(re.search(r"flower|bud", text))


def slug(*parts):
    joined = " ".join(p for p in parts if p).lower()
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", joined)).strip("-")[:80]


def build_listing(product, shop, source_url):
    name = flatten(pick(product, "name"))
    if not name:
        return None

    brand = flatten(pick(product, "brand"))
    lineage_raw = flatten(pick(product, "lineage"))
    lineage = LINEAGE_MAP.get(re.sub(r"[^a-z]", "", str(lineage_raw or "").lower()), "UNKNOWN")

    profile = []
    terps = pick(product, "terpenes")
    if isinstance(terps, list):
        for t in terps:
            raw = flatten(t) if not isinstance(t, dict) else (t.get("name") or t.get("terpene"))
            mapped = normalise_terpene(raw)
            if raw:
                raw_terpene_names[str(raw)[:40]] += 1
            profile.append({
                "name": mapped or "OTHER",
                "rawName": None if mapped else str(raw)[:60],
                "percent": as_number(t.get("value") if isinstance(t, dict) else None),
            })

    # Terpenes stated on a menu without a certificate are exactly that.
    source = "MENU_LISTING" if profile else "NONE"

    sizes = []
    variants = pick(product, "variants")
    if isinstance(variants, list):
        for v in variants:
            grams = as_number(v.get("gramAmount") if isinstance(v, dict) else v) or \
                    as_number(v.get("weight") if isinstance(v, dict) else None)
            if grams and 0 < grams <= 30:
                sizes.append(grams)

    stock = flatten(pick(product, "inStock"))
    in_stock = True if stock is None else bool(stock) if not isinstance(stock, (int, float)) else stock > 0

    return {
        "listingId": slug(str(brand or ""), str(name)),
        "licenseNumber": shop["licenseNumber"],
        "capturedAt": NOW,
        "strainNameRaw": str(name)[:200],
        "strainNameCanonical": re.sub(r"\s+", " ", str(name).lower().replace("#", "")).strip() or None,
        "brand": str(brand)[:120] if brand else None,
        "lineage": lineage,
        "thcPercent": as_number(pick(product, "thc")),
        "cbdPercent": as_number(pick(product, "cbd")),
        "totalCannabinoidsPercent": None,
        "terpenes": {
            "source": source,
            "profile": profile,
            "totalPercent": None,
            "labName": None,
            "testedOn": None,
            "coaUrl": None,
            "referenceStrain": None,
        },
        "harvestedOn": None,
        "packagedOn": None,
        "inStock": in_stock,
        "availableSizesGrams": sorted(set(sizes)) or None,
        "productUrl": None,
        "sources": [{"url": source_url, "label": "Shop menu", "type": "MENU_PLATFORM", "retrievedAt": NOW}],
        "warnings": [],
    }


def collect(shop):
    site = shop["contact"]["website"]
    out = {"licenseNumber": shop["licenseNumber"], "listings": [], "status": None, "productsSeen": 0}

    if not robots_allows(site):
        out["status"] = "robots-disallowed"
        return out

    session = requests.Session()
    home = fetch(session, site)
    if not home["ok"]:
        out["status"] = f"unreachable ({home.get('status') or home.get('error')})"
        return out

    pages = [home]
    soup = BeautifulSoup(home["text"], "html.parser")
    candidates = []
    for a in soup.find_all("a", href=True):
        url = urljoin(home["url"], a["href"])
        if not url.startswith("http") or host_of(url) != host_of(home["url"]):
            continue
        label = " ".join(a.stripped_strings)[:120]
        if FLOWER_URL.search(url) or FLOWER_URL.search(label):
            candidates.insert(0, url)
        elif MENU_WORDS.search(url) or MENU_WORDS.search(label):
            candidates.append(url)

    for url in list(dict.fromkeys(candidates))[:3]:
        if not robots_allows(url):
            continue
        time.sleep(PER_HOST_PAUSE)
        page = fetch(session, url)
        if page["ok"]:
            pages.append(page)

    seen_ids = set()
    for page in pages:
        products = extract_products(page["text"])
        out["productsSeen"] += len(products)
        if products and not any(FIELDS["name"][0] in p or "name" in p for p in products[:3]):
            unresolved_keys.update(sorted(products[0].keys())[:30])
        for product in products:
            if not is_flower(product):
                continue
            listing = build_listing(product, shop, page["url"])
            if listing and listing["listingId"] and listing["listingId"] not in seen_ids:
                seen_ids.add(listing["listingId"])
                out["listings"].append(listing)

    out["status"] = "ok" if out["listings"] else ("no-flower-found" if out["productsSeen"] else "no-products-in-html")
    return out


results = []
with ThreadPoolExecutor(max_workers=6) as ex:
    futures = {ex.submit(collect, s): s for s in targets}
    for n, fut in enumerate(as_completed(futures), 1):
        shop = futures[fut]
        try:
            results.append(fut.result())
        except Exception as e:
            results.append({"licenseNumber": shop["licenseNumber"], "listings": [],
                            "status": f"exception: {type(e).__name__}: {e}", "productsSeen": 0})
        if n % 20 == 0:
            print(f"collected {n}/{len(targets)}")

listings = [l for r in results for l in r["listings"]]
listings.sort(key=lambda x: (x["licenseNumber"], x["strainNameRaw"]))

summary = {
    "shopsTargeted": len(targets),
    "shopsWithFlower": sum(1 for r in results if r["listings"]),
    "listings": len(listings),
    "statusCounts": dict(Counter(r["status"] for r in results).most_common()),
    "productsSeenTotal": sum(r["productsSeen"] for r in results),
    "withTerpenes": sum(1 for l in listings if l["terpenes"]["source"] != "NONE"),
    "withThc": sum(1 for l in listings if l["thcPercent"] is not None),
    "withSizes": sum(1 for l in listings if l["availableSizesGrams"]),
    "unmappedTerpeneNames": dict(raw_terpene_names.most_common(15)),
}
# When nothing parsed, the real key names are the finding worth reporting.
if unresolved_keys:
    summary["unrecognisedProductKeys"] = dict(unresolved_keys.most_common(30))

print(json.dumps(summary, indent=2))

if not args.dry_run:
    (ROOT / "data/flower-listings.json").write_text(
        json.dumps(listings, indent=2, ensure_ascii=False) + "\n"
    )
    print(f"\nWrote {len(listings)} listings")
