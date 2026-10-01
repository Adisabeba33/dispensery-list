#!/usr/bin/env python3
"""Проверка паспорта доверия бренда (scripts/brand-trust.py) на выдуманных данных, без сети.

    python scripts/brand-trust-check.py      # ненулевой код — что-то сломалось

Что проверяется:
- бренд из подтверждённой семьи двойников — красный и без сегодняшних карточек;
- семья «на заметку» видна в уликах, но яруса не меняет;
- бренд, сделанный производителем из семьи двойников, — с этой уликой;
- THC меню выше сертификата на пяти парах — улика с примером;
- карточки без названия сорта — жёлтый;
- старые тесты при своём производстве — оранжевый, не красный;
- своё производство со свежими датами — зелёный;
- меньше трёх карточек без семьи — нет данных;
- написания бренда (REVERT, Revert, Revert Cannabis) — один паспорт;
- пакет на отзыве — красный;
- история: ярус пишется один раз, смена яруса — новая запись и строка в отчёте;
- отчёт по пустому файлу печатается без ошибки;
- второй уровень: бренд без карточек, но с сертификатами — паспорт по
  сертификатам; старая проба — оранжевый; без замечаний — нейтральный, не
  зелёный; один сертификат под разными названиями — улика;
- THC меню, больший в 1,14 раза (THCa), — не завышение;
- «(Micro)» — тот же бренд.
"""
import importlib.util
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("brand_trust", ROOT / "scripts/brand-trust.py")
bt = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bt)

TODAY = "2026-10-01"
failures = []


def check(ok, what):
    if not ok:
        failures.append(what)
        print(f"FAIL: {what}")


def row(brand, name, shop, thc=None, tags=None, packaged=None, coa=None, panel=None):
    return {"licenseNumber": shop, "capturedAt": f"{TODAY}T10:00:00Z", "brand": brand,
            "brandKey": "".join(ch for ch in brand.lower() if ch.isalnum()), "strainNameCanonical": name,
            "strainNameRaw": name, "thcPercent": thc, "packageIds": tags, "packagedOn": packaged, "inStock": True,
            "labPanelKey": panel, "terpenes": {"coaUrl": coa}}


def card(strain, maker="Acme Farms LLC", lic="OCM-MICR-24-000900", batch="1A4120300000AAA000000001",
         thc=25.0, tested="2026-08-01", packaged="2026-08-05", harvested="2026-07-01", **kw):
    return {"found": True, "strain": strain, "product": strain, "manufacturer": maker, "manufacturerLicense": lic,
            "facility": maker, "facilityLicense": lic, "batchTag": batch, "thc": thc, "tested": tested,
            "packaged": packaged, "harvested": harvested, "lab": "Kaycha Labs NY", "category": "Buds",
            "testingState": "TestPassed", **kw}


def tag(prefix, n):
    return f"1A4120300000{prefix}{n:09d}"


def run(rows, cards, cases=(), previous=None, producers=(), certificates=None):
    return bt.build(rows, cards, {"links": {}, "packages": {}}, {"cases": list(cases)}, list(producers),
                    previous or {}, TODAY, certificates or {})


def case(brands, status, licences=(), producer="Pierre McClain LLC", verified=()):
    return {"status": status, "brandKeys": list(brands), "licenses": list(licences), "producer": producer,
            "signals": {"A": 1 if status == "confirmed" else 0}, "verified": list(verified)}


SHOPS = [f"OCM-CAURD-24-{i:06d}" for i in range(1, 30)]

# --- семья confirmed без карточек → красный; watch → улика без смены яруса
rows = [row("Splash", "Candy Gelato", s, 26.1) for s in SHOPS[:5]]
out = run(rows, {}, [case(["splash"], "confirmed", ["OCM-MICR-25-000246"], verified=["x", "y"])])
p = out["brands"]["splash"]
check(p["tier"] == "red", f"семья confirmed без карточек — красный, а не {p['tier']}")
check("проверено вручную партий 2" in p["identityWhy"][0], f"ручная проверка в улике: {p['identityWhy']}")

# --- своё производство, свежие даты, 20+ магазинов → зелёный; семья watch этого не меняет
own = {tag("BBB", i): card(f"Strain {i}", maker="Green Acres Farm LLC", lic="OCM-MICR-24-000777",
                           batch=tag("BBB", 100 + i)) for i in range(5)}
rows = [row("Green Acres", f"Strain {i % 5}", s, 25.0, [tag("BBB", i % 5)], "2026-08-05") for i, s in enumerate(SHOPS[:22])]
out = run(rows, own, [case(["greenacres"], "watch", producer="Green Acres")])
p = out["brands"]["greenacres"]
check(p["ownership"] == "своё производство", f"своё производство, а не {p['ownership']}")
check(p["tier"] == "green", f"своё и свежее — зелёный, а не {p['tier']} ({p['identityWhy']}, {p['trustWhy']})")
check(any("watch" in w for w in p["identityWhy"]), "семья watch видна в уликах")

# --- производитель из семьи двойников; THC меню выше сертификата → красный с примером
made = {tag("CCC", i): card(f"Kush {i}", maker="Excelsior Legacy LLC", lic="OCM-MICR-25-000243",
                            batch=tag("CCC", 100 + i), thc=19.0) for i in range(5)}
rows = [row("Superdope", f"Kush {i}", SHOPS[i], 23.0, [tag("CCC", i)]) for i in range(5)]
out = run(rows, made, [case(["dada"], "confirmed", ["OCM-MICR-25-000243"], producer="Excelsior Legacy LLC")])
p = out["brands"]["superdope"]
check(any("сделан производителем из семьи двойников" in w for w in p["identityWhy"]), f"улика производителя: {p['identityWhy']}")
check(any("THC в меню выше сертификата в среднем на 4.0" in w and "против 19.0" in w for w in p["identityWhy"]),
      f"THC меню выше сертификата с примером: {p['identityWhy']}")
check(p["tier"] == "red", f"производитель из семьи + завышенный THC — красный, а не {p['tier']}")

# --- карточки без названия сорта, написания одного бренда → один жёлтый паспорт
nameless = {tag("DDD", i): card("Hybrid", maker="Capital Region Co. INC", lic="OCM-PROC-24-000095",
                                batch=tag("DDD", 100 + i)) for i in range(4)}
rows = [row(b, f"Name {i}", SHOPS[i], 25.0, [tag("DDD", i)]) for i, b in enumerate(["REVERT", "Revert", "Revert Cannabis", "Revert"])]
out = run(rows, nameless)
check(len(out["brands"]) == 1 and "revert" in out["brands"], f"написания — один бренд: {list(out['brands'])}")
p = out["brands"].get("revert") or {}
check(p.get("brand") == "Revert", f"имя бренда — Revert, а не {p.get('brand')}")
check(p.get("tier") == "yellow" and any("не называет сорт" in w for w in p.get("identityWhy", [])),
      f"сорт не назван — жёлтый: {p.get('tier')} {p.get('identityWhy')}")

# --- старые тесты при своём производстве → оранжевый
old = {tag("EEE", i): card(f"Old {i}", maker="Hurley Grown LLC", lic="OCM-PROC-24-000186", batch=tag("EEE", 100 + i),
                           tested="2026-01-01", packaged="2026-06-01") for i in range(4)}
rows = [row("Hurley Grown", f"Old {i}", SHOPS[i], 25.0, [tag("EEE", i)]) for i in range(4)]
p = run(rows, old)["brands"]["hurleygrown"]
check(p["tier"] == "orange", f"старые тесты — оранжевый, а не {p['tier']} ({p['freshnessWhy']})")

# --- мало карточек без семьи → нет данных; отзыв → красный
few = {tag("FFF", 0): card("One")}
p = run([row("Tiny", "One", SHOPS[0], 25.0, [tag("FFF", 0)])], few)["brands"]["tiny"]
check(p["tier"] == "nodata", f"одна карточка — нет данных, а не {p['tier']}")
rec = {tag("ABC", 0): card("Recalled", onRecall=True)}
p = run([row("Tiny", "Recalled", SHOPS[0], 25.0, [tag("ABC", 0)])], rec)["brands"]["tiny"]
check(p["tier"] == "red" and any("отзыве" in w for w in p["identityWhy"]), f"отзыв — красный: {p['tier']} {p['identityWhy']}")

# --- история ярусов и отчёт
rows = [row("Hurley Grown", f"Old {i}", SHOPS[i], 25.0, [tag("EEE", i)]) for i in range(4)]
first = run(rows, old)
again = bt.build(rows, old, {"links": {}, "packages": {}}, {"cases": []}, [], {"brands": first["brands"]}, "2026-10-02")
check(len(again["brands"]["hurleygrown"]["tierHistory"]) == 1, "тот же ярус — история не растёт")
moved = bt.build(rows, old, {"links": {}, "packages": {}}, {"cases": [case(["hurleygrown"], "confirmed", producer="Hurley")]},
                 [], {"brands": first["brands"]}, "2026-10-02")
hist = moved["brands"]["hurleygrown"]["tierHistory"]
check([h["tier"] for h in hist] == ["orange", "red"], f"смена яруса — новая запись: {hist}")
path = Path(tempfile.mkdtemp()) / "bt.json"
doc = bt.write(moved, path)
text = bt.report(doc)
check("**Сменили ярус:** Hurley Grown оранжевый → красный" in text, f"переход в отчёте: {text}")
check("**Красные (1):**" in text, "красные в отчёте")
check("_Паспортов брендов нет._" in bt.report({}), "отчёт по пустому файлу")

# --- второй уровень: сертификаты без карточек
certs = {f"https://lab.example/{i}.pdf": {"sampled": "2025-12-01", "sha256": f"s{i}"} for i in range(6)}
rows = [row("Leal", f"Strain {i}", SHOPS[i], 25.0, coa=f"https://lab.example/{i}.pdf", panel="THC:25|A:0.4") for i in range(6)]
p = run(rows, {}, certificates=certs)["brands"]["leal"]
check(p["basis"] == "certificates", f"сертификаты без карточек — второй уровень, а не {p['basis']}")
check(p["tier"] == "orange" and any("проба для сертификата отобрана 304" in w for w in p["freshnessWhy"]),
      f"старая проба — оранжевый: {p['tier']} {p['freshnessWhy']}")
fresh = {u: {**c, "sampled": "2026-09-01"} for u, c in certs.items()}
rows = [row("Leal", f"Strain {i}", s, 25.0, coa=f"https://lab.example/{i}.pdf", panel="THC:25|A:0.4") for i, s in enumerate(SHOPS[:22])]
for i, r in enumerate(rows):
    r["terpenes"]["coaUrl"] = f"https://lab.example/{i % 6}.pdf"
    r["strainNameCanonical"] = f"Strain {i % 6}"
p = run(rows, {}, certificates=fresh)["brands"]["leal"]
check(p["trust"] >= 3 and p["tier"] == "neutral", f"свежо и широко без карточек — нейтральный, не зелёный: {p['tier']} {p['trustWhy']}")
shared = {"https://lab.example/x.pdf": {"sampled": "2026-09-01", "sha256": "same"},
          "https://lab.example/y.pdf": {"sampled": "2026-09-01", "sha256": "same"}}
rows = [row("Copycat", "Gelato", SHOPS[0], 26.0, coa="https://lab.example/x.pdf", panel="P"),
        row("Copycat", "Wedding Cake", SHOPS[1], 26.0, coa="https://lab.example/y.pdf", panel="P")] + \
       [row("Copycat", "Gelato", s, 26.0, panel="P") for s in SHOPS[2:5]]
p = run(rows, {}, certificates=shared)["brands"]["copycat"]
check(any("один сертификат под разными названиями" in w for w in p["identityWhy"]), f"один сертификат — улика: {p['identityWhy']}")

# --- THCa: меню больше карточки в 1,14 раза — не завышение
thca = {tag("ACE", i): card(f"Kush {i}", thc=25.0, batch=tag("ACE", 100 + i)) for i in range(5)}
rows = [row("Wizard", f"Kush {i}", SHOPS[i], 28.5, [tag("ACE", i)]) for i in range(5)]
p = run(rows, thca)["brands"]["wizard"]
check(p["thcPairs"] == 0 and not any("THC в меню выше" in w for w in p["identityWhy"]), f"THCa — не завышение: {p['identityWhy']}")

# --- (Micro) — тот же бренд
rows = [row("Milkweed", "A", SHOPS[0]), row("Milkweed (Micro)", "B", SHOPS[1])]
check(list(run(rows, {})["brands"]) == ["milkweed"], "Milkweed и Milkweed (Micro) — один бренд")

if failures:
    print(f"brand-trust-check: {len(failures)} провалено")
    sys.exit(1)
print("brand-trust-check: ok")
