#!/usr/bin/env python3
"""Forensic cases: every detector's candidates as one reviewable list.

    python scripts/forensic-cases.py                    # data/forensics/cases.json
    python scripts/forensic-cases.py --dossier FX-...   # one case as markdown

Reads data/forensics/ (retail-cards.jsonl, retail-history.json, coa-index.json,
collisions.json), data/shelf-terpenes.json (which lots cite which certificate)
and data/forensic-reviews.json (people's verification — committed, edited by
hand). A case is a candidate relationship with what it takes to reproduce it:
the IDs, the values compared, the source URLs, why it fired and what it cannot
tell. It is never a finding of misconduct: bulk flower is legally repacked and
sold under other names, and nothing here says fraud.

verificationStatus is "candidate" unless data/forensic-reviews.json records
"source_verified" (checked against the original Retail ID card or
certificate), "externally_confirmed" (an official record says so) or
"dismissed" (a person judged it benign). A recall flag on a Retail ID card is
itself the official record.

Signals:
  SAME_BATCH_DIFFERENT_NAME   one Metrc batch under names Lot Twins' rules keep
                              apart, with one certificate (lab, test day, THC
                              agree). One batch number over different
                              certificates is a packager's production lot:
                              MIXED_BATCH, review only (Lot Twins' mixedBatches).
  RENAMED_IN_LINEAGE          a package made from another (its sourcePackage)
                              under another name.
  CHEMICAL_CLONE              collisions.json without a shared batch.
  SAME_COA_DIFFERENT_IDENTITY one certificate — one URL, or one document by
                              SHA-256 at several URLs — cited for lots whose
                              names differ and whose THC agree.
  COA_MISATTACHED             the same, with THC that differ: a shop linked
                              another lot's certificate (review; a data error).
  COA_MUTATION                one certificate URL served another document.
  RETAIL_ID_MUTATION          one Retail ID card showed another identity, or
                              stopped answering.
  IMPOSSIBLE_TIMELINE         dates on one card, or one certificate, that
                              cannot be in that order. Deterministic rules
                              only; a long gap is not here (Lot Twins' old
                              tests, SŌMA's freshness).
  RECALL_FLAG                 a Retail ID card says the package is on recall.
"""
import argparse
import hashlib
import importlib.util
import json
import sys
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FDIR = ROOT / "data/forensics"
OUT = FDIR / "cases.json"
REVIEWS = ROOT / "data/forensic-reviews.json"
LOTS = ROOT / "data/shelf-terpenes.json"
STATUSES = ("candidate", "source_verified", "externally_confirmed", "dismissed")
PRIORITY = {"high": 0, "medium": 1, "review": 2}
THC_SAME = 0.01  # one certificate prints one THC figure
# Retail ID fields whose change on one card is material, not cosmetic.
MATERIAL = {"strain", "product", "batchTag", "sourcePackage", "lotNumber", "lab", "tested", "packaged",
            "harvested", "manufacturerLicense", "facilityLicense", "labTestingState"}


def _module(name):
    spec = importlib.util.spec_from_file_location(name.replace("-", "_"), ROOT / f"scripts/{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


lt = _module("lot-twins")
fh = _module("forensic-harvest")


def load(path, default):
    try:
        return json.loads(path.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def load_jsonl(path):
    try:
        return [json.loads(x) for x in path.read_text().splitlines() if x.strip()]
    except FileNotFoundError:
        return []


def case_id(key):
    return "FX-" + hashlib.sha256(key.encode()).hexdigest()[:10].upper()


def name_of(x):
    return (x or {}).get("strain") or (x or {}).get("product")


def same_name(a, b):
    return lt.same_name(lt.norm_name(a), lt.norm_name(b))


def clusters(named):
    """[(id, name)] → groups of ids whose names Lot Twins folds into one."""
    items = [(i, [lt.norm_name(n)]) for i, n in named if n]
    return lt.name_clusters(items)


def thc_of(card):
    v = (card.get("totals") or {}).get("total_thc")
    v = v.get("value") if isinstance(v, dict) and not v.get("qualifier") else v
    if not isinstance(v, (int, float)):
        v = card.get("thc")
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) and v > 0 else None


def entity(card, history):
    """What a case shows of one package."""
    tag = card.get("tag")
    entry = (history.get("tags") or {}).get(tag) or {}
    out = {k: card.get(k) for k in (
        "tag", "strain", "product", "facility", "facilityLicense", "manufacturer", "manufacturerLicense",
        "receivedFrom", "batchTag", "sourcePackage", "lotNumber", "lab", "tested", "packaged", "harvested",
        "isOnRecall", "labTestingState", "observedAt", "observedVia", "responseSha256") if card.get(k) not in (None, "")}
    out["thc"] = thc_of(card)
    out["sourceUrl"] = fh.source_url(tag)
    if entry.get("menu"):
        out["menu"] = entry["menu"]
    if len(entry.get("versions") or []) > 1:
        out["cardVersions"] = len(entry["versions"])
    return out


def seen_span(entities):
    days = []
    for e in entities:
        days += [e.get("observedAt")] + [(e.get("menu") or {}).get(k) for k in ("firstSeen", "lastSeen")]
    days = sorted(d for d in days if d)
    return (days[0], days[-1]) if days else (None, None)


def base(key, signal, priority, summary, entities, **extra):
    first, last = seen_span(entities)
    case = {"caseId": case_id(key), "signals": [signal], "priority": priority, "verificationStatus": "candidate",
            "summary": summary, "entities": entities, "firstSeen": first, "lastSeen": last}
    case.update({k: v for k, v in extra.items() if v not in (None, [], {})})
    return case


# ---------------------------------------------------------------- batches and lineage

def certificate(cards):
    """Do the cards carry one certificate? True / False / None (cannot tell):
    lab, test day and THC must agree wherever two cards know them."""
    known = 0
    for field in ("lab", "tested", "thc"):
        vals = [thc_of(c) if field == "thc" else fh._cmp(c.get(field)) for c in cards]
        vals = [v for v in vals if v is not None]
        if len(vals) < 2:
            continue
        known += 1
        if field == "thc" and max(vals) - min(vals) > THC_SAME:
            return False
        if field != "thc" and len(set(vals)) > 1:
            return False
    return True if known else None


def lineage_edges(cards):
    """Every package → its sourcePackage, where both are public cards."""
    out = []
    for tag, c in sorted(cards.items()):
        src = str(c.get("sourcePackage") or "").upper()
        if src and src != tag and src in cards:
            p = cards[src]
            out.append({"from": src, "to": tag, "fromName": name_of(p), "toName": name_of(c),
                        "renamed": bool(name_of(p) and name_of(c) and not same_name(name_of(p), name_of(c)))})
    return out


def batch_cases(cards, history, collisions):
    by_batch = defaultdict(list)
    for tag, c in cards.items():
        if c.get("batchTag"):
            by_batch[str(c["batchTag"]).upper()].append(tag)
    edges = lineage_edges(cards)
    chem = defaultdict(list)
    for hit in collisions:
        if hit.get("sameBatch"):
            chem[str(hit["a"].get("batchTag") or "").upper()].append(hit)
    out, covered = [], set()
    for batch, tags in sorted(by_batch.items()):
        groups = clusters([(t, name_of(cards[t])) for t in tags])
        if len(groups) < 2:
            continue
        members = [cards[t] for t in sorted(tags)]
        cert = certificate(members)
        names = sorted({name_of(c) for c in members if name_of(c)}, key=str.casefold)
        batch_edges = [e for e in edges if e["to"] in tags or e["from"] in tags]
        covered |= {(e["from"], e["to"]) for e in batch_edges}
        ents = [entity(c, history) for c in members]
        signals = []
        if cert is False:
            signal, priority = "MIXED_BATCH", "review"
            why = f"batch {batch} carries {len(groups)} names over different certificates (a packager's production lot)"
        else:
            signal = "SAME_BATCH_DIFFERENT_NAME"
            priority = "high" if cert else "medium"
            why = (f"one Metrc batch {batch} is sold as {' / '.join(names)}"
                   + ("" if cert else " (certificate not confirmed: lab, test day or THC unknown)"))
        if any(e["renamed"] for e in batch_edges):
            signals.append("RENAMED_IN_LINEAGE")
        hits = chem.get(batch) or []
        if hits:
            signals.append("CHEMICAL_CLONE")
        best = max(hits, key=lambda h: h["commonAnalytes"]) if hits else None
        case = base(f"batch|{batch}", signal, priority, why, ents, batch=batch, lineage=batch_edges,
                    chemistry={"commonAnalytes": best["commonAnalytes"], "matches": best["matchedAnalytes"],
                               "signal": best["signal"],
                               "note": "Entailed by the shared batch: Retail ID shows the batch's certificate on "
                                       "every package, so equal chemistry is the same test, not a second proof."}
                    if best else None,
                    sources=sorted({e["sourceUrl"] for e in ents}),
                    confidence=("Metrc identifiers: the batch tag and the package chain are the regulator's "
                                "records, stronger than any chemistry match.") if priority != "review" else None,
                    limitations=["A batch can legitimately be repacked and sold under other names; the case says "
                                 "the names differ, not why.",
                                 "Retail ID shows what the packager entered in Metrc."])
        case["signals"] += signals
        out.append(case)
    for e in edges:
        if not e["renamed"] or (e["from"], e["to"]) in covered:
            continue
        ents = [entity(cards[e["from"]], history), entity(cards[e["to"]], history)]
        out.append(base(f"lineage|{e['from']}|{e['to']}", "RENAMED_IN_LINEAGE", "medium",
                        f"package {e['to']} ({e['toName']}) was made from {e['from']} ({e['fromName']})",
                        ents, lineage=[e], sources=sorted({x["sourceUrl"] for x in ents}),
                        limitations=["Names in a package chain can be product names, not plant names."]))
    return out


def batch_of(side, cards):
    """A collision side's Metrc batch: a card's own, or — for a certificate
    that prints its package tag — that package's card's."""
    tag = side.get("id") if side.get("kind") == "retail" else side.get("metrcTag")
    return str((cards.get(tag) or {}).get("batchTag") or side.get("batchTag") or "").upper() or None


def chemistry_cases(cards, history, collisions):
    out = []
    for hit in collisions:
        if hit.get("sameBatch") or hit.get("priority") == "review":
            continue
        ba, bb = batch_of(hit["a"], cards), batch_of(hit["b"], cards)
        if ba and ba == bb:
            continue  # one batch: its batch case holds the relationship
        ents, urls = [], set()
        for side in (hit["a"], hit["b"]):
            if side.get("kind") == "retail" and side.get("id") in cards:
                ents.append(entity(cards[side["id"]], history))
                urls.add(fh.source_url(side["id"]))
            else:
                ents.append({k: v for k, v in side.items() if v not in (None, "")})
                if side.get("url"):
                    urls.add(side["url"])
        key = "chem|" + "|".join(sorted(str(s.get("id")) for s in (hit["a"], hit["b"])))
        out.append(base(key, "CHEMICAL_CLONE", hit["priority"],
                        f"{name_of(hit['a']) or hit['a'].get('id')} and {name_of(hit['b']) or hit['b'].get('id')}: "
                        f"{hit['commonAnalytes']} analytes equal within tolerance ({hit['signal']})",
                        ents, chemistry={"commonAnalytes": hit["commonAnalytes"], "matches": hit["matchedAnalytes"],
                                         "signal": hit["signal"]},
                        sources=sorted(urls),
                        limitations=["Chemistry without a shared identifier: a processor's templated panel or "
                                     "one certificate reused by a packager looks the same (see SŌMA's "
                                     "SHELF-MEASUREMENTS on 1Off, Excelsior Legacy, HM OPS)."]))
    return out


# ---------------------------------------------------------------- certificates

def lots_by_certificate(lots):
    by = defaultdict(list)
    for lot in lots:
        for url in lot.get("certificates") or []:
            by[url].append(lot)
    return by


def lot_entity(lot):
    return {k: lot.get(k) for k in ("brand", "strain", "thcPercent", "firstOnShelf", "lastSeen") if lot.get(k)} | \
        {"shops": len(lot.get("shops") or [])}


def coa_cases(lots, coa, cards, history):
    out = []
    by_url = lots_by_certificate(lots)
    docs = coa.get("documents") or {}
    by_sha = defaultdict(set)
    for url, doc in docs.items():
        for v in doc.get("versions") or []:
            if v.get("sha256"):
                by_sha[v["sha256"]].add(url)
    # One document (same bytes) behind several URLs, or one URL: the lots it serves.
    groups = [("coa-sha|" + sha, sorted(urls), sha) for sha, urls in by_sha.items() if len(urls) > 1]
    grouped = {u for _k, urls, _s in groups for u in urls}
    groups += [("coa-url|" + url, [url], None) for url in by_url if url not in grouped]
    for key, urls, sha in groups:
        cited = list({(lot.get("brand"), lot.get("strain"), lot.get("thcPercent")): lot
                      for u in urls for lot in by_url.get(u, [])}.values())
        named = [(f"{lot.get('brand')}|{lot.get('strain')}|{lot.get('thcPercent')}", lot.get("strain")) for lot in cited]
        if len(clusters(named)) < 2:
            continue
        names = sorted({lot.get("strain") for lot in cited if lot.get("strain")}, key=str.casefold)
        where = f" ({len(urls)} URLs, one document)" if sha else ""
        thcs = [float(lot["thcPercent"]) for lot in cited if isinstance(lot.get("thcPercent"), (int, float))]
        if thcs and max(thcs) - min(thcs) > THC_SAME:
            # A certificate prints one THC: lots that print different ones
            # cannot all be its lot. A shop linked another lot's certificate.
            out.append(base(key, "COA_MISATTACHED", "review",
                            "one certificate cited for " + " / ".join(
                                f"{lot.get('strain')} ({lot.get('thcPercent')})" for lot in cited) + where,
                            [lot_entity(lot) for lot in cited], coa={"urls": urls, "sha256": sha}, sources=urls,
                            limitations=["The lots' THC differ, so at least one lot's link or THC belongs to "
                                         "another lot: a data error on the shelves, not one batch under two "
                                         "names. The lot it misleads is not traceable by that link."]))
            continue
        out.append(base(key, "SAME_COA_DIFFERENT_IDENTITY", "medium",
                        f"one certificate and one THC cited for {' / '.join(names)}{where}",
                        [lot_entity(lot) for lot in cited], coa={"urls": urls, "sha256": sha},
                        sources=urls,
                        limitations=["The link from a lot to its certificate is the shop's, not the regulator's; "
                                     "the case says the names differ under one certificate, not who attached it."]))
    # A certificate that names its tested package: that package's card calls it otherwise.
    for url, doc in docs.items():
        versions = doc.get("versions") or []
        rec = (versions[-1].get("record") or {}) if versions else {}
        tag = rec.get("metrcTag")
        if not tag or tag not in cards or rec.get("docType") == "metrc-retail-id":
            continue
        card_name = name_of(cards[tag])
        mismatched = [lot for lot in by_url.get(url, []) if card_name and lot.get("strain")
                      and not same_name(card_name, lot.get("strain"))]
        if mismatched:
            out.append(base(f"coa-tag|{url}", "SAME_COA_DIFFERENT_IDENTITY", "medium",
                            f"certificate of package {tag} ({card_name}) is cited for "
                            + " / ".join(sorted({lot['strain'] for lot in mismatched})),
                            [entity(cards[tag], history)] + [lot_entity(lot) for lot in mismatched],
                            coa={"urls": [url], "sha256": versions[-1].get("sha256")},
                            sources=[url, fh.source_url(tag)],
                            limitations=["The certificate's tested package can be a source package of the lot "
                                         "on the shelf; a renamed product is not a different plant by itself."]))
    return out


COA_FIELDS = ("docType", "lab", "sampleId", "batchTag", "lotNumber", "metrcTag", "sampled", "received",
              "reported", "packaged", "tested", "strain", "product", "moisture", "waterActivity")


def coa_diff(a, b):
    out = {f: [a.get(f), b.get(f)] for f in COA_FIELDS if a.get(f) != b.get(f)}
    aa, ba = a.get("analytes") or {}, b.get("analytes") or {}
    for k in sorted(aa.keys() | ba.keys()):
        x, y = (aa.get(k) or {}).get("value"), (ba.get(k) or {}).get("value")
        qx, qy = (aa.get(k) or {}).get("qualifier"), (ba.get(k) or {}).get("qualifier")
        if (x, qx) != (y, qy):
            out[f"analytes.{k}"] = [x if x is not None else qx, y if y is not None else qy]
    return out


def coa_mutation_cases(coa):
    out = []
    for url, doc in sorted((coa.get("documents") or {}).items()):
        versions = doc.get("versions") or []
        if len(versions) < 2:
            continue
        steps = []
        for a, b in zip(versions, versions[1:]):
            steps.append({"from": a.get("sha256"), "to": b.get("sha256"), "firstSeen": b.get("firstSeen"),
                          "sameText": a.get("textSha256") == b.get("textSha256"),
                          "changed": coa_diff(a.get("record") or {}, b.get("record") or {})})
        material = any(not s["sameText"] and s["changed"] for s in steps)
        priority = "high" if material else ("medium" if any(not s["sameText"] for s in steps) else "review")
        out.append(base(f"coa-mut|{url}", "COA_MUTATION", priority,
                        f"{url} served {len(versions)} documents"
                        + ("; parsed fields changed" if material else
                           "; text changed, parsed fields did not" if priority == "medium" else
                           "; bytes changed, text did not (re-rendered)"),
                        [], coa={"urls": [url], "versions": [{k: v.get(k) for k in ("sha256", "textSha256", "firstSeen",
                                                                                      "lastSeen", "bytes")}
                                                            for v in versions]},
                        changes=steps, sources=[url],
                        limitations=["The index keeps hashes, not the PDFs: the old document is proven by its "
                                     "SHA-256, and must be kept elsewhere to be shown."]))
    return out


def retail_mutation_cases(cards, history):
    out = []
    for tag, e in sorted((history.get("tags") or {}).items()):
        versions = e.get("versions") or []
        if len(versions) < 2 and not e.get("missing"):
            continue
        changes = [{"observedAt": v.get("observedAt"), "changed": v.get("changed")} for v in versions[1:]]
        fields = {"chemistry" if "." in f else f for c in changes for f in (c["changed"] or {})}
        cosmetic = all(f in ("strain", "product") and same_name(*(c["changed"] or {})[f])
                       for c in changes for f in (c["changed"] or {}) if f in ("strain", "product")) and \
            not (fields - {"strain", "product"})
        if e.get("missing") and not changes:
            priority, why = "review", f"Retail ID card {tag} stopped answering (404 since {e['missing']['first']})"
        elif fields & (MATERIAL | {"chemistry"}) and not cosmetic:
            priority, why = "high", f"Retail ID card {tag} changed {', '.join(sorted(fields))}"
        else:
            priority, why = "review", f"Retail ID card {tag} changed {', '.join(sorted(fields)) or 'spelling'}"
        ent = [entity(cards[tag], history)] if tag in cards else [{"tag": tag, "sourceUrl": fh.source_url(tag)}]
        out.append(base(f"rid-mut|{tag}", "RETAIL_ID_MUTATION", priority, why, ent,
                        changes=changes or None, missing=e.get("missing"), sources=[fh.source_url(tag)],
                        limitations=["A packager may correct a Metrc entry; the case says the public card changed, "
                                     "not why."]))
    return out


# ---------------------------------------------------------------- timeline and recall

def _after(a, b, slack=0):
    """Is day a later than day b (+slack days)?"""
    try:
        return date.fromisoformat(a) > date.fromisoformat(b) + timedelta(days=slack)
    except (TypeError, ValueError):
        return False


def card_timeline(card, menu=None):
    """Impossible orders on one Retail ID card, and the tag on a menu before
    its package existed. Metrc's cultivationDate is not read: it is not the
    harvest."""
    rules = []
    h, t, p, seen = card.get("harvested"), card.get("tested"), card.get("packaged"), card.get("observedAt")
    if h and t and _after(h, t):
        rules.append(("tested_before_harvest", {"harvested": h, "tested": t}))
    if h and p and _after(h, p):
        rules.append(("packaged_before_harvest", {"harvested": h, "packaged": p}))
    for field in ("harvested", "tested", "packaged", "received"):
        # A day's slack: Metrc dates are New York days, ours are UTC.
        if card.get(field) and seen and _after(card[field], seen, slack=1):
            rules.append((f"{field}_after_observed", {field: card[field], "observedAt": seen}))
    first = (menu or {}).get("firstSeen")
    if p and first and _after(p, first, slack=1):
        rules.append(("on_menu_before_packaged", {"packaged": p, "firstOnMenu": first}))
    return rules


def coa_timeline(record, fetched):
    """Impossible orders within one certificate."""
    rules = []
    s, r, rep = record.get("sampled"), record.get("received"), record.get("reported")
    if s and r and _after(s, r):
        rules.append(("received_before_sampled", {"sampled": s, "received": r}))
    if s and rep and _after(s, rep):
        rules.append(("reported_before_sampled", {"sampled": s, "reported": rep}))
    if r and rep and _after(r, rep):
        rules.append(("reported_before_received", {"received": r, "reported": rep}))
    for field in ("sampled", "received", "reported", "tested", "packaged"):
        if record.get(field) and fetched and _after(record[field], fetched, slack=1):
            rules.append((f"{field}_after_fetched", {field: record[field], "fetched": fetched}))
    return rules


def timeline_cases(cards, history, coa):
    out = []
    tags = history.get("tags") or {}
    for tag, card in sorted(cards.items()):
        for rule, dates in card_timeline(card, (tags.get(tag) or {}).get("menu")):
            out.append(base(f"time|{tag}|{rule}", "IMPOSSIBLE_TIMELINE", "medium",
                            f"{tag} ({name_of(card)}): {rule.replace('_', ' ')}", [entity(card, history)],
                            timeline={"rule": rule, **dates}, sources=[fh.source_url(tag)],
                            limitations=["A mistyped date in Metrc gives the same picture as a package from "
                                         "another batch."]))
    for url, doc in sorted((coa.get("documents") or {}).items()):
        for v in doc.get("versions") or []:
            for rule, dates in coa_timeline(v.get("record") or {}, v.get("firstSeen")):
                out.append(base(f"time|{url}|{v.get('sha256')}|{rule}", "IMPOSSIBLE_TIMELINE", "review",
                                f"certificate {url}: {rule.replace('_', ' ')}", [],
                                timeline={"rule": rule, **dates}, coa={"urls": [url], "sha256": v.get("sha256")},
                                sources=[url], limitations=["Dates read by a generic parser: check the PDF."]))
    return out


def recall_cases(cards, history):
    out = []
    for tag, card in sorted(cards.items()):
        if card.get("isOnRecall") is True:
            case = base(f"recall|{tag}", "RECALL_FLAG", "high", f"Retail ID shows package {tag} ({name_of(card)}) on recall",
                        [entity(card, history)], sources=[fh.source_url(tag)],
                        limitations=["The flag says the package is recalled, not why; OCM's notices say why."])
            case["verificationStatus"] = "externally_confirmed"
            out.append(case)
    return out


# ---------------------------------------------------------------- assembly

def reviews(path=REVIEWS):
    raw = load(path, {}).get("reviews") or {}
    for cid, r in raw.items():
        if r.get("status") not in STATUSES:
            raise SystemExit(f"{path.name}: {cid} has status {r.get('status')!r}; allowed: {', '.join(STATUSES)}")
    return raw


def build(cards, history, coa, collisions, lots, human):
    cases = (batch_cases(cards, history, collisions) + chemistry_cases(cards, history, collisions)
             + coa_cases(lots, coa, cards, history) + coa_mutation_cases(coa)
             + retail_mutation_cases(cards, history) + timeline_cases(cards, history, coa)
             + recall_cases(cards, history))
    by_tag = defaultdict(set)
    for c in cases:
        for e in c["entities"]:
            if e.get("tag"):
                by_tag[e["tag"]].add(c["caseId"])
    for c in cases:
        related = set().union(*(by_tag.get(e.get("tag"), set()) for e in c["entities"])) - {c["caseId"]}
        if related:
            c["related"] = sorted(related)
        review = human.get(c["caseId"])
        if review:
            c["verificationStatus"] = review["status"]
            c["review"] = review
    cases.sort(key=lambda c: (PRIORITY[c["priority"]], c["signals"][0], c["caseId"]))
    return cases


def dossier(case):
    """One case as markdown: what was compared, which IDs, values, URLs, why."""
    lines = [f"# {case['caseId']} — {', '.join(case['signals'])}", "",
             f"**{case['priority']}** · {case['verificationStatus']} · seen {case.get('firstSeen')} → {case.get('lastSeen')}",
             "", case["summary"], ""]
    if case.get("entities"):
        lines += ["## Packages", "", "| tag | name | facility | manufacturer | batch | source package | lab | tested | packaged | THC |",
                  "|---|---|---|---|---|---|---|---|---|---|"]
        for e in case["entities"]:
            lines.append("| " + " | ".join(str(e.get(k) or "") for k in (
                "tag", "strain", "facility", "manufacturer", "batchTag", "sourcePackage", "lab", "tested", "packaged", "thc")) + " |")
        menus = [(e["tag"], e["menu"]) for e in case["entities"] if e.get("menu")]
        if menus:
            lines += ["", "On menus:", ""] + [f"- `{t}` {m['firstSeen']} → {m['lastSeen']}: {', '.join(m['names'])}"
                                              for t, m in menus]
        lines.append("")
    if case.get("lineage"):
        lines += ["## Package chain", ""] + [f"- `{e['from']}` ({e['fromName']}) → `{e['to']}` ({e['toName']})"
                                             + (" — **renamed**" if e["renamed"] else "") for e in case["lineage"]] + [""]
    if case.get("chemistry"):
        ch = case["chemistry"]
        lines += ["## Chemistry", "", f"{ch['commonAnalytes']} shared analytes ({ch['signal']}). {ch.get('note', '')}", "",
                  "| analyte | a | b | Δ | tolerance |", "|---|---|---|---|---|"]
        lines += [f"| {m['analyte']} | {m['a']} | {m['b']} | {m['delta']} | {m['tolerance']} |" for m in ch["matches"]] + [""]
    for key in ("timeline", "changes", "coa", "missing"):
        if case.get(key):
            lines += [f"## {key.capitalize()}", "", "```json", json.dumps(case[key], ensure_ascii=False, indent=1), "```", ""]
    lines += ["## Sources", ""] + [f"- {u}" for u in case.get("sources") or []] + [""]
    if case.get("confidence"):
        lines += ["## Confidence", "", case["confidence"], ""]
    lines += ["## Limitations", ""] + [f"- {x}" for x in case.get("limitations") or []]
    if case.get("review"):
        lines += ["", "## Review", "", "```json", json.dumps(case["review"], ensure_ascii=False, indent=1), "```"]
    return "\n".join(lines) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dossier", help="print one case as markdown")
    args = ap.parse_args()
    cards = {r["tag"]: r for r in load_jsonl(FDIR / "retail-cards.jsonl") if r.get("tag")}
    history = load(FDIR / "retail-history.json", {})
    coa = load(FDIR / "coa-index.json", {})
    collisions = load(FDIR / "collisions.json", {}).get("candidates") or []
    lots = load(LOTS, {}).get("lots") or []
    cases = build(cards, history, coa, collisions, lots, reviews())
    if args.dossier:
        hit = next((c for c in cases if c["caseId"] == args.dossier), None)
        if not hit:
            raise SystemExit(f"no case {args.dossier}")
        sys.stdout.write(dossier(hit))
        return
    counts = defaultdict(int)
    for c in cases:
        counts[c["priority"]] += 1
        for s in c["signals"][:1]:
            counts["signal:" + s] += 1
    OUT.write_text(json.dumps({
        "about": "Forensic candidates with their evidence, for people to verify; not findings of misconduct. "
                 "verificationStatus comes from data/forensic-reviews.json.",
        "day": date.today().isoformat(), "counts": dict(sorted(counts.items())), "cases": cases,
    }, ensure_ascii=False, indent=1) + "\n")
    print(f"forensic-cases: {len(cases)} cases ({counts['high']} high, {counts['medium']} medium, "
          f"{counts['review']} review); " + ", ".join(f"{k[7:]} {v}" for k, v in sorted(counts.items()) if k.startswith("signal:")))


if __name__ == "__main__":
    main()
