#!/usr/bin/env python3
"""Терпеновые панели с полок — по партиям, для Сомы.

Меню, которое показывает терпены, переписывает их с сертификата партии: у
Alley Oop от ElectraLeaf четыре магазина Gotham и BudBiz печатают 0.37, 0.23,
0.18, 0.12, 0.07 — ровно то, что Сома вручную переписала с сертификата Kaycha
той же партии. Поэтому единица здесь — партия, а не позиция меню: сорт бренда
при одном значении THC (оно тоже с сертификата). Одна партия в десяти магазинах —
одно измерение, подтверждённое десять раз, а не десять измерений.

    python scripts/shelf-terpenes.py    # data/shelf-terpenes.json

Как собирается партия:

- позиции одного сорта бренда с одним THC — одна партия; «31» и 30.64 — тоже
  одна (то же правило, что для партий в shelf-history.py);
- позиция без THC присоединяется к партии, только если её панель совпадает
  с панелью партии по всем общим терпенам; иначе к какой партии она относится,
  неизвестно, и она не идёт никуда;
- меню часто печатает не всю панель, а первые несколько терпенов, и разные
  меню — разные несколько. Панель партии — объединение того, что напечатали
  её магазины;
- если магазины расходятся в цифре одного терпена, берётся цифра большинства;
  при равенстве терпен не пишется. Если одно меню назвало терпен дважды с
  разными цифрами («Pinene» и «Alpha-Pinene» сборщик читает одним именем), из
  этой позиции он не берётся: пустое поле лучше правдоподобной догадки;
- в выгрузку идут партии, у которых в панели хотя бы три терпена.

Срок жизни партии — 16 недель с последнего дня, когда её видели на полке.
Партия, которой сегодня нет ни в одном меню, из выгрузки не пропадает: её
панель остаётся измерением этого сорта, пока партия могла ещё стоять у кого-то
дома или на складе. Та же партия (сорт бренда, тот же THC) на сегодняшних
полках обновляет свой последний день и сохраняет первый. Партия, не виденная
16 недель, уходит в data/shelf-terpenes-archive.json — не удаляется.
"""
import importlib.util
import json
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LISTINGS = ROOT / "data/flower-listings.json"
OUT = ROOT / "data/shelf-terpenes.json"
ARCHIVE = ROOT / "data/shelf-terpenes-archive.json"
LIFETIME = timedelta(weeks=16)
MIN_TERPENES = 3
SAME = 0.005  # ближе — одна и та же цифра, записанная иначе

_spec = importlib.util.spec_from_file_location("shelf_history", ROOT / "scripts/shelf-history.py")
_history = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_history)
key_of, same_batch, listings_of = _history.key_of, _history.same_batch, _history.listings_of


def panel_of(row):
    """{терпен: %} одной позиции; терпен, названный дважды по-разному, не берётся."""
    seen = defaultdict(set)
    for p in (row.get("terpenes") or {}).get("profile") or []:
        if p.get("percent") is not None and p.get("name") and p["name"] != "OTHER":
            seen[p["name"]].add(round(float(p["percent"]), 4))
    return {name: values.pop() for name, values in seen.items() if len(values) == 1}


def agrees(a, b):
    shared = a.keys() & b.keys()
    return bool(shared) and all(abs(a[t] - b[t]) <= SAME for t in shared)


def merged(panels):
    """Панель партии из панелей её магазинов; и сколько терпенов пришлось отбросить."""
    votes = defaultdict(Counter)
    for panel in panels:
        for name, value in panel.items():
            votes[name][value] += 1
    out, dropped = {}, 0
    for name, counted in votes.items():
        (value, n), *rest = counted.most_common()
        if rest and rest[0][1] == n and abs(rest[0][0] - value) > SAME:
            dropped += 1
            continue
        out[name] = value
    return dict(sorted(out.items(), key=lambda kv: -kv[1])), dropped


def lots(rows):
    by_strain = defaultdict(list)
    for row in rows:
        if (row.get("terpenes") or {}).get("source") != "MENU_LISTING":
            continue
        panel = panel_of(row)
        key = key_of(row)
        if panel and key:
            by_strain[key].append((row, panel))

    out, stray, conflicts = [], 0, 0
    for key, found in by_strain.items():
        groups = []  # [точный THC, [(row, panel)]]
        # Сначала точные значения, чтобы «31» пристало к 30.64, а не наоборот.
        dated = sorted((f for f in found if isinstance(f[0].get("thcPercent"), (int, float))),
                       key=lambda f: -len(repr(float(f[0]["thcPercent"]))))
        for row, panel in dated:
            thc = float(row["thcPercent"])
            home = next((g for g in groups if same_batch(g[0], thc)), None)
            if home:
                home[1].append((row, panel))
            else:
                groups.append([thc, [(row, panel)]])
        for row, panel in (f for f in found if not isinstance(f[0].get("thcPercent"), (int, float))):
            homes = [g for g in groups if any(agrees(panel, p) for _r, p in g[1])]
            if len(homes) == 1:
                homes[0][1].append((row, panel))
            else:
                stray += 1

        for thc, members in groups:
            panel, dropped = merged([p for _r, p in members])
            conflicts += dropped
            if len(panel) < MIN_TERPENES:
                continue
            rows_ = [r for r, _p in members]
            terps = [r.get("terpenes") or {} for r in rows_]
            out.append({
                "brand": Counter(r.get("brand") for r in rows_).most_common(1)[0][0],
                "strain": Counter(r.get("strainNameCanonical") or r.get("strainNameRaw") for r in rows_).most_common(1)[0][0],
                "key": key,
                "thcPercent": thc,
                "terpenes": panel,
                "totalPercent": max((t.get("totalPercent") for t in terps if t.get("totalPercent")), default=None),
                "shops": sorted({r["licenseNumber"] for r in rows_}),
                "certificates": sorted({t["coaUrl"] for t in terps if t.get("coaUrl")}),
                "lineageStated": sorted({r["lineage"] for r in rows_ if r.get("lineage") not in (None, "UNKNOWN")}),
                "read": min(r["capturedAt"][:10] for r in rows_),
                "lastSeen": max(r["capturedAt"][:10] for r in rows_),
            })
    out.sort(key=lambda lot: (lot["key"], -lot["thcPercent"]))
    return out, stray, conflicts


def carried(fresh, before, day):
    """Партии прошлых выгрузок, ещё живые, рядом с сегодняшними; и те, что ушли в архив.

    Сегодняшняя партия, та же, что прошлая (тот же сорт бренда, тот же THC),
    остаётся сегодняшней — с первым днём прошлой. Прошлая партия, которой
    сегодня нет, остаётся, пока с её последнего дня не прошло 16 недель."""
    horizon = (date.fromisoformat(day) - LIFETIME).isoformat()
    kept, gone = list(fresh), []
    for old in before:
        last = old.get("lastSeen") or old["read"]
        twin = next((l for l in fresh if l["key"] == old["key"] and same_batch(l["thcPercent"], old["thcPercent"])), None)
        if twin:
            twin["read"] = min(twin["read"], old["read"])
        elif last >= horizon:
            kept.append({**old, "lastSeen": last})
        else:
            gone.append({**old, "lastSeen": last})
    kept.sort(key=lambda lot: (lot["key"], -lot["thcPercent"]))
    return kept, gone


def load_lots(path):
    try:
        return json.loads(path.read_text()).get("lots") or []
    except FileNotFoundError:
        return []


def main():
    rows = listings_of(LISTINGS.read_text())
    found, stray, conflicts = lots(rows)
    day = max((r["capturedAt"][:10] for r in rows if r.get("capturedAt")), default=None)
    today = len(found)
    found, gone = carried(found, load_lots(OUT), day)
    OUT.write_text(json.dumps({
        "about": "Терпеновые панели с полок Нью-Йорка, по партиям: сорт бренда при одном THC. "
                 "Пишется scripts/shelf-terpenes.py из data/flower-listings.json; читает Сома. "
                 "Партия живёт 16 недель с последнего дня на полке (lastSeen), потом уходит в архив.",
        "day": day,
        "lots": found,
    }, ensure_ascii=False, indent=1) + "\n")
    if gone:
        archived = load_lots(ARCHIVE)
        seen = {(l["key"], l["thcPercent"], l["lastSeen"]) for l in archived}
        archived += [l for l in gone if (l["key"], l["thcPercent"], l["lastSeen"]) not in seen]
        ARCHIVE.write_text(json.dumps({
            "about": "Партии, которых не было на полках 16 недель; выгрузка shelf-terpenes.json их больше не несёт.",
            "lots": sorted(archived, key=lambda lot: (lot["key"], -lot["thcPercent"], lot["lastSeen"])),
        }, ensure_ascii=False, indent=1) + "\n")
    print(f"{OUT.relative_to(ROOT)}: {len(found)} партий ({today} на сегодняшних полках, "
          f"{len(found) - today} из прошлых выгрузок, ещё живы), в архив ушло {len(gone)}; "
          f"{len({l['key'] for l in found})} сортов брендов, "
          f"с сертификатом {sum(1 for l in found if l['certificates'])}, "
          f"в двух магазинах и больше {sum(1 for l in found if len(l['shops']) > 1)}; "
          f"позиций без THC, не узнанных ни в одной партии, {stray}; "
          f"терпенов, где магазины разошлись поровну, {conflicts}")


if __name__ == "__main__":
    main()
