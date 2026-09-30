#!/usr/bin/env python3
"""Find chemistry identity candidates across Retail-ID cards and COA records.

This is an evidence triage tool, not an accusation engine.  It emits candidates
with explicit reasons and shared measurements.  lot-twins.py remains untouched;
its name rules (norm_name / same_name) decide whether two names differ.

Only measured values are compared: a qualifier (ND, <LOQ, a Retail ID card's
reported 0) is not a value, and sums (total terpenes, total cannabinoids) are
not independent dimensions. "Terpene-like" is an explicit family — the source's
terpene section on a Retail ID card, TERPENES for a COA — not "whatever is not
a cannabinoid".
"""
import argparse
import importlib.util
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
FDIR=ROOT/"data/forensics"
RETAIL=FDIR/"retail-cards.jsonl"
COA=FDIR/"coa-index.json"
OUT=FDIR/"collisions.json"

spec=importlib.util.spec_from_file_location("lot_twins",ROOT/"scripts/lot-twins.py")
lt=importlib.util.module_from_spec(spec);spec.loader.exec_module(lt)

# Exact source precision is preferred. Near matching is intentionally tight and
# requires several independent analytes.
ABS_TOL={"total_thc":0.03,"thc":0.03,"thca":0.03,"delta_9_thc":0.02,
         "total_cbd":0.02,"cbd":0.02,"cbda":0.02,"cbg":0.02,"cbga":0.02}
DEFAULT_TOL=0.005
MIN_COMMON=5
MIN_TERPENES=4
CANNABINOIDS=set(ABS_TOL)|{"cbc","cbn","thcv","cbdv","delta_8_thc","cbca","cbna","thcva","cbdva"}
TERPENES={
    "alpha_bisabolol","alpha_humulene","alpha_pinene","alpha_terpinene","alpha_terpineol","beta_caryophyllene",
    "beta_myrcene","beta_ocimene","beta_pinene","bisabolol","borneol","camphene","camphor","caryophyllene_oxide",
    "cedrol","delta_3_carene","eucalyptol","farnesene","fenchol","fenchone","gamma_terpinene","geraniol",
    "geranyl_acetate","guaiol","isoborneol","isopulegol","limonene","linalool","menthol","nerol","nerolidol",
    "ocimene","p_cymene","phytol","pulegone","sabinene","sabinene_hydrate","terpineol","terpinolene",
    "trans_nerolidol","valencene",
}


def load_json(path,default):
    try:return json.loads(path.read_text())
    except (FileNotFoundError,json.JSONDecodeError):return default


def load_jsonl(path):
    try:
        return [json.loads(x) for x in path.read_text().splitlines() if x.strip()]
    except FileNotFoundError:return []


def value(v):
    """A measured value, or None: qualifiers (ND, <LOQ, reported zero) are not values."""
    if isinstance(v,bool):return None
    if isinstance(v,(int,float)):return float(v) if v>0 else None
    if isinstance(v,dict) and not v.get("qualifier"):return value(v.get("value"))
    return None


def retail_measurements(row):
    """(measurements, terpene keys) of a Retail ID card."""
    out={};terp=set()
    for family in ("totals","cannabinoids","terpenes"):
        for k,v in (row.get(family) or {}).items():
            n=value(v)
            if n is None:continue
            if family=="terpenes":terp.add(k)
            elif k not in CANNABINOIDS:continue  # sums and unknowns are not dimensions
            out[k]=n
    # Old cached cards may carry these separately.
    n=value(row.get("thc"))
    if n is not None:out.setdefault("total_thc",n)
    return out,terp


def coa_measurements(record):
    out={k:value(v) for k,v in (record.get("analytes") or {}).items() if k in CANNABINOIDS or k in TERPENES}
    return {k:v for k,v in out.items() if v is not None}


def identity(row,kind):
    if kind=="retail":
        return {
            "kind":"retail","id":row.get("tag"),"product":row.get("product"),
            "strain":row.get("strain"),"lab":row.get("lab"),"tested":row.get("tested"),
            "batchTag":row.get("batchTag"),"sourcePackage":row.get("sourcePackage"),
            "lotNumber":row.get("lotNumber"),"manufacturer":row.get("manufacturer"),
            "facility":row.get("facility"),
        }
    return {
        "kind":"coa","id":row.get("sha256"),"url":row.get("sourceUrl"),"docType":row.get("docType"),
        "lab":row.get("lab"),"sampleId":row.get("sampleId"),"tested":row.get("reported") or row.get("tested"),
        "batchTag":row.get("batchTag"),"lotNumber":row.get("lotNumber"),"metrcTag":row.get("metrcTag"),
        "product":row.get("product"),"strain":row.get("strain"),
    }


def name_of(x):
    """The commercial name to compare: the strain, else the product."""
    return x.get("strain") or x.get("product")


def name_key(x):
    return lt.norm_name(x)[0] if x else ""


def same_name(x,y):
    return lt.same_name(lt.norm_name(x),lt.norm_name(y))


def materially_different(a,b):
    """Compare like with like: strains when both sides have one, else products.
    A missing name is unknown, not different; spellings Lot Twins folds
    ("Blue-Dream" / "blue dream", "OG #8" / "Ghost OG #8") are one name."""
    for field in ("strain","product"):
        x,y=a.get(field),b.get(field)
        if x and y:
            return not same_name(x,y)
    return False


def package(i):
    return i.get("id") if i.get("kind")=="retail" else i.get("metrcTag")


def same_object(a,b):
    """One public object seen twice: the same card, the same document (any
    version of one URL), or a certificate of the very package a card is."""
    if a.get("kind")==b.get("kind") and a.get("id")==b.get("id"):return True
    if a.get("url") and a.get("url")==b.get("url"):return True
    pa,pb=package(a),package(b)
    return bool(pa and pa==pb)


def compare(a,b,aterp=None,bterp=None):
    common=sorted(a.keys() & b.keys())
    matched=[]; different=[]
    for k in common:
        tol=ABS_TOL.get(k,DEFAULT_TOL)
        delta=abs(a[k]-b[k])
        item={"analyte":k,"a":a[k],"b":b[k],"delta":round(delta,6),"tolerance":tol}
        (matched if delta<=tol+1e-12 else different).append(item)

    def terpene(k,side):
        return k in side if side is not None else k in TERPENES
    terp=[x for x in matched if terpene(x["analyte"],aterp) and terpene(x["analyte"],bterp)]
    return common,matched,different,terp


def classify(aid,bid,ameas,bmeas,afp=None,bfp=None,aterp=None,bterp=None):
    common,matched,diff,terp=compare(ameas,bmeas,aterp,bterp)
    # A hash over one or two measurements is not a chemical fingerprint in the
    # forensic sense: common shelf THC values collide constantly. Exact hashes
    # must meet the same dimensional evidence floor as near-clones.
    if afp and bfp and afp==bfp and len(common)>=MIN_COMMON and len(terp)>=MIN_TERPENES:
        return "exact_fingerprint",common,matched,diff
    if len(common)>=MIN_COMMON and len(terp)>=MIN_TERPENES and not diff:
        return "near_chemical_clone",common,matched,diff
    return None,common,matched,diff


def records():
    out=[]
    for row in load_jsonl(RETAIL):
        meas,terp=retail_measurements(row)
        if meas:
            out.append({"identity":identity(row,"retail"),"measurements":meas,"terpenes":terp,
                        "fingerprint":row.get("fingerprint"),"raw":row})
    coa=load_json(COA,{}).get("documents",{})
    for url,doc in coa.items():
        for v in doc.get("versions") or []:
            r=v.get("record") or {}
            meas=coa_measurements(r)
            if meas:
                out.append({"identity":identity(r,"coa"),"measurements":meas,"terpenes":None,
                            "fingerprint":r.get("chemistryFingerprint"),"raw":r})
    return out


def candidates(rows):
    found=[]
    for i,a in enumerate(rows):
        for b in rows[i+1:]:
            if same_object(a["identity"],b["identity"]):
                continue
            kind,common,matched,diff=classify(a["identity"],b["identity"],a["measurements"],b["measurements"],
                                              a.get("fingerprint"),b.get("fingerprint"),
                                              a.get("terpenes"),b.get("terpenes"))
            if not kind:continue
            # Same known batch is valuable linkage; different commercial identity
            # makes it especially useful for Lot Twins triage.
            same_batch=bool(a["identity"].get("batchTag") and
                            a["identity"].get("batchTag")==b["identity"].get("batchTag"))
            different_name=materially_different(a["identity"],b["identity"])
            # Same commercial identity within the same known batch is ordinary
            # packaging duplication, not a collision candidate.
            if same_batch and not different_name:
                continue
            found.append({
                "signal":kind,"a":a["identity"],"b":b["identity"],
                "sameBatch":same_batch,"differentCommercialName":different_name,
                "commonAnalytes":len(common),"matchedAnalytes":matched,
                "differentAnalytes":diff,
                "priority":"high" if same_batch and different_name else
                           "medium" if different_name else "review",
            })
    # Collapse package-level duplicates into one identity/batch relationship.
    deduped={}
    for hit in found:
        def commercial(x):
            return name_key(name_of(x)) or str(x.get("id"))
        pair=tuple(sorted((commercial(hit["a"]),commercial(hit["b"]))))
        batch=hit["a"].get("batchTag") if hit.get("sameBatch") else None
        key=(hit["signal"],batch,pair)
        old=deduped.get(key)
        if old is None or hit["commonAnalytes"]>old["commonAnalytes"]:
            deduped[key]=hit
    return list(deduped.values())


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
