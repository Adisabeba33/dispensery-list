#!/usr/bin/env python3
"""COA forensic parser: immutable hashes + normalized high-value measurements.

Input is pdftotext output.  This module is deliberately conservative: it parses
only labelled values and preserves ND/<LOD/<LOQ as qualifiers instead of zero.
It complements coa-dates.py; it does not replace its date behavior yet.

Two kinds of document hide behind shops' "COA" links (docType):
  lab-coa          a laboratory's certificate;
  metrc-retail-id  a printout of the package's Metrc Retail ID page — the
                   producer's card, with the batch's test copied onto it.
Analyte rows are read only where a line is "name value unit" and nothing
else: Kaycha, DRS and Green Analytics print LOQ and mg columns beside the
percentage, in different orders, and a generic reader would take the wrong
one. Those need per-lab readers; until then they give no analytes.
"""
import hashlib
import json
import re
from datetime import date

PARSER_VERSION = 3
DATE = r"(\d{1,2}/\d{1,2}/\d{2,4}|\d{4}-\d{2}-\d{2}|[A-Z][a-z]{2,8}\.? \d{1,2}, \d{4})"
MONTHS = {m:i for i,m in enumerate(("jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"),1)}
TAG = re.compile(r"\b(1A4[0-9A-F]{21})\b")

LABS = [
    ("Green Analytics", "Green Analytics"), ("Kaycha", "Kaycha"),
    ("DRS Testing", "DRS"), ("Keystone", "Keystone"), ("ACT Lab", "ACT"),
    ("Smithers", "Smithers"), ("Reliable Labs", "Reliable"), ("MCR Labs", "MCR"),
]
ANALYTE_ALIASES = {
    "total thc":"total_thc", "thc":"thc", "thca":"thca",
    "delta 9 thc":"delta_9_thc", "delta-9 thc":"delta_9_thc", "δ9-thc":"delta_9_thc", "δ9 thc":"delta_9_thc",
    "total cbd":"total_cbd", "cbd":"cbd", "cbda":"cbda", "cbg":"cbg", "cbga":"cbga",
    "cbc":"cbc", "cbn":"cbn", "thcv":"thcv",
    "beta caryophyllene":"beta_caryophyllene", "β-caryophyllene":"beta_caryophyllene",
    "caryophyllene":"beta_caryophyllene", "beta myrcene":"beta_myrcene",
    "β-myrcene":"beta_myrcene", "myrcene":"beta_myrcene",
    "limonene":"limonene", "linalool":"linalool", "alpha pinene":"alpha_pinene",
    "α-pinene":"alpha_pinene", "beta pinene":"beta_pinene", "β-pinene":"beta_pinene",
    "alpha humulene":"alpha_humulene", "α-humulene":"alpha_humulene",
    "humulene":"alpha_humulene", "terpinolene":"terpinolene", "ocimene":"ocimene",
    "fenchol":"fenchol", "bisabolol":"bisabolol", "α-bisabolol":"bisabolol", "camphene":"camphene",
    "terpineol":"terpineol", "valencene":"valencene", "guaiol":"guaiol", "geraniol":"geraniol",
}
VALUE = r"(?P<value>(?:<[ \t]*)?(?:LOQ|LOD|MRL|ND|N/D|[0-9]+(?:\.[0-9]+)?))[ \t]*(?P<unit>%|mg/g|ppm|ppb)?"
# An identifier has a digit. The labels also head columns and notes ("Lot
# Size", "Parent Lot: ... Sampling Notes", "Is Production Batch false",
# "Sample ID #  Sample Name"), and a digit-free capture is one of those words.
ID = r"([A-Z0-9][A-Z0-9._/-]{3,})"
SAMPLE_IDS = [
    re.compile(r"(?:Sample\s*ID|Sample\s*#|Lab\s*ID|Regulator\s+Sample\s+ID)\s*[:#]?\s*"+ID, re.I),
    re.compile(r"\bSample\s*:\s*"+ID, re.I),  # DRS, ACT, Kaycha: "Sample: 2511RLI1133-4373"
]
BATCH_IDS = [
    re.compile(r"(?:Regulator\s+Batch\s+ID|Batch\s+Lot\s+ID|Batch(?:\s*ID|\s*#|\s*No\.?|\s*Number)?|METRC\s*Batch)\s*[:#]?\s*"+ID, re.I),
]
LOT_IDS = [
    re.compile(r"(?:Lot(?:\s*ID|\s*#|\s*No\.?|\s*Number)?)\s*[:#]?\s*"+ID, re.I),
]
# The package the lab sampled, when the certificate prints it.
METRC_TAGS = [
    re.compile(r"(?:Seed\s+to\s+sale|Metrc\s+Package\s*#?|TEST\s+PKG|Test\s+Package|Source\s+Package)\s*[:#]?\s*(1A4[0-9A-F]{21})\b", re.I),
]
DATES = {
    "sampled": [r"Sampled Date", r"Sampling Date", r"Sample Collection Date(?:/Time)?", r"Date Sampled", r"Sample Collected", r"Sampled"],
    "received": [r"Sample Received", r"Date Received"],
    "reported": [r"Report Date", r"Date Reported", r"Report Created", r"Date Released", r"Completed", r"Published"],
    "packaged": [r"Packaged Date", r"Package Date"],
}
# A Metrc Retail ID printout is a card: "Label   value" rows, or (the newer
# page) the label on one line and its value on the next.
RETAIL_FIELDS = {
    "cultivar":"strain", "id":"metrcTag", "facility":"facility", "product name":"product",
    "license":"license", "tested by":"labName", "tested date":"tested",
    "laboratory license":"labLicense", "cultivation date":"cultivated", "packaged date":"packaged",
    "is production batch":"productionBatch", "name":"product",
}
RETAIL_STACKED = {
    "package tag":"metrcTag", "facility":"facility", "facility license":"license", "packaged on":"packaged",
    "tested date":"tested", "tested by":"labName", "laboratory license":"labLicense",
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


def is_identifier(value):
    return bool(value) and any(c.isdigit() for c in value)


def first_id(patterns, text):
    for p in patterns:
        for m in p.finditer(text):
            v=m.group(1).strip().rstrip(".,;")
            if is_identifier(v): return v
    return None


def doc_type(text):
    low=(text or "").lower()
    head=" ".join(low[:800].split())
    if re.search(r"\bmetrc retail ?i ?d\b",head) or "powered by retail id" in low:
        return "metrc-retail-id"
    return "lab-coa"


def lab_of(text):
    return next((name for needle,name in LABS if needle.lower() in (text or "").lower()),None)


def retail_card(text):
    """The label/value rows of a Metrc Retail ID printout."""
    out={}
    for m in re.finditer(r"(?im)^[ \t]*([A-Za-z][A-Za-z ]+?)[ \t]{2,}(\S.*?)[ \t]*$", text):
        key=RETAIL_FIELDS.get(m.group(1).strip().lower())
        if key and key not in out:
            out[key]=m.group(2).strip()
    lines=[x.strip() for x in text.splitlines() if x.strip()]
    for label,value in zip(lines,lines[1:]):
        key=RETAIL_STACKED.get(label.lower())
        if key and key not in out:
            out[key]=value
    for key in ("tested","cultivated","packaged"):
        if key in out: out[key]=iso(out[key])
    if "productionBatch" in out:
        out["productionBatch"]={"true":True,"false":False}.get(out["productionBatch"].lower())
    if not TAG.fullmatch(out.get("metrcTag") or ""): out.pop("metrcTag",None)
    return out


def qualifier(raw):
    x=re.sub(r"\s+","",raw.upper())
    if x in ("ND","N/D"): return None, "ND"
    if x == "LOD": return None, "<LOD"
    if x == "LOQ": return None, "<LOQ"
    if x.startswith("<"):
        # "<0.0040" is a bound: the lab says the value is below it, not that
        # it is the value. The bound is kept in the qualifier.
        inner=x[1:]
        return None, "<"+inner
    try: v=float(x)
    except ValueError: return None, x
    if v == 0: return None, "reported_zero"  # a bare 0 matches every other bare 0
    return v, None


def analytes(text, printout=False):
    """Parse conservative one-line 'Analyte value unit' rows. One line: [ \\t],
    never \\s, which would take a summary box's number from the next line.
    A Retail ID printout also prints "Total THC  261 mg/pkg  26.1%": its
    percentage is the one marked %."""
    out={}
    aliases=sorted(ANALYTE_ALIASES, key=len, reverse=True)
    names="|".join(re.escape(a) for a in aliases)
    per_pkg=r"(?:[0-9]+(?:\.[0-9]+)?[ \t]*mg/pkg[ \t]+)" + ("?" if printout else "{0}")
    rx=re.compile(r"(?im)^[ \t]*(?P<name>"+names+r")[ \t]*(?:[:|][ \t]*|[ \t]+)"+per_pkg+VALUE+r"[ \t]*$")
    for m in rx.finditer(text):
        key=ANALYTE_ALIASES[m.group("name").lower()]
        val,q=qualifier(m.group("value"))
        out[key]={"value":val,"unit":m.group("unit"),"qualifier":q}
    return dict(sorted(out.items()))


def physical(text):
    """Moisture % and water activity, from one line each, taken only when the
    value is the line's one bare number: labs print limit and result in either
    order — Keystone "Water Activity 0.05 0.65 0.58 Pass" (LOQ, limit,
    result), CTNY "Moisture 15 % 9.8 % Pass" (limit, result), MCR "Moisture
    Content 10.0% 15.0% Pass" (result, limit). A limit written with its
    comparator ("≤ 0.65") does not count. Out-of-range values are not kept."""
    fields={}
    # A number standing alone: not part of a method code (TM-NY-1, SOP-055-GA),
    # a date or a time. Moisture must carry its %.
    alone=r"(?<![\w.\-/:])([0-9]+(?:\.[0-9]+)?)(?![\w.\-/:])"
    for key,label,unit,top in (("moisture",r"Moisture(?: Content)?",r"[ \t]*%",100),
                               ("waterActivity",r"Water Activity|Aw","",1)):
        for m in re.finditer(r"(?im)^[ \t]*(?:"+label+r")\b(?P<rest>[^\n]*)$",text):
            rest=re.sub(r"[≤≥<>]=?[ \t]*[0-9.]+","",m.group("rest"))
            bare=re.findall(alone+unit,rest)
            if len(bare)==1 and 0<float(bare[0])<=top:
                fields[key]=float(bare[0])
                break
    return fields


def parse_text(text, source_url=None, document_sha256=None):
    kind=doc_type(text)
    card=retail_card(text) if kind=="metrc-retail-id" else {}
    dates={k:first(v,text) for k,v in DATES.items()}
    if kind=="metrc-retail-id":
        # The card's own dates; its "Cultivation Date" is not the harvest.
        dates.update(sampled=None, received=None, reported=None, packaged=card.pop("packaged",None))
    metrc=card.pop("metrcTag",None) or first_id(METRC_TAGS,text)
    return {
        "sourceUrl":source_url, "sha256":document_sha256, "docType":kind,
        "lab":lab_of(card.get("labName")) if kind=="metrc-retail-id" else lab_of(text),
        "sampleId":None if kind=="metrc-retail-id" else first_id(SAMPLE_IDS,text),
        "batchTag":None if kind=="metrc-retail-id" else first_id(BATCH_IDS,text),
        "lotNumber":None if kind=="metrc-retail-id" else first_id(LOT_IDS,text),
        "metrcTag":metrc, **dates, **card,
        "analytes":analytes(text,printout=kind=="metrc-retail-id"), **physical(text),
        "parser":{"name":"coa-forensics","version":PARSER_VERSION},
    }


def sha256_bytes(blob):
    return hashlib.sha256(blob).hexdigest()


def text_sha256(text):
    """Hash of the extracted text: tells a re-rendered PDF (new bytes, same
    words) from a changed certificate."""
    lines=[" ".join(x.split()) for x in (text or "").splitlines()]
    return hashlib.sha256("\n".join(x for x in lines if x).encode()).hexdigest()


def chemistry_fingerprint(record):
    payload={
        "analytes":{k:{"value":v.get("value"),"unit":v.get("unit"),"qualifier":v.get("qualifier")}
                    for k,v in sorted((record.get("analytes") or {}).items())},
        "moisture":record.get("moisture"), "waterActivity":record.get("waterActivity"),
    }
    return hashlib.sha256(json.dumps(payload,sort_keys=True,separators=(",",":")).encode()).hexdigest()
