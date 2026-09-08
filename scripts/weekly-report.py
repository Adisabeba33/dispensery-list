#!/usr/bin/env python3
"""Что изменилось в реестре за неделю — магазины и производители.

Реестр штата публикует только действующие лицензии, поэтому «пропал из
реестра» и «закрылся» — разные вещи, и путать их нельзя: магазин может
работать с истекающей лицензией, а может держать лицензию и не открыться.
Отчёт разводит это по категориям, которые человек может прочитать и на
которые может что-то сделать.

    python scripts/weekly-report.py --previous-dispensaries /tmp/before-d.json \\
                                    --previous-producers /tmp/before-p.json

Пишет refresh-report.md — тело пулл-реквеста, который открывает еженедельный
прогон.
"""
import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

ap = argparse.ArgumentParser()
ap.add_argument("--previous-dispensaries", required=True)
ap.add_argument("--previous-producers")
ap.add_argument("--out", default=str(ROOT / "refresh-report.md"))
args = ap.parse_args()

def load(path):
    p = Path(path)
    return json.loads(p.read_text()) if p.exists() else []

def shop_name(r):
    return r.get("dbaName") or r["legalName"]

def city(r):
    return (r.get("address") or {}).get("city") or "—"

before_d = {r["licenseNumber"]: r for r in load(args.previous_dispensaries)}
after_d = {r["licenseNumber"]: r for r in json.loads((DATA / "dispensaries.json").read_text())}

OPEN = "OPEN"
new_licences, opened, closed, left, moved = [], [], [], [], []

for lic, r in after_d.items():
    old = before_d.get(lic)
    if old is None:
        new_licences.append(f'**{shop_name(r)}** — {city(r)} ({lic}), '
                            f'статус: {r.get("operationalStatus")}')
        continue
    was, now = old.get("operationalStatus"), r.get("operationalStatus")
    if was != OPEN and now == OPEN:
        opened.append(f'**{shop_name(r)}** — {city(r)} ({lic})')
    elif was == OPEN and now != OPEN:
        closed.append(f'**{shop_name(r)}** — {city(r)}: {was} → {now} ({lic})')
    a, b = (old.get("address") or {}).get("line1"), (r.get("address") or {}).get("line1")
    if a and b and a != b:
        moved.append(f'**{shop_name(r)}**: {a} → {b}')

for lic, old in before_d.items():
    if lic not in after_d:
        # Реестр публикует только действующие лицензии. Исчезновение строки —
        # это лицензия, которая больше не действует: отозвана, сдана или не
        # продлена. Какое именно из трёх — реестр не говорит, и мы не гадаем.
        left.append(f'**{shop_name(old)}** — {city(old)} ({lic}), '
                    f'была {old.get("operationalStatus")}')

# Лицензия, которая вот-вот истечёт, — единственная категория, где отчёт
# полезен ДО того, как что-то случилось.
today = datetime.now(timezone.utc)
soon = today + timedelta(days=60)
expiring, already_expired = [], []
for lic, r in sorted(after_d.items(), key=lambda kv: (kv[1].get("dates") or {}).get("licenseExpiration") or "9999"):
    exp = (r.get("dates") or {}).get("licenseExpiration")
    if not exp:
        continue
    try:
        when = datetime.fromisoformat(exp).replace(tzinfo=timezone.utc)
    except ValueError:
        continue
    if when < today:
        # Реестр показывает лицензию действующей, а дата окончания уже прошла.
        # Одно из двух врёт. Чаще всего это продление, которое в открытых
        # данных ещё не отражено, но проверять надо: работать по истёкшей
        # лицензии нельзя, и ссылаться на неё как на действующую мы не вправе.
        already_expired.append(f'**{shop_name(r)}** — {city(r)}: дата окончания {exp}, '
                               f'а лицензия числится действующей')
    elif when <= soon:
        expiring.append(f'**{shop_name(r)}** — {city(r)}: до {exp}')

# ------------------------------------------------------------- производители
before_p = {r["licenseNumber"]: r for r in load(args.previous_producers or "")} if args.previous_producers else {}
prod_path = DATA / "producers.json"
after_p = {r["licenseNumber"]: r for r in json.loads(prod_path.read_text())} if prod_path.exists() else {}

TYPE_RU = {
    "CULTIVATOR": "гровер",
    "PROCESSOR": "переработчик",
    "PROCESSOR_BRANDING": "переработчик (бренд)",
    "PROCESSOR_FLOWER": "переработчик (цветок)",
    "MICROBUSINESS": "микробизнес",
}
new_producers, gone_producers = [], []
if before_p:
    for lic, r in after_p.items():
        if lic not in before_p:
            new_producers.append(
                f'**{r["entityName"]}** — {TYPE_RU.get(r["licenseType"], r["licenseType"])}'
                + (f', {", ".join(r["counties"])}' if r.get("counties") else "")
                + f' ({lic})')
    for lic, old in before_p.items():
        if lic not in after_p:
            gone_producers.append(f'**{old["entityName"]}** — '
                                  f'{TYPE_RU.get(old["licenseType"], old["licenseType"])} ({lic})')

# ------------------------------------------------------------------- отчёт
now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
growers = sum(1 for r in after_p.values() if r["licenseType"] in ("CULTIVATOR", "MICROBUSINESS"))
lines = [
    f"## Реестр — {now}",
    "",
    f"- магазинов: **{len(before_d)} → {len(after_d)}** ({len(after_d) - len(before_d):+}), "
    f"из них работают: {sum(1 for r in after_d.values() if r.get('operationalStatus') == OPEN)}",
]
if after_p:
    lines.append(f"- производителей: **{len(before_p) or '—'} → {len(after_p)}**, "
                 f"из них выращивают: {growers}")
lines.append("")

sections = [
    ("🆕 Новые лицензии", new_licences),
    ("🟢 Открылись", opened),
    ("🔴 Перестали работать", closed),
    ("⛔ Ушли из реестра (лицензия больше не действует)", left),
    ("📦 Переехали", moved),
    ("🌱 Новые производители", new_producers),
    ("🚪 Производители ушли из реестра", gone_producers),
    ("⏳ Лицензия истекает в ближайшие 60 дней", expiring),
    ("❓ Дата окончания уже прошла, а лицензия активна — реестр противоречит сам себе", already_expired),
]
changed = False
for title, items in sections:
    if not items:
        continue
    changed = True
    lines += ["", f"### {title} — {len(items)}", ""] + [f"- {i}" for i in items[:40]]
    if len(items) > 40:
        lines.append(f"- …и ещё {len(items) - 40}")

if not changed:
    lines += ["", "_За неделю в реестре ничего не изменилось._"]

Path(args.out).write_text("\n".join(lines) + "\n")
print("\n".join(lines))
