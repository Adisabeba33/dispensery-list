#!/usr/bin/env python3
"""Проверка детектора двойников (scripts/lot-twins.py) на выдуманных данных, без сети.

    python scripts/lot-twins-check.py      # ненулевой код — что-то сломалось

Что проверяется:
- партия Metrc под тремя названиями (как у Splash) — confirmed, лицензия и
  все три названия в случае;
- варианты написания одного сорта (Perm Chimera / Permanent Chimera, Maui
  Wowie / Maui Waui, Cr*nch B*rries, PBWY / Peach Be With You…) — не случай;
- панель в одном магазине под тремя брендами — шаблон магазина, не в счёт;
- один номер партии под двумя названиями с разным THC — не случай;
- целый THC под разными названиями — не случай;
- пара с одним кодом UPC при одном THC — watch; при разном THC — не случай;
- панель под Master Kush в двух магазинах и OG Kush — probable, названия разные;
- одно меню на две лицензии сети — один магазин, панель на нём — watch;
- совпадения THC на уровне случайности не поднимают панель одного магазина;
- панель одного магазина, переписанная на второе название (Fyre), — не случай;
- панель с пятью веществами и та же с шестым — одна панель;
- карточка Retail ID с цифрами панели даёт партии названия с полок — A;
- кривая дата на карточке и битый JSON не роняют прогон;
- --budget меньше нуля — ошибка; пять ошибок подряд останавливают зондирование;
- кэш карточек худеет и не растёт без края;
- слияние с прошлым прогоном хранит firstDetected и пишет newSinceLastRun;
- отчёт по пустому файлу печатается без ошибки;
- G: имя урожая в harvestDate карточки читается (части pt. N — один урожай,
  дата из H:ММ.ДД.ГГ), урожай под тремя названиями — confirmed с партией,
  тестом и THC у каждого; тот же урожай под одним названием — ничего;
- H: производственная партия «Biomass…» под тремя названиями — confirmed;
  код упаковочного прогона (KB.NY.SM.WRLD.8TH.260327) — только watch, так и
  подписан; партия с одним batchTag — это A, не H;
- C': почти одинаковые панели под разными названиями — watch, «почти
  одинаковые панели»; когда у названий по Retail ID свои партии — «шаблонные
  панели одного переработчика», не confirmed; панели из сотых долей и
  варианты написания — не случай;
- --import-cards читает сырые карточки <метка>.json, чужие имена и битые
  файлы считает, не падает;
- два упаковщика семьи названы каждый со своей лицензией.
"""
import importlib.util
import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("lot_twins", ROOT / "scripts/lot-twins.py")
lt = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(lt)

TODAY = "2026-09-01"
PANEL = "THC:26.1|CARYOPHYLLENE:0.3|LIMONENE:0.42|LINALOOL:0.34|MYRCENE:0.43"
failures = []


def check(ok, what):
    if not ok:
        failures.append(what)
        print(f"FAIL: {what}")


def listing(brand, name, shop, thc=None, panel=None, tags=None, warnings=None, key=None, url=None):
    return {
        "licenseNumber": shop, "capturedAt": f"{TODAY}T10:00:00Z", "brand": brand,
        "brandKey": key or "".join(ch for ch in brand.lower() if ch.isalnum()),
        "strainNameRaw": name, "strainNameCanonical": name, "thcPercent": thc,
        "labPanelKey": panel, "packageIds": tags, "warnings": warnings or [], "inStock": True,
        "sources": [{"url": url or f"https://{shop.lower()}.example/menu"}],
    }


def card(tag, strain, batch, license_="OCM-MICR-25-000246", facility="Pierre McClain LLC",
         packaged="2026-06-07", tested="2025-10-28", thc=26.1, terpenes=None, harvest=None, source_batch=None,
         product=None):
    out = {
        "found": True, "facility": facility, "facilityLicense": license_, "product": product or f"SCC201-{strain[:3]}",
        "strain": strain, "packaged": packaged, "tested": tested, "harvested": None,
        "lab": "Keystone State Testing, LLC", "batchTag": batch, "sourcePackage": None, "sourceBatch": source_batch,
        "manufacturer": facility, "manufacturerLicense": license_,
        "thc": thc, "terpenes": terpenes or {"βMyrcene": 0.4265, "Limonene": 0.4226, "Linalool": 0.3408},
        "checked": TODAY,
    }
    if harvest:
        out.update({"harvestText": harvest, "harvestLabels": [harvest], "harvested": lt.harvest_date_of(harvest)})
    return out


def run(rows, cards=None, previous=None, today=TODAY):
    producers = [{"licenseNumber": "OCM-MICR-25-000246", "entityName": "Pierre McClain LLC"}]
    return lt.build(rows, cards or {}, {"links": {}, "packages": {}}, previous or {}, producers,
                    {}, {}, {}, today)


# --- названия
SAME = [
    ("Milkweed", "Perm Chimera", "Permanent Chimera"),
    ("Milkweed", "Permanent Chimera", "Permanent Chimera (Indoor Hydroponics)"),
    ("Ruby Farms", "Maui Wowie", "Maui Waui"),
    ("Smart Bud", "Cr*nch B*rries", "Crunch Berries"),
    ("Grocery", "Stardawg", "Starwdawg"),
    ("Tall Trees", "Sherb Coktail #7", "Sherb Cocktail #7"),
    ("A1 Ducksauce", "Yum Yum Munchia Mania", "Yum Yum Munchie Mania"),
    ("Tyson", "Galactic Toad Reserve", "The Toad"),
    ("J Cannabis", "PBWY 3.5", "Peach Be With You"),
    ("Sensei", "1353 (Indoor)", "Sensei - 1353"),
    ("Celestial", "Aurora - Candy Kush", "Candy Krush"),
    ("Claybourne", "Cobra Kush Gold Cuts", "Cobar Kush"),
    ("ElectraLeaf", "Bubba Kush", "Bubbas Kush 2-2"),
    ("Mini Mart", "World Cup Collection - Marker - Colombia", "Marker-Columbia"),
    ("Plug Pack", "Chopped Cheese XL Flower Pack", "Chopped Cheese Flower 6-1"),
    ("Smoke", "Taxi Lightz", "Taxi Lights"),
    ("Budding Bliss", "Grapes & Cream", "Grapes N Cream"),
    ("Honest Pharm", "Peaches & Creme Punch", "Peaches & Cream Punch"),
    ("Wizard Trees", "Wizard Trees Nebula", "Nebula"),
    ("Dayzed", "Evil Cookies indoor - 3.5GM", "Evil Cookies"),
    ("Back Home", "Bonfire (Ice Cream Cake)", "Ice Cream Cake"),
]
DIFFERENT = [
    ("Dank", "OG Kush", "Master Kush"),
    ("Hi", "Grape Soda", "K-Lab"),
    ("Splash", "Candy Gelato", "Zeven Up"),
    ("Splash", "Cherry Runtz 3.5g", "03' Sour x Runrz"),
    ("Splash", "G33", "Triangle Mintz #23"),
    ("Splash", "44TH FLOOR", "Bubblegum OG"),
    ("Splash", "Candy Shop", "Candy Gelato"),
    ("Grocery", "Gelato 33", "Gelato 41"),
    ("Splash", "CHEM 91", "Kushmintz"),
]
LINES = {"claybourne": ["Gold Cuts", "Classic Cuts"], "minimart": ["World Cup Collection"],
         "tothemoon": ["Essentials"]}
for brand, a, b in SAME:
    lines = LINES.get("".join(ch for ch in brand.lower() if ch.isalnum()), ())
    check(lt.same_name(lt.norm_name(a, brand, lines), lt.norm_name(b, brand, lines)),
          f"одно название: {brand} «{a}» / «{b}»")
for brand, a, b in DIFFERENT:
    check(not lt.same_name(lt.norm_name(a, brand), lt.norm_name(b, brand)),
          f"разные названия: {brand} «{a}» / «{b}»")

# --- Splash: одна партия, три названия → confirmed
cards = {
    "1A4120300002719000000801": card("1A4120300002719000000801", "Candy Gelato", "1A41203000026BA000000014", packaged="2026-03-06"),
    "1A4120300002719000000819": card("1A4120300002719000000819", "Zeven Up", "1A41203000026BA000000014"),
    "1A4120300001E8C000000583": card("1A4120300001E8C000000583", "The Wrap Up", "1A41203000026BA000000014",
                                     license_="OCM-MICR-24-000040-DX1", facility="Harlem Blossoms LLC", packaged="2026-05-28"),
}
rows = [
    listing("Hi", "The Wrap Up", "OCM-CAURD-23-000002", 26.1, tags=["1A4120300001E8C000000583"]),
    listing("Good Money", "Zeven Up", "OCM-CAURD-24-000046", 26.1, tags=["1A4120300002719000000819"]),
    listing("Splash", "Candy Gelato", "OCM-CAURD-24-000047", 26.1, tags=["1A4120300002719000000801"]),
]
out = run(rows, cards)
splash = [c for c in out["cases"] if "OCM-MICR-25-000246" in c["licenses"]]
check(len(splash) == 1, "Splash: один случай с лицензией Pierre McClain")
if splash:
    c = splash[0]
    check(c["status"] == "confirmed", f"Splash: confirmed, а не {c['status']}")
    check(c["signals"]["A"] == 1 and c["signals"]["B"] == 1, f"Splash: сигналы A и B, а не {c['signals']}")
    check({"Candy Gelato", "Zeven Up", "The Wrap Up"} <= set(c["allNames"]), f"Splash: три названия, а не {c['allNames']}")
    check("OCM-MICR-24-000040" in c["licenses"], f"Splash: второй упаковщик в лицензиях, а не {c['licenses']}")
    check({"hi", "goodmoney", "splash"} <= set(c["brandKeys"]), f"Splash: три бренда, а не {c['brandKeys']}")
    check(c["producer"] == "Pierre McClain LLC + Harlem Blossoms LLC",
          f"Splash: два упаковщика, каждый со своим именем, а не «{c['producer']}»")
    check([p["license"] for p in c["producers"]] == ["OCM-MICR-25-000246", "OCM-MICR-24-000040"],
          f"Splash: производство первым, упаковщик вторым: {c['producers']}")
    check("**Pierre McClain LLC (OCM-MICR-25-000246) + Harlem Blossoms LLC (OCM-MICR-24-000040)**" in lt.case_line(c),
          f"Splash в отчёте: каждая лицензия со своим юрлицом: {lt.case_line(c)[:120]}")
    check(c["firstDetected"] == TODAY and c["newSinceLastRun"]["isNew"], "Splash: новый случай сегодня")

# --- один номер партии, но разные сертификаты (THC врозь) → watch, не confirmed
cards = {
    "1A412030000191D000002132": card("1A412030000191D000002132", "Mom's Spaghetti", "1A412030000191D000001670",
                                     license_="OCM-PROC-25-000326", facility="HPI CANNA Inc.", thc=37.4934),
    "1A412030000191D000002136": card("1A412030000191D000002136", "GMO", "1A412030000191D000001670",
                                     license_="OCM-PROC-25-000326", facility="HPI CANNA Inc.", thc=32.7444),
}
out = run([], cards)
check(not out["cases"], f"партия с разными сертификатами — не случай, а не {[(c['status'], c['signals']) for c in out['cases']]}")

# --- варианты написания на одной панели в двух магазинах → не случай
rows = []
for i, (brand, a, b) in enumerate(SAME):
    panel = f"THC:2{i % 10}.{i:02d}|CARYOPHYLLENE:0.3|LIMONENE:0.42|LINALOOL:0.34|MYRCENE:0.4{i}"
    rows.append(listing(brand, a, "OCM-CAURD-23-000002", 20 + i / 100, panel=panel,
                        key="".join(ch for ch in brand.lower() if ch.isalnum())))
    rows.append(listing(brand, b, "OCM-CAURD-24-000046", 20 + i / 100, panel=panel,
                        key="".join(ch for ch in brand.lower() if ch.isalnum())))
lines_doc = {k: v for k, v in LINES.items()}
out = lt.build(rows, {}, {"links": {}, "packages": {}}, {}, [], {}, {}, lines_doc, TODAY)
check(not out["cases"], "варианты написания не дают случаев: " + "; ".join(c["producer"] for c in out["cases"]))

# --- шаблон магазина: одна панель под тремя брендами → не в счёт
rows = [
    listing("Brand A", "Alpha", "OCM-RETL-25-000430", 24.14, panel=PANEL),
    listing("Brand B", "Beta", "OCM-RETL-25-000430", 24.14, panel=PANEL),
    listing("Brand C", "Gamma", "OCM-RETL-25-000430", 24.14, panel=PANEL),
    listing("Brand D", "Delta", "OCM-RETL-25-000431", 24.14, panel=PANEL, warnings=[lt.STRIPPED]),
    listing("Brand D", "Epsilon", "OCM-RETL-25-000431", 24.14, panel=PANEL, warnings=[lt.STRIPPED]),
]
out = run(rows)
check(not out["cases"], "шаблон магазина не даёт случаев")
check(out["excluded"]["template"] == 3 and out["excluded"]["stripped"] == 2,
      f"исключено 3 шаблонных и 2 снятых, а не {out['excluded']}")

# --- целый THC под разными названиями → не случай
rows = [listing("Dank", "Master Kush", "OCM-CAURD-23-000002", 28),
        listing("Dank", "OG Kush", "OCM-CAURD-24-000046", 28),
        listing("Dank", "Gelato Skittlez", "OCM-CAURD-24-000046", 28.0)]
out = run(rows)
check(not out["cases"], "целый THC не даёт случая")

# --- только код UPC при одном THC → watch; при разном THC — артикул бренда, не случай
rows = [listing("Dank", "Gelato Skittlez", "OCM-CAURD-23-000002", 28.99, tags=["634240454301"]),
        listing("Dank", "OG Kush", "OCM-CAURD-24-000046", 28.99, tags=["634240454301"])]
out = run(rows)
check(len(out["cases"]) == 1 and out["cases"][0]["status"] == "watch" and out["cases"][0]["signals"]["E"] == 1,
      f"пара с одним UPC и одним THC — watch, а не {[c['status'] for c in out['cases']]}")
check(out["cases"] and out["cases"][0]["codes"][0]["kind"] == "UPC" and out["cases"][0]["codes"][0]["thc"] == 28.99,
      "код подписан как UPC с его THC")
rows = [listing("Find.", "Banana Burst", "OCM-CAURD-23-000002", 27.38, tags=["P-FDWF352026-1383A"]),
        listing("Find.", "Zangria", "OCM-CAURD-23-000002", 23.61, tags=["P-FDWF352026-1383A"])]
out = run(rows)
check(not out["cases"], f"код при разном THC — не случай, а не {[c['status'] for c in out['cases']]}")

# --- одно меню на две лицензии сети — один магазин: панель на нём — watch, не probable
rows = [listing("Brand A", "Alpha", "OCM-CAURD-23-000009", 24.14, panel=PANEL, warnings=[lt.SHARED], url="https://gotham.example/flower"),
        listing("Brand A", "Beta", "OCM-CAURD-23-000009", 24.14, panel=PANEL, warnings=[lt.SHARED], url="https://gotham.example/flower"),
        listing("Brand A", "Alpha", "OCM-CAURD-24-000112", 24.14, panel=PANEL, warnings=[lt.SHARED], url="https://gotham.example/flower"),
        listing("Brand A", "Beta", "OCM-CAURD-24-000112", 24.14, panel=PANEL, warnings=[lt.SHARED], url="https://gotham.example/flower")]
out = run(rows)
check(len(out["cases"]) == 1 and out["cases"][0]["status"] == "watch" and out["cases"][0]["shelfPanels"][0]["shops"] == 1,
      f"общее меню сети — один магазин, а не {[(c['status'], c['shelfPanels'][0]['shops']) for c in out['cases']]}")

# --- совпадения THC на уровне случайности: панель одного магазина остаётся watch
DANK_PANEL = "THC:28.99|CARYOPHYLLENE:0.09|GUAIOL:0.06|HUMULENE:0.05|MYRCENE:0.49|OCIMENE:0.11"
rows = [listing("Big", "Master Kush", "OCM-CAURD-23-000002", 28.99, panel=DANK_PANEL),
        listing("Big", "OG Kush", "OCM-CAURD-23-000002", 28.99, panel=DANK_PANEL)]
for i in range(120):  # 120 названий на отрезке в 300 сотых: случайных пар ждёшь ~24
    rows.append(listing("Big", f"Strain {i} {'Alpha Beta Gamma Delta'.split()[i % 4]}", f"OCM-RETL-25-{i % 7:06d}", 22 + (i * 37 % 300) / 100))
out = run(rows)
big = [c for c in out["cases"] if "big" in c["brandKeys"]]
check(len(big) == 1 and big[0]["status"] == "watch" and not big[0]["thcTwinsStats"]["meaningful"]
      and big[0]["signals"]["D"] == 0,
      f"случайные совпадения THC не в счёт: {[(c['status'], c['thcTwinsStats']) for c in big]}")

# --- панель одного магазина, переписанная на второе название (Fyre): не случай
FYRE = "THC:32.37|CARYOPHYLLENE:0.5|LIMONENE:0.3|LINALOOL:0.2|MYRCENE:0.4"
rows = [listing("Fyre", "BX RUNTZ", "OCM-CAURD-24-000001", 32.37, panel=FYRE),
        listing("Fyre", "SOUR JOKER", "OCM-CAURD-24-000001", 32.37, panel=FYRE),
        listing("Fyre", "Bx Runtz", "OCM-CAURD-25-000229", 32.37, panel=FYRE),
        listing("Fyre", "Sour Joker", "OCM-CAURD-24-000142", 28.36)]
out = run(rows)
check(not out["cases"] and out["excluded"]["pasted"] == 1 and "SOUR JOKER" in out["excluded"]["pastedPanels"][0]["dropped"][0],
      f"переписанная панель — не случай: {[c['status'] for c in out['cases']]} {out['excluded']}")

# --- панель с пятью веществами и та же с шестым — одна панель в двух магазинах
FIVE = "THC:25.63|CARYOPHYLLENE:1.07|HUMULENE:0.27|LIMONENE:0.36|LINALOOL:0.12"
rows = [listing("Young Gong", "Melody Makers (Indoor)", "OCM-RETL-24-000244", 25.63, panel=FIVE),
        listing("420 Treez", "GG4", "OCM-RETL-24-000133", 25.63, panel=FIVE + "|VALENCENE:0.16")]
out = run(rows)
check(len(out["cases"]) == 1 and out["cases"][0]["status"] == "probable" and len(out["cases"][0]["shelfPanels"][0]["panelKeys"]) == 2
      and {"younggong", "420treez"} <= set(out["cases"][0]["brandKeys"]),
      f"панель с лишним веществом — та же панель: {[(c['status'], c['brandKeys']) for c in out['cases']]}")
check(not lt.panels_match(lt.parse_panel(FIVE), lt.parse_panel("THC:25.63|CARYOPHYLLENE:1.07|HUMULENE:0.27|LIMONENE:0.36|LINALOOL:0.13")),
      "панель с другой сотой — другая панель")

# --- карточка с цифрами панели: партия получает названия с полок (A), панель — партию
cards = {"1A4120300002719000000817": card("1A4120300002719000000817", "Cherry Runtz", "1A41203000026BA000000012",
                                          tested="2025-10-21", thc=25.97,
                                          terpenes={"βCaryophyllene": 0.2938, "βMyrcene": 0.2878, "Linalool": 0.2705, "Limonene": 0.2439})}
SHELF = "THC:25.97|CARYOPHYLLENE:0.29|LIMONENE:0.24|LINALOOL:0.27|MYRCENE:0.29"
rows = [listing("Hi", "Candy Shop", "OCM-CAURD-23-000002", 25.97, panel=SHELF),
        listing("Good Money", "03' Sour x Runtz", "OCM-CAURD-24-000046", 25.97, panel=SHELF)]
out = run(rows, cards)
c = out["cases"][0] if out["cases"] else None
check(c and c["status"] == "confirmed" and c["signals"]["A"] == 1 and c["batches"][0]["batch"].endswith("000012")
      and {e["name"] for e in c["batches"][0]["shelfNames"]} == {"Candy Shop", "03' Sour x Runtz"}
      and c["shelfPanels"][0]["cards"][0]["tested"] == "2025-10-21" and "OCM-MICR-25-000246" in c["licenses"],
      f"карточка + панель полок = партия под названиями с полок: {c and (c['status'], c['signals'], c['batches'])}")
check(lt.compound_key("βPinene") == "PINENE_BETA" and lt.compound_key("CaryophylleneOxide") == "CARYOPHYLLENE_OXIDE"
      and lt.compound_key("αHumulene") == "HUMULENE", "имена терпенов карточки переводятся в имена полки")

# --- кривая дата на карточке не роняет прогон
bad = {"1A4120300002719000000900": card("1A4120300002719000000900", "Broken", "1A41203000026BA000000090", packaged="2026-99-99")}
out = run([], bad)
check(isinstance(out["oldTests"], list), "кривая дата на карточке — не падение")

# --- жвачки не в разделе старых тестов
gum = {"1A412030000191D000002143": {**card("1A412030000191D000002143", "Doozies", "1A412030000191D000002000", packaged="2026-08-01", tested="2026-01-01"),
                                    "product": "Green Revolution | Gummies 10 Pack | Doozies", "strain": None}}
out = run([], gum)
check(not out["oldTests"] and out["oldTestsSkippedNonFlower"] == 1, f"жвачки не старый тест цветка: {out['oldTests']}")

# --- панель под двумя названиями в двух магазинах → probable; в одном → watch
DANK = "THC:28.99|CARYOPHYLLENE:0.09|GUAIOL:0.06|HUMULENE:0.05|MYRCENE:0.49|OCIMENE:0.11"
rows = [listing("Dank By Definition", "Master Kush", "OCM-CAURD-23-000002", 28.99, panel=DANK),
        listing("Dank", "MASTER KUSH INDICA 1/8", "OCM-CAURD-24-000046", 28.99, panel=DANK),
        listing("Dank By Definition", "OG Kush", "OCM-CAURD-23-000002", 28.99, panel=DANK)]
out = run(rows)
check(len(out["cases"]) == 1 and out["cases"][0]["status"] == "probable",
      f"Dank: probable, а не {[c['status'] for c in out['cases']]}")
if out["cases"]:
    panel = out["cases"][0]["shelfPanels"][0]
    check(panel["shops"] == 2 and len(panel["names"]) == 2, f"Dank: два названия в двух магазинах, а не {panel}")
rows = rows[:1] + rows[2:]
out = run(rows)
check(len(out["cases"]) == 1 and out["cases"][0]["status"] == "watch",
      f"панель в одном магазине — watch, а не {[c['status'] for c in out['cases']]}")

# --- слияние: firstDetected остаётся, новое название попадает в newSinceLastRun
rows = [listing("Dank By Definition", "Master Kush", "OCM-CAURD-23-000002", 28.99, panel=DANK),
        listing("Dank", "Master Kush", "OCM-CAURD-24-000046", 28.99, panel=DANK),
        listing("Dank By Definition", "OG Kush", "OCM-CAURD-23-000002", 28.99, panel=DANK)]
first = run(rows)
rows.append(listing("Dank", "Gelato Skittlez", "OCM-CAURD-25-000311", 28.99, panel=DANK))
second = run(rows, previous={"cases": first["cases"]}, today="2026-09-02")
check(len(second["cases"]) == 1, "слияние: один случай")
if second["cases"]:
    c = second["cases"][0]
    check(c["firstDetected"] == TODAY, f"слияние хранит firstDetected {TODAY}, а не {c['firstDetected']}")
    check(not c["newSinceLastRun"]["isNew"] and c["newSinceLastRun"]["names"] == ["Gelato Skittlez"],
          f"слияние: новое название Gelato Skittlez, а не {c['newSinceLastRun']}")
    check(c["statusHistory"][0]["day"] == TODAY and c["statusHistory"][-1]["status"] == "probable",
          f"история статусов начинается с {TODAY}: {c['statusHistory']}")
    shops = next(e for p in c["shelfPanels"] for e in p["names"] if e["name"] == "Master Kush")["shops"]
    check(len(shops) == 2, f"слияние складывает магазины названия: {shops}")

# --- G: имена урожаев с карточки
RAW = {"facilityName": "Excelsior Legacy LLC", "facilityLicense": "OCM-MICR-25-000243", "coaCard": {"data": {
    "strainName": "Dumbo Gumbo", "productName": "NoiZey Dumbo Gumbo 4g",
    "harvestDate": "Double Runtz H:12.01.25, Double Runtz H:12.01.25 pt. 2, Double Runtz H:12.01.25 pt. 3",
    "sourceBatch": "NZDG03-26", "sourcePackage": "1A4120300001A94000000100", "lotNumber": "1A4120300001A94000000291",
    "batchTag": "1A4120300001A94000000291", "testedDate": "2026-04-01T00:00:00", "packagedDate": "2026-04-02T00:00:00Z",
    "manufacturer": {"name": "Excelsior Legacy LLC", "licenseNumber": "OCM-MICR-25-000243"},
    "receivedFromFacilityName": "Excelsior Legacy LLC", "receivedFromFacilityLicenseNumber": "OCM-MICR-25-000243",
    "lab": {"name": "Green Analytics NY, LLC"}, "category": "Buds",
    "totals": {"thc": {"percent": 31.1737}}, "terpenes": {"bMyrcene": {"percent": 0.5, "label": "βMyrcene"}}}}}
c = lt.compact_card(RAW)
check(c.get("harvestLabels") == ["Double Runtz H:12.01.25"] and c["harvested"] == "2025-12-01"
      and c.get("harvestText", "").startswith("Double Runtz"),
      f"имена урожаев из harvestDate, части pt. N — один урожай: {c.get('harvestLabels')} {c.get('harvested')}")
check(c["sourceBatch"] == "NZDG03-26" and c["sourcePackage"].endswith("000100") and c["lotNumber"].endswith("000291")
      and c["manufacturer"] == "Excelsior Legacy LLC" and c["manufacturerLicense"] == "OCM-MICR-25-000243"
      and c["receivedFrom"] == "Excelsior Legacy LLC" and c["receivedFromLicense"] == "OCM-MICR-25-000243",
      "compact_card держит партию, пакет, лот, производство и откуда получен")
c = lt.compact_card({**RAW, "coaCard": {"data": {**RAW["coaCard"]["data"], "harvestDate": "2025-12-11T00:00:00Z"}}})
check(c["harvested"] == "2025-12-11" and "harvestLabels" not in c, f"настоящая дата сбора остаётся датой: {c['harvested']}")
check(lt.harvest_date_of("Bubba Kush H:12.01.25") == "2025-12-01" and lt.harvest_date_of("Tricho Jordan") is None
      and lt.harvest_date_of("X H:13.45.25") is None, "дата из имени урожая, кривая — None")

EX = dict(license_="OCM-MICR-25-000243", facility="Excelsior Legacy LLC", tested="2026-04-01", packaged="2026-04-02",
          harvest="Double Runtz H:12.01.25")
xcards = {
    "1A4120300001A94000000289": card("1A4120300001A94000000289", "C.R.E.A.M.", "1A4120300001A94000000289", thc=29.7822, product="NoiZey C.R.E.A.M. 4g", **EX),
    "1A4120300001A94000000291": card("1A4120300001A94000000291", "Dumbo Gumbo", "1A4120300001A94000000291", thc=31.1737, product="NoiZey Dumbo Gumbo 4g", **EX),
    "1A4120300001A94000000225": card("1A4120300001A94000000225", "Lemon Cherry Gelato", "1A4120300001A94000000225", thc=28.2039, product="Synergy Lemon Cherry Gelato 28g", **EX),
}
out = run([], xcards)
ex = [c for c in out["cases"] if "OCM-MICR-25-000243" in c["licenses"]]
check(len(ex) == 1 and ex[0]["status"] == "confirmed" and ex[0]["signals"]["G"] == 1 and ex[0]["signals"]["A"] == 0,
      f"урожай под тремя названиями — confirmed по G: {[(c['status'], c['signals']) for c in out['cases']]}")
if ex:
    h = ex[0]["harvests"][0]
    check(h["harvest"] == "Double Runtz H:12.01.25" and h["harvested"] == "2025-12-01" and h["names"] == 3
          and {p["name"] for p in h["packages"]} == {"C.R.E.A.M.", "Dumbo Gumbo", "Lemon Cherry Gelato"}
          and all(p["batch"] and p["tested"] == "2026-04-01" and p["thc"] for p in h["packages"])
          and {p["brand"] for p in h["packages"]} == {"NoiZey", "Synergy"},
          f"урожай записан с именем, датой, партией, тестом, THC и брендом у каждого названия: {h}")
    check(ex[0]["producer"] == "Excelsior Legacy LLC", f"случай урожая назван производством, а не «{ex[0]['producer']}»")
    check("один урожай под 3 названиями" in lt.case_line(ex[0]) and "Double Runtz H:12.01.25" in lt.case_line(ex[0]),
          f"отчёт: «один урожай под N названиями»: {lt.case_line(ex[0])[:160]}")
xcards = {"1A4120300001A94000000291": card("1A4120300001A94000000291", "Dumbo Gumbo", "1A4120300001A94000000291", thc=31.17, **EX),
         "1A4120300001A94000000292": card("1A4120300001A94000000292", "Dumbo Gumbo 4g", "1A4120300001A94000000292", thc=30.4, **EX)}
out = run([], xcards)
check(not out["cases"], f"тот же урожай под одним названием — не случай: {[c['signals'] for c in out['cases']]}")

# --- H: производственная партия под разными названиями; код прогона — только на заметку
AP = dict(license_="OCM-PROC-24-000062", facility="AP COHEN LICENSING INC.", tested="2026-09-02", packaged="2026-09-05",
          source_batch="Biomass - Flower - MIXED")
xcards = {
    "1A41203000003F6000001516": card("1A41203000003F6000001516", "GORILLA GLUE", "1A41203000003F6000001516", thc=26.237, product="Herb 3.5g Gorilla Glue", **AP),
    "1A41203000003F6000001522": card("1A41203000003F6000001522", "LEMON KUSH", "1A41203000003F6000001522", thc=27.817, product="Herb 3.5g Lemon Kush", **AP),
    "1A41203000003F6000001526": card("1A41203000003F6000001526", "BLUE HAZE", "1A41203000003F6000001526", thc=31.087, product="HERB 1oz Flower Blue Haze", **AP),
}
out = run([], xcards)
ap = out["cases"][0] if out["cases"] else None
check(ap and len(out["cases"]) == 1 and ap["status"] == "confirmed" and ap["signals"]["H"] == 1 and ap["signals"]["A"] == 0
      and ap["productionBatches"][0]["kind"] == "production" and ap["productionBatches"][0]["names"] == 3
      and ap["productionBatches"][0]["sourceBatch"] == "Biomass - Flower - MIXED"
      and {lt.grower_of(p["brand"]) for p in ap["productionBatches"][0]["packages"]} == {"herb"}
      and ap["producer"] == "AP COHEN LICENSING INC.",
      f"партия сырья под тремя названиями — confirmed по H: {ap and (ap['status'], ap['signals'], ap['producer'])}")
check(ap and "одна производственная партия «Biomass - Flower - MIXED» под 3 названиями" in lt.case_line(ap),
      f"отчёт: «одна производственная партия …»: {ap and lt.case_line(ap)[:160]}")
LU = dict(license_="OCM-PROC-24-000179", facility="Lunulata LLC", tested="2026-04-07", packaged="2026-04-10",
          source_batch="KB.NY.SM.WRLD.8TH.260327")
xcards = {"1A4120300004396000000656": card("1A4120300004396000000656", "Red Zprite", "1A4120300004396000000656", thc=28.529, product="Smoke - WRLD - Red Zprite - 3.5g", **LU),
         "1A4120300004396000000657": card("1A4120300004396000000657", "Velvet Gushers", "1A4120300004396000000657", thc=31.077, product="Smoke - WRLD - Velvet Gushers - 3.5g", **LU)}
out = run([], xcards)
lu = out["cases"][0] if out["cases"] else None
check(lu and len(out["cases"]) == 1 and lu["status"] == "watch" and lu["signals"]["Hrun"] == 1 and lu["signals"]["H"] == 0
      and lu["productionBatches"][0]["kind"] == "packagingRun" and "упаковочного прогона" in lt.case_line(lu),
      f"код упаковочного прогона — watch, так и подписан: {lu and (lu['status'], lu['signals'], lt.case_line(lu)[:120])}")
xcards = {"1A41203000003F6000001516": card("1A41203000003F6000001516", "GORILLA GLUE", "1A41203000003F6000001500", thc=26.2, **AP),
         "1A41203000003F6000001522": card("1A41203000003F6000001522", "LEMON KUSH", "1A41203000003F6000001500", thc=26.2, **AP)}
out = run([], xcards)
check(len(out["cases"]) == 1 and out["cases"][0]["signals"]["A"] == 1 and out["cases"][0]["signals"]["H"] == 0,
      f"одна партия по batchTag — это A, не H: {[c['signals'] for c in out['cases']]}")

# --- C': почти одинаковые панели — watch; с разными партиями по Retail ID — шаблон переработчика
NEAR_A = "THC:32.43|CARYOPHYLLENE:0.16|LIMONENE:0.2|LINALOOL:0.35|MYRCENE:0.09"
NEAR_B = "THC:32.29|CARYOPHYLLENE:0.15|LIMONENE:0.19|LINALOOL:0.33|MYRCENE:0.08"
check(lt.panels_near(lt.parse_panel(NEAR_A), lt.parse_panel(NEAR_B)) and not lt.panels_match(lt.parse_panel(NEAR_A), lt.parse_panel(NEAR_B)),
      "почти одна панель: THC в 0,3, терпены в 0,02")
check(not lt.panels_near(lt.parse_panel(NEAR_A), lt.parse_panel("THC:32.74|CARYOPHYLLENE:0.16|LIMONENE:0.2|LINALOOL:0.35|MYRCENE:0.09"))
      and not lt.panels_near(lt.parse_panel(NEAR_A), lt.parse_panel("THC:32.43|CARYOPHYLLENE:0.16|LIMONENE:0.2|LINALOOL:0.38|MYRCENE:0.09")),
      "THC дальше 0,3 или терпен дальше 0,02 — не почти")
rows = [listing("Preferred Gardens", "Gelato 41", "OCM-CAURD-24-000169", 32.43, panel=NEAR_A),
        listing("Preferred Gardens", "Znackz", "OCM-CAURD-24-000169", 32.29, panel=NEAR_B)]
out = run(rows)
c = out["cases"][0] if out["cases"] else None
check(c and len(out["cases"]) == 1 and c["status"] == "watch" and c["signals"]["Cnear"] == 1 and c["signals"]["C"] == 0
      and c["nearPanels"][0]["kind"] == "near" and len(c["nearPanels"][0]["names"]) == 2,
      f"почти одинаковые панели — только watch: {c and (c['status'], c['signals'], c['nearPanels'][0]['kind'])}")
check(c and "почти одинаковые панели" in lt.case_line(c) and "шаблонные" not in lt.case_line(c),
      f"отчёт подписывает «почти одинаковые панели»: {c and lt.case_line(c)[:160]}")
rows = [listing("Preferred Gardens", "Gelato 41", "OCM-CAURD-24-000169", 32.43, panel=NEAR_A, tags=["1A41203000003F6000001261"]),
        listing("Preferred Gardens", "Znackz", "OCM-CAURD-24-000169", 32.29, panel=NEAR_B, tags=["1A41203000003F6000001262"])]
xcards = {"1A41203000003F6000001261": card("1A41203000003F6000001261", "Gelato 41", "1A41203000003F6000001261", license_="OCM-PROC-24-000062",
                                          facility="AP COHEN LICENSING INC.", tested="2026-07-31", thc=32.43,
                                          terpenes={"βCaryophyllene": 0.16, "Limonene": 0.2, "Linalool": 0.35, "βMyrcene": 0.09}),
         "1A41203000003F6000001262": card("1A41203000003F6000001262", "Znackz", "1A41203000003F6000001262", license_="OCM-PROC-24-000062",
                                          facility="AP COHEN LICENSING INC.", tested="2026-08-07", thc=32.29,
                                          terpenes={"βCaryophyllene": 0.15, "Limonene": 0.19, "Linalool": 0.33, "βMyrcene": 0.08})}
out = run(rows, xcards)
c = out["cases"][0] if out["cases"] else None
check(c and len(out["cases"]) == 1 and c["status"] == "watch" and c["nearPanels"][0]["kind"] == "templated"
      and "namesHaveOwnBatches" in {e["kind"] for e in c["nearPanels"][0]["evidence"]}
      and "шаблонные панели одного переработчика" in lt.case_line(c),
      f"разные партии у почти одной панели — шаблон переработчика, не confirmed: {c and (c['status'], c['nearPanels'][0]['kind'], c['nearPanels'][0]['evidence'])}")
rows = [listing("Papa's Herb", "Znackz", "OCM-CAURD-24-000219", 27.37, panel="THC:27.37|BISABOLOL:0.01|CARYOPHYLLENE:0.04|LIMONENE:0.02|LINALOOL:0.03"),
        listing("Papa's Herb", "Lemon Diesel", "OCM-CAURD-24-000219", 27.1, panel="THC:27.1|BISABOLOL:0.01|CARYOPHYLLENE:0.02|LIMONENE:0.04|LINALOOL:0.02")]
out = run(rows)
check(not out["cases"], f"панели из сотых долей — не почти одна: {[c['signals'] for c in out['cases']]}")
rows = []
for i, (brand, a, b) in enumerate(SAME):
    rows.append(listing(brand, a, "OCM-CAURD-23-000002", 20 + i / 100,
                        panel=f"THC:2{i % 10}.{i:02d}|CARYOPHYLLENE:0.3|LIMONENE:0.42|LINALOOL:0.34|MYRCENE:0.4{i}",
                        key="".join(ch for ch in brand.lower() if ch.isalnum())))
    rows.append(listing(brand, b, "OCM-CAURD-24-000046", 20.1 + i / 100,
                        panel=f"THC:2{i % 10}.{i + 10:02d}|CARYOPHYLLENE:0.31|LIMONENE:0.42|LINALOOL:0.33|MYRCENE:0.4{i}",
                        key="".join(ch for ch in brand.lower() if ch.isalnum())))
out = lt.build(rows, {}, {"links": {}, "packages": {}}, {}, [], {}, {}, lines_doc, TODAY)
check(not out["cases"], "варианты написания на почти одной панели — не случай: " + "; ".join(c["producer"] for c in out["cases"]))

# --- ввоз сырых карточек
with tempfile.TemporaryDirectory() as tmp:
    (Path(tmp) / "1A4120300001A94000000291.json").write_text(json.dumps(RAW))
    (Path(tmp) / "notes.json").write_text("{}")
    (Path(tmp) / "1A4120300001A94000000292.json").write_text("{broken")
    imported = {}
    done = lt.import_cards(tmp, imported, TODAY)
    check(done == {"added": 1, "notATag": 1, "bad": 1} and imported["1A4120300001A94000000291"]["strain"] == "Dumbo Gumbo"
          and imported["1A4120300001A94000000291"]["harvestLabels"] == ["Double Runtz H:12.01.25"]
          and imported["1A4120300001A94000000291"]["checked"] == TODAY,
          f"ввоз сырых карточек: {done} {sorted(imported)}")

# --- отчёт по пустому файлу
text = lt.report({})
check(text.startswith("\n### Одна партия — много названий"), "отчёт по пустому файлу начинается с заголовка")
check("### Старые тесты" in text, "отчёт по пустому файлу содержит раздел старых тестов")
with tempfile.TemporaryDirectory() as tmp:
    path = Path(tmp) / "lot-twins.json"
    try:
        text = lt.report(lt.write({**first, "cards": {"1A4120300002719000000801": cards["1A4120300002719000000817"]},
                                   "probing": {}, "probed": {}}, {}, path))
        check("Dank" in text and "вероятно" in text.lower(), "отчёт называет Dank вероятным")
        check(lt.read_json(path, None)["cards"]["1A4120300002719000000801"]["strain"] == "Cherry Runtz",
              "карточки по одной в строку читаются обратно")
        path.write_text('{"cases": [garbage')
        check(lt.read_json(path, {}) == {}, "битый JSON читается как пустой")
    finally:
        path.unlink(missing_ok=True)

# --- бюджет не меньше нуля; пять ошибок подряд останавливают зондирование
try:
    lt.nonnegative("-5")
    check(False, "--budget -5 должен быть ошибкой")
except Exception:
    pass
calls = []
lt.fetch_card = lambda tag: (calls.append(tag), {"found": None, "error": "HTTP 500"})[1]
lt.PACE = 0
stats = lt.probe([(f"1A4120300002719{i:09d}", "near0") for i in range(20)], {}, 20, TODAY, {}, log=lambda *a, **k: None)
check(len(calls) == lt.ERRORS_IN_ROW and stats["stoppedAfterErrors"] and stats["skippedForBudget"] == 15,
      f"после {lt.ERRORS_IN_ROW} ошибок подряд — стоп: запросов {len(calls)}, {stats}")

# --- кэш худеет: 404 старше 30 дней уходят, старые карточки вне случаев теряют терпены
cache = {"A": {"found": False, "checked": "2026-01-01"}, "B": {"found": False, "checked": TODAY},
         "C": {**card("C", "Old", "X"), "checked": "2026-01-01"}, "D": {**card("D", "Needed", "X"), "checked": "2026-01-01"},
         "E": {"found": None, "error": "x", "checked": "2026-01-01"}}
done = lt.prune_cards(cache, {"D"}, TODAY)
check("A" not in cache and "B" in cache and "E" not in cache and cache["C"]["terpenes"] == {} and cache["C"].get("trimmed")
      and cache["D"]["terpenes"], f"кэш худеет как обещано: {done} {sorted(cache)}")

if failures:
    print(f"lot-twins-check: {len(failures)} {lt.plural(len(failures), 'ошибка', 'ошибки', 'ошибок')}")
    sys.exit(1)
print("lot-twins-check: ok")
