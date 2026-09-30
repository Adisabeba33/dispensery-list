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

print("forensic-collisions-check: OK")
