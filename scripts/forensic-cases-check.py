#!/usr/bin/env python3
"""Offline regression checks for scripts/forensic-cases.py."""
import importlib.util
import json
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("fc", ROOT / "scripts/forensic-cases.py")
fc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fc)


def card(tag, strain, batch, **kw):
    c = {"tag": tag, "strain": strain, "batchTag": batch, "lab": "Keystone State Testing, LLC",
         "tested": "2025-12-22", "totals": {"total_thc": {"value": 24.16, "qualifier": None}},
         "observedAt": "2026-09-30"}
    c.update(kw)
    return c


def run(cards, history=None, coa=None, collisions=None, lots=None, human=None):
    return fc.build({c["tag"]: c for c in cards}, history or {}, coa or {}, collisions or [], lots or [], human or {})


def signals(cases):
    return sorted(s for c in cases for s in c["signals"])


B42 = "1A41203000026BA000000042"
BLUE, G41A, G41B = "1A4120300002719000000823", "1A4120300001E8C000000582", "1A4120300001E8C000000586"

# The Pierre McClain chain: batch …042 packed as Blue Dream, repacked from that
# package as Gelato 41. One case, with the renamed link in its chain.
chain = [card(BLUE, "Blue Dream", B42, sourcePackage="1A41203000026BA000000041"),
         card(G41A, "Gelato 41", B42, sourcePackage=BLUE), card(G41B, "Gelato 41", B42, sourcePackage=BLUE)]
hit = {"sameBatch": True, "priority": "high", "signal": "exact_fingerprint", "commonAnalytes": 11,
       "matchedAnalytes": [{"analyte": "limonene", "a": 0.7225, "b": 0.7225, "delta": 0, "tolerance": 0.005}],
       "a": {"kind": "retail", "id": G41A, "batchTag": B42, "strain": "Gelato 41"},
       "b": {"kind": "retail", "id": BLUE, "batchTag": B42, "strain": "Blue Dream"}}
cases = run(chain, collisions=[hit])
assert len(cases) == 1, cases
c = cases[0]
assert c["priority"] == "high" and c["signals"] == ["SAME_BATCH_DIFFERENT_NAME", "RENAMED_IN_LINEAGE", "CHEMICAL_CLONE"]
assert c["caseId"] == fc.case_id("batch|" + B42) and c["verificationStatus"] == "candidate"
assert [e["renamed"] for e in c["lineage"]] == [True, True] and "Entailed" in c["chemistry"]["note"]
assert "Blue Dream" in c["summary"] and "Gelato 41" in c["summary"]
md = fc.dossier(c)
assert BLUE in md and "renamed" in md and "Entailed" in md

# One batch number over two certificates (HPI: Mom's Spaghetti 37.49, GMO
# 32.74 in batch …1670) is a packager's production lot: review, not high.
hpi = [card("1A412030000191D000004918", "Mom's Spaghetti", "1A412030000191D000001670",
            totals={"total_thc": {"value": 37.4934}}, lab="Kaycha Labs NY", tested="2026-04-17"),
       card("1A412030000191D000004935", "GMO", "1A412030000191D000001670",
            totals={"total_thc": {"value": 32.7444}}, lab="Kaycha Labs NY", tested="2026-04-17")]
cases = run(hpi)
assert [(x["signals"][0], x["priority"]) for x in cases] == [("MIXED_BATCH", "review")]

# Good Money's "Zeven Up" certificate is a saved Retail ID page of package
# …870; its chemistry equals The Wrap Up's card. Once …870's card shows batch
# …014, that is the batch case, not a separate chemistry case.
Z870, TWU = "1A4120300002719000000870", "1A4120300001E8C000000583"
B14 = "1A41203000026BA000000014"
zeven = {"sameBatch": False, "priority": "medium", "signal": "near_chemical_clone", "commonAnalytes": 7,
         "matchedAnalytes": [], "a": {"kind": "coa", "id": "sha", "metrcTag": Z870, "product": "Zeven Up"},
         "b": {"kind": "retail", "id": TWU, "batchTag": B14, "strain": "The Wrap Up"}}
cases = run([card(TWU, "The Wrap Up", B14), card(Z870, "Zeven Up", B14)], collisions=[zeven])
assert [x["signals"][0] for x in cases] == ["SAME_BATCH_DIFFERENT_NAME"], cases
cases = run([card(TWU, "The Wrap Up", B14)], collisions=[zeven])  # …870 not fetched yet
assert [(x["signals"][0], x["priority"]) for x in cases] == [("CHEMICAL_CLONE", "medium")]

# Spellings of one name in one batch are no case at all.
assert run([card("1A4A" + "0" * 20, "Cherry Runtz", "B1"), card("1A4A" + "0" * 19 + "1", "CHERRY RUNTZ 3.5g", "B1")]) == []

# Unknown certificate (slim cards without THC or lab): medium, said so.
slim = [card("1A4B" + "0" * 20, "Blue Dream", "B2", totals={}, lab=None, tested=None),
        card("1A4B" + "0" * 19 + "1", "Gelato 41", "B2", totals={}, lab=None, tested=None)]
assert [(x["priority"], "not confirmed" in x["summary"]) for x in run(slim)] == [("medium", True)]

# A rename across batches is its own case.
cases = run([card("1A4C" + "0" * 20, "Half Moon Gelato", "B3"),
             card("1A4C" + "0" * 19 + "1", "Sunshet Sherbert", "B4", sourcePackage="1A4C" + "0" * 20)])
assert [(x["signals"], x["priority"]) for x in cases] == [(["RENAMED_IN_LINEAGE"], "medium")]

# ---------------------------------------------------------------- certificates
lot = lambda brand, strain, *urls: {"brand": brand, "strain": strain, "thcPercent": 20.0,  # noqa: E731
                                    "shops": ["s"], "certificates": list(urls)}
# The six shared certificate URLs on the 2026-09-30 shelves are all spellings.
variants = [lot("Aeterna", "RS", "u1"), lot("Aeterna", "RS-11", "u1"),
            lot("Connected", "Ghost OG", "u2"), lot("Connected", "OG (Indoor)", "u2"),
            lot("Dark Heart", "Grandma's", "u3"), lot("Dark Heart", "Grandma's House", "u3"),
            lot("Grocery", "Ghost OG #8", "u4"), lot("Grocery", "OG #8", "u4")]
assert run([], lots=variants) == []
cases = run([], lots=[lot("A", "Blue Dream", "u5"), lot("B", "Gelato 41", "u5")])
assert [(x["signals"][0], x["priority"]) for x in cases] == [("SAME_COA_DIFFERENT_IDENTITY", "medium")]
# One document (same bytes) at two URLs for two names, one THC: the link is
# the shop's, so medium.
coa = {"documents": {"u6": {"versions": [{"sha256": "S", "record": {}}]},
                     "u7": {"versions": [{"sha256": "S", "record": {}}]}}}
cases = run([], coa=coa, lots=[lot("A", "Blue Dream", "u6"), lot("B", "Gelato 41", "u7")])
assert [(x["signals"][0], x["priority"], x["coa"]["urls"]) for x in cases] == \
    [("SAME_COA_DIFFERENT_IDENTITY", "medium", ["u6", "u7"])]
# The full 780-certificate crawl of 2026-09-30: six documents cited for two
# names, each pair with different THC (7Seaz Caviar Kush 22.53 / Permafrost x
# Leopard Shark 24.99, one Smithers PDF at three URLs). One certificate prints
# one THC: a shop linked another lot's certificate — a data error, review.
seaz = [dict(lot("7Seaz", "Permafrost x Leopard Shark", "u6"), thcPercent=24.99),
        dict(lot("7Seaz", "Permafrost x Leopard Shark", "u7"), thcPercent=24.99),
        dict(lot("7Seaz", "Caviar Kush", "u7"), thcPercent=22.53)]
cases = run([], coa=coa, lots=seaz)
assert [(x["signals"][0], x["priority"], len(x["entities"])) for x in cases] == [("COA_MISATTACHED", "review", 2)]

# A URL that served two documents: what changed is shown; a re-render is review.
rec = {"lab": "Kaycha", "sampled": "2026-01-10", "analytes": {"limonene": {"value": 0.61, "qualifier": None}}}
mut = {"documents": {"u8": {"versions": [
    {"sha256": "A", "textSha256": "t1", "record": rec},
    {"sha256": "B", "textSha256": "t2", "record": {**rec, "sampled": "2026-02-10",
                                                   "analytes": {"limonene": {"value": 0.71, "qualifier": None}}}}]}}}
c = run([], coa=mut)[0]
assert c["signals"] == ["COA_MUTATION"] and c["priority"] == "high"
assert c["changes"][0]["changed"] == {"sampled": ["2026-01-10", "2026-02-10"], "analytes.limonene": [0.61, 0.71]}
mut["documents"]["u8"]["versions"][1].update(textSha256="t1", record=rec)
assert run([], coa=mut)[0]["priority"] == "review"

# ---------------------------------------------------------------- Retail ID history
T = "1A4120300001E8C000000999"
hist = {"tags": {T: {"versions": [{"identity": {"strain": "Blue Dream"}},
                                  {"observedAt": "2026-10-02", "changed": {"strain": ["Blue Dream", "Gelato 41"]}}]}}}
c = run([card(T, "Gelato 41", "B5")], history=hist)[0]
assert (c["signals"], c["priority"]) == (["RETAIL_ID_MUTATION"], "high")
hist["tags"][T]["versions"][1]["changed"] = {"strain": ["Blue Dream", "Blue Dream 3.5g"]}
assert run([card(T, "Blue Dream 3.5g", "B5")], history=hist)[0]["priority"] == "review"  # a spelling
hist["tags"][T]["versions"][1]["changed"] = {"totals.total_thc": [24.16, 25.01]}
assert run([card(T, "Blue Dream", "B5")], history=hist)[0]["priority"] == "high"  # a new certificate

# ---------------------------------------------------------------- timeline
# Fela's Farm's Applescotti: tested 2025-12-17, cultivationDate 2026-02-18.
# Metrc's cultivation date is not the harvest: no case.
apple = card("1A41203000004F0000000735", "Applescotti", "1A41203000004F0000000065", tested="2025-12-17",
             packaged="2026-02-18", cultivated="2026-02-18")
assert run([apple]) == []
# Harvested after the test, or packed before the harvest: impossible.
bad = card("1A4D" + "0" * 20, "X", "B6", harvested="2026-01-10", tested="2025-12-17", packaged="2026-01-05")
assert sorted(x["timeline"]["rule"] for x in run([bad])) == ["packaged_before_harvest", "tested_before_harvest"]
# A date after the day the card was read is impossible — past a day's slack
# for New York dates read in UTC.
assert [x["timeline"]["rule"] for x in run([card("1A4H" + "0" * 20, "X", "B10", packaged="2026-10-03")])] \
    == ["packaged_after_observed"]
assert run([card("1A4H" + "0" * 20, "X", "B10", packaged="2026-10-01")]) == []
# Packaged after the test is ordinary (the lab samples the packed lot).
assert run([card("1A4E" + "0" * 20, "X", "B7", tested="2026-07-30", packaged="2026-07-22")]) == []
# A tag on a menu before its package existed.
menu = {"tags": {"1A4F" + "0" * 20: {"menu": {"firstSeen": "2026-09-10", "lastSeen": "2026-09-30",
                                              "shops": [], "names": []}}}}
cases = run([card("1A4F" + "0" * 20, "X", "B8", packaged="2026-09-20")], history=menu)
assert [x["timeline"]["rule"] for x in cases] == ["on_menu_before_packaged"]
# A certificate reported before its sample was taken: review (a parser read it).
docs = {"documents": {"u9": {"versions": [{"sha256": "Z", "firstSeen": "2026-09-30",
                                          "record": {"sampled": "2026-02-10", "reported": "2026-02-01"}}]}}}
assert [(x["timeline"]["rule"], x["priority"]) for x in run([], coa=docs)] == [("reported_before_sampled", "review")]

# ---------------------------------------------------------------- recall and reviews
c = run([card("1A4G" + "0" * 20, "X", "B9", isOnRecall=True)])[0]
assert c["signals"] == ["RECALL_FLAG"] and c["verificationStatus"] == "externally_confirmed"
cid = fc.case_id("batch|" + B42)
cases = run(chain, human={cid: {"status": "source_verified", "reviewedAt": "2026-09-30"}})
assert cases[0]["verificationStatus"] == "source_verified" and cases[0]["review"]["reviewedAt"] == "2026-09-30"
with tempfile.TemporaryDirectory() as d:
    p = Path(d) / "reviews.json"
    p.write_text(json.dumps({"reviews": {cid: {"status": "fraud_confirmed"}}}))
    try:
        fc.reviews(p)
        raise AssertionError("fraud_confirmed must be refused")
    except SystemExit as exc:
        assert "fraud_confirmed" in str(exc)
# The committed reviews file only uses allowed statuses.
fc.reviews()

print("forensic-cases-check: OK")
