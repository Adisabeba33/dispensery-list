#!/usr/bin/env python3
"""Offline fixtures for coa-forensics.py. No network."""
import importlib.util
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("coa_forensics",ROOT/"scripts/coa-forensics.py")
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

fixtures=[
("""Green Analytics
Sample ID: GA-260519-001
Batch ID: 1A41203000026BA000000014
Sampling Date: 05/19/2026
Report Date: 05/22/2026
Total THC 26.10 %
Beta Caryophyllene 0.3020 %
Limonene 0.4226 %
Myrcene ND %
Moisture Content 10.4 %
Water Activity 0.58
""","Green Analytics","2026-05-19"),
("""Kaycha Labs
Sample #: K-12345
Sampled Date: 12/12/25
THCA 28.44 %
Delta-9 THC <LOQ %
Linalool 0.3408 %
""","Kaycha","2025-12-12"),
("""Keystone State Testing
Lab ID: KS-7788
Date Sampled: 10/15/2025
THC 24.16 %
β-Caryophyllene 1.181 %
α-Pinene 0.1112 %
""","Keystone","2025-10-15"),
("""ACT Lab
Sample ID: ACT-99
Sample Received: 01/28/2025
CBD N/D %
Limonene 0.52 %
""","ACT",None),
]

for text,lab,sampled in fixtures:
    r=m.parse_text(text)
    assert r["lab"]==lab,(lab,r)
    assert r["sampled"]==sampled,(sampled,r)

r=m.parse_text(fixtures[0][0])
assert r["analytes"]["beta_myrcene"]["value"] is None
assert r["analytes"]["beta_myrcene"]["qualifier"]=="ND"
assert r["analytes"]["beta_caryophyllene"]["value"]==0.302
assert r["moisture"]==10.4 and r["waterActivity"]==0.58

r=m.parse_text(fixtures[1][0])
assert r["analytes"]["delta_9_thc"]["value"] is None
assert r["analytes"]["delta_9_thc"]["qualifier"]=="<LOQ"

a=m.parse_text("Total THC 26.10 %\nLimonene 0.4226 %\n")
b=m.parse_text("Total THC 26.10 %\nLimonene 0.4226 %\n")
c=m.parse_text("Total THC 26.11 %\nLimonene 0.4226 %\n")
assert m.chemistry_fingerprint(a)==m.chemistry_fingerprint(b)
assert m.chemistry_fingerprint(a)!=m.chemistry_fingerprint(c)
assert m.sha256_bytes(b"abc")=="ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"

print("coa-forensics-check: OK")
