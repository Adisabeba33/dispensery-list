#!/usr/bin/env python3
"""Regression cases for forensic-collisions.py."""
import importlib.util
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("fc",ROOT/"scripts/forensic-collisions.py")
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

a={"total_thc":26.10,"limonene":0.4226,"beta_caryophyllene":0.3020,
   "beta_myrcene":0.2111,"linalool":0.1200,"alpha_humulene":0.1010}
b=dict(a)
kind,common,matched,diff=m.classify({}, {}, a,b)
assert kind=="near_chemical_clone" and len(common)==6 and not diff

# Small lab/rounding drift inside explicit tolerances remains a candidate.
b2={"total_thc":26.12,"limonene":0.424,"beta_caryophyllene":0.304,
    "beta_myrcene":0.213,"linalool":0.122,"alpha_humulene":0.103}
kind,*_=m.classify({}, {}, a,b2)
assert kind=="near_chemical_clone"

# THC alone, even exactly equal or with an equal hash, is never enough.
kind,*_=m.classify({}, {}, {"total_thc":26.1},{"total_thc":26.1})
assert kind is None
kind,*_=m.classify({}, {}, {"total_thc":26.1},{"total_thc":26.1},"same","same")
assert kind is None

# Four shared terpenes but materially different fifth analyte is rejected.
bad=dict(b);bad["beta_myrcene"]=0.41
kind,common,matched,diff=m.classify({}, {}, a,bad)
assert kind is None and any(x["analyte"]=="beta_myrcene" for x in diff)

# Fewer than four terpene-like measurements is insufficient.
short={"total_thc":26.1,"limonene":0.42,"beta_caryophyllene":0.30,
       "beta_myrcene":0.21,"linalool":0.12}
kind,*_=m.classify({}, {}, short,short)
assert kind=="near_chemical_clone"  # 4 terpenes + THC = minimum accepted evidence.

too_short={"total_thc":26.1,"limonene":0.42,"beta_caryophyllene":0.30,
           "beta_myrcene":0.21}
kind,*_=m.classify({}, {}, too_short,too_short)
assert kind is None

assert m.materially_different({"product":"Blue Dream"},{"product":"Gelato 41"})
assert not m.materially_different({"product":"Blue-Dream"},{"product":"blue dream"})
# Lot Twins' name rules: spellings of one name are one name...
assert not m.materially_different({"strain":"OG #8"},{"strain":"Ghost OG #8"})
assert not m.materially_different({"strain":"Grandma's"},{"strain":"Grandma's House"})
# ...numbers still part names, and strains are compared before product codes.
assert m.materially_different({"strain":"Gelato 33"},{"strain":"Gelato 41"})
assert m.materially_different({"strain":"Gelato 41","product":"SCC350-G41"},{"strain":"Blue Dream","product":"SCC350"})
# A saved Retail ID page names the product; the card calls it by strain and a code.
assert not m.materially_different({"product":"Zeven Up"},{"strain":"Zeven Up","product":"SCC201"})

# Retail ID cards fill unreported terpenes with 0 (kept as a qualifier): two
# unrelated cards share a dozen of them, and they must not count.
zeros={f"t{i}":{"value":None,"qualifier":"reported_zero"} for i in range(8)}
card_a={"tag":"A","totals":{"total_thc":{"value":24.16}},"terpenes":{**zeros,"limonene":{"value":0.72}}}
card_b={"tag":"B","totals":{"total_thc":{"value":24.16}},"terpenes":{**zeros,"limonene":{"value":0.72}}}
ma,ta=m.retail_measurements(card_a);mb,tb=m.retail_measurements(card_b)
assert ma=={"total_thc":24.16,"limonene":0.72}
kind,*_=m.classify({},{},ma,mb,"same","same",ta,tb)
assert kind is None
# A raw 0 (an old cache's CBD) and a bound are not values either.
assert m.value(0) is None and m.value({"value":0.004,"qualifier":"<"}) is None and m.value({"value":0.3}) == 0.3

# Sums are not dimensions: THC + total terpenes + total cannabinoids + Δ9 do
# not make "five shared analytes".
agg={"tag":"C","totals":{"total_thc":{"value":26.1},"total_terpenes":{"value":1.595},
                         "total_cannabinoids":{"value":30.2},"delta_9_thc":{"value":2.167}},
     "terpenes":{"limonene":{"value":0.42},"linalool":{"value":0.34},"beta_myrcene":{"value":0.43}}}
ma,ta=m.retail_measurements(agg)
assert "total_terpenes" not in ma and "total_cannabinoids" not in ma and ma["delta_9_thc"]==2.167
kind,*_=m.classify({},{},ma,dict(ma),"x","x",ta,set(ta))
assert kind is None  # three terpenes: below the floor, however many cannabinoids agree

# Minor cannabinoids are not terpenes (before: anything outside ABS_TOL was).
minor={"total_thc":26.1,"cbn":0.05,"cbc":0.1,"thcv":0.02,"limonene":0.42,"linalool":0.34,"beta_myrcene":0.43}
kind,*_=m.classify({},{},minor,dict(minor))
assert kind is None

# One package seen twice — its card and a shop's printout of that card, or two
# versions of one certificate URL — is not a relationship.
card_id={"kind":"retail","id":"1A41203000004F0000000735"}
printout={"kind":"coa","id":"sha","metrcTag":"1A41203000004F0000000735","url":"https://x/coa.pdf"}
assert m.same_object(card_id,printout)
assert m.same_object({"kind":"coa","id":"v1","url":"https://x/coa.pdf"},{"kind":"coa","id":"v2","url":"https://x/coa.pdf"})
assert not m.same_object(card_id,{"kind":"retail","id":"1A41203000004F0000000736"})

print("forensic-collisions-check: OK")
