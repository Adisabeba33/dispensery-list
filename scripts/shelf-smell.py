#!/usr/bin/env python3
"""Где полка выглядит неправдоподобно.

Валидатор проверяет, что запись правильной ФОРМЫ. Это другой вопрос: похожи ли
собранные полки на то, что бывает в настоящем магазине. Четыре бага, стоившие
нам данных, нашёл человек, открывший сайт магазина и посчитавший унции — ни
один автоматический контроль их не увидел. Этот скрипт человека не заменяет,
он говорит, на какие магазины смотреть первыми.

Каждая проверка — это форма уже случившейся поломки:

  размеры вне ходовых      парсер прочитал ценой или количеством то, что не вес
                           (11, 26, 27 граммов уже попадали в справочник)
  сорт нигде больше        витрина чужого магазина или демо темы: 47 выдуманных
                           позиций с codegearthemes.com были именно такими
  одинаковые полки         две лицензии, читающие страницу сети, а не филиала
  одна позиция на полке    страница одного товара, принятая за витрину
  всё без размера          прочитано, но вес не разобран — полка беднее, чем есть

    python scripts/shelf-smell.py                  # всё
    python scripts/shelf-smell.py --since 2026-09-14   # только свежие полки
"""
import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

ap = argparse.ArgumentParser()
ap.add_argument("--listings", default=str(ROOT / "data/flower-listings.json"))
ap.add_argument("--since", default=None,
                help="смотреть только полки, прочитанные не раньше этой даты (YYYY-MM-DD)")
ap.add_argument("--top", type=int, default=15)
args = ap.parse_args()

rows = json.loads(Path(args.listings).read_text())
shops = {d["licenseNumber"]: (d.get("dbaName") or d["legalName"])
         for d in json.loads((ROOT / "data/dispensaries.json").read_text())}

# Нас интересуют только 3.5 / 7 / 14 / 28 — остальное для справочника мусор.
# Но «нам не нужен» и «такого веса не бывает» — разные вещи, и путать их
# нельзя: 0.7 г это настоящий вес настоящей банки, а 11, 26 и 27 граммов —
# это цена или количество, прочитанные как вес. Ловим второе.
REAL_SIZES = {0.5, 0.7, 1, 2, 3.5, 5, 7, 10, 14, 28}

by_shop = defaultdict(list)
for r in rows:
    by_shop[r["licenseNumber"]].append(r)

if args.since:
    by_shop = {lic: rs for lic, rs in by_shop.items()
               if max((r.get("capturedAt") or "") for r in rs)[:10] >= args.since}

name = lambda lic: shops.get(lic, lic)
findings = []


def note(kind, lic, detail):
    findings.append((kind, lic, detail))


# 1. Размеры, которых не бывает на полке. Ходовые — 1, 3.5, 7, 14, 28.
for lic, rs in by_shop.items():
    odd = Counter()
    for r in rs:
        for g in r.get("availableSizesGrams") or []:
            if g not in REAL_SIZES:
                odd[g] += 1
    if odd:
        share = sum(odd.values()) / max(sum(len(r.get("availableSizesGrams") or []) for r in rs), 1)
        if share > 0.2:
            top = ", ".join(f"{g}г×{n}" for g, n in odd.most_common(5))
            note("размеры", lic, f"{share:.0%} позиций в весах, которых не бывает: {top}")

# 2. Сорт, которого нет ни в одном другом магазине штата. Один-два — обычное
#    дело. Полка, где таких почти всё, — это чужая витрина.
everywhere = Counter()
for lic, rs in by_shop.items():
    for n in {(r.get("strainNameCanonical") or "").lower() for r in rs}:
        if n:
            everywhere[n] += 1
for lic, rs in by_shop.items():
    names = {(r.get("strainNameCanonical") or "").lower() for r in rs} - {""}
    if len(names) < 8:
        continue
    alone = {n for n in names if everywhere[n] == 1}
    if len(alone) / len(names) > 0.8:
        sample = ", ".join(sorted(alone)[:4])
        note("сорта", lic, f"{len(alone)} из {len(names)} сортов не встречаются больше нигде: {sample}")

# 3. Две лицензии с одинаковым набором сортов читают одну и ту же страницу.
signature = {}
for lic, rs in by_shop.items():
    names = frozenset((r.get("strainNameCanonical") or "").lower() for r in rs) - {""}
    if len(names) >= 5:
        signature.setdefault(names, []).append(lic)
for names, lics in signature.items():
    if len(lics) > 1:
        note("общая полка", lics[0],
             f"полка в {len(names)} сортов совпадает у: " + ", ".join(name(l) for l in lics))

# 4. Полка из одной-двух позиций — обычно страница одного товара.
for lic, rs in by_shop.items():
    if len(rs) <= 2:
        note("короткая полка", lic,
             f"всего {len(rs)} позиц. — проверить, витрина ли это: "
             + "; ".join((r.get("strainNameRaw") or "?") for r in rs))

# 5. Родословная одного сорта, расходящаяся между магазинами. Сорт один и тот
#    же; если у одних он indica, а у других sativa, кто-то читает не то поле.
lineages = defaultdict(Counter)
for r in rows:
    n = (r.get("strainNameCanonical") or "").lower()
    lin = r.get("lineage")
    if n and lin and lin != "UNKNOWN":
        lineages[n][lin] += 1
conflicts = []
for n, kinds in lineages.items():
    opposed = {"INDICA", "SATIVA"} & set(kinds)
    if len(opposed) == 2 and min(kinds["INDICA"], kinds["SATIVA"]) >= 2:
        conflicts.append((n, dict(kinds)))

print(f"Полок к осмотру: {len(by_shop)}")
if args.since:
    print(f"(только прочитанные с {args.since})")
print()

if not findings and not conflicts:
    print("Ничего подозрительного. Это не значит, что всё верно — значит, грубого нет.")

for kind in ("размеры", "сорта", "общая полка", "короткая полка"):
    hits = [f for f in findings if f[0] == kind]
    if not hits:
        continue
    print(f"### {kind}: {len(hits)}")
    for _k, lic, detail in hits[: args.top]:
        print(f"  {name(lic)} [{lic}]")
        print(f"    {detail}")
    if len(hits) > args.top:
        print(f"  …и ещё {len(hits) - args.top}")
    print()

if conflicts:
    print(f"### родословная расходится между магазинами: {len(conflicts)}")
    print("  Чаще всего это магазины противоречат друг другу, а не мы ошибаемся.")
    print("  Но для СОМЫ сорт не может быть одновременно indica и sativa.")
    for n, kinds in sorted(conflicts, key=lambda x: -sum(x[1].values()))[: args.top]:
        print(f"  {n}: " + ", ".join(f"{k}×{v}" for k, v in sorted(kinds.items())))
    if len(conflicts) > args.top:
        print(f"  …и ещё {len(conflicts) - args.top}")
