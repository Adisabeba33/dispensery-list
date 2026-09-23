#!/usr/bin/env python3
"""Кого осталось добить руками — список для data/menu-endpoints.json.

Коллектор сам находит меню у большинства магазинов: по ссылке на сайте, по
известной платформе, перебором обычных адресов. Там, где он не находит,
единственное, что помогает, — адрес меню, записанный человеком. Этот скрипт
собирает список тех, кому он нужен, чтобы работа шла по списку, а не по
памяти.

    python scripts/menu-endpoints-wanted.py          # перезаписать docs/
    python scripts/menu-endpoints-wanted.py --print  # напечатать в stdout
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/MENU_ENDPOINTS_WANTED.md"
THIRD_PARTY = {"LEAFLY", "WEEDMAPS"}


def load(name, fallback):
    try:
        return json.loads((ROOT / name).read_text())
    except (OSError, ValueError):
        return fallback


def why_empty(row):
    """Словами, почему у магазина пусто — из диагностики последнего прогона."""
    if not row:
        return "не проверялся в последнем прогоне"
    if row.get("menuLink") == "none":
        return "ссылку на меню не нашли"
    if row.get("menuLink") == "robots-disallowed":
        return "robots.txt запрещает — **не трогать**"
    if str(row.get("status", "")).startswith("error"):
        return "страница не открылась"
    if row.get("status") == "no-flower":
        return f"товары есть ({row.get('productsSeen', 0)}), цветка нет"
    if row.get("productsSeen"):
        return f"прочитано {row['productsSeen']} товаров, ни один не цветок"
    return "страница вернула ноль товаров"


def main(to_stdout):
    shops = load("data/dispensaries.json", [])
    listings = load("data/flower-listings.json", [])
    endpoints = {e["licenseNumber"] for e in load("data/menu-endpoints.json", [])}
    coverage = load("data/menu-coverage.json", {})

    held = {}
    for l in listings:
        held[l["licenseNumber"]] = held.get(l["licenseNumber"], 0) + 1

    open_shops = [s for s in shops if s.get("operationalStatus") == "OPEN"]

    def site(s):
        return (s.get("contact") or {}).get("website")

    def provider(s):
        return (s.get("menu") or {}).get("provider")

    swept = [s for s in open_shops if provider(s) not in THIRD_PARTY and site(s)]
    # Магазин, чей robots.txt отказал целому сайту, обход не читает вовсе.
    # Адрес меню ему не нужен — его нужно оставить в покое, — так что он
    # уходит из «Пусто» вниз, к остальным, куда мы не ходим. Отказ только в
    # адресе меню (status другой, menuLink — этот) остаётся в «Пусто»:
    # разрешённая страница у такого магазина может и найтись.
    refused = [
        s for s in swept
        if (coverage.get(s["licenseNumber"]) or {}).get("status") == "robots-disallowed"
    ]
    refused_ids = {s["licenseNumber"] for s in refused}
    empty = [
        s for s in swept
        if not held.get(s["licenseNumber"]) and s["licenseNumber"] not in refused_ids
    ]
    short = [
        (s, coverage.get(s["licenseNumber"]))
        for s in swept
        if held.get(s["licenseNumber"])
        and (coverage.get(s["licenseNumber"]) or {}).get("declaredTotal")
        and coverage[s["licenseNumber"]]["declaredTotal"]
        > (coverage[s["licenseNumber"]].get("productsSeen") or 0)
    ]

    lines = [
        "# Магазины, которым нужен адрес меню",
        "",
        f"Работающих магазинов в реестре: **{len(open_shops)}**. Обход заходит в "
        f"**{len(swept) - len(refused)}**, полку отдают "
        f"**{len(swept) - len(refused) - len(empty)}**.",
        "",
        "Этот файл собирается скриптом `scripts/menu-endpoints-wanted.py` по "
        "последнему прогону — правит его не рука, а следующий запуск.",
        "",
        "## Что с этим делать",
        "",
        "Открыть сайт магазина, найти страницу, где реально видны товары с "
        "весами, и дописать строку в `data/menu-endpoints.json`:",
        "",
        "```json",
        "{",
        '  "licenseNumber": "OCM-CAURD-24-000051",',
        '  "menuUrl": "https://thespotdispensary.com/menu/?category=flowers",',
        '  "platform": "BLAZE",',
        '  "robotsAllows": true,',
        '  "flowerVisibleWithoutLogin": true,',
        '  "ageGate": "none",',
        '  "checkedAt": "2026-09-18",',
        '  "notes": "Прямая ссылка на категорию Flower."',
        "}",
        "```",
        "",
        "- `menuUrl` — адрес, на котором видно **цветок**, а не главная магазина. "
        "Категория лучше общего меню: на общем меню коллектор читает вейпы и "
        "съедобное вместе с банками.",
        "- `platform` — `DUTCHIE`, `BLAZE`, `TREEZ`, `IHEARTJANE`, `MEADOW`, "
        "`PROPRIETARY` или `OTHER`. Не знаете — `OTHER`.",
        "- `flowerVisibleWithoutLogin` — видно ли товары **без входа в аккаунт**. "
        "Если меню требует логин, ставьте `false` и `menuUrl: null`: за логин мы "
        "не ходим.",
        "- `ageGate` — `none`, `simple-button`, `date-of-birth-form` или `login`.",
        "- Пустое поле лучше правдоподобной догадки. Не уверены — `null` и "
        "напишите почему в `notes`.",
        "",
        "Проверить перед коммитом: `python scripts/validate-menu-endpoints.py`.",
        "",
    ]

    if not coverage:
        lines += [
            "> Причины «почему пусто» появятся здесь после первого прогона, "
            "который сохранит `data/menu-coverage.json`. Пока список без них.",
            "",
        ]

    lines += [f"## Пусто — {len(empty)}", ""]
    if empty:
        lines += ["| Магазин | Город | Сайт | Почему пусто |", "|---|---|---|---|"]
        for s in sorted(empty, key=lambda s: (s["address"]["city"], s.get("dbaName") or s["legalName"])):
            name = s.get("dbaName") or s["legalName"]
            mark = " ✳️" if s["licenseNumber"] in endpoints else ""
            lines.append(
                f"| {name}{mark} | {s['address']['city']} | {site(s)} | "
                f"{why_empty(coverage.get(s['licenseNumber']))} |"
            )
        lines += [
            "",
            "✳️ — адрес в `menu-endpoints.json` уже есть, и всё равно пусто: "
            "значит записанный адрес больше не тот.",
            "",
        ]

    if short:
        lines += [
            f"## Полка читается не до конца — {len(short)}",
            "",
            "Здесь адрес есть и меню отвечает, но отдаёт меньше, чем само "
            "объявляет. Листание таким не помогло — им нужен прямой адрес "
            "категории.",
            "",
            "| Магазин | Держим | Меню объявляет | Сайт |",
            "|---|---:|---:|---|",
        ]
        for s, cov in sorted(short, key=lambda x: (x[1].get("productsSeen") or 0) - x[1]["declaredTotal"]):
            name = s.get("dbaName") or s["legalName"]
            lines.append(
                f"| {name} | {held.get(s['licenseNumber'], 0)} | "
                f"{cov['declaredTotal']} | {site(s)} |"
            )
        lines.append("")

    third = [s for s in open_shops if provider(s) in THIRD_PARTY]
    nosite = [s for s in open_shops if not site(s)]
    lines += [
        "## Сюда не ходим",
        "",
        f"- **{len(third)}** магазинов держат меню на Leafly или Weedmaps. Это "
        "чужая витрина, а не витрина магазина, и читать её мы не будем — "
        "адрес такого меню в файл добавлять не нужно.",
        f"- **{len(nosite)}** магазинов не имеют сайта в реестре; см. "
        "`docs/MISSING_WEBSITES.md`. Найдётся сайт — магазин сам попадёт в обход.",
    ]
    if refused:
        lines.append(
            f"- **{len(refused)}** магазинов запретили обход в своём `robots.txt`. "
            "Мы спросили и получили отказ — это ответ, а не пробел, и искать им "
            "адрес меню не нужно. Отказ обычно приходит не от магазина, а от "
            "платформы, на которой стоит его витрина, и тогда уходит не один "
            "магазин, а все её. Список только растёт: сайт, который не отдал "
            "`robots.txt`, считается разрешившим, так что попасть сюда можно "
            "лишь по ясно объявленному запрету."
        )
        for r in sorted(refused, key=lambda x: (x["address"]["city"], x.get("dbaName") or x["legalName"])):
            lines.append(
                f"  - {r.get('dbaName') or r['legalName']} — "
                f"{r['address']['city']}, {site(r)}"
            )
    lines.append("")

    text = "\n".join(lines)
    if to_stdout:
        print(text)
    else:
        OUT.write_text(text + "\n")
        print(f"{OUT.relative_to(ROOT)}: {len(empty)} пусто, {len(short)} недочитано")
    return 0


if __name__ == "__main__":
    raise SystemExit(main("--print" in sys.argv))
