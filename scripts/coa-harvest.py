#!/usr/bin/env python3
"""Harvest known public COAs into a reproducible forensic index.

PDF bytes are NOT committed to Git. Their SHA-256 is retained so a downloaded
copy can be proven identical. A changed document at the same URL becomes a
new version in history instead of silently overwriting evidence.
"""
import argparse
import importlib.util
import json
import shutil
import subprocess
import tempfile
import urllib.request
from datetime import date
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
LOTS=ROOT/"data/shelf-terpenes.json"
OUTDIR=ROOT/"data/forensics"
OUT=OUTDIR/"coa-index.json"

spec=importlib.util.spec_from_file_location("coa_forensics",ROOT/"scripts/coa-forensics.py")
cf=importlib.util.module_from_spec(spec); spec.loader.exec_module(cf)


def load(path,default):
    try:return json.loads(path.read_text())
    except (FileNotFoundError,json.JSONDecodeError):return default


def urls():
    raw=load(LOTS,{})
    return sorted({u for lot in raw.get("lots",[]) for u in (lot.get("certificates") or []) if isinstance(u,str) and u.startswith(("http://","https://"))})


def fetch(url):
    req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 forensic-coa-index/1"})
    with urllib.request.urlopen(req,timeout=45) as r:
        return r.read()


def text_of(blob,workdir):
    p=Path(workdir)/"coa.pdf"; p.write_bytes(blob)
    run=subprocess.run(["pdftotext","-layout",str(p),"-"],capture_output=True,text=True,timeout=60)
    if run.returncode:return None,"pdftotext:"+str(run.returncode)
    return run.stdout,None


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--network",action="store_true",help="download known COA URLs")
    ap.add_argument("--budget",type=int,default=50)
    args=ap.parse_args()
    OUTDIR.mkdir(parents=True,exist_ok=True)
    known=load(OUT,{"documents":{}})
    docs=known.get("documents",{})
    today=date.today().isoformat()
    requested=parsed=changed=errors=0

    if args.network and not shutil.which("pdftotext"):
        raise SystemExit("pdftotext not found (poppler-utils)")

    targets=urls()
    if args.network:
        with tempfile.TemporaryDirectory() as workdir:
            for url in targets:
                if requested>=max(0,args.budget):break
                requested+=1
                try:
                    blob=fetch(url); sha=cf.sha256_bytes(blob)
                    old=docs.get(url) or {}
                    versions=old.get("versions") or []
                    prior=next((v for v in versions if v.get("sha256")==sha),None)
                    if prior:
                        prior["lastSeen"]=today
                        continue
                    text,err=text_of(blob,workdir)
                    if err:raise RuntimeError(err)
                    record=cf.parse_text(text,source_url=url,document_sha256=sha)
                    record["chemistryFingerprint"]=cf.chemistry_fingerprint(record)
                    version={"sha256":sha,"firstSeen":today,"lastSeen":today,"bytes":len(blob),"record":record}
                    versions.append(version)
                    docs[url]={"versions":versions}
                    parsed+=1
                    if old and versions[:-1]:changed+=1
                except Exception as exc:
                    errors+=1
                    entry=docs.setdefault(url,{"versions":[]})
                    entry["lastError"]={"day":today,"type":type(exc).__name__,"message":str(exc)[:160]}

    payload={
        "about":"Versioned forensic index of public COAs. PDF bytes are not stored in Git; SHA-256 proves document identity.",
        "day":today,"documents":dict(sorted(docs.items())),
        "run":{"knownUrls":len(targets),"network":args.network,"budget":args.budget,
               "requested":requested,"parsedNewVersions":parsed,"changedDocuments":changed,"errors":errors},
    }
    OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=1)+"\n")
    print(f"coa-forensics: {len(targets)} URLs; requested {requested}; new versions {parsed}; changed {changed}; errors {errors}")


if __name__=="__main__":
    main()
