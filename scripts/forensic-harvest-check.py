#!/usr/bin/env python3
"""Offline regression checks for scripts/forensic-harvest.py."""
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("fh", ROOT / "scripts/forensic-harvest.py")
fh = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fh)

assert fh.norm_name("β-Caryophyllene") == "beta_caryophyllene"
assert fh.norm_name("Beta Caryophyllene") == "beta_caryophyllene"
assert fh.norm_name("α-Pinene") == "alpha_pinene"
assert fh.total_name("thc") == "total_thc" and fh.total_name("delta9thc") == "delta_9_thc"
assert fh.total_name("terpenes") == "total_terpenes"

m = fh.measurement_map({
    "a": {"label": "β-Caryophyllene", "percent": 0.3020},
    "b": {"label": "Limonene", "percent": "0.4226"},
    "nd": {"label": "Myrcene", "percent": None, "resultText": "ND"},
    "z": {"label": "Guaiol", "percent": 0},
    "lt": {"label": "Linalool", "percent": "<0.01"},
    "txt": {"label": "Terpinolene", "percent": 0.11, "resultText": "0.11 %"},
})
assert m["beta_caryophyllene"]["value"] == 0.302
assert m["limonene"]["value"] == 0.4226
# ND must never silently become zero: it stays, as a qualifier with no value.
assert m["beta_myrcene"] == {"value": None, "qualifier": "ND"}
# A Retail ID card fills unreported terpenes with 0; that is not a measurement.
assert m["guaiol"] == {"value": None, "qualifier": "reported_zero"}
# A bound is not a measurement either.
assert m["linalool"]["value"] is None and m["linalool"]["qualifier"] == "<0.01"
# A result text that is just the number is not a qualifier.
assert m["terpinolene"] == {"value": 0.11, "qualifier": None}

base = {
    "totals": {"total_thc": {"value": 26.1, "qualifier": None}},
    "cannabinoids": {},
    "terpenes": {
        "limonene": {"value": 0.4226, "qualifier": None},
        "beta_caryophyllene": {"value": 0.302, "qualifier": None},
    },
}
renamed = {**base, "product": "Completely Different Name", "tag": "1A4" + "0" * 21}
fp1, _ = fh.fingerprint(base)
fp2, _ = fh.fingerprint(renamed)
assert fp1 == fp2  # chemistry, not commercial identity, defines the fingerprint.

changed = {**base, "terpenes": {
    "limonene": {"value": 0.4227, "qualifier": None},
    "beta_caryophyllene": {"value": 0.302, "qualifier": None},
}}
fp3, _ = fh.fingerprint(changed)
assert fp3 != fp1

# One card hashes the same from either collector: the live card's reported
# zeros and aggregates (total terpenes, Δ9) that Lot Twins does not keep do
# not move the fingerprint.
live_shape = {**base,
              "totals": {**base["totals"], "total_terpenes": {"value": 2.9, "qualifier": None},
                         "delta_9_thc": {"value": 1.2, "qualifier": None}},
              "terpenes": {**base["terpenes"], "guaiol": {"value": None, "qualifier": "reported_zero"}}}
assert fh.fingerprint(live_shape)[0] == fp1

# ---------------------------------------------------------------- live queue
# Leads a public source points at, and public cards, are eligible.
assert fh.live_eligible({"flower-listings:retail-link"})
assert fh.live_eligible({"card:source-package"})
# Good Money's "Zeven Up" certificate is a saved Retail ID page of package …870,
# a tag no menu prints: a lead. A lab certificate's sampled package is one too.
assert fh.live_eligible({"coa:retail-id-page"}) and fh.live_eligible({"coa:tested-package"})
assert not fh.live_eligible({"coa:retail-id-page"}, "missing")
assert fh.live_eligible({"retail-id-cache"}, "found")
assert fh.live_eligible({"lot-twins-cache"}, "found")
assert fh.live_eligible({"lot-twins-cache", "lot-twins:probe-only"}, "found")
# Raw menu package IDs are discovery evidence only.
assert not fh.live_eligible({"flower-listings"})
# Pilot runs 1-8: every one of 100 requests per run went to a tag Lot Twins
# had already seen 404 (its neighbour probes) — "in a cache" is not "public".
assert not fh.live_eligible({"lot-twins-cache"}, "missing")
assert not fh.live_eligible({"lot-twins-cache", "lot-twins:probe-only"}, None)
assert not fh.live_eligible({"retail-id-cache", "flower-listings"}, "missing")
assert not fh.live_eligible({"flower-listings:retail-link"}, "missing")

T = lambda n: "1A4120300001E8C" + f"{n:09d}"  # noqa: E731
run8 = {T(i): {"lot-twins-cache", "lot-twins:probe-only"} for i in range(428)}
assert fh.plan_live(run8, {t: "missing" for t in run8}, {}, set()) == []

sources = {
    T(1): {"flower-listings"},                                   # raw, unknown: never
    T(2): {"flower-listings", "retail-id-cache"},                # 404: never
    T(3): {"flower-listings", "retail-id-cache"},                # slim public card: enrich
    T(4): {"lot-twins-cache"},                                   # full public card: re-observe
    T(5): {"card:source-package"},                               # a source package: after enrichment
    T(6): {"flower-listings:retail-link", "retail-id-cache"},    # slim, observed live before
    T(7): {"coa:retail-id-page"},                                # a page points at it: first
    T(8): {"coa:tested-package"},                                # a lab's sample package: after enrichment
}
state = {T(2): "missing", T(3): "found", T(4): "found", T(6): "found"}
history = {"tags": {T(6): {"versions": [{"sources": ["live"], "lastSeen": "2026-09-01"}]}}}
plan = fh.plan_live(sources, state, history, full_tags={T(4)})
# Pilot run 9: Retail ID pages' tags 5 of 5 public, lab certificates' sampled
# packages 17 of 17 404 — only the first come before enrichment.
assert plan == [(T(7), "lead"), (T(3), "enrich"), (T(5), "source"), (T(8), "source"),
                (T(4), "reobserve"), (T(6), "reobserve")], plan
# A lead that answered 404 rests RECHECK_DAYS, then is a lead again.
fh.observe_not_public(history, T(5), "2026-09-30")
assert T(5) in fh.resting(history, "2026-10-29") and T(5) not in fh.resting(history, "2026-10-31")
plan = fh.plan_live(sources, state, history, {T(4)}, fh.resting(history, "2026-10-01"))
assert (T(5), "source") not in plan and len(plan) == 5

# ---------------------------------------------------------------- live card
api = {
    "packageLabel": T(9), "isOnRecall": True, "facilityName": "Farm LLC", "facilityLicense": "OCM-MICR-24-000001-P2",
    "productCard": {"productName": "Brand - 3.5g - Applescotti", "strain": "Applescotti"},
    "coaCard": {"data": {
        "strainName": "Applescotti", "batchTag": T(65), "sourcePackage": T(20), "lotNumber": T(9),
        "testedDate": "2025-12-17T00:00:00", "packagedDate": "2026-02-18T00:00:00",
        "cultivationDate": "2026-02-18T00:00:00", "receivedDateTime": "2026-02-28T02:46:31+00:00",
        "lab": {"name": "Kaycha Labs NY", "licenseNumber": "OCM-CPL-24-00006-L1"},
        "manufacturer": {"name": "Farm LLC", "licenseNumber": "OCM-MICR-24-000001-P2"},
        "labTestingStateName": "TestPassed", "isProductionBatch": False,
        "totals": {"thc": {"percent": 27.7523}, "cbd": {"percent": 0}, "terpenes": {"percent": 2.24}},
        "terpenes": {"aPinene": {"label": "αPinene", "percent": 0.16}, "guaiol": {"label": "Guaiol", "percent": 0}},
    }},
}
card = fh.compact(api, T(9))
assert card["isOnRecall"] is True and card["labTestingState"] == "TestPassed"
assert card["sourcePackage"] == T(20) and card["received"] == "2026-02-28"
assert card["harvested"] is None and card["cultivated"] == "2026-02-18"  # cultivation is not harvest
assert card["totals"]["total_thc"]["value"] == 27.7523
assert card["totals"]["total_cbd"]["qualifier"] == "reported_zero"
assert card["terpenes"]["alpha_pinene"]["value"] == 0.16
assert card["terpenes"]["guaiol"]["value"] is None

# ---------------------------------------------------------------- history
h = {}
slim = {"product": "SCC350", "strain": "Blue Dream", "batchTag": T(42), "tested": "2025-12-22",
        "totals": {}, "cannabinoids": {}, "terpenes": {}}
assert fh.observe(h, T(1), slim, "retail-id-cache", "2026-09-29") == []
full = {**slim, "sourcePackage": T(41), "manufacturer": "Pierre McClain LLC",
        "totals": {"total_thc": {"value": 24.16, "qualifier": None}},
        "terpenes": {"limonene": {"value": 0.7225, "qualifier": None},
                     "guaiol": {"value": None, "qualifier": "reported_zero"}}}
# The full card fills in the slim one: more fields are not a change.
assert fh.observe(h, T(1), full, "live", "2026-09-30", "ab" * 32) == []
v = h["tags"][T(1)]["versions"]
assert len(v) == 1 and v[0]["identity"]["sourcePackage"] == T(41) and v[0]["sources"] == ["live", "retail-id-cache"]
assert v[0]["chemistry"]["terpenes"]["limonene"]["value"] == 0.7225
assert fh.history_card(T(1), h["tags"][T(1)])["manufacturer"] == "Pierre McClain LLC"
# Case and spacing are not a change; a re-observation just confirms.
assert fh.observe(h, T(1), {**full, "strain": "blue  dream"}, "live", "2026-10-01") == []
# A renamed card is a new version holding what changed; the old one stays.
assert fh.observe(h, T(1), {**full, "strain": "Gelato 41"}, "live", "2026-10-02") == ["strain"]
v = h["tags"][T(1)]["versions"]
assert len(v) == 2 and v[0]["identity"]["strain"] == "Blue Dream" and v[1]["changed"]["strain"] == ["Blue Dream", "Gelato 41"]
# A stale cache snapshot does not reopen the superseded identity.
assert fh.observe(h, T(1), slim, "retail-id-cache", "2026-09-29") == []
assert len(h["tags"][T(1)]["versions"]) == 2
# A changed measured value is a change; an analyte only one side has is not.
more = {**full, "strain": "Gelato 41", "terpenes": {**full["terpenes"], "linalool": {"value": 0.15, "qualifier": None}}}
assert fh.observe(h, T(1), more, "live", "2026-10-03") == []
recert = {**more, "totals": {"total_thc": {"value": 25.01, "qualifier": None}}}
assert fh.observe(h, T(1), recert, "live", "2026-10-04") == ["totals.total_thc"]
# The newest version is the card: a later cache observation that changed it
# is not overlaid with an older live read.
hc = {"versions": [{"sources": ["live"], "identity": {"strain": "Blue Dream"}, "lastSeen": "2026-10-01"},
                   {"sources": ["lot-twins-cache"], "identity": {"strain": "Gelato 41"}, "lastSeen": "2026-10-09"}]}
assert fh.history_card(T(2), hc) is None
assert fh.history_card(T(2), {"versions": hc["versions"][:1]})["strain"] == "Blue Dream"
# A public card that answers 404 is marked, and unmarked when it is back.
fh.observe_missing(h, T(1), "2026-10-05")
assert h["tags"][T(1)]["missing"] == {"first": "2026-10-05", "last": "2026-10-05"}
fh.observe(h, T(1), recert, "live", "2026-10-06")
assert "missing" not in h["tags"][T(1)] and h["tags"][T(1)]["missingBefore"]["first"] == "2026-10-05"

fh.observe_menu(h, T(1), "2026-09-30", "OCM-RETL-24-000244", "Good Money | Zeven Up")
fh.observe_menu(h, T(1), "2026-09-28", "OCM-RETL-24-000133", "HI MY NAME IS | THE WRAP UP")
menu = h["tags"][T(1)]["menu"]
assert menu["firstSeen"] == "2026-09-28" and menu["lastSeen"] == "2026-09-30" and len(menu["shops"]) == 2

print("forensic-harvest-check: OK")
