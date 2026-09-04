#!/usr/bin/env python3
"""Discovery pass over real dispensary menus.

Phase 1 began by dumping the registry's actual columns instead of assuming
them. Menus deserve the same treatment: platforms change their delivery
constantly, and a parser written against a guess produces confident nonsense.
So this pass fetches, records what each site actually exposes, and reports it.
It writes no listings.

It also decides where it is allowed to look:
  - robots.txt is fetched per host and obeyed;
  - one request at a time per host, with a pause between;
  - a real User-Agent naming the project and pointing at the repository;
  - no logins, no captcha or age-gate bypass, no paid or private endpoints.

A host that disallows us is recorded as such and skipped. That is a finding,
not a failure to route around.

Usage: python scripts/menu-probe.py [--limit N]
"""
import argparse
import json
import re
import time
import urllib.robotparser
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "enrichment-output"
OUT.mkdir(parents=True, exist_ok=True)

UA = (
    "Mozilla/5.0 (compatible; dispensary-list-menu-probe/1.0; "
    "+https://github.com/Adisabeba33/dispensery-list)"
)
TIMEOUT = 15
PER_HOST_PAUSE = 1.0

parser = argparse.ArgumentParser()
parser.add_argument("--limit", type=int, default=60, help="how many shops to probe")
args = parser.parse_args()

records = json.loads((ROOT / "data/dispensaries.json").read_text())

# Only shops that are open, publish a menu we identified, and have a website.
targets = [
    r for r in records
    if r.get("operationalStatus") == "OPEN"
    and (r.get("menu") or {}).get("provider")
    and (r.get("contact") or {}).get("website")
]

# Spread the sample across platforms so the report describes every one we face,
# rather than sixty Dutchie shops and nothing else.
by_provider = {}
for r in targets:
    by_provider.setdefault(r["menu"]["provider"], []).append(r)
sample, i = [], 0
while len(sample) < min(args.limit, len(targets)):
    added = False
    for provider in sorted(by_provider):
        bucket = by_provider[provider]
        if i < len(bucket) and len(sample) < args.limit:
            sample.append(bucket[i])
            added = True
    if not added:
        break
    i += 1

MENU_WORDS = re.compile(r"\b(menu|shop|order|browse|products?)\b", re.I)
FLOWER_WORDS = re.compile(r"\b(flower|bud|eighth|1/8|3\.5\s?g|quarter|ounce)\b", re.I)

robots_cache: dict[str, urllib.robotparser.RobotFileParser | None] = {}


def host_of(url: str) -> str:
    return urlparse(url).netloc.lower()


def robots_allows(url: str) -> tuple[bool, str]:
    """True when robots.txt permits us. A missing robots.txt permits by default."""
    host = host_of(url)
    if host not in robots_cache:
        rp = urllib.robotparser.RobotFileParser()
        rp.set_url(f"{urlparse(url).scheme}://{host}/robots.txt")
        try:
            rp.read()
            robots_cache[host] = rp
        except Exception:
            robots_cache[host] = None  # unreadable: treat as no restriction stated
    rp = robots_cache[host]
    if rp is None:
        return True, "robots.txt unreadable"
    try:
        return bool(rp.can_fetch(UA, url)), "robots.txt consulted"
    except Exception:
        return True, "robots.txt unparseable"


def fetch(session, url):
    try:
        r = session.get(url, timeout=TIMEOUT, allow_redirects=True,
                        headers={"User-Agent": UA, "Accept": "text/html,application/xhtml+xml,*/*"})
        return {"ok": 200 <= r.status_code < 400, "status": r.status_code,
                "url": r.url, "text": r.text[:1_500_000], "error": None}
    except Exception as e:
        return {"ok": False, "status": None, "url": url, "text": "", "error": f"{type(e).__name__}: {e}"}


def describe_json_blobs(html: str) -> list[dict]:
    """Names the machine-readable structures a page carries, with a shape sample.

    What we need is not the values yet but the shape: which container holds the
    products, and what a product object is called.
    """
    found = []
    soup = BeautifulSoup(html, "html.parser")

    for tag in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(tag.string or "")
        except Exception:
            continue
        items = data if isinstance(data, list) else [data]
        for item in items:
            if isinstance(item, dict):
                found.append({
                    "kind": "json-ld",
                    "type": item.get("@type"),
                    "keys": sorted(item.keys())[:25],
                })

    next_data = soup.find("script", id="__NEXT_DATA__")
    if next_data and next_data.string:
        try:
            data = json.loads(next_data.string)
            props = (data.get("props") or {}).get("pageProps") or {}
            found.append({"kind": "__NEXT_DATA__", "pagePropsKeys": sorted(props.keys())[:30]})
        except Exception:
            found.append({"kind": "__NEXT_DATA__", "pagePropsKeys": None, "note": "unparseable"})

    # Platform fingerprints: the id we would need to ask the platform directly.
    for pattern, label in [
        (r"embedded-menu/([0-9a-f]{16,32})", "dutchie_embed_id"),
        (r"dutchie\.com/embedded-menu/([0-9a-z-]{6,})", "dutchie_slug"),
        (r"iheartjane\.com/embed/stores/(\d+)", "jane_store_id"),
        (r"window\.__APOLLO_STATE__", "apollo_state"),
        (r"window\.__INITIAL_STATE__", "initial_state"),
    ]:
        m = re.search(pattern, html, re.I)
        if m:
            found.append({"kind": label, "value": m.group(1) if m.groups() else True})

    return found


def probe(record):
    site = record["contact"]["website"]
    provider = record["menu"]["provider"]
    result = {
        "licenseNumber": record["licenseNumber"],
        "name": record.get("dbaName") or record["legalName"],
        "provider": provider,
        "website": site,
        "robotsAllowed": None,
        "robotsNote": None,
        "pages": [],
        "structures": [],
        "flowerWordsSeen": False,
        "error": None,
    }

    allowed, note = robots_allows(site)
    result["robotsAllowed"], result["robotsNote"] = allowed, note
    if not allowed:
        result["error"] = "robots.txt disallows this path — not fetched"
        return result

    session = requests.Session()
    home = fetch(session, site)
    result["pages"].append({k: home[k] for k in ["url", "status", "ok", "error"]})
    if not home["ok"]:
        result["error"] = home["error"] or f"HTTP {home['status']}"
        return result

    result["structures"] += describe_json_blobs(home["text"])
    result["flowerWordsSeen"] = bool(FLOWER_WORDS.search(home["text"]))

    # Follow at most two same-site links that look like a menu.
    soup = BeautifulSoup(home["text"], "html.parser")
    candidates = []
    for a in soup.find_all("a", href=True):
        label = " ".join(a.stripped_strings)[:120]
        url = urljoin(home["url"], a["href"])
        if not url.startswith("http"):
            continue
        if host_of(url) != host_of(home["url"]):
            continue
        if MENU_WORDS.search(label) or MENU_WORDS.search(url):
            candidates.append(url)

    for url in list(dict.fromkeys(candidates))[:2]:
        ok, _ = robots_allows(url)
        if not ok:
            result["pages"].append({"url": url, "status": None, "ok": False, "error": "robots.txt disallows"})
            continue
        time.sleep(PER_HOST_PAUSE)
        page = fetch(session, url)
        result["pages"].append({k: page[k] for k in ["url", "status", "ok", "error"]})
        if page["ok"]:
            result["structures"] += describe_json_blobs(page["text"])
            result["flowerWordsSeen"] = result["flowerWordsSeen"] or bool(FLOWER_WORDS.search(page["text"]))

    return result


results = []
# Modest concurrency: these are small businesses' sites, not a CDN.
with ThreadPoolExecutor(max_workers=6) as ex:
    futures = {ex.submit(probe, r): r for r in sample}
    for n, fut in enumerate(as_completed(futures), 1):
        r = futures[fut]
        try:
            results.append(fut.result())
        except Exception as e:
            results.append({"licenseNumber": r["licenseNumber"], "provider": (r.get("menu") or {}).get("provider"),
                            "website": (r.get("contact") or {}).get("website"),
                            "error": f"probe exception: {type(e).__name__}: {e}", "structures": [], "pages": []})
        if n % 10 == 0:
            print(f"probed {n}/{len(sample)}")

results.sort(key=lambda x: (x.get("provider") or "", x["licenseNumber"]))

structure_kinds = Counter()
jsonld_types = Counter()
nextdata_keys = Counter()
product_key_samples = []
blocked_hosts = Counter()
reach_by_provider = Counter()

for r in results:
    provider = r.get("provider") or "?"
    if r.get("robotsAllowed") is False:
        blocked_hosts[urlparse(r.get("website") or "").netloc.lower()] += 1
    if not r.get("error"):
        reach_by_provider[provider] += 1
    for s in r.get("structures", []):
        kind = s.get("kind")
        structure_kinds[kind] += 1
        if kind == "json-ld":
            t = s.get("type")
            jsonld_types[json.dumps(t) if isinstance(t, list) else str(t)] += 1
            # A Product entry is the thing a parser would read, so capture its
            # shape rather than only its existence.
            if isinstance(t, str) and t.lower() in {"product", "offer", "itemlist"} and len(product_key_samples) < 6:
                product_key_samples.append({"provider": provider, "type": t, "keys": s.get("keys")})
        elif kind == "__NEXT_DATA__":
            for k in s.get("pagePropsKeys") or []:
                nextdata_keys[k] += 1

summary = {
    "eligibleShops": len(targets),
    "probed": len(results),
    "reachable": sum(1 for r in results if not r.get("error")),
    "robotsDisallowed": sum(1 for r in results if r.get("robotsAllowed") is False),
    "byProvider": dict(Counter(r.get("provider") for r in results)),
    "structuresFound": dict(structure_kinds.most_common()),
    "flowerWordsSeen": sum(1 for r in results if r.get("flowerWordsSeen")),
    "reachableByProvider": dict(reach_by_provider.most_common()),
    "jsonLdTypes": dict(jsonld_types.most_common(15)),
    "nextDataPagePropsKeys": dict(nextdata_keys.most_common(20)),
    "productKeySamples": product_key_samples,
    "robotsBlockedHosts": dict(blocked_hosts.most_common(30)),
}

(OUT / "menu-probe.json").write_text(
    json.dumps({"summary": summary, "records": results}, indent=2, ensure_ascii=False) + "\n"
)
print(json.dumps(summary, indent=2))
