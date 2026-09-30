#!/usr/bin/env python3
"""Forensic harvest layer for public NY Retail ID / COA evidence.

This script deliberately does NOT modify lot-twins.py or its output.  It turns
already-discovered package tags into a durable, normalized evidence dataset
that later detectors can consume.

Sources, in priority order:
  * data/lot-twins.json cards (rich Retail ID cards already fetched)
  * data/retail-id.json packages (dates / identity)
  * data/flower-listings.json packageIds (discovery queue)
  * optional live app.1a4.com fetches (--network)

Outputs:
  data/forensics/retail-cards.jsonl
  data/forensics/fingerprints.jsonl
  data/forensics/retail-history.json  (read back on the next run: every
                                       distinct identity a card has shown,
                                       and the days menus printed each tag)
  data/forensics/harvest-state.json

No sequential tag guessing is done here. Discovery provenance is retained.

Live requests (--network) go only to public cards and to leads a public source
names, in the order of what they are likely to return:
  0. leads a public page points at, that no collector has an answer for yet:
     a menu's 1a4.com link, the package tag of a Retail ID page a shop saved
     as its "COA" (data/forensics/coa-index.json) — a public card: 5 of 5 on
     2026-09-30;
  1. enrichment: public cards the caches hold slim (retail-id.py keeps dates
     only) — chemistry, package chain, recall flag and test state;
  2. packages that are likely internal: a found card's source package, the
     package a lab certificate says it sampled ("Seed to sale", "TEST PKG") —
     often a bulk or sample package never enrolled (23 of 25 and 17 of 17
     answered 404 on 2026-09-30), so after the sure things;
  3. re-observation: the public card observed live longest ago, so that a
     card that changes shows up in retail-history.json.
A raw menu package ID is discovery evidence only: retail-id.py asks each one
with its own recheck policy, and most answer 404 (pilot runs 1-8: 100 of 100).
A tag any collector has seen 404, and a tag known only from Lot Twins'
probing, is never asked here.
"""
import argparse
import hashlib
import json
import re
import subprocess
import time
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "data/forensics"
HISTORY = OUTDIR / "retail-history.json"
TAG = re.compile(r"^1A4[0-9A-F]{21}$")
LINK = re.compile(r"^https://1a4\.com/(\S+)$", re.I)
API = "https://app.1a4.com/api/landingpage/data"
PACE = 0.5          # seconds between live requests, as Lot Twins
ERRORS_IN_ROW = 5   # this many failed requests in a row end the live run
MENU_KEEP = 20      # shops / names kept per tag in its menu record
RECHECK_DAYS = 30   # a 404 this harvest got is asked again after this, as Lot Twins

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
# Retail ID totals are keyed, not labelled: thc, cbd, terpenes, cannabinoids,
# delta9thc. The last three are stored, but they are sums or a part of THC.
TOTALS = {
    "thc": "total_thc", "totalthc": "total_thc", "cbd": "total_cbd", "totalcbd": "total_cbd",
    "terpenes": "total_terpenes", "totalterpenes": "total_terpenes",
    "cannabinoids": "total_cannabinoids", "totalcannabinoids": "total_cannabinoids",
    "delta9thc": "delta_9_thc", "d9thc": "delta_9_thc",
}
# What the chemistry fingerprint hashes from totals. Lot Twins' cache keeps
# THC and CBD only, and one card must hash the same whichever collector read it.
FINGERPRINT_TOTALS = ("total_thc", "total_cbd")
# A source string that says the analyte was not quantified.
QUALIFIER = re.compile(r"^\s*(?:<|>|n\s*/\s*[dr]\b|n\.?\s*[dr]\.?(?![a-z])|not\s+(?:detected|reported)|loq\b|lod\b|bql\b)", re.I)

# Identity of a public card, as retail-history.json keeps it. A change in any
# of these between two observations of one tag is a new version.
IDENTITY = (
    "product", "strain", "category", "batchTag", "sourcePackage", "lotNumber",
    "facility", "facilityLicense", "manufacturer", "manufacturerLicense",
    "receivedFrom", "receivedFromLicense", "lab", "labLicense",
    "harvested", "tested", "packaged", "received", "cultivated",
    "isOnRecall", "labTestingState", "isProductionBatch",
)
FAMILIES = ("totals", "cannabinoids", "terpenes")
# Sources whose card carries chemistry and the package chain.
FULL = {"live", "lot-twins-cache"}


def load(path, default):
    try:
        return json.loads(path.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def norm_name(value):
    s = str(value or "").strip().lower()
    s = s.replace("α", "alpha").replace("β", "beta").replace("δ", "delta").replace("Δ", "delta")
    key = re.sub(r"[^a-z0-9]+", "", s)
    if key in ALIASES:
        return ALIASES[key]
    return re.sub(r"[^a-z0-9]+", "_", s).strip("_")


def total_name(value):
    key = re.sub(r"[^a-z0-9]+", "", str(value or "").lower().replace("δ", "delta").replace("Δ", "delta"))
    return TOTALS.get(key) or norm_name(value)


def number(value):
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        if QUALIFIER.match(value):
            return None  # "<0.01" is a bound, not a measurement
        m = re.search(r"-?\d+(?:\.\d+)?", value.replace(",", ""))
        return float(m.group()) if m else None
    return None


def measurement(value, qualifier=None):
    """One value as the source gave it, or None when there is nothing to keep.

    A bare 0 is not a measurement: a Retail ID card carries a fixed slate of
    twenty terpenes and fills the ones the certificate lacks with 0, so two
    unrelated cards share a dozen zeros. It is kept as a qualifier, never as a
    value a detector could match on — as are ND, <LOQ and the like."""
    if qualifier is None and isinstance(value, str) and QUALIFIER.match(value):
        qualifier = value.strip()
    n = number(value)
    if n is None:
        return {"value": None, "qualifier": qualifier} if qualifier else None
    if n == 0 and not qualifier:
        return {"value": None, "qualifier": "reported_zero"}
    return {"value": round(n, 6), "qualifier": qualifier}


def measurement_map(raw, totals=False):
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
            text = item.get("qualifier") or item.get("resultText")
            qualifier = text if isinstance(text, str) and QUALIFIER.match(text) else None
        else:
            value = item
        name = total_name(label) if totals else norm_name(label)
        m = measurement(value, qualifier)
        if name and m:
            out[name] = m
    return dict(sorted(out.items()))


def day(value):
    return value[:10] if isinstance(value, str) and re.match(r"\d{4}-\d{2}-\d{2}", value) else None


def compact(data, tag):
    coa = (data.get("coaCard") or {}).get("data") or {}
    while isinstance(coa, str):
        coa = json.loads(coa)
    if isinstance(coa, list):
        coa = coa[0] if coa else {}
    if not isinstance(coa, dict):
        coa = {}
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
        "category": coa.get("category"),
        "batchTag": coa.get("batchTag"),
        "sourcePackage": coa.get("sourcePackage"),
        "lotNumber": coa.get("lotNumber"),
        "harvested": day(coa.get("harvestDate")),
        "tested": day(coa.get("testedDate") or coa.get("dateTested")),
        "packaged": day(coa.get("packagedDate") or coa.get("packageDate")),
        "received": day(coa.get("receivedDateTime")),
        # Metrc's cultivationDate is kept as evidence and never read as a
        # harvest: on Fela's Farm's Applescotti (1A41203000004F0000000735) it
        # is the packaging day, two months after the batch's test.
        "cultivated": day(coa.get("cultivationDate")),
        "lab": lab.get("name") if isinstance(lab, dict) else lab,
        "labLicense": lab.get("licenseNumber") if isinstance(lab, dict) else None,
        "manufacturer": manufacturer.get("name") if isinstance(manufacturer, dict) else None,
        "manufacturerLicense": manufacturer.get("licenseNumber") if isinstance(manufacturer, dict) else None,
        "receivedFrom": coa.get("receivedFromFacilityName"),
        "receivedFromLicense": coa.get("receivedFromFacilityLicenseNumber"),
        "isOnRecall": data.get("isOnRecall"),
        "labTestingState": coa.get("labTestingStateName"),
        "isProductionBatch": coa.get("isProductionBatch"),
        "totals": measurement_map(coa.get("totals") or {}, totals=True),
        "cannabinoids": measurement_map(coa.get("cannabinoids") or coa.get("cannabinoid") or {}),
        "terpenes": measurement_map(coa.get("terpenes") or {}),
    }


def positives(card, family):
    """Measured values of one family: numeric, positive, no qualifier."""
    out = {}
    for k, v in (card.get(family) or {}).items():
        x = v.get("value") if isinstance(v, dict) else v
        q = v.get("qualifier") if isinstance(v, dict) else None
        if isinstance(x, (int, float)) and not isinstance(x, bool) and x > 0 and not q:
            out[k] = float(x)
    return out


def fingerprint(card):
    """Stable chemistry fingerprint. Identity fields are intentionally excluded,
    and so is anything that is not a measured value (qualifiers, reported
    zeros) or that one collector keeps and another does not (see
    FINGERPRINT_TOTALS). Values are written to 1e-4 %, Lot Twins' cache
    precision, so a card hashes the same from either collector; stored values
    keep the source's precision."""
    chemistry = {}
    for family in FAMILIES:
        vals = positives(card, family)
        if family == "totals":
            vals = {k: v for k, v in vals.items() if k in FINGERPRINT_TOTALS}
        chemistry[family] = {k: round(v, 4) for k, v in sorted(vals.items())}
    payload = json.dumps(chemistry, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(payload.encode()).hexdigest(), chemistry


def discovered():
    """Every known package tag → its discovery origins, and what the caches know.

    Origins: flower-listings (a menu printed the tag), flower-listings:retail-link
    (a menu printed a 1a4.com link that resolves to it), retail-id-cache and
    lot-twins-cache (a collector holds an answer for it), card:source-package
    (a found public card names it as its source package), coa:retail-id-page
    (a shop's "COA" link is a saved Retail ID page of it), coa:tested-package
    (a lab certificate names it as the package sampled: Kaycha's "Seed to
    sale", TagLeaf's "TEST PKG"), lot-twins:probe-only
    (inferred: Lot Twins holds it and nothing else points at it — its
    neighbour probing, or a menu tag no longer printed; Lot Twins does not
    record which). State: "found", "missing" (a collector got 404) or None."""
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
    state = {}
    twins = load(ROOT / "data/lot-twins.json", {}).get("cards") or {}
    for origin, cards in (("retail-id-cache", retail.get("packages") or {}), ("lot-twins-cache", twins)):
        for tag, card in cards.items():
            tag = str(tag).upper()
            if not TAG.match(tag) or not isinstance(card, dict):
                continue
            sources[tag].add(origin)
            if card.get("found") is True:
                state[tag] = "found"
            elif card.get("found") is False and state.get(tag) != "found":
                state[tag] = "missing"
            src = str(card.get("sourcePackage") or "").upper()
            if card.get("found") and TAG.match(src):
                sources[src].add("card:source-package")
    for doc in (load(OUTDIR / "coa-index.json", {}).get("documents") or {}).values():
        for v in doc.get("versions") or []:
            record = v.get("record") or {}
            tag = str(record.get("metrcTag") or "").upper()
            if TAG.match(tag):
                page = record.get("docType") == "metrc-retail-id"
                sources[tag].add("coa:retail-id-page" if page else "coa:tested-package")
    for origins in sources.values():
        if origins == {"lot-twins-cache"}:
            origins.add("lot-twins:probe-only")
    return sources, state


LEAD_ORIGINS = {"flower-listings:retail-link", "coa:retail-id-page", "card:source-package", "coa:tested-package"}
# Leads that are, by what points at them, public cards; the rest are often
# internal packages and wait until the slim cards are enriched.
PAGE_LEADS = {"flower-listings:retail-link", "coa:retail-id-page"}


def live_eligible(origins, state=None):
    """May the live harvest ask Retail ID about this tag?

    Only with evidence that the tag is a public Retail ID card: one a
    collector already found (enrichment, re-observation), or a lead a public
    source points at. A tag any collector has seen 404 is never asked here —
    retail-id.py and Lot Twins own their recheck policies — and a raw menu
    package ID or a Lot Twins probe is discovery evidence only."""
    if state == "missing":
        return False
    if state == "found":
        return True
    return bool(set(origins or ()) & LEAD_ORIGINS)


def last_live(entry):
    days = [v.get("lastSeen") for v in (entry or {}).get("versions") or [] if "live" in (v.get("sources") or [])]
    return max(days) if days else None


def resting(history, today):
    """Tags this harvest got 404 for within RECHECK_DAYS: not asked again yet."""
    cutoff = (date.fromisoformat(today) - timedelta(days=RECHECK_DAYS)).isoformat()
    return {tag for tag, e in ((history or {}).get("tags") or {}).items()
            if any((e.get(k) or {}).get("last", "") > cutoff for k in ("missing", "notPublic"))}


def plan_live(sources, state, history, full_tags, rest=()):
    """Ordered live queue [(tag, tier)]: leads a page points at, enrichment,
    source packages, re-observation."""
    tags = (history or {}).get("tags") or {}
    leads, enrich, source, reobserve = [], [], [], []
    for tag, origins in sources.items():
        st = state.get(tag)
        if tag in rest or not live_eligible(origins, st):
            continue
        if st != "found":
            (leads if set(origins) & PAGE_LEADS else source).append(tag)
        elif tag not in full_tags and last_live(tags.get(tag)) is None:
            enrich.append(tag)
        else:
            reobserve.append(tag)
    reobserve.sort(key=lambda t: (last_live(tags.get(t)) or "", t))
    return ([(t, "lead") for t in sorted(leads)] + [(t, "enrich") for t in sorted(enrich)]
            + [(t, "source") for t in sorted(source)] + [(t, "reobserve") for t in reobserve])


# ------------------------------------------------------------------ history

def _cmp(value):
    return " ".join(value.split()).casefold() if isinstance(value, str) else value


def chemistry_of(card):
    return {f: dict(card.get(f) or {}) for f in FAMILIES if card.get(f)}


def chemistry_changes(old, new):
    """Analytes measured in both observations whose values differ (at 1e-4 %)."""
    out = {}
    for family in FAMILIES:
        a, b = positives(old, family), positives(new, family)
        for k in sorted(a.keys() & b.keys()):
            if round(a[k], 4) != round(b[k], 4):
                out[f"{family}.{k}"] = [a[k], b[k]]
    return out


def identity_hash(identity):
    return hashlib.sha256(json.dumps({k: _cmp(v) for k, v in sorted(identity.items())},
                                     sort_keys=True, ensure_ascii=True).encode()).hexdigest()


def observe(history, tag, card, source, observed, response_sha=None):
    """Record one observation of a public card; return the fields it changed.

    The first observation opens the tag's history. A later one that agrees
    with the latest version on every field both know confirms it (and fills
    fields it lacked: a slim card does not contradict a full one). One that
    disagrees appends a new version holding what changed — the old version is
    never rewritten. An observation older than the latest version is a stale
    cache snapshot: it can confirm, never reopen, a superseded identity."""
    tags = history.setdefault("tags", {})
    identity = {f: card.get(f) for f in IDENTITY if card.get(f) not in (None, "")}
    chemistry = chemistry_of(card)
    entry = tags.setdefault(tag, {"firstSeen": observed, "lastSeen": observed})
    if source == "live" and "missing" in entry:
        entry["missingBefore"] = entry.pop("missing")  # public again
    entry["firstSeen"] = min(entry.get("firstSeen") or observed, observed)
    entry["lastSeen"] = max(entry.get("lastSeen") or observed, observed)
    versions = entry.setdefault("versions", [])

    def version(changed=None):
        v = {"observedAt": observed, "lastSeen": observed, "sources": [source],
             "identity": identity, "identityHash": identity_hash(identity), "chemistry": chemistry}
        if response_sha:
            v["responseSha256"] = response_sha
        if changed:
            v["changed"] = changed
        versions.append(v)

    if not versions:
        version()
        return []
    latest = versions[-1]
    changed = {f: [latest["identity"][f], v] for f, v in identity.items()
               if f in latest["identity"] and _cmp(latest["identity"][f]) != _cmp(v)}
    changed.update(chemistry_changes(latest.get("chemistry") or {}, chemistry))
    if changed:
        if observed < latest["observedAt"]:
            return []
        version(changed)
        return sorted(changed)
    for f, v in identity.items():
        latest["identity"].setdefault(f, v)
    for family, vals in chemistry.items():
        known = latest.setdefault("chemistry", {}).setdefault(family, {})
        for k, v in vals.items():
            known.setdefault(k, v)
    latest["identityHash"] = identity_hash(latest["identity"])
    latest["lastSeen"] = max(latest["lastSeen"], observed)
    if source not in latest["sources"]:
        latest["sources"] = sorted(latest["sources"] + [source])
    if response_sha:
        latest["responseSha256"] = response_sha
    return []


def observe_missing(history, tag, observed):
    """A card once found now answers 404: kept on the tag, never dropped."""
    entry = history.setdefault("tags", {}).setdefault(tag, {"firstSeen": observed, "lastSeen": observed})
    gone = entry.setdefault("missing", {"first": observed, "last": observed})
    gone["last"] = observed


def observe_not_public(history, tag, observed):
    """A lead that answered 404: remembered so it rests RECHECK_DAYS."""
    entry = history.setdefault("tags", {}).setdefault(tag, {})
    gone = entry.setdefault("notPublic", {"first": observed, "last": observed})
    gone["last"] = observed


def observe_menu(history, tag, observed, shop, name):
    entry = history.setdefault("tags", {}).setdefault(tag, {})
    menu = entry.setdefault("menu", {"firstSeen": observed, "lastSeen": observed, "shops": [], "names": []})
    menu["firstSeen"] = min(menu["firstSeen"], observed)
    menu["lastSeen"] = max(menu["lastSeen"], observed)
    for key, value in (("shops", shop), ("names", name)):
        if value and value not in menu[key] and len(menu[key]) < MENU_KEEP:
            menu[key] = sorted(menu[key] + [value])


def menu_rows(rows, links):
    """(tag, day, shop, 'brand | name') for every package tag a menu prints."""
    for row in rows:
        observed = str(row.get("capturedAt") or "")[:10] or None
        name = " | ".join(str(x) for x in (row.get("brand"), row.get("strainNameRaw")) if x)
        for raw in row.get("packageIds") or []:
            text = str(raw).strip()
            tag = text.upper()
            if not TAG.match(tag):
                tag = str(links.get(text.upper()) or "").upper() if LINK.match(text) else ""
            if TAG.match(tag) and observed:
                yield tag, observed, row.get("licenseNumber"), name


def source_url(tag):
    return f"{API}?id={tag.lower()}&index=0"


def history_card(tag, entry):
    """The tag's latest version as a card when a live read is part of it, or
    None: then the caches' card is the newest there is."""
    versions = (entry or {}).get("versions") or []
    if not versions or "live" not in (versions[-1].get("sources") or []):
        return None
    v = versions[-1]
    card = {"tag": tag, "found": True, **v.get("identity", {}), **v.get("chemistry", {})}
    card.update(observedAt=v.get("lastSeen"), observedVia="live")
    if v.get("responseSha256"):
        card["responseSha256"] = v["responseSha256"]
    return card


def cached_cards():
    """[(tag, card, source)] for every found card in the collectors' caches:
    Retail ID's slim cards, then Lot Twins' full ones."""
    out = []
    retail = load(ROOT / "data/retail-id.json", {})
    for tag, card in (retail.get("packages") or {}).items():
        if card.get("found"):
            c = dict(card)
            c["tag"] = tag.upper()
            for family in FAMILIES:
                c.setdefault(family, {})
            out.append((tag.upper(), c, "retail-id-cache"))
    twins = load(ROOT / "data/lot-twins.json", {})
    for tag, card in (twins.get("cards") or {}).items():
        if card.get("found"):
            c = dict(card)
            c["tag"] = tag.upper()
            # Old cache has exact terpenes but not normalized measurement objects.
            c["terpenes"] = {norm_name(k): m for k, v in (c.get("terpenes") or {}).items()
                             if (m := measurement(v))}
            totals = {}
            for key, field in (("total_thc", "thc"), ("total_cbd", "cbd"), ("total_terpenes", "totalTerpenes")):
                m = measurement(c.get(field))
                if m:
                    totals[key] = m
            c["totals"] = totals
            c.setdefault("cannabinoids", {})
            out.append((tag.upper(), c, "lot-twins-cache"))
    return out


def fetch_live(tag):
    """(card, response SHA-256 of the raw bytes). curl, as retail-id.py: it goes
    through the sandbox proxy."""
    run = subprocess.run(["curl", "-sS", "-m", "30", "-w", "\n%{http_code}", source_url(tag)], capture_output=True)
    body, _, code = run.stdout.rpartition(b"\n")
    code = code.decode(errors="replace").strip()
    if code == "404":
        return {"tag": tag, "found": False}, None
    if code != "200":
        return {"tag": tag, "found": None, "error": f"HTTP {code or 'none'}"}, None
    try:
        return compact(json.loads(body.decode("utf-8")), tag), hashlib.sha256(body).hexdigest()
    except Exception as exc:
        return {"tag": tag, "found": None, "error": f"{type(exc).__name__}: {str(exc)[:100]}"}, None


def write_jsonl(path, rows):
    path.write_text("".join(json.dumps(r, ensure_ascii=False, sort_keys=True) + "\n" for r in rows))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--network", action="store_true", help="fetch public Retail ID cards and leads")
    ap.add_argument("--budget", type=int, default=100, help="maximum live requests; no tag guessing")
    args = ap.parse_args()
    OUTDIR.mkdir(parents=True, exist_ok=True)
    today = date.today().isoformat()

    restored = HISTORY.exists()
    history = json.loads(HISTORY.read_text()) if restored else {}  # unreadable history stops the run
    history.setdefault("tags", {})
    sources, state = discovered()
    cached = cached_cards()
    # Oldest snapshot first, so a cache that saw a card before it changed
    # opens the history and the newer one records the change.
    for tag, card, origin in sorted(cached, key=lambda x: (x[1].get("checked") or today, x[2], x[0])):
        observe(history, tag, card, origin, card.get("checked") or today)
    retail = load(ROOT / "data/retail-id.json", {})
    links = {str(k).upper(): v for k, v in retail.get("links", {}).items()}
    listings = load(ROOT / "data/flower-listings.json", [])
    rows = listings if isinstance(listings, list) else listings.get("listings", [])
    for tag, observed, shop, name in menu_rows(rows, links):
        observe_menu(history, tag, observed, shop, name)

    full_tags = {t for t, _c, origin in cached if origin in FULL}
    rest = resting(history, today)
    queue = plan_live(sources, state, history, full_tags, rest)
    pool = defaultdict(int)
    for _tag, tier in queue:
        pool[tier] += 1
    requested = found = missing = errors = in_row = 0
    by_tier = defaultdict(int)
    stopped = False
    live = {}
    if args.network:
        for tag, tier in queue[:max(0, args.budget)]:
            if in_row >= ERRORS_IN_ROW:
                stopped = True
                break
            if requested:
                time.sleep(PACE)
            requested += 1
            by_tier[tier] += 1
            card, sha = fetch_live(tag)
            if card.get("found") is True:
                in_row = 0
                found += 1
                live[tag] = card
                observe(history, tag, card, "live", today, sha)
            elif card.get("found") is False:
                in_row = 0
                missing += 1
                if state.get(tag) == "found":
                    observe_missing(history, tag, today)
                else:
                    observe_not_public(history, tag, today)
            else:
                in_row += 1
                errors += 1

    cards = {}
    for tag, card, origin in cached:  # Lot Twins' full card lands over the slim one
        cards[tag] = {**cards.get(tag, {}), **card, "observedAt": card.get("checked"), "observedVia": origin}
    for tag, entry in history["tags"].items():
        c = history_card(tag, entry)
        if c:
            cards[tag] = {**cards.get(tag, {}), **c}
    for tag in cards:
        cards[tag]["sourceUrl"] = source_url(tag)

    evidence, fps = [], []
    for tag in sorted(cards):
        card = cards[tag]
        row = {**card, "discoveredFrom": sorted(sources.get(tag, []))}
        row.pop("checked", None)
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

    history["about"] = ("Every distinct identity each public Retail ID card has shown (versions), "
                        "and the days menus printed each tag (menu). Written by scripts/forensic-harvest.py; "
                        "old versions are never rewritten.")
    history["day"] = today
    history["tags"] = dict(sorted(history["tags"].items()))
    HISTORY.write_text(json.dumps(history, ensure_ascii=False, indent=1, sort_keys=False) + "\n")
    write_jsonl(OUTDIR / "retail-cards.jsonl", evidence)
    write_jsonl(OUTDIR / "fingerprints.jsonl", fps)
    entries = history["tags"].values()
    public = [e for e in entries if e.get("versions")]
    firsts = [e["firstSeen"] for e in public if e.get("firstSeen")]
    run_state = {
        "day": today, "knownTags": len(sources), "cards": len(evidence),
        "fingerprints": len(fps), "network": {
            "enabled": args.network, "budget": args.budget, "requested": requested,
            "found": found, "notFound": missing, "errors": errors,
            "stoppedAfterErrors": stopped, "byTier": dict(by_tier), "pool": dict(pool),
            "eligibleKnownTags": sum(1 for t, o in sources.items() if live_eligible(o, state.get(t))),
            "skippedKnown404": sum(1 for t in sources if state.get(t) == "missing"),
            "skippedRawDiscovery": sum(1 for t, o in sources.items()
                                       if state.get(t) is None and not live_eligible(o, None)),
            "probeOnly": sum(1 for o in sources.values() if "lot-twins:probe-only" in o),
            "resting404": len(rest & set(sources)),
        },
        "history": {
            "restored": restored, "since": min(firsts) if firsts else None,
            "publicCards": len(public), "versions": sum(len(e["versions"]) for e in public),
            "changedCards": sum(1 for e in public if len(e["versions"]) > 1),
            "noLongerPublic": sum(1 for e in public if e.get("missing")),
            "tagsOnMenus": sum(1 for e in entries if e.get("menu")),
        },
        "about": "Forensic evidence layer. Known tags only; discovery provenance retained; no sequential tag guessing.",
    }
    (OUTDIR / "harvest-state.json").write_text(json.dumps(run_state, ensure_ascii=False, indent=1) + "\n")
    print(f"forensics: {len(sources)} known tags, {len(evidence)} cards, {len(fps)} fingerprints; "
          f"network {requested} requests/{found} found/{missing} 404/{errors} errors "
          f"(queue: {pool.get('lead', 0)} leads, {pool.get('enrich', 0)} to enrich, {pool.get('source', 0)} "
          f"source packages, {pool.get('reobserve', 0)} to re-observe); history {'restored' if restored else 'new'}, "
          f"{run_state['history']['changedCards']} changed cards")


if __name__ == "__main__":
    main()
