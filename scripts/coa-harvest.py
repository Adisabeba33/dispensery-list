#!/usr/bin/env python3
"""Harvest known public COAs into a reproducible forensic index.

PDF bytes are NOT committed to Git. Their SHA-256 is retained so a downloaded
copy can be proven identical. A changed document at the same URL becomes a
new version in history instead of silently overwriting evidence.

Each run asks never-fetched URLs first, then the ones checked longest ago, so
the budget walks the whole list instead of re-reading its first 50 (runs 1-8
fetched the same 50 of 780 every time). A re-check is also what can see a
document change. A version keeps the SHA-256 of its bytes and of its text:
new bytes with the same text is a re-rendered PDF, new text a new document.
A version parsed by an older parser is re-parsed when its bytes come back.
"""
import argparse
import importlib.util
import json
import shutil
import subprocess
import tempfile
import time
import urllib.request
from datetime import date
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
LOTS=ROOT/"data/shelf-terpenes.json"
OUTDIR=ROOT/"data/forensics"
OUT=OUTDIR/"coa-index.json"
PACE=0.3  # seconds between downloads: every URL so far is one shop's POS

spec=importlib.util.spec_from_file_location("coa_forensics",ROOT/"scripts/coa-forensics.py")
cf=importlib.util.module_from_spec(spec); spec.loader.exec_module(cf)


def load(path,default):
    try:return json.loads(path.read_text())
    except (FileNotFoundError,json.JSONDecodeError):return default


def urls():
    raw=load(LOTS,{})
    return sorted({u for lot in raw.get("lots",[]) for u in (lot.get("certificates") or []) if isinstance(u,str) and u.startswith(("http://","https://"))})


def order(targets,docs):
    """Never-checked URLs first, then by the day each was last checked."""
    def key(url):
        d=docs.get(url) or {}
        return (bool(d.get("lastChecked") or d.get("versions") or d.get("lastError")),d.get("lastChecked") or "",url)
    return sorted(targets,key=key)


def fetch(url):
    req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 forensic-coa-index/1"})
    with urllib.request.urlopen(req,timeout=45) as r:
        return r.read()


def text_of(blob,workdir):
    p=Path(workdir)/"coa.pdf"; p.write_bytes(blob)
    run=subprocess.run(["pdftotext","-layout",str(p),"-"],capture_output=True,text=True,timeout=60)
    if run.returncode:return None,"pdftotext:"+str(run.returncode)
    return run.stdout,None


def record_of(text,url,sha):
    record=cf.parse_text(text,source_url=url,document_sha256=sha)
    record["chemistryFingerprint"]=cf.chemistry_fingerprint(record)
    return record


def ingest(docs,url,blob,text,today):
    """Add one download to the index; return what it was: "same", "reparsed",
    "new", "changed" (new text at a known URL) or "rerendered" (new bytes,
    same text)."""
    sha=cf.sha256_bytes(blob)
    entry=docs.setdefault(url,{"versions":[]})
    entry["lastChecked"]=today
    entry.pop("lastError",None)
    versions=entry.setdefault("versions",[])
    prior=next((v for v in versions if v.get("sha256")==sha),None)
    if prior:
        prior["lastSeen"]=today
        if ((prior.get("record") or {}).get("parser") or {}).get("version")!=cf.PARSER_VERSION and text is not None:
            prior["record"]=record_of(text,url,sha)
            prior["textSha256"]=cf.text_sha256(text)
            return "reparsed"
        return "same"
    version={"sha256":sha,"textSha256":cf.text_sha256(text),"firstSeen":today,"lastSeen":today,
             "bytes":len(blob),"record":record_of(text,url,sha)}
    kind="new"
    if versions:
        last=versions[-1]
        version["previous"]=last["sha256"]
        kind="rerendered" if last.get("textSha256")==version["textSha256"] else "changed"
    versions.append(version)
    return kind


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--network",action="store_true",help="download known COA URLs")
    ap.add_argument("--budget",type=int,default=50)
    args=ap.parse_args()
    OUTDIR.mkdir(parents=True,exist_ok=True)
    restored=OUT.exists()
    known=json.loads(OUT.read_text()) if restored else {"documents":{}}  # unreadable index stops the run
    docs=known.get("documents",{})
    today=date.today().isoformat()
    counts={"same":0,"reparsed":0,"new":0,"changed":0,"rerendered":0}
    requested=errors=0

    if args.network and not shutil.which("pdftotext"):
        raise SystemExit("pdftotext not found (poppler-utils)")

    targets=urls()
    if args.network:
        with tempfile.TemporaryDirectory() as workdir:
            for url in order(targets,docs)[:max(0,args.budget)]:
                if requested:time.sleep(PACE)
                requested+=1
                try:
                    blob=fetch(url)
                    text,err=text_of(blob,workdir)
                    if err:raise RuntimeError(err)
                    counts[ingest(docs,url,blob,text,today)]+=1
                except Exception as exc:
                    errors+=1
                    entry=docs.setdefault(url,{"versions":[]})
                    entry["lastChecked"]=today
                    entry["lastError"]={"day":today,"type":type(exc).__name__,"message":str(exc)[:160]}

    fetched=[u for u in targets if (docs.get(u) or {}).get("versions")]
    payload={
        "about":"Versioned forensic index of public COAs. PDF bytes are not stored in Git; SHA-256 proves document identity.",
        "day":today,"documents":dict(sorted(docs.items())),
        "run":{"knownUrls":len(targets),"indexedUrls":len(fetched),"restored":restored,
               "network":args.network,"budget":args.budget,"requested":requested,
               "parsedNewVersions":counts["new"]+counts["changed"]+counts["rerendered"],
               "changedDocuments":counts["changed"],"rerenderedDocuments":counts["rerendered"],
               "unchanged":counts["same"],"reparsed":counts["reparsed"],"errors":errors},
    }
    OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=1)+"\n")
    print(f"coa-forensics: {len(targets)} URLs, {len(fetched)} indexed; requested {requested}; "
          f"new {counts['new']}; changed {counts['changed']}; re-rendered {counts['rerendered']}; "
          f"unchanged {counts['same']}; re-parsed {counts['reparsed']}; errors {errors}")


if __name__=="__main__":
    main()
