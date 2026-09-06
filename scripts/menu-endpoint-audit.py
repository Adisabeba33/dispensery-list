#!/usr/bin/env python3
"""Audit the 27 Phase-3 menu-endpoint targets.

This script is intentionally conservative. It makes sequential requests only,
checks robots.txt on the menu host before requesting a candidate endpoint,
uses an honest User-Agent, never submits forms/cookies/age gates, and never
logs in or works around anti-bot controls. Its output is research evidence;
`data/menu-endpoints.json` is curated from the evidence afterwards.
"""

import json
import re
import time
import urllib.robotparser
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import requests

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "enrichment-output"
OUT.mkdir(parents=True, exist_ok=True)
UA = "Mozilla/5.0 (compatible; dispensary-list-menu-endpoint-audit/1.0; +https://github.com/Adisabeba33/dispensery-list)"
TIMEOUT = 18
PAUSE = 1.2
CHECKED = datetime.now(timezone.utc).date().isoformat()

TARGETS = [
    {"licenseNumber":"OCM-CAURD-25-000281","name":"Flynnstoned Cannabis Company","site":"https://flynnstoned.com","candidate":"https://flynnstoned.com/categories/flower/","expected":"PROPRIETARY"},
    {"licenseNumber":"OCM-CAURD-24-000165","name":"Frass Box Cannabis LLC","site":"https://frassboxcannabis.com","candidate":"https://frassboxcannabis.com/categories/flower/","expected":"PROPRIETARY"},
    {"licenseNumber":"OCM-CAURD-24-000051","name":"ARE WE GOOD ENTERPRISES INC.","site":"https://thespotdispensary.com","candidate":"https://thespotdispensary.com/menu/?category=flowers","expected":"BLAZE"},
    {"licenseNumber":"OCM-RETL-25-000360","name":"BK Greenery LLC","site":"https://www.bkgreenery.com","candidate":"https://www.bkgreenery.com/menu","expected":"DUTCHIE"},
    {"licenseNumber":"OCM-CAURD-24-000145","name":"BY ANY OTHER NAME","site":"https://byanyothernamebk.com","candidate":"https://byanyothernamebk.com/shop/","expected":"DUTCHIE"},
    {"licenseNumber":"OCM-RETL-24-000063","name":"Bud City Cannabis LLC","site":"https://budcityny.com","candidate":"https://budcityny.com/shop/flower/","expected":"DUTCHIE"},
    {"licenseNumber":"OCM-RETL-25-000285","name":"Buzzy NY, LLC","site":"https://www.getbuzzy.com","candidate":"https://getbuzzy.com/menu/?dtche%5Bcategory%5D=flower","expected":"DUTCHIE"},
    {"licenseNumber":"OCM-RETL-24-000144","name":"Case Management","site":"https://qualitycontroldispensary.com/","candidate":"https://qualitycontroldispensary.com/flower-brooklyn","expected":"DUTCHIE"},
    {"licenseNumber":"OCM-CAURD-26-000336","name":"Emerald Dispensary Carroll Gardens","site":"https://www.theemeraldny.com/carrollgardens","candidate":"https://dutchie.com/dispensary/emerald-dispensary-carroll-gardens","expected":"DUTCHIE"},
    {"licenseNumber":"OCM-CAURD-24-000196","name":"Fireleaf, LLC","site":"https://www.fireleafny.com","candidate":"https://fireleafny.com/shop/?dtche%5Bcategory%5D=flower","expected":"DUTCHIE"},
    {"licenseNumber":"OCM-RETL-24-000171","name":"GUARDIAN WELLNESS LLC","site":"https://guardianwellnessretail.com","candidate":"https://guardianwellnessretail.com/order-online/?dtche%5Bcategory%5D=flower","expected":"DUTCHIE"},
    {"licenseNumber":"OCM-RETL-24-000260","name":"Herbwell","site":"https://www.herbwellcannabis.com","candidate":"https://dutchie.com/dispensary/herbwell-bronx","expected":"DUTCHIE"},
    {"licenseNumber":"OCM-CAURD-24-000131","name":"Hibernica","site":"https://shophibernica.com","candidate":"https://shophibernica.com/dispensary-bronx-menu/?dtche%5Bcategory%5D=flower","expected":"DUTCHIE"},
    {"licenseNumber":"OCM-RETL-24-000008","name":"My Bud 420 Inc.","site":"https://mybud420.com","candidate":"https://mybud420.com/shop/?dtche%5Bcategory%5D=flower","expected":"DUTCHIE"},
    {"licenseNumber":"OCM-CAURD-25-000304","name":"Say Less","site":"https://saylessny.com","candidate":"https://saylessny.com/order-online/?dtche%5Bcategory%5D=flower","expected":"DUTCHIE"},
    {"licenseNumber":"OCM-RETL-24-000261","name":"Stash House","site":"https://stashhouseus.com","candidate":"https://stashhouseus.com/shop/?dtche%5Bcategory%5D=flower","expected":"DUTCHIE"},
    {"licenseNumber":"OCM-RETL-24-000189","name":"DISPO/BK LLC","site":"https://dispostore.com","candidate":"https://dispostore.com/shop","expected":"MEADOW"},
    {"licenseNumber":"OCM-RETL-24-000151","name":"All Good Cannabis Dispensary","site":"https://stayallgood.com","candidate":"https://stayallgood.com/shop/categories/flower","expected":"OTHER"},
    {"licenseNumber":"OCM-CAURD-26-000325","name":"Brooklyn Urban","site":"https://bkurbanbud.com","candidate":"https://shop.bkurbanbud.com/shop/categories/flower/","expected":"OTHER"},
    {"licenseNumber":"OCM-RETL-24-000055","name":"ELEVATED","site":"https://elevated718.com","candidate":"https://elevated718.com/menu/categories/flower","expected":"OTHER"},
    {"licenseNumber":"OCM-CAURD-25-000305","name":"Flower Daddy","site":"https://flowerdaddy.nyc","candidate":"https://shop.flowerdaddy.nyc/newyork/menu/flower-3325","expected":"OTHER"},
    {"licenseNumber":"OCM-RETL-26-000488","name":"Freshly Baked NYC","site":"https://freshlybaked.nyc/","candidate":"https://freshlybaked.nyc/stores/midtown/shop/menu/flower-1088","expected":"OTHER"},
    {"licenseNumber":"OCM-CAURD-25-000292","name":"Celestial Herbs","site":"https://celestialherbsllc.com","candidate":"https://celestialherbs.dispensary.shop/rec/flower/nb/k3w","expected":"OTHER"},
    {"licenseNumber":"OCM-CAURD-25-000284","name":"Chrome Flwrs","site":"https://chromeflwrs.com","candidate":"https://chromeflwrs.com/categories/flower/","expected":"PROPRIETARY"},
    {"licenseNumber":"OCM-RETL-24-000133","name":"Forever 4 20","site":"https://www.forever420ny.com","candidate":"https://www.forever420ny.com/collection/flower","expected":"TREEZ"},
    {"licenseNumber":"OCM-CAURD-25-000324","name":"Victory Dispensary LLC","site":"https://www.victorydispensaryny.com","candidate":"https://www.victorydispensaryny.com/collection/flower","expected":"TREEZ"},
    {"licenseNumber":"OCM-RETL-25-000466","name":"4081 Companies, LLC","site":None,"candidate":None,"expected":None},
]

session = requests.Session()
session.headers.update({"User-Agent": UA, "Accept": "text/html,application/xhtml+xml,*/*"})
robots_cache = {}
last_request = 0.0


def polite_get(url):
    global last_request
    wait = PAUSE - (time.monotonic() - last_request)
    if wait > 0:
        time.sleep(wait)
    try:
        r = session.get(url, timeout=TIMEOUT, allow_redirects=True)
        last_request = time.monotonic()
        ctype = r.headers.get("content-type", "")
        text = r.text[:2_000_000] if ("text" in ctype or "html" in ctype or not ctype) else ""
        return {"ok": 200 <= r.status_code < 400, "status": r.status_code, "url": r.url, "text": text, "error": None}
    except Exception as exc:
        last_request = time.monotonic()
        return {"ok": False, "status": None, "url": url, "text": "", "error": f"{type(exc).__name__}: {exc}"}


def robots_for(url):
    p = urlparse(url)
    origin = f"{p.scheme}://{p.netloc}"
    if origin in robots_cache:
        return robots_cache[origin]
    robots_url = origin + "/robots.txt"
    response = polite_get(robots_url)
    if response["status"] == 200:
        rp = urllib.robotparser.RobotFileParser()
        rp.set_url(robots_url)
        rp.parse(response["text"].splitlines())
        value = {"url": robots_url, "status": 200, "allows": bool(rp.can_fetch("*", url)), "error": None}
    elif response["status"] in (401, 403):
        value = {"url": robots_url, "status": response["status"], "allows": False, "error": "robots.txt access denied; treated conservatively as disallowed"}
    else:
        value = {"url": robots_url, "status": response["status"], "allows": True, "error": response["error"]}
    robots_cache[origin] = value
    return value


def platform_from(url, text):
    blob = ((url or "") + "\n" + (text or "")).lower()
    markers = [
        ("DUTCHIE", ["dutchie.com", "embed.dutchie", "dtche%5b", "dtche[", "dutchie menu"]),
        ("BLAZE", ["ecommerce.blaze.me", "blaze.me", "by blaze", "powered by blaze"]),
        ("TREEZ", ["treez.io", "treezcomm.app", "powered with love by treez", "powered by treez"]),
        ("IHEARTJANE", ["iheartjane.com", "menu.iheartjane.com"]),
        ("MEADOW", ["getmeadow.com", "meadow.menu", "meadow embedded menu", "meadow platform"]),
    ]
    for provider, needles in markers:
        if any(n in blob for n in needles):
            return provider, next(n for n in needles if n in blob)
    other_markers = [
        ("Dispense", ["dispenseapp.com", "dispense.app"]),
        ("Sweed", ["sweedpos.com", "sweed"]),
        ("POSaBIT", ["posabit"]),
        ("dispensary.shop", ["dispensary.shop"]),
        ("JointCommerce", ["jointcommerce"]),
    ]
    for label, needles in other_markers:
        if any(n in blob for n in needles):
            return "OTHER", label
    return None, None


def age_gate(text):
    low = (text or "").lower()
    if re.search(r"(log\s*in|sign\s*in).{0,80}(required|continue|account)", low, re.S):
        return "login"
    if re.search(r"(date of birth|birth date|mm\s*/\s*dd\s*/\s*yyyy|enter your birthday)", low):
        return "date-of-birth-form"
    if re.search(r"(are you 21|at least 21|21 years of age|21\+|i am 21|i'm at least 21|confirm.*21)", low):
        return "simple-button"
    return "none"


def flower_evidence(text, url):
    low = (text or "").lower()
    score = 0
    evidence = []
    if "flower" in (url or "").lower():
        score += 1; evidence.append("flower-in-url")
    for needle in ["flower", "thc", "add to cart", "add to bag", "3.5g", "1/8", "pre-packaged flower"]:
        if needle in low:
            score += 1; evidence.append(needle)
    return score >= 3, evidence[:8]


def same_host(url_a, url_b):
    try:
        a = urlparse(url_a).netloc.lower().removeprefix("www.")
        b = urlparse(url_b).netloc.lower().removeprefix("www.")
        return a == b or a.endswith("." + b) or b.endswith("." + a)
    except Exception:
        return False


results = []
for idx, target in enumerate(TARGETS, 1):
    candidate = target["candidate"]
    row = {k: target.get(k) for k in ["licenseNumber", "name", "site", "candidate", "expected"]}
    row.update({"checkedAt": CHECKED, "robots": None, "page": None, "detectedPlatform": None, "platformEvidence": None,
                "flowerVisible": None, "ageGate": None, "outsideScope": False, "notes": []})
    if not candidate:
        row["notes"].append("No candidate menu URL is known; no request made.")
        results.append(row)
        print(f"[{idx}/{len(TARGETS)}] {target['licenseNumber']}: no candidate")
        continue

    robots = robots_for(candidate)
    row["robots"] = robots
    if not robots["allows"]:
        row["notes"].append("robots.txt disallows the candidate URL; page was not requested.")
        results.append(row)
        print(f"[{idx}/{len(TARGETS)}] {target['licenseNumber']}: robots disallow")
        continue

    page = polite_get(candidate)
    row["page"] = {k: page[k] for k in ["ok", "status", "url", "error"]}
    final_host = urlparse(page["url"]).netloc.lower()
    if "weedmaps.com" in final_host or "leafly.com" in final_host:
        row["outsideScope"] = True
        row["notes"].append("Candidate resolves to Weedmaps/Leafly, which the brief excludes from collection.")
    provider, evidence = platform_from(page["url"], page["text"])
    if not provider and page["ok"] and target["site"] and same_host(page["url"], target["site"]):
        provider, evidence = "PROPRIETARY", "same-site menu page with no known platform marker"
    row["detectedPlatform"] = provider
    row["platformEvidence"] = evidence
    row["ageGate"] = age_gate(page["text"])
    flower, flower_ev = flower_evidence(page["text"], page["url"])
    row["flowerVisible"] = flower if page["ok"] else None
    row["flowerEvidence"] = flower_ev
    if page["url"] != candidate:
        row["notes"].append(f"Redirected to {page['url']}")
    if provider and target["expected"] and provider != target["expected"]:
        row["notes"].append(f"Detected platform {provider} differs from brief guess {target['expected']}.")
    if page["ok"] and not flower:
        row["notes"].append("Endpoint opened but automated evidence was insufficient to prove visible flower products.")
    if not page["ok"]:
        row["notes"].append(f"Endpoint request failed: {page['status'] or page['error']}")
    results.append(row)
    print(f"[{idx}/{len(TARGETS)}] {target['licenseNumber']}: HTTP {page['status']} platform={provider} flower={row['flowerVisible']} gate={row['ageGate']}")

summary = {
    "checkedAt": CHECKED,
    "targets": len(results),
    "robotsAllowed": sum(1 for r in results if (r.get("robots") or {}).get("allows") is True),
    "robotsDisallowed": sum(1 for r in results if (r.get("robots") or {}).get("allows") is False),
    "endpointOk": sum(1 for r in results if (r.get("page") or {}).get("ok") is True),
    "flowerVisible": sum(1 for r in results if r.get("flowerVisible") is True),
    "platformDetected": sum(1 for r in results if r.get("detectedPlatform")),
    "outsideScope": sum(1 for r in results if r.get("outsideScope")),
    "noCandidate": sum(1 for r in results if not r.get("candidate")),
}
(OUT / "menu-endpoint-audit.json").write_text(json.dumps({"summary": summary, "records": results}, indent=2, ensure_ascii=False) + "\n")
print(json.dumps(summary, indent=2))
