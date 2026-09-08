#!/usr/bin/env python3
"""Что изменилось на полках со вчерашнего дня.

Ежедневный прогон переписывает файл витрин целиком, и разница между двумя
версиями — единственное, что человек может прочитать: сорок тысяч строк JSON
он читать не станет. Отчёт отвечает на вопросы, ради которых прогон и
затевался: что появилось нового, что ушло, и не оборвалась ли где-то сборка.

    python scripts/menu-diff.py --previous /tmp/before.json

Пишет menu-report.md. Возвращает код 1, если сборка выглядит битой: полка
схлопнулась больше чем вдвое. Это не повод выбрасывать данные, это повод не
публиковать их не глядя.
"""
import argparse
import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

ap = argparse.ArgumentParser()
ap.add_argument("--previous", required=True, help="файл витрин ДО прогона")
ap.add_argument("--current", default=str(ROOT / "data/flower-listings.json"))
ap.add_argument("--out", default=str(ROOT / "menu-report.md"))
args = ap.parse_args()

before = json.loads(Path(args.previous).read_text())
after = json.loads(Path(args.current).read_text())
shops = {d["licenseNumber"]: (d.get("dbaName") or d["legalName"])
         for d in json.loads((ROOT / "data/dispensaries.json").read_text())}

def by_shop(rows):
    out = defaultdict(set)
    for l in rows:
        out[l["licenseNumber"]].add((l.get("strainNameRaw") or "").strip())
    return out

sb, sa = by_shop(before), by_shop(after)
names_before = {n.lower() for s in sb.values() for n in s if n}
names_after = {n.lower() for s in sa.values() for n in s if n}

# Сорт, которого вчера не было НИ В ОДНОМ магазине — это новинка на рынке, а
# не переезд с полки на полку. Различать их важно: первое интересно, второе нет.
new_to_market = defaultdict(set)
for lic, names in sa.items():
    for n in names:
        if n and n.lower() not in names_before:
            new_to_market[n].add(lic)
gone_from_market = sorted(names_before - names_after)

# Полка, схлопнувшаяся вдвое, — почти всегда прогон, который не долистал, а не
# магазин, распродавший половину товара за ночь.
collapsed = [(lic, len(sb[lic]), len(sa.get(lic, ())))
             for lic in sb if lic in sa and len(sa[lic]) * 2 < len(sb[lic])]
vanished = [lic for lic in sb if lic not in sa]

now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
grew = sum(1 for lic in sa if len(sa[lic]) > len(sb.get(lic, ())))
shrank = sum(1 for lic in sa if lic in sb and len(sa[lic]) < len(sb[lic]))

lines = [
    f"## Витрины — {now}",
    "",
    f"- позиций: **{len(before)} → {len(after)}** ({len(after) - len(before):+})",
    f"- магазинов с полкой: **{len(sb)} → {len(sa)}**",
    f"- сортов на рынке: **{len(names_before)} → {len(names_after)}**",
    f"- полок выросло {grew}, сократилось {shrank}",
    "",
    f"### Новых сортов на рынке: {len(new_to_market)}",
    "",
]
if new_to_market:
    ranked = sorted(new_to_market.items(), key=lambda kv: (-len(kv[1]), kv[0].lower()))
    lines += [f"- **{n}** — {len(w)} магазин(ов): "
              + ", ".join(sorted(shops.get(s, s) for s in w)[:4])
              for n, _w in [] ] or [
        f"- **{n}** — {len(w)} магазин(ов): "
        + ", ".join(sorted(shops.get(s, s) for s in w)[:4]) for n, w in ranked[:60]
    ]
    if len(ranked) > 60:
        lines.append(f"- …и ещё {len(ranked) - 60}")
else:
    lines.append("_ничего нового_")

lines += ["", f"### Пропало с рынка: {len(gone_from_market)}", ""]
lines += [f"- {n}" for n in gone_from_market[:40]] or ["_ничего_"]
if len(gone_from_market) > 40:
    lines.append(f"- …и ещё {len(gone_from_market) - 40}")

broken = bool(collapsed or vanished)
if broken:
    lines += ["", "### ⚠ Полки, которые выглядят оборванными", "",
              "Это скорее всего недолистанная страница, а не распроданный товар.", ""]
    for lic, b, a in sorted(collapsed, key=lambda x: x[2] - x[1])[:20]:
        lines.append(f"- **{shops.get(lic, lic)}**: {b} → {a}")
    for lic in vanished[:20]:
        lines.append(f"- **{shops.get(lic, lic)}**: {len(sb[lic])} → полка пропала целиком")

Path(args.out).write_text("\n".join(lines) + "\n")
print("\n".join(lines[:14]))
print(f"\nОтчёт: {args.out}")
raise SystemExit(1 if broken else 0)
