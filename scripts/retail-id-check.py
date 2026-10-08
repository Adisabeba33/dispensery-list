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

# --- новые на полке — первыми, если всех не успеть
waiting = {tag(1000 + i): "2026-10-0%d" % (1 + i % 3) for i in range(400)}
todo, _, _ = rid.plan(fresh, {}, "2026-09-01", 50, waiting)
check(all(waiting[t] == "2026-10-03" for t in todo), "первыми — метки, попавшие в меню последними")

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
    check(len(out["waiting"]) == 350 and not set(asked) & set(out["waiting"]),
          "спрошенные метки уходят из ожидания, остальные ждут")
    rid.LISTINGS.write_text(json.dumps([{"packageIds": [tag(i) for i in range(600)]}]))
    rid.main(rid.Budget(150, sleep=lambda s: None))
    check(len(asked) == 300 and len(set(asked)) == 300, "следующий прогон спрашивает следующие метки")
    out = json.loads(rid.OUT.read_text())
    check(len(out["waiting"]) == 300, f"неспрошенные ждут с днём, когда их увидели: {len(out['waiting'])}")

    # --- ошибки подряд останавливают прогон
    rid.OUT.unlink()
    asked.clear()
    rid.card = lambda t: asked.append(t) or {"found": None, "error": "HTTP 503"}
    rid.main(rid.Budget(150, sleep=lambda s: None))
    check(len(asked) == rid.STOP_AFTER_ERRORS, f"после {rid.STOP_AFTER_ERRORS} ошибок подряд — стоп: {len(asked)}")
    check(all(v["found"] is None for v in json.loads(rid.OUT.read_text())["packages"].values()),
          "неотвеченные остаются неотвеченными — спросятся снова")

# --- панель сертификата из карточки
CARD = {
    "facilityName": "Grower LLC",
    "productCard": {"productName": "Caviar 3.5g"},
    "coaCard": {"fileLink": "https://blob.example/coa.pdf?sig=x", "data": json.dumps({
        "strainName": "Caviar Chop Cheese", "testedDate": "2026-08-28T00:00:00",
        "lab": {"name": "Green Analytics NY, LLC", "licenseNumber": "OCM-CPL-24-00013-L1", "docId": 159726},
        "totals": {"thc": {"percent": 26.018}, "cbd": {"percent": 0}, "terpenes": {"percent": 1.31}},
        "terpenes": {
            "bMyrcene": {"percent": 0.17}, "aPinene": {"percent": 0.02}, "bPinene": {"percent": 0.07},
            "limonene": {"percent": 0.41}, "caryophylleneOxide": {"percent": 0.01},
            "bCaryophyllene": {"percent": 0.23}, "guaiol": {"percent": 0}, "aTerpinene": {"percent": 0.03},
            "gTerpinene": {"percent": 0.02}, "cedrene": {"percent": 0.05}, "aBisabolol": {"percent": None},
        },
    })},
}
rid.curl = lambda url, *extra: (json.dumps(CARD), "200")
c = rid.read_card(tag(1))
check(c["found"] and c["thc"] == 26.018 and c["cbd"] == 0.0 and c["terpenesTotal"] == 1.31, f"THC, CBD, сумма: {c}")
check(c["terpenes"] == {"MYRCENE": 0.17, "PINENE_ALPHA": 0.02, "PINENE_BETA": 0.07, "LIMONENE": 0.41,
                        "CARYOPHYLLENE_OXIDE": 0.01, "CARYOPHYLLENE": 0.23},
      f"имена реестра; ноль, пусто и незнакомое имя не пишутся; два изомера в одно имя — ни одного: {c['terpenes']}")
check(c["lab"] == "Green Analytics NY, LLC" and c["labLicense"] == "OCM-CPL-24-00013-L1" and c["labDoc"] == 159726,
      "лаборатория, её лицензия, номер документа")
check(c["coaFile"] is True and c["tested"] == "2026-08-28", "PDF есть; день теста")
CARD["coaCard"].pop("fileLink")
check(rid.read_card(tag(1))["coaFile"] is False, "PDF нет")

# --- найденные до панели перечитываются: своим местом сверх бюджета новых (и тем, что
#     новым не понадобилось), свежие упаковки первыми
with tempfile.TemporaryDirectory() as d:
    d = Path(d)
    rid.LISTINGS, rid.OUT, rid.ROOT = d / "listings.json", d / "retail-id.json", d
    old = {tag(i): {"found": True, "checked": "2026-09-01", "packaged": f"2026-0{1 + i % 9}-01"} for i in range(400)}
    old[tag(0)]["terpenes"] = {"MYRCENE": 0.5}
    gone = tag(1000)
    old[gone] = {"found": True, "checked": "2026-09-01", "packaged": "2026-09-30"}
    rid.OUT.write_text(json.dumps({"packages": old}))
    rid.LISTINGS.write_text(json.dumps([{"packageIds": list(old) + [tag(2000 + i) for i in range(10)]}]))
    asked = []
    rid.card = lambda t: asked.append(t) or ({"found": False} if t == gone or t >= tag(2000)
                                             else {"found": True, "terpenes": {"LIMONENE": 0.3}, "thc": 25.0})
    rid.main(rid.Budget(150, sleep=lambda s: None))
    out = json.loads(rid.OUT.read_text())["packages"]
    new = [t for t in asked if t >= tag(2000)]
    check(len(new) == 10 and asked[:10] == new, "новые метки — первыми, своим бюджетом")
    re_read = asked[10:]
    check(len(asked) == rid.MAX_PER_RUN + rid.BACKFILL_PER_RUN,
          f"всего за прогон — не больше MAX_PER_RUN + BACKFILL_PER_RUN: {len(asked)}")
    check(tag(0) not in re_read, "пакет с панелью не перечитывается")
    check(re_read[0] == gone and all(out[t]["packaged"] >= out[u]["packaged"] for t, u in zip(re_read[1:], re_read[2:])),
          "свежие упаковки первыми")
    t1 = re_read[1]
    check(out[t1]["terpenes"] == {"LIMONENE": 0.3} and out[t1]["checked"] == "2026-09-01" and out[t1]["packaged"],
          "перечитанный получает панель и сохраняет прежние поля")
    check(out[gone]["found"] is True and out[gone].get("panelChecked") and "terpenes" not in out[gone],
          "пропавший из Retail ID остаётся найденным, отмечен и больше не спрашивается")
    asked.clear()
    rid.main(rid.Budget(150, sleep=lambda s: None))
    check(gone not in asked and len(asked) == 400 - 1 - len(re_read) + 1,
          f"следующий прогон перечитывает оставшихся: {len(asked)}")

if failures:
    print(f"retail-id-check: {len(failures)} ошибок")
    for f in failures:
        print("  -", f)
    sys.exit(1)
print("retail-id-check: ok")
