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
MAX_INTERNAL_PAGES = 5

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
MENU_WORDS = re.compile(r"\b(menu|shop|order(?: online)?|online ordering)\b", re.I)
SUPPORT_WORDS = re.compile(r"\b(contact|location|visit|hours|directions|menu|shop|order|pickup)\b", re.I)
AGE_WORDS = re.compile(r"(are you 21|21\+|age verification|enter site|i am 21|verify age)", re.I)
LOGIN_WALL = re.compile(r"(sign in to continue|log in to continue|login required|account required|download (our|the) app)", re.I)
PHONE_RE = re.compile(r"(?<!\d)(?:\+?1[\s.\-]?)?\(?([2-9]\d{2})\)?[\s.\-]?(\d{3})[\s.\-]?(\d{4})(?!\d)")


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
    if len(digits) != 10 or digits[0] in "01":
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
    anchor_links = []
    tel_phones = set()
    visible_phones = set()
    visible_text = ""
    if soup:
        visible_text = " ".join(soup.stripped_strings)[:250_000]
        for m in PHONE_RE.finditer(visible_text):
            p = normalize_phone("".join(m.groups()))
            if p:
                visible_phones.add(p)
        for a in soup.find_all("a", href=True):
            raw = a.get("href")
            if not raw:
                continue
            if raw.lower().startswith("tel:"):
                p = normalize_phone(raw[4:])
                if p:
                    tel_phones.add(p)
                continue
            u = urljoin(page["url"], raw)
            if u.startswith("http"):
                item = {"url": u, "label": " ".join(a.stripped_strings)[:300], "tag": "a"}
                links.append(item)
                anchor_links.append(item)
        for tag in soup.find_all(["iframe", "script"], src=True):
            raw = tag.get("src")
            if not raw:
                continue
            u = urljoin(page["url"], raw)
            if u.startswith("http"):
                links.append({"url": u, "label": "", "tag": tag.name})
        # JSON-LD sometimes contains the location telephone even when there is no tel: link.
        for tag in soup.find_all("script", attrs={"type": "application/ld+json"}):
            blob = tag.string or tag.get_text(" ")
            for m in PHONE_RE.finditer(blob or ""):
                p = normalize_phone("".join(m.groups()))
                if p:
                    visible_phones.add(p)
    scan = "\n".join([page["url"], text] + [x["url"] for x in links])
    provider, other = detect_provider(scan)
    provider_links = []
    for item in links:
        p, o = detect_provider(item["url"])
        if p:
            provider_links.append({**item, "provider": p, "otherPlatform": o})
    internal_candidates = []
    menu_candidates = []
    for item in anchor_links:
        text_for_match = (item["label"] or "") + " " + item["url"]
        if same_site(original_site, item["url"]) and SUPPORT_WORDS.search(text_for_match):
            internal_candidates.append({"url": item["url"], "label": item["label"]})
        if same_site(original_site, item["url"]) and MENU_WORDS.search(text_for_match):
            menu_candidates.append({"url": item["url"], "label": item["label"]})
    return {
        "provider": provider,
        "otherPlatform": other,
        "providerLinks": provider_links,
        "internalCandidates": list({x["url"]: x for x in internal_candidates}.values()),
        "menuCandidates": list({x["url"]: x for x in menu_candidates}.values()),
        "telPhones": sorted(tel_phones),
        "visiblePhones": sorted(visible_phones),
        "ageGateText": bool(AGE_WORDS.search(text or "")),
        "loginWallText": bool(LOGIN_WALL.search(text or "")),
        "visibleText": visible_text,
    }


def explicit_services(text):
    low = (text or "").lower()
    out = {}
    patterns = {
        "pickup": [r"\bin[- ]store pickup\b", r"\bpickup available\b", r"\border.{0,50}for pickup\b"],
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
    tel_phones = set(ev["telPhones"])
    visible_phones = set(ev["visiblePhones"])
    age_seen = ev["ageGateText"]
    login_seen = ev["loginWallText"]
    opened_menu_candidates = []

    # One site pass: include obvious menu/order/shop plus contact/location pages for phone/services.
    for item in ev["internalCandidates"][:MAX_INTERNAL_PAGES]:
        u = item["url"]
        pg = fetch(u, session)
        pages.append({"role": "internal_candidate", "label": item.get("label"), **{k: pg[k] for k in ["url", "status", "ok", "error"]}})
        pe = page_evidence(pg, site)
        combined_text += " " + pe["visibleText"]
        tel_phones.update(pe["telPhones"])
        visible_phones.update(pe["visiblePhones"])
        provider_links.extend(pe["providerLinks"])
        age_seen = age_seen or pe["ageGateText"]
        login_seen = login_seen or pe["loginWallText"]
        if not provider and pe["provider"]:
            provider, other = pe["provider"], pe["otherPlatform"]
        if pg["ok"] and MENU_WORDS.search((item.get("label") or "") + " " + item["url"]):
            opened_menu_candidates.append(pg["url"])
        time.sleep(0.05)

    # Explicit third-party link is strongest evidence and gives the direct menu URL.
    if provider_links:
        provider_links.sort(key=lambda x: (0 if MENU_WORDS.search((x.get("label") or "") + " " + x["url"]) else 1, len(x["url"])))
        chosen = provider_links[0]
        provider = chosen["provider"]
        other = chosen.get("otherPlatform")
        menu_url = chosen["url"]
    else:
        menu_url = None

    # Proprietary requires an actual same-domain menu/shop/order link that opened.
    if not provider and opened_menu_candidates:
        provider = "PROPRIETARY"
        menu_url = opened_menu_candidates[0]
    elif not provider and home["ok"] and MENU_WORDS.search(home["url"]):
        provider = "PROPRIETARY"
        menu_url = home["url"]

    menu_public = None
    if menu_url:
        mp = fetch(menu_url, session)
        pages.append({"role": "menu_probe", **{k: mp[k] for k in ["url", "status", "ok", "error"]}})
        mev = page_evidence(mp, site)
        if mp["ok"]:
            # Brief explicitly permits a simple 21+ acknowledgement; login/app-only is not public.
            menu_public = False if mev["loginWallText"] else True
        if mp["url"] != menu_url and mp["url"].startswith("http"):
            menu_url = mp["url"]

    # Prefer a unique tel: value. Otherwise accept one unique phone visible on the business site.
    if len(tel_phones) == 1:
        phone = next(iter(tel_phones))
        phone_basis = "tel_link"
    elif len(tel_phones) == 0 and len(visible_phones) == 1:
        phone = next(iter(visible_phones))
        phone_basis = "visible_site_text"
    else:
        phone = None
        phone_basis = None
    services = explicit_services(combined_text)
    return {
        "id": r["id"], "licenseNumber": r["licenseNumber"], "name": r.get("dbaName") or r.get("legalName"),
        "website": site, "websiteFinalUrl": home["url"], "websiteOk": home["ok"], "websiteStatus": home["status"],
        "websiteError": home["error"], "menuProvider": provider, "otherPlatform": other,
        "menuUrl": menu_url, "menuIsPublic": menu_public, "phone": phone, "phoneBasis": phone_basis,
        "telPhoneCandidates": sorted(tel_phones), "visiblePhoneCandidates": sorted(visible_phones),
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
            results.append({"id": r["id"], "licenseNumber": r["licenseNumber"], "name": r.get("dbaName") or r.get("legalName"), "website": (r.get("contact") or {}).get("website"), "websiteOk": False, "websiteError": f"collector exception: {type(e).__name__}: {e}", "menuProvider": None, "menuUrl": None, "menuIsPublic": None, "phone": None, "phoneBasis": None, "telPhoneCandidates": [], "visiblePhoneCandidates": [], "servicesTrue": {}, "pages": []})
        if i % 25 == 0:
            print(f"collected {i}/{len(targets)}")

results.sort(key=lambda x: x["licenseNumber"])
provider_counts = {}
other_counts = {}
for x in results:
    key = x.get("menuProvider") or "NULL"
    provider_counts[key] = provider_counts.get(key, 0) + 1
    if x.get("otherPlatform"):
        other_counts[x["otherPlatform"]] = other_counts.get(x["otherPlatform"], 0) + 1
summary = {
    "targetCount": len(targets),
    "websiteOk": sum(1 for x in results if x.get("websiteOk")),
    "menuProviderFilled": sum(1 for x in results if x.get("menuProvider")),
    "menuProviderCoverage": round(sum(1 for x in results if x.get("menuProvider")) / len(results), 4) if results else 0,
    "phoneFilled": sum(1 for x in results if x.get("phone")),
    "phoneCoverage": round(sum(1 for x in results if x.get("phone")) / len(results), 4) if results else 0,
    "providerCounts": provider_counts,
    "otherPlatformCounts": other_counts,
}
(OUT / "website-evidence.json").write_text(json.dumps({"summary": summary, "records": results}, indent=2, ensure_ascii=False) + "\n")
print(json.dumps(summary, indent=2))
