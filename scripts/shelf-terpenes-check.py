#!/usr/bin/env python3
"""Проверки scripts/shelf-terpenes.py без сети: панель сертификата из Metrc
Retail ID у позиций, чьё меню терпенов не печатает."""
import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("shelf_terpenes", ROOT / "scripts/shelf-terpenes.py")
st = importlib.util.module_from_spec(spec)
spec.loader.exec_module(st)
failures = []


def check(cond, what):
    if not cond:
        failures.append(what)


T1, T2, T3 = "1A4120300000216000000001", "1A4120300000216000000002", "1A4120300000216000000003"
PANEL = {"CARYOPHYLLENE": 0.23, "LIMONENE": 0.41, "LINALOOL": 0.11, "MYRCENE": 0.17}
PACKAGES = {
    T1: {"found": True, "thc": 26.018, "terpenes": PANEL, "terpenesTotal": 1.31, "lab": "Kaycha Labs NY",
         "tested": "2026-08-28"},
    T2: {"found": True, "thc": 26.018, "terpenes": {"MYRCENE": 0.9, "PINENE_ALPHA": 0.2, "LIMONENE": 0.1}},
    T3: {"found": False},
}
LINKS = {"HTTPS://1A4.COM/ABC": T1}


def row(n, **over):
    return {"listingId": n, "licenseNumber": f"OCM-{n}", "capturedAt": "2026-10-07T12:00:00Z",
            "brand": "Grower", "strainNameCanonical": "Caviar", "packageIds": [T1],
            "terpenes": {"source": "NONE"}, **over}


rows = [
    row(1),                                                       # нет THC в меню — берётся с сертификата
    row(2, thcPercent=26.02, packageIds=["https://1a4.com/abc"]),  # ссылка QR → метка
    row(3, thcPercent=31.5),                                      # THC меню далеко — не эта банка
    row(4, packageIds=[T1, T2]),                                  # две метки, две панели — ничего
    row(5, packageIds=[T3]),                                      # пакета нет в Retail ID
    row(6, packageIds=[T1, T3]),                                  # одна найденная метка — берётся
    row(7, thcPercent=26.0, terpenes={"source": "MENU_LISTING", "profile": [{"name": "MYRCENE", "percent": 0.5}]}),
]
added = st.from_retail_id(rows, PACKAGES, LINKS)
check(added == 3, f"панель получили позиции 1, 2, 6: {added}")
t = rows[0]["terpenes"]
check(t["source"] == "RETAIL_ID" and {p["name"]: p["percent"] for p in t["profile"]} == PANEL
      and t["retailId"] == [T1] and t["labName"] == "Kaycha Labs NY" and t["totalPercent"] == 1.31,
      f"панель, метка, лаборатория, сумма: {t}")
check(rows[0]["thcPercent"] == 26.02, f"THC с сертификата, округлённый как в меню: {rows[0].get('thcPercent')}")
check(rows[1]["terpenes"]["source"] == "RETAIL_ID" and rows[1]["thcPercent"] == 26.02, "ссылка QR читается как метка")
check(rows[2]["terpenes"]["source"] == "NONE" and rows[3]["terpenes"]["source"] == "NONE"
      and rows[4]["terpenes"]["source"] == "NONE", "далёкий THC, спор двух панелей, ненайденный пакет — ничего")
check(rows[5]["terpenes"]["retailId"] == [T1], "ненайденная метка рядом с найденной не мешает")
check(rows[6]["terpenes"]["source"] == "MENU_LISTING", "панель меню не заменяется")

found, _stray, _conflicts = st.lots(rows)
lot = next((l for l in found if l["thcPercent"] == 26.02), None)
check(lot is not None and lot["terpenes"] == PANEL and lot["retailId"] == [T1] and lot["certificates"] == []
      and len(lot["shops"]) == 3, f"партия из позиций с панелью Retail ID: {lot}")
check(all("retailId" not in l for l in found if l is not lot), "у партий без Retail ID поля нет")

if failures:
    print(f"shelf-terpenes-check: {len(failures)} ошибок")
    for f in failures:
        print("  -", f)
    sys.exit(1)
print("shelf-terpenes-check: ok")
