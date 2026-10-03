#!/usr/bin/env python3
"""Проверки scripts/retail-id.py без сети: сколько спрашивается за прогон, в
каком порядке, с паузами и когда прогон перестаёт спрашивать."""
import importlib.util
import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("retail_id", ROOT / "scripts/retail-id.py")
rid = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rid)
failures = []


def check(cond, what):
    if not cond:
        failures.append(what)


def tag(n):
    return f"1A4120300000216{n:09d}"


# --- план: новые первыми, перепроверки — самые давние, не меньше RECHECK_MIN
packages = {tag(i): {"found": False, "checked": "2026-08-01" if i % 2 else "2026-07-01"} for i in range(100)}
fresh = {tag(1000 + i) for i in range(400)}
todo, nf, nr = rid.plan(fresh | set(packages), packages, "2026-09-01", 150)
check(len(todo) == 150, f"не больше места: {len(todo)}")
check(nf == 400 and nr == 100, f"сколько ждало: {nf}, {nr}")
check(sum(t in fresh for t in todo) == 150 - rid.RECHECK_MIN, "новым — всё, кроме мест перепроверок")
rechecked = [t for t in todo if t in packages]
check(len(rechecked) == rid.RECHECK_MIN and all(packages[t]["checked"] == "2026-07-01" for t in rechecked),
      "перепроверки — самые давние первыми")
todo, _, _ = rid.plan({tag(1000)} | set(packages), packages, "2026-09-01", 150)
check(len(todo) == 101, f"новых мало — место перепроверкам: {len(todo)}")
todo, _, _ = rid.plan(set(packages), packages, "2026-06-01", 150)
check(todo == [], "ненайденные, проверенные недавно, не спрашиваются")
packages[tag(5)] = {"found": True, "checked": "2026-07-01"}
check(tag(5) not in rid.plan(set(packages), packages, "2026-09-01", 150)[0], "найденный не перечитывается")
todo, _, _ = rid.plan(fresh | set(packages), packages, "2026-09-01", 10)
check(len(todo) == 10, f"места меньше RECHECK_MIN — не больше места: {len(todo)}")

# --- прогон: по одному, с паузой между запросами, не больше бюджета
sleeps = []
with tempfile.TemporaryDirectory() as d:
    d = Path(d)
    rid.LISTINGS = d / "listings.json"
    rid.OUT = d / "retail-id.json"
    rid.ROOT = d
    rid.LISTINGS.write_text(json.dumps([{"packageIds": [tag(i) for i in range(500)]}]))
    asked = []
    rid.card = lambda t: asked.append(t) or {"found": False}
    rid.main(rid.Budget(150, sleep=sleeps.append))
    out = json.loads(rid.OUT.read_text())
    check(len(asked) == 150 and len(out["packages"]) == 150, f"за прогон 150 из 500: {len(asked)}")
    check(len(sleeps) == 149 and all(rid.PAUSE[0] <= s <= rid.PAUSE[1] for s in sleeps),
          f"пауза перед каждым запросом, кроме первого: {len(sleeps)}")
    rid.main(rid.Budget(150, sleep=lambda s: None))
    check(len(asked) == 300 and len(set(asked)) == 300, "следующий прогон спрашивает следующие метки")

    # --- ошибки подряд останавливают прогон
    rid.OUT.unlink()
    asked.clear()
    rid.card = lambda t: asked.append(t) or {"found": None, "error": "HTTP 503"}
    rid.main(rid.Budget(150, sleep=lambda s: None))
    check(len(asked) == rid.STOP_AFTER_ERRORS, f"после {rid.STOP_AFTER_ERRORS} ошибок подряд — стоп: {len(asked)}")
    check(all(v["found"] is None for v in json.loads(rid.OUT.read_text())["packages"].values()),
          "неотвеченные остаются неотвеченными — спросятся снова")

if failures:
    print(f"retail-id-check: {len(failures)} ошибок")
    for f in failures:
        print("  -", f)
    sys.exit(1)
print("retail-id-check: ok")
