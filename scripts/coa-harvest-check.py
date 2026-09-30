#!/usr/bin/env python3
"""Offline checks for COA index version semantics."""
import importlib.util
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("cf",ROOT/"scripts/coa-forensics.py")
cf=importlib.util.module_from_spec(spec);spec.loader.exec_module(cf)

x=b"%PDF fake version one"
y=b"%PDF fake version two"
assert cf.sha256_bytes(x)!=cf.sha256_bytes(y)

text="""Kaycha
Sample ID: ABC-1234
Sampled Date: 05/11/2026
Total THC 27.42 %
Limonene 0.61 %
Beta Caryophyllene 0.30 %
Linalool ND %
"""
r=cf.parse_text(text,"https://example.test/coa.pdf",cf.sha256_bytes(x))
assert r["sourceUrl"].endswith("coa.pdf")
assert r["sha256"]==cf.sha256_bytes(x)
assert r["sampleId"]=="ABC-1234"
assert r["analytes"]["linalool"]["qualifier"]=="ND"
assert r["analytes"]["linalool"]["value"] is None
print("coa-harvest-check: OK")
