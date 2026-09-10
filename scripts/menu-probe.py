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
not a failure to route around. A host that merely refuses to serve robots.txt
is recorded as unknown, not as disallowing: a 403 from a WAF, a CDN or a proxy
is not a crawl policy the shop ever wrote, and must not harden into one.

Usage: python scripts/menu-probe.py [--limit N | --all] [--only-untried]
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
parser.add_argument(
    "--all",
    action="store_true",
    help="sweep every eligible shop instead of sampling --limit of them",
)
parser.add_argument(
    "--only-untried",
    action="store_true",
    help="skip shops we already collected listings for or already recorded in menu-endpoints.todo.json",
)
args = parser.parse_args()

records = json.loads((ROOT / "data/dispensaries.json").read_text())

# Open, and with a website to visit. A KNOWN menu provider used to be required
# here too, and that was circular: this pass exists to discover what a site
# actually exposes, so demanding we already know the platform meant the 72 open
# shops whose platform was never identified could never be probed — and so
# their platform stayed unidentified. Provider is a grouping signal below, not
# an entry requirement.
targets = [
    r for r in records
    if r.get("operationalStatus") == "OPEN"
    and (r.get("contact") or {}).get("website")
]

if args.only_untried:
    # Step 0 of the coverage plan: the shops no pass has ever reached. Anything
    # already collected, or already recorded as a known dead end, is somebody
    # else's problem.
    def _read(rel):
        path = ROOT / rel
        return json.loads(path.read_text()) if path.exists() else []

    tried = {l.get("licenseNumber") for l in _read("data/flower-listings.json")}
    tried |= {t.get("licenseNumber") for t in _read("data/menu-endpoints.todo.json")}
    tried |= {e.get("licenseNumber") for e in _read("data/menu-endpoints.json")}
    targets = [r for r in targets if r["licenseNumber"] not in tried]

# Spread the sample across platforms so the report describes every one we face,
# rather than sixty Dutchie shops and nothing else. Shops whose platform is not
# yet identified group under "?" and take their turn like any other — they are
# the ones this pass has the most to learn from.
by_provider = {}
for r in targets:
    by_provider.setdefault((r.get("menu") or {}).get("provider") or "?", []).append(r)

if args.all:
    sample = list(targets)
else:
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

print(
    f"targets: {len(targets)} eligible"
    + (" (untried only)" if args.only_untried else "")
    + f" · probing {len(sample)}"
    + ("" if args.all else f" (sample of --limit {args.limit}; pass --all to sweep)")
)
for provider in sorted(by_provider):
    print(f"    {provider:<12} {len(by_provider[provider])}")

MENU_WORDS = re.compile(r"\b(menu|shop|order|browse|products?)\b", re.I)
# The first two runs showed JSON-LD carries only LocalBusiness/Breadcrumb/FAQ
# metadata — not one Product entry across 128 blocks. Products live in
# __NEXT_DATA__ instead, so the flower category page is what we need to reach.
FLOWER_URL = re.compile(r"(flower|/bud|category=flower|categories/flower)", re.I)
FLOWER_WORDS = re.compile(r"\b(flower|bud|eighth|1/8|3\.5\s?g|quarter|ounce)\b", re.I)

# host -> (parser | None, note). None means no policy was obtained; the note
# says why, and whether that "why" is a refusal or an absence.
robots_cache: dict[str, tuple[urllib.robotparser.RobotFileParser | None, str]] = {}


def host_of(url: str) -> str:
    return urlparse(url).netloc.lower()


def load_robots(url: str) -> tuple[urllib.robotparser.RobotFileParser | None, str]:
    """Fetch robots.txt ourselves and say plainly what came back.

    RobotFileParser.read() swallows the HTTP status: a 401 or 403 on
    /robots.txt silently becomes disallow_all, indistinguishable from a site
    that actually wrote Disallow. A WAF, a CDN or an egress proxy answering
    403 would then be recorded as the shop's own crawl policy — a permanent
    verdict invented out of a transport error. So fetch it here and keep the
    status.
    """
    host = host_of(url)
    if host in robots_cache:
        return robots_cache[host]

    scheme = urlparse(url).scheme or "https"
    entry: tuple[urllib.robotparser.RobotFileParser | None, str]
    try:
        r = requests.get(
            f"{scheme}://{host}/robots.txt",
            timeout=TIMEOUT,
            allow_redirects=True,
            headers={"User-Agent": UA, "Accept": "text/plain,*/*"},
        )
    except Exception as e:
        entry = (None, f"robots.txt unreachable ({type(e).__name__})")
    else:
        if r.status_code == 200:
            rp = urllib.robotparser.RobotFileParser()
            try:
                rp.parse(r.text.splitlines())
                entry = (rp, "robots.txt consulted")
            except Exception:
                entry = (None, "robots.txt unparseable")
        elif r.status_code in (401, 403):
            # A refusal to serve robots.txt is not a crawl rule. It says only
            # that something between us and the file said no.
            entry = (None, f"robots.txt withheld (HTTP {r.status_code})")
        elif 400 <= r.status_code < 500:
            entry = (None, f"no robots.txt (HTTP {r.status_code})")
        else:
            entry = (None, f"robots.txt unavailable (HTTP {r.status_code})")

    robots_cache[host] = entry
    return entry


def robots_allows(url: str) -> tuple[bool | None, str]:
    """Three answers, not two: yes, no, and we do not know.

    None is what a 401 or 403 on robots.txt earns. We still decline to fetch
    on None — a refusal is a refusal — but the record says "unknown", so no
    shop is written off permanently on the strength of one bad response from
    a WAF, a CDN or a proxy that never spoke for the shop at all.
    """
    rp, note = load_robots(url)
    if rp is None:
        # Only an outright refusal to serve the file is treated as a reason to
        # stay away. A file that is absent, broken or briefly unreachable
        # states no restriction, exactly as before — the change here is that
        # none of these are ever written down as the shop's own policy.
        if note.startswith("robots.txt withheld"):
            return None, note
        return True, note
    try:
        return bool(rp.can_fetch(UA, url)), note
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
            if not isinstance(item, dict):
                continue
            entry = {"kind": "json-ld", "type": item.get("@type"), "keys": sorted(item.keys())[:25]}

            # An ItemList holds the products one level down, usually wrapped in
            # ListItem envelopes. That inner object is the product.
            elements = item.get("itemListElement")
            if isinstance(elements, list) and elements:
                first = elements[0]
                if isinstance(first, dict):
                    inner = first.get("item") if isinstance(first.get("item"), dict) else first
                    entry["itemListCount"] = len(elements)
                    entry["itemType"] = inner.get("@type")
                    entry["itemKeys"] = sorted(inner.keys())[:30]
                    for k in ("name", "category"):
                        if inner.get(k):
                            entry.setdefault("itemSample", {})[k] = str(inner[k])[:70]
            found.append(entry)

    next_data = soup.find("script", id="__NEXT_DATA__")
    if next_data and next_data.string:
        try:
            data = json.loads(next_data.string)
            props = (data.get("props") or {}).get("pageProps") or {}
            entry = {"kind": "__NEXT_DATA__", "pagePropsKeys": sorted(props.keys())[:30]}

            # The product object's own field names are what a parser is written
            # against, so pull them out wherever a product list turns up.
            for key in ("products", "menuItems", "items", "productList"):
                value = props.get(key)
                if key == "products" and "products" in props:
                    # The key being present says nothing about it holding anything.
                    # If the server ships it empty, the menu is fetched client-side
                    # and no amount of HTML fetching will produce products.
                    entry["productsFieldType"] = type(value).__name__
                    if isinstance(value, list):
                        entry["productsFieldLength"] = len(value)
                    elif isinstance(value, dict):
                        entry["productsFieldKeys"] = sorted(value.keys())[:20]
                if isinstance(value, dict):
                    # `data` first, and it is not a guess: the collector was
                    # written against this engine in September after the same
                    # descent list missed it, and the shape reported by this
                    # run — dict(keys=data,params), on seven sites — is that
                    # engine. Without it the probe reports zero product lists
                    # while looking straight at them.
                    value = (value.get("data") or value.get("products")
                             or value.get("items") or value.get("edges"))
                if isinstance(value, list) and value:
                    first = value[0]
                    if isinstance(first, dict) and "node" in first and isinstance(first["node"], dict):
                        first = first["node"]
                    if isinstance(first, dict):
                        entry["productContainer"] = key
                        entry["productCount"] = len(value)
                        entry["productKeys"] = sorted(first.keys())[:40]
                        # Category naming decides how flower gets filtered out.
                        for cat_key in ("type", "category", "productCategory", "kind", "subcategory"):
                            if cat_key in first:
                                entry.setdefault("categorySamples", {})[cat_key] = str(first[cat_key])[:60]
                        break
            found.append(entry)
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
    # None when the platform has not been identified yet — which is now a
    # normal case, and the single most useful thing this pass can resolve.
    provider = (record.get("menu") or {}).get("provider")
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
    if allowed is False:
        result["error"] = "robots.txt disallows this path — not fetched"
        return result
    if allowed is None:
        # Not a verdict about this shop, so it must not read like one.
        result["error"] = f"robots.txt could not be read ({note}) — not fetched"
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
        if FLOWER_URL.search(url) or FLOWER_URL.search(label):
            candidates.insert(0, url)   # a flower category page is the target
        elif MENU_WORDS.search(label) or MENU_WORDS.search(url):
            candidates.append(url)

    for url in list(dict.fromkeys(candidates))[:4]:
        ok, link_note = robots_allows(url)
        if ok is not True:
            reason = "robots.txt disallows" if ok is False else f"robots.txt unknown ({link_note})"
            result["pages"].append({"url": url, "status": None, "ok": False, "error": reason})
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
unknown_robots_hosts = Counter()
products_field_shape = Counter()
item_list_samples = []
reach_by_provider = Counter()

for r in results:
    provider = r.get("provider") or "?"
    if r.get("robotsAllowed") is False:
        blocked_hosts[urlparse(r.get("website") or "").netloc.lower()] += 1
    elif r.get("robotsAllowed") is None:
        unknown_robots_hosts[urlparse(r.get("website") or "").netloc.lower()] += 1
    if not r.get("error"):
        reach_by_provider[provider] += 1
    for s in r.get("structures", []):
        kind = s.get("kind")
        structure_kinds[kind] += 1
        if kind == "__NEXT_DATA__" and s.get("productsFieldType"):
            products_field_shape[
                f'{s["productsFieldType"]}'
                + (f'(len={s.get("productsFieldLength")})' if "productsFieldLength" in s else "")
                + (f'(keys={",".join((s.get("productsFieldKeys") or [])[:6])})' if s.get("productsFieldKeys") else "")
            ] += 1
        if kind == "json-ld" and s.get("itemKeys") and len(item_list_samples) < 5:
            item_list_samples.append({
                "provider": provider, "count": s.get("itemListCount"),
                "itemType": s.get("itemType"), "itemKeys": s.get("itemKeys"),
                "sample": s.get("itemSample"),
            })
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
            if s.get("productKeys") and len(product_key_samples) < 8:
                product_key_samples.append({
                    "provider": provider,
                    "container": s.get("productContainer"),
                    "count": s.get("productCount"),
                    "keys": s.get("productKeys"),
                    "categorySamples": s.get("categorySamples"),
                })

summary = {
    "eligibleShops": len(targets),
    "probed": len(results),
    "reachable": sum(1 for r in results if not r.get("error")),
    "robotsDisallowed": sum(1 for r in results if r.get("robotsAllowed") is False),
    "robotsUnknown": sum(1 for r in results if r.get("robotsAllowed") is None),
    "byProvider": dict(Counter(r.get("provider") for r in results)),
    "structuresFound": dict(structure_kinds.most_common()),
    "flowerWordsSeen": sum(1 for r in results if r.get("flowerWordsSeen")),
    "reachableByProvider": dict(reach_by_provider.most_common()),
    "jsonLdTypes": dict(jsonld_types.most_common(15)),
    "nextDataPagePropsKeys": dict(nextdata_keys.most_common(20)),
    "productsFieldShape": dict(products_field_shape.most_common()),
    "itemListSamples": item_list_samples,
    "shopsWithProductList": sum(1 for r in results for s in r.get("structures", []) if s.get("productKeys")),
    "productKeySamples": product_key_samples,
    "robotsBlockedHosts": dict(blocked_hosts.most_common(30)),
    "robotsUnknownHosts": dict(unknown_robots_hosts.most_common(30)),
}

(OUT / "menu-probe.json").write_text(
    json.dumps({"summary": summary, "records": results}, indent=2, ensure_ascii=False) + "\n"
)
print(json.dumps(summary, indent=2))
