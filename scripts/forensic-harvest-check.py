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

m = fh.measurement_map({
    "a": {"label": "β-Caryophyllene", "percent": 0.3020},
    "b": {"label": "Limonene", "percent": "0.4226"},
    "nd": {"label": "Myrcene", "percent": None, "resultText": "ND"},
})
assert m["beta_caryophyllene"]["value"] == 0.302
assert m["limonene"]["value"] == 0.4226
assert "beta_myrcene" not in m  # ND must never silently become zero.

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

q=[
    ("1A4RAW", {"flower-listings"}),
    ("1A4CACHE", {"retail-id-cache"}),
    ("1A4LINK", {"flower-listings:retail-link"}),
]
assert [x[0] for x in sorted(q,key=fh.queue_key)] == ["1A4LINK","1A4CACHE","1A4RAW"]

print("forensic-harvest-check: OK")
