#!/usr/bin/env python3
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "enrichment-output"
OUT.mkdir(parents=True, exist_ok=True)
records = json.loads((ROOT / "data/dispensaries.json").read_text())

UA = "Mozilla/5.0 (compatible; dispensary-list-enrichment/1.0; +https://github.com/Adisabeba33/dispensery-list)"
TIMEOUT = 12
MAX_INTERNAL_PAGES = 3

PROVIDERS = [
    ("DUTCHIE", ("dutchie.com", "embed.dutchie.com")),
    ("IHEARTJANE", ("iheartjane.com", "menu.iheartjane.com")),
    ("MEADOW", ("getmeadow.com", "meadow.menu")),
    ("BLAZE", ("blaze.me", "ecommerce.blaze.me")),
    ("TREEZ", ("treez.io",)),
    ("LEAFLY", ("leafly.com/dispensary-info/",)),
    ("WEEDMAPS", ("weedmaps.com/dispensaries/",)),
]
OTHER_PLATFORM_MARKERS = {
    "posabit": "POSaBIT",
    "tymber.io": "Tymber",
    "dispenseapp.com": "Dispense",
    "dispense.app": "Dispense",
    "buddi.io": "Buddi",
    "alleaves.com": "Alleaves",
    "springbig.com": "Springbig",
    "menu.klicktrack.io": "KlickTrack",
    "klicktrack.io": "KlickTrack",
    "bud.com": "Bud.com",
    "sweedpos.com": "Sweed",
}
LINK_WORDS = re.compile(r"\b(menu|shop|order|online|pickup|products?|store)\b", re.I)
AGE_WORDS = re.compile(r"(are you 21|21\+|age verification|enter site|i am 21|verify age)", re.I)
LOGIN_WALL = re.compile(r"(sign in to continue|log in to continue|login required|account required|download (our|the) app)", re.I)


def host(url):
    try:
        return urlparse(url).netloc.lower().split(":")[0].removeprefix("www.")
    except Exception:
        return ""


def same_site(a, b):
    ha, hb = host(a), host(b)
    return ha == hb or ha.endswith("." + hb) or hb.endswith("." + ha)


def normalize_phone(value):
    digits = re.sub(r"\D", "", value or "")
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) != 10:
        return None
    return f"+1-{digits[:3]}-{digits[3:6]}-{digits[6:]}"


def detect_provider(text):
    low = (text or "").lower()
    for provider, markers in PROVIDERS:
        if any(m in low for m in markers):
            return provider, None
    for marker, label in OTHER_PLATFORM_MARKERS.items():
        if marker in low:
            return "OTHER", label
    return None, None


def fetch(url, session):
    try:
        r = session.get(url, timeout=TIMEOUT, allow_redirects=True, headers={"User-Agent": UA, "Accept": "text/html,application/xhtml+xml,*/*"})
        ctype = r.headers.get("content-type", "")
        text = r.text if ("text" in ctype or "html" in ctype or not ctype) else ""
        return {"ok": 200 <= r.status_code < 400, "status": r.status_code, "url": r.url, "text": text[:2_000_000], "error": None}
    except Exception as e:
        return {"ok": False, "status": None, "url": url, "text": "", "error": f"{type(e).__name__}: {e}"}


def page_evidence(page, original_site):
    text = page["text"]
    soup = BeautifulSoup(text, "html.parser") if text else None
    links = []
    tel_phones = set()
    if soup:
        for tag in soup.find_all(["a", "iframe", "script"], href=True) + soup.find_all(["iframe", "script"], src=True):
            raw = tag.get("href") or tag.get("src")
            if not raw:
                continue
            u = urljoin(page["url"], raw)
            if u.startswith("http"):
                label = " ".join(tag.stripped_strings) if tag.name == "a" else ""
                links.append({"url": u, "label": label[:300], "tag": tag.name})
        for a in soup.find_all("a", href=True):
            href = a.get("href", "")
            if href.lower().startswith("tel:"):
                p = normalize_phone(href[4:])
                if p:
                    tel_phones.add(p)
    scan = "\n".join([page["url"], text] + [x["url"] for x in links])
    provider, other = detect_provider(scan)
    provider_links = []
    for item in links:
        p, o = detect_provider(item["url"])
        if p:
            provider_links.append({**item, "provider": p, "otherPlatform": o})
    internal_candidates = []
    for item in links:
        if same_site(original_site, item["url"]) and LINK_WORDS.search((item["label"] or "") + " " + item["url"]):
            internal_candidates.append(item["url"])
    return {
        "provider": provider,
        "otherPlatform": other,
        "providerLinks": provider_links,
        "internalCandidates": list(dict.fromkeys(internal_candidates)),
        "telPhones": sorted(tel_phones),
        "ageGateText": bool(AGE_WORDS.search(text or "")),
        "loginWallText": bool(LOGIN_WALL.search(text or "")),
        "visibleText": " ".join(soup.stripped_strings)[:200_000] if soup else ""
    }


def explicit_services(text):
    low = (text or "").lower()
    out = {}
    patterns = {
        "pickup": [r"\bin[- ]store pickup\b", r"\bpickup available\b", r"\border.*for pickup\b"],
        "curbside": [r"\bcurbside pickup\b", r"\bcurbside service\b"],
        "adaAccessible": [r"\bada accessible\b", r"\bwheelchair accessible\b"],
        "onsiteConsumption": [r"\bon[- ]site consumption\b", r"\bconsumption lounge\b"],
        "acceptsDebit": [r"\baccept(?:s|ed)? debit\b", r"\bdebit cards? accepted\b"],
        "acceptsCredit": [r"\baccept(?:s|ed)? (?:all )?(?:major )?credit cards?\b", r"\bcredit cards? accepted\b"],
        "cashOnly": [r"\bcash only\b"],
        "atmOnSite": [r"\batm (?:on[- ]site|onsite|available|inside)\b"],
        "parking": [r"\bfree parking\b", r"\bparking available\b", r"\bon[- ]site parking\b"],
    }
    for key, pats in patterns.items():
        if any(re.search(p, low, re.I | re.S) for p in pats):
            out[key] = True
    return out


def collect_record(r):
    site = (r.get("contact") or {}).get("website")
    session = requests.Session()
    home = fetch(site, session)
    pages = [{"role": "website", **{k: home[k] for k in ["url", "status", "ok", "error"]}}]
    ev = page_evidence(home, site)
    combined_text = ev["visibleText"]
    provider = ev["provider"]
    other = ev["otherPlatform"]
    provider_links = ev["providerLinks"][:]
    phones = set(ev["telPhones"])
    age_seen = ev["ageGateText"]
    login_seen = ev["loginWallText"]

    # Follow only a few obvious same-site menu/shop/order links. No form submission, cookies, age-gate bypass, or login.
    for u in ev["internalCandidates"][:MAX_INTERNAL_PAGES]:
        pg = fetch(u, session)
        pages.append({"role": "internal_candidate", **{k: pg[k] for k in ["url", "status", "ok", "error"]}})
        pe = page_evidence(pg, site)
        combined_text += " " + pe["visibleText"]
        phones.update(pe["telPhones"])
        provider_links.extend(pe["providerLinks"])
        age_seen = age_seen or pe["ageGateText"]
        login_seen = login_seen or pe["loginWallText"]
        if not provider and pe["provider"]:
            provider, other = pe["provider"], pe["otherPlatform"]
        time.sleep(0.05)

    # Prefer an explicit provider link over an HTML marker.
    if provider_links:
        provider_links.sort(key=lambda x: (0 if LINK_WORDS.search((x.get("label") or "") + " " + x["url"]) else 1, len(x["url"])))
        chosen = provider_links[0]
        provider = chosen["provider"]
        other = chosen.get("otherPlatform")
        menu_url = chosen["url"]
    else:
        menu_url = None

    # Proprietary only when an obvious same-site menu/shop/order page actually opened and no known third-party provider was found.
    if not provider:
        opened_candidates = [p for p in pages if p["role"] == "internal_candidate" and p["ok"]]
        obvious = [p for p in opened_candidates if LINK_WORDS.search(p["url"])]
        if obvious:
            provider = "PROPRIETARY"
            menu_url = obvious[0]["url"]
        elif home["ok"] and not ev["internalCandidates"]:
            # Do not automatically call this NONE: many sites hide the menu behind JS.
            provider = None

    menu_public = None
    if menu_url:
        mp = fetch(menu_url, session)
        pages.append({"role": "menu_probe", **{k: mp[k] for k in ["url", "status", "ok", "error"]}})
        mev = page_evidence(mp, site)
        if mp["ok"]:
            # Age confirmation is explicitly allowed by the brief; a login/app-only wall is not public.
            menu_public = False if mev["loginWallText"] else True
        if mp["url"] != menu_url and mp["url"].startswith("http"):
            menu_url = mp["url"]

    phone = next(iter(phones)) if len(phones) == 1 else None
    services = explicit_services(combined_text)
    return {
        "id": r["id"], "licenseNumber": r["licenseNumber"], "name": r.get("dbaName") or r.get("legalName"),
        "website": site, "websiteFinalUrl": home["url"], "websiteOk": home["ok"], "websiteStatus": home["status"],
        "websiteError": home["error"], "menuProvider": provider, "otherPlatform": other,
        "menuUrl": menu_url, "menuIsPublic": menu_public, "phone": phone, "phoneCandidates": sorted(phones),
        "servicesTrue": services, "ageGateObserved": age_seen, "loginWallObserved": login_seen,
        "pages": pages,
    }


targets = [r for r in records if r.get("operationalStatus") == "OPEN" and (r.get("contact") or {}).get("website")]
results = []
with ThreadPoolExecutor(max_workers=12) as ex:
    futs = {ex.submit(collect_record, r): r for r in targets}
    for i, fut in enumerate(as_completed(futs), 1):
        r = futs[fut]
        try:
            results.append(fut.result())
        except Exception as e:
            results.append({"id": r["id"], "licenseNumber": r["licenseNumber"], "name": r.get("dbaName") or r.get("legalName"), "website": (r.get("contact") or {}).get("website"), "websiteOk": False, "websiteError": f"collector exception: {type(e).__name__}: {e}", "menuProvider": None, "menuUrl": None, "menuIsPublic": None, "phone": None, "phoneCandidates": [], "servicesTrue": {}, "pages": []})
        if i % 25 == 0:
            print(f"collected {i}/{len(targets)}")

results.sort(key=lambda x: x["licenseNumber"])
provider_counts = {}
for x in results:
    key = x.get("menuProvider") or "NULL"
    provider_counts[key] = provider_counts.get(key, 0) + 1
summary = {
    "targetCount": len(targets),
    "websiteOk": sum(1 for x in results if x.get("websiteOk")),
    "menuProviderFilled": sum(1 for x in results if x.get("menuProvider")),
    "menuProviderCoverage": round(sum(1 for x in results if x.get("menuProvider")) / len(results), 4) if results else 0,
    "phoneFilled": sum(1 for x in results if x.get("phone")),
    "phoneCoverage": round(sum(1 for x in results if x.get("phone")) / len(results), 4) if results else 0,
    "providerCounts": provider_counts,
    "otherPlatforms": sorted({x.get("otherPlatform") for x in results if x.get("otherPlatform")}),
}
(OUT / "website-evidence.json").write_text(json.dumps({"summary": summary, "records": results}, indent=2, ensure_ascii=False) + "\n")
print(json.dumps(summary, indent=2))
