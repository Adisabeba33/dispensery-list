#!/usr/bin/env python3
"""Find chemistry identity candidates across Retail-ID cards and COA records.

This is an evidence triage tool, not an accusation engine.  It emits candidates
with explicit reasons and shared measurements.  lot-twins.py remains untouched.
"""
import argparse
import json
import math
from collections import defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
FDIR=ROOT/"data/forensics"
RETAIL=FDIR/"retail-cards.jsonl"
COA=FDIR/"coa-index.json"
OUT=FDIR/"collisions.json"

# Exact source precision is preferred. Near matching is intentionally tight and
# requires several independent analytes.
ABS_TOL={"total_thc":0.03,"thc":0.03,"thca":0.03,"delta_9_thc":0.02,
         "total_cbd":0.02,"cbd":0.02,"cbda":0.02,"cbg":0.02,"cbga":0.02}
DEFAULT_TOL=0.005
MIN_COMMON=5
MIN_TERPENES=4


def load_json(path,default):
    try:return json.loads(path.read_text())
    except (FileNotFoundError,json.JSONDecodeError):return default


def load_jsonl(path):
    try:
        return [json.loads(x) for x in path.read_text().splitlines() if x.strip()]
    except FileNotFoundError:return []


def value(v):
    if isinstance(v,(int,float)):return float(v)
    if isinstance(v,dict) and isinstance(v.get("value"),(int,float)):return float(v["value"])
    return None


def retail_measurements(row):
    out={}
    for family in ("totals","cannabinoids","terpenes"):
        for k,v in (row.get(family) or {}).items():
            n=value(v)
            if n is not None:out[k]=n
    # Old cached cards may carry these separately.
    if isinstance(row.get("thc"),(int,float)):out.setdefault("total_thc",float(row["thc"]))
    return out


def coa_measurements(record):
    return {k:float(v["value"]) for k,v in (record.get("analytes") or {}).items()
            if isinstance(v,dict) and isinstance(v.get("value"),(int,float))}


def identity(row,kind):
    if kind=="retail":
        return {
            "kind":"retail","id":row.get("tag"),"product":row.get("product"),
            "strain":row.get("strain"),"lab":row.get("lab"),"tested":row.get("tested"),
            "batchTag":row.get("batchTag"),"lotNumber":row.get("lotNumber"),
            "manufacturer":row.get("manufacturer"),"facility":row.get("facility"),
        }
    return {
        "kind":"coa","id":row.get("sha256"),"url":row.get("sourceUrl"),
        "lab":row.get("lab"),"sampleId":row.get("sampleId"),"tested":row.get("reported"),
        "batchTag":row.get("batchTag"),"lotNumber":row.get("lotNumber"),
    }


def name_key(x):
    return " ".join(str(x or "").lower().replace("-"," ").split())


def materially_different(a,b):
    names=[(a.get("product"),b.get("product")),(a.get("strain"),b.get("strain"))]
    known=[(name_key(x),name_key(y)) for x,y in names if x and y]
    return any(x!=y for x,y in known)


def compare(a,b):
    common=sorted(a.keys() & b.keys())
    matched=[]; different=[]
    for k in common:
        tol=ABS_TOL.get(k,DEFAULT_TOL)
        delta=abs(a[k]-b[k])
        item={"analyte":k,"a":a[k],"b":b[k],"delta":round(delta,6),"tolerance":tol}
        (matched if delta<=tol+1e-12 else different).append(item)
    terp=[x for x in matched if x["analyte"] not in ABS_TOL]
    return common,matched,different,terp


def classify(aid,bid,ameas,bmeas,afp=None,bfp=None):
    common,matched,diff,terp=compare(ameas,bmeas)
    if afp and bfp and afp==bfp and len(common)>=1:
        return "exact_fingerprint",common,matched,diff
    if len(common)>=MIN_COMMON and len(terp)>=MIN_TERPENES and not diff:
        return "near_chemical_clone",common,matched,diff
    return None,common,matched,diff


def records():
    out=[]
    for row in load_jsonl(RETAIL):
        meas=retail_measurements(row)
        if meas:
            out.append({"identity":identity(row,"retail"),"measurements":meas,
                        "fingerprint":row.get("fingerprint"),"raw":row})
    coa=load_json(COA,{}).get("documents",{})
    for url,doc in coa.items():
        for v in doc.get("versions") or []:
            r=v.get("record") or {}
            meas=coa_measurements(r)
            if meas:
                out.append({"identity":identity(r,"coa"),"measurements":meas,
                            "fingerprint":r.get("chemistryFingerprint"),"raw":r})
    return out


def candidates(rows):
    found=[]
    for i,a in enumerate(rows):
        for b in rows[i+1:]:
            # Do not compare the same public object to itself.
            if a["identity"].get("kind")==b["identity"].get("kind") and a["identity"].get("id")==b["identity"].get("id"):
                continue
            kind,common,matched,diff=classify(a["identity"],b["identity"],a["measurements"],b["measurements"],
                                              a.get("fingerprint"),b.get("fingerprint"))
            if not kind:continue
            # Same known batch is valuable linkage; different commercial identity
            # makes it especially useful for Lot Twins triage.
            same_batch=bool(a["identity"].get("batchTag") and
                            a["identity"].get("batchTag")==b["identity"].get("batchTag"))
            different_name=materially_different(a["identity"],b["identity"])
            found.append({
                "signal":kind,"a":a["identity"],"b":b["identity"],
                "sameBatch":same_batch,"differentCommercialName":different_name,
                "commonAnalytes":len(common),"matchedAnalytes":matched,
                "differentAnalytes":diff,
                "priority":"high" if same_batch and different_name else
                           "medium" if different_name else "review",
            })
    return found


def main():
    ap=argparse.ArgumentParser();ap.parse_args()
    FDIR.mkdir(parents=True,exist_ok=True)
    rows=records(); hits=candidates(rows)
    OUT.write_text(json.dumps({
        "about":"Chemistry collision candidates for human/lot-twins review; not findings of misconduct.",
        "thresholds":{"minCommonAnalytes":MIN_COMMON,"minTerpenes":MIN_TERPENES,
                      "defaultAbsoluteTolerance":DEFAULT_TOL,"namedTolerances":ABS_TOL},
        "recordsCompared":len(rows),"candidates":hits,
    },ensure_ascii=False,indent=1)+"\n")
    print(f"forensic-collisions: {len(rows)} records, {len(hits)} candidates, "
          f"{sum(1 for x in hits if x['priority']=='high')} high priority")


if __name__=="__main__":main()
