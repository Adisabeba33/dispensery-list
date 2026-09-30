#!/usr/bin/env python3
"""COA forensic parser: immutable hashes + normalized high-value measurements.

Input is pdftotext output.  This module is deliberately conservative: it parses
only labelled values and preserves ND/<LOD/<LOQ as qualifiers instead of zero.
It complements coa-dates.py; it does not replace its date behavior yet.
"""
import hashlib
import json
import re
from datetime import date

DATE = r"(\d{1,2}/\d{1,2}/\d{2,4}|\d{4}-\d{2}-\d{2}|[A-Z][a-z]{2,8}\.? \d{1,2}, \d{4})"
MONTHS = {m:i for i,m in enumerate(("jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"),1)}

LABS = [
    ("Green Analytics", "Green Analytics"), ("Kaycha", "Kaycha"),
    ("DRS Testing", "DRS"), ("Keystone", "Keystone"), ("ACT Lab", "ACT"),
    ("Smithers", "Smithers"), ("Reliable Labs", "Reliable"),
]
ANALYTE_ALIASES = {
    "total thc":"total_thc", "thc":"thc", "thca":"thca",
    "delta 9 thc":"delta_9_thc", "delta-9 thc":"delta_9_thc", "δ9-thc":"delta_9_thc",
    "total cbd":"total_cbd", "cbd":"cbd", "cbda":"cbda", "cbg":"cbg", "cbga":"cbga",
    "cbc":"cbc", "cbn":"cbn", "thcv":"thcv",
    "beta caryophyllene":"beta_caryophyllene", "β-caryophyllene":"beta_caryophyllene",
    "caryophyllene":"beta_caryophyllene", "beta myrcene":"beta_myrcene",
    "β-myrcene":"beta_myrcene", "myrcene":"beta_myrcene",
    "limonene":"limonene", "linalool":"linalool", "alpha pinene":"alpha_pinene",
    "α-pinene":"alpha_pinene", "beta pinene":"beta_pinene", "β-pinene":"beta_pinene",
    "alpha humulene":"alpha_humulene", "α-humulene":"alpha_humulene",
    "humulene":"alpha_humulene", "terpinolene":"terpinolene", "ocimene":"ocimene",
    "fenchol":"fenchol", "bisabolol":"bisabolol", "camphene":"camphene",
}
VALUE = r"(?P<value>(?:<\s*)?(?:LOQ|LOD|ND|N/D|[0-9]+(?:\.[0-9]+)?))\s*(?P<unit>%|mg/g|ppm|ppb)?"
SAMPLE_IDS = [
    re.compile(r"(?:Sample\s*ID|Sample\s*#|Lab\s*ID)\s*[:#]?\s*([A-Z0-9][A-Z0-9._/-]{3,})", re.I),
]
BATCH_IDS = [
    re.compile(r"(?:Batch(?:\s*ID|\s*#|\s*No\.?|\s*Number)?|METRC\s*Batch)\s*[:#]?\s*([A-Z0-9][A-Z0-9._/-]{4,})", re.I),
]
LOT_IDS = [
    re.compile(r"(?:Lot(?:\s*ID|\s*#|\s*No\.?|\s*Number)?)\s*[:#]?\s*([A-Z0-9][A-Z0-9._/-]{3,})", re.I),
]
DATES = {
    "sampled": [r"Sampled Date", r"Sampling Date", r"Sample Collection Date(?:/Time)?", r"Date Sampled", r"Sample Collected"],
    "received": [r"Sample Received", r"Date Received"],
    "reported": [r"Report Date", r"Published"],
    "packaged": [r"Packaged Date", r"Package Date"],
}


def iso(raw):
    raw = raw.strip()
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw):
        y,m,d = map(int, raw.split("-"))
    else:
        named = re.fullmatch(r"([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{1,2}),\s*(\d{4})", raw)
        if named:
            m=MONTHS.get(named.group(1).lower()); d=int(named.group(2)); y=int(named.group(3))
            if not m: return None
        else:
            try: m,d,y=map(int, raw.split("/"))
            except ValueError: return None
            if y < 100: y += 2000
    try: return date(y,m,d).isoformat()
    except ValueError: return None


def first(patterns, text):
    for label in patterns:
        m=re.search(label+r"\s*:?\s*"+DATE, text, re.I)
        if m:
            v=iso(m.group(1))
            if v: return v
    return None


def first_id(patterns, text):
    for p in patterns:
        m=p.search(text)
        if m: return m.group(1).strip()
    return None


def qualifier(raw):
    x=re.sub(r"\s+","",raw.upper())
    if x in ("ND","N/D"): return None, "ND"
    if x == "LOD": return None, "<LOD"
    if x == "LOQ": return None, "<LOQ"
    if x.startswith("<"):
        inner=x[1:]
        if inner in ("LOD","LOQ"): return None, "<"+inner
        try: return float(inner), "<"
        except ValueError: return None, x
    try: return float(x), None
    except ValueError: return None, x


def analytes(text):
    """Parse conservative one-line 'Analyte value unit' rows."""
    out={}
    aliases=sorted(ANALYTE_ALIASES, key=len, reverse=True)
    names="|".join(re.escape(a) for a in aliases)
    rx=re.compile(r"(?im)^\s*(?P<name>"+names+r")\s*(?:[:|]\s*|\s+)"+VALUE+r"\s*$")
    for m in rx.finditer(text):
        key=ANALYTE_ALIASES[m.group("name").lower()]
        val,q=qualifier(m.group("value"))
        out[key]={"value":val,"unit":m.group("unit"),"qualifier":q}
    return dict(sorted(out.items()))


def physical(text):
    fields={}
    patterns={
        "moisture": r"(?im)^\s*(?:Moisture|Moisture Content)\s*[:|]?\s*([0-9]+(?:\.[0-9]+)?)\s*%",
        "waterActivity": r"(?im)^\s*(?:Water Activity|Aw)\s*[:|]?\s*([0-9]+(?:\.[0-9]+)?)",
    }
    for k,p in patterns.items():
        m=re.search(p,text)
        if m: fields[k]=float(m.group(1))
    return fields


def parse_text(text, source_url=None, document_sha256=None):
    lab=next((name for needle,name in LABS if needle.lower() in text.lower()),None)
    dates={k:first(v,text) for k,v in DATES.items()}
    return {
        "sourceUrl":source_url, "sha256":document_sha256, "lab":lab,
        "sampleId":first_id(SAMPLE_IDS,text), "batchTag":first_id(BATCH_IDS,text),
        "lotNumber":first_id(LOT_IDS,text), **dates,
        "analytes":analytes(text), **physical(text),
        "parser":{"name":"coa-forensics","version":1},
    }


def sha256_bytes(blob):
    return hashlib.sha256(blob).hexdigest()


def chemistry_fingerprint(record):
    payload={
        "analytes":{k:{"value":v.get("value"),"unit":v.get("unit"),"qualifier":v.get("qualifier")}
                    for k,v in sorted((record.get("analytes") or {}).items())},
        "moisture":record.get("moisture"), "waterActivity":record.get("waterActivity"),
    }
    return hashlib.sha256(json.dumps(payload,sort_keys=True,separators=(",",":")).encode()).hexdigest()
