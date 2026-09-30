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

spec=importlib.util.spec_from_file_location("ch",ROOT/"scripts/coa-harvest.py")
ch=importlib.util.module_from_spec(spec);spec.loader.exec_module(ch)
U="https://example.test/coa.pdf"
docs={}
assert ch.ingest(docs,U,x,text,"2026-09-30")=="new"
assert ch.ingest(docs,U,x,text,"2026-10-01")=="same"
v=docs[U]["versions"]
assert len(v)==1 and v[0]["firstSeen"]=="2026-09-30" and v[0]["lastSeen"]=="2026-10-01"
# New bytes with the same words: a re-rendered PDF, kept as a version.
assert ch.ingest(docs,U,y,text,"2026-10-02")=="rerendered"
# New words: a changed document. No version is ever overwritten.
assert ch.ingest(docs,U,b"%PDF three",text.replace("27.42","29.10"),"2026-10-03")=="changed"
v=docs[U]["versions"]
assert [x_["sha256"] for x_ in v]==[cf.sha256_bytes(x),cf.sha256_bytes(y),cf.sha256_bytes(b"%PDF three")]
assert v[2]["previous"]==v[1]["sha256"] and v[0]["record"]["analytes"]["total_thc"]["value"]==27.42
# A version read by an older parser is re-read when its bytes come back.
v[0]["record"]["parser"]["version"]=1
assert ch.ingest(docs,U,x,text,"2026-10-04")=="reparsed" and v[0]["record"]["parser"]["version"]==cf.PARSER_VERSION

# The budget walks the list: never-checked first, then the longest unchecked.
docs={"a":{"lastChecked":"2026-09-30","versions":[{}]},"b":{"lastChecked":"2026-09-01","versions":[{}]},
      "c":{"lastChecked":"2026-09-15","lastError":{"day":"2026-09-15"}}}
assert ch.order(["a","b","c","d","e"],docs)==["d","e","b","c","a"]
print("coa-harvest-check: OK")
