#!/usr/bin/env python3
"""Чья это полка на самом деле.

Один адрес меню не может обслуживать две лицензии. Если обслуживает — значит
мы прочитали витрину сети или витрину одной точки и раздали её всем: сеть
Just a Little Higher отдала одну полку пяти лицензиям, Gotham — трём. Для
вопроса «какие сорта есть в Нью-Йорке» это неважно, а для вопроса «где купить»
это прямая неправда, и данные должны говорить об этом сами.

Отдельно — позиции, прочитанные не с сайта магазина. Такие не помечаются, а
удаляются: это не неточная привязка, это чужой товар.

    python scripts/attribution-audit.py            # показать
    python scripts/attribution-audit.py --apply    # исправить
"""
import argparse
import json
import re
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
LISTINGS = DATA / "flower-listings.json"

SHARED = "SHELF_SHARED_WITH_OTHER_LICENCES"

# Те же правила, что у коллектора: домен магазина, платформа меню, или другой
# домен того же магазина, узнанный по его имени. Реестр хранит один адрес на
# магазин, а магазины переезжают.
MENU_PLATFORM = re.compile(
    r"(^|\.)(dutchie\.com|dutchie\.co|iheartjane\.com|dispenseapp\.com|tymber\.io|getblaze\.io|"
    r"blaze\.me|treez\.io|getmeadow\.com|meadow\.dev|sweedpos\.com|greenrush\.com)$", re.I)

def compact(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())

ap = argparse.ArgumentParser()
ap.add_argument("--apply", action="store_true", help="переписать data/flower-listings.json")
args = ap.parse_args()

listings = json.loads(LISTINGS.read_text())
shops = {d["licenseNumber"]: d for d in json.loads((DATA / "dispensaries.json").read_text())}

def name(lic):
    d = shops.get(lic)
    return (d.get("dbaName") or d["legalName"]) if d else lic

def registrable(host):
    return ".".join((host or "").lower().split(".")[-2:])

# ---------------------------------------------------- прочитано не с сайта магазина
offsite = []
for l in listings:
    url = l["sources"][0]["url"]
    site = (shops.get(l["licenseNumber"], {}).get("contact") or {}).get("website") or ""
    if not site:
        continue
    a, b = urlparse(url).hostname or "", urlparse(site).hostname or ""
    if registrable(a) == registrable(b) or MENU_PLATFORM.search(a):
        continue
    host = compact(re.sub(r"\.[a-z]+$", "", a))
    who = compact(name(l["licenseNumber"]))
    if len(who) >= 5 and len(host) >= 5 and (host in who or who in host):
        continue
    offsite.append(l)

# ------------------------------------------------ один адрес на несколько лицензий
by_url = defaultdict(set)
for l in listings:
    by_url[l["sources"][0]["url"]].add(l["licenseNumber"])
shared_urls = {u: v for u, v in by_url.items() if len(v) > 1}

print(f"позиций всего: {len(listings)}\n")
print(f"— прочитано НЕ с сайта магазина (удалить): {len(offsite)}")
for url in sorted({l['sources'][0]['url'] for l in offsite}):
    who = sorted({name(l["licenseNumber"]) for l in offsite if l["sources"][0]["url"] == url})
    print(f"    {url}\n      {', '.join(who)}")

shared_rows = [l for l in listings if len(by_url[l["sources"][0]["url"]]) > 1 and l not in offsite]
print(f"\n— полка не привязана к точке (пометить): {len(shared_rows)}")
for url, lics in sorted(shared_urls.items(), key=lambda kv: -len(kv[1])):
    print(f"    {len(lics)}×  {url}")
    print(f"        {', '.join(sorted(name(x) for x in lics))}")

if not args.apply:
    print("\nничего не изменено; --apply чтобы исправить")
    raise SystemExit(0)

drop = {id(l) for l in offsite}
kept = []
marked = 0
for l in listings:
    if id(l) in drop:
        continue
    if len(by_url[l["sources"][0]["url"]]) > 1:
        w = l.setdefault("warnings", [])
        if SHARED not in w:
            w.append(SHARED)
            marked += 1
    else:
        # Витрина, привязанная заново: снимаем метку, а не оставляем висеть.
        if SHARED in (l.get("warnings") or []):
            l["warnings"].remove(SHARED)
    kept.append(l)

LISTINGS.write_text(json.dumps(kept, indent=2, ensure_ascii=False) + "\n")
print(f"\nудалено {len(offsite)}, помечено {marked}, осталось {len(kept)}")
