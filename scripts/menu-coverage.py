#!/usr/bin/env python3
"""Сколько магазина мы на самом деле прочитали — и где полка оборвалась.

Коллектор уже считает всё, что для этого нужно: сколько товаров пришло со
страницы, сколько из них цветок, какое число меню называет само, докрутили
мы список до конца или упёрлись в лимит. Всё это ложится в
enrichment-output/menu-summary.json — и там же умирает:

  * каталог enrichment-output/ в .gitignore, то есть с раннера не уезжает;
  * каждая партия из тридцати пяти магазинов перезаписывает файл целиком;
  * отчёт (scripts/menu-diff.py) читает из сводки ровно одно поле —
    shelvesHeldAtPreviousReading.

Поэтому единственная проверка полноты, которая доезжает до человека, —
разностная: «вчера было больше, чем сегодня». Она по построению не видит
полку, которая обрывается каждый день одинаково. Магазин, у которого мы
читаем двадцать товаров из ста двадцати, выглядит идеально стабильным.

Этот скрипт собирает пошаговую диагностику со всех партий и печатает по ней
раздел отчёта: абсолютную проверку вместо разностной.

    python scripts/menu-coverage.py collect   # после каждой партии
    python scripts/menu-coverage.py save      # один раз, в data/menu-coverage.json
    python scripts/menu-coverage.py report    # один раз, markdown в stdout
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SUMMARY = ROOT / "enrichment-output" / "menu-summary.json"
ACCUMULATED = Path("/tmp/menu-coverage.json")
SAVED = ROOT / "data/menu-coverage.json"

# Только то, что отвечает на вопрос «прочитали ли мы магазин целиком». Всё
# остальное из perShop — образцы полезной нагрузки, списки ключей, ссылки —
# весит много и здесь не нужно.
KEEP = (
    "licence",
    "shop",
    "status",
    "menuLink",
    # Где мы в итоге стояли и что магазин назвал своими категориями. Коллектор
    # считает и то и другое с самого начала — и выбрасывал на пороге отчёта,
    # из-за чего восемьдесят восемь магазинов «меню открыли, товаров ноль»
    # нельзя было разобрать вообще: ни адреса, ни того, что там лежало.
    "landedOn",
    "categories",
    "ageGate",
    "foundMenuByGuess",
    "guessedMenuPaths",
    "foundMenuOnSecondLook",
    "payloads",
    "settled",
    "jsonApiProducts",
    "rejectedShape",
    "productsSeen",
    "declaredTotal",
    "flower",
    "rejected",
    "hitScrollCap",
    "hitScrollBudget",
    "scrollRounds",
    "landedOnProductPage",
    "usedKnownEndpoint",
    "foundMenuByGuess",
    "guessedMenuPaths",
    "pagesAsked",
    "pagedFrom",
    "pagedTo",
    "pagingIgnored",
    "pagingRefused",
    "hitPagingBudget",
    "pagedQueryProducts",
    "pagingStoppedBecause",
    "pagedQueryIsPageable",
    "retried",
    "firstAttempt",
    "willAskAgain",
    "retryBudgetSpent",
)

# Размеры страницы, которые раздают меню: двадцать, двадцать четыре, двадцать
# пять. Полка ровно в один из них — почти наверняка первая страница, а не
# ассортимент: в собранных данных на «ровно 20» стоят двенадцать магазинов и
# на «ровно 24» одиннадцать, при том что на соседних числах их по два-четыре.
PAGE_SIZES = (12, 20, 24, 25, 30, 36, 40, 48, 50, 60, 96, 100)


def read_json(path, fallback):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return fallback


def collect():
    rows = read_json(ACCUMULATED, {})
    for entry in read_json(SUMMARY, {}).get("perShop") or []:
        licence = entry.get("licence")
        if not licence:
            continue
        # Последнее чтение побеждает: если магазин почему-то попал в две
        # партии, верна та, что прочитала его позже.
        rows[licence] = {k: entry.get(k) for k in KEEP if entry.get(k) is not None}
    ACCUMULATED.write_text(json.dumps(rows))
    print(f"coverage: {len(rows)} shop(s) so far")
    return 0


def shop_name(row):
    return row.get("shop") or row.get("licence") or "?"


def section(lines, title, note, items, limit=15):
    if not items:
        return
    lines += ["", f"### {title} — {len(items)}", ""]
    if note:
        lines += [note, ""]
    lines += [f"- {i}" for i in items[:limit]]
    if len(items) > limit:
        lines.append(f"- …и ещё {len(items) - limit}")


def report():
    rows = list(read_json(ACCUMULATED, {}).values())
    if not rows:
        return 0

    with_shelf = [r for r in rows if (r.get("flower") or 0) > 0]
    empty = [r for r in rows if not (r.get("flower") or 0)]

    lines = ["", "---", "", "## Полнота чтения", ""]
    lines.append(
        f"- посещено магазинов: **{len(rows)}**, с полкой: **{len(with_shelf)}**, "
        f"пусто: **{len(empty)}**"
    )

    why_empty = {}
    for r in empty:
        if r.get("menuLink") == "none":
            key = "ссылку на меню не нашли"
        elif r.get("menuLink") == "robots-disallowed":
            key = "robots.txt запрещает"
        elif str(r.get("status", "")).startswith("error"):
            key = "страница не открылась"
        elif r.get("status") == "no-flower":
            key = "товары есть, цветка нет"
        else:
            key = "страница вернула ноль товаров"
        why_empty[key] = why_empty.get(key, 0) + 1
    if why_empty:
        lines.append(
            "- пусто потому что: "
            + ", ".join(f"{k} — {n}" for k, n in sorted(why_empty.items(), key=lambda x: -x[1]))
        )

    # Меню назвало своё число. Это единственная проверка полноты, которая не
    # зависит ни от вчерашнего чтения, ни от наших догадок.
    # Обе стороны сравнения берутся из одного запроса. Раньше слева стояло
    # самое большое число из всего ответа, а справа — сумма товаров изо всех
    # запросов страницы сразу, и это сравнивало несравнимое: FUMI объявлял 259
    # (это был другой запрос), Verdi — 519 в одном прогоне и 29 в следующем с
    # той же полки.
    short = [
        r
        for r in rows
        if r.get("declaredTotal")
        and r.get("pagedQueryProducts") is not None
        and r["declaredTotal"] > r["pagedQueryProducts"]
    ]
    short.sort(key=lambda r: r["pagedQueryProducts"] - r["declaredTotal"])
    section(
        lines,
        "⚠ Меню объявляет больше, чем мы прочитали",
        "Слева — число, которое меню назвало в том же ответе, где лежали\n"
        "товары. Справа — сколько мы прочитали **того же самого запроса**, а не\n"
        "всего, что страница успела нафетчить. Расхождение здесь значит\n"
        "недочитанную полку, а не другой вопрос.",
        [
            f"**{shop_name(r)}**: меню говорит {r['declaredTotal']}, "
            f"прочитали {r['pagedQueryProducts']}"
            + (f" (остановились: {r['pagingStoppedBecause']})" if r.get("pagingStoppedBecause") else "")
            for r in short
        ],
    )

    # Чем кончилось листание, по всем магазинам сразу. Три из пяти выходов из
    # цикла раньше молчали, и «полка кончилась» было не отличить от «ответ не
    # дошёл».
    why_stop = {}
    for r in rows:
        key = r.get("pagingStoppedBecause")
        if key:
            why_stop[key] = why_stop.get(key, 0) + 1
    if why_stop:
        WORDS = {
            "ran-out-of-pages": "дошли до лимита страниц",
            "out-of-time": "кончилось время",
            "read-everything-declared": "прочитали всё, что меню объявило",
            "no-page-in-request": "в запросе нет номера страницы",
            "refused": "следующую страницу не отдали",
            "answer-not-captured": "⚠ ответ пришёл, но мы его не поймали",
            "nothing-arrived": "ответ не пришёл",
            "answer-had-no-products": "в ответе не было товаров",
            "same-products-again": "вернули ту же страницу",
        }
        lines += ["", "### Чем кончилось листание", ""]
        lines += [
            f"- {WORDS.get(k, k)}: **{n}**"
            for k, n in sorted(why_stop.items(), key=lambda x: -x[1])
        ]

    blind = [r for r in rows if r.get("pagingStoppedBecause") == "no-page-in-request"]
    section(
        lines,
        "Листать нечем",
        "В запросе, которым магазин отдал товары, номера страницы нет вовсе —\n"
        "так отвечают карусели «рекомендуем» и «новинки». Настоящий список\n"
        "обычно лежит рядом и листается; если полка коротка, магазину нужен\n"
        "свой адрес меню в data/menu-endpoints.json.",
        [
            f"**{shop_name(r)}**: прочитано {r.get('productsSeen', 0)}"
            + (f" из {r['declaredTotal']}" if r.get("declaredTotal") else "")
            for r in blind
        ],
    )

    # Что дало листание. Раньше этих товаров не было вовсе: прокрутка их не
    # достаёт, потому что меню не подгружается прокруткой — оно листается.
    paged = [r for r in rows if r.get("pagesAsked")]
    if paged:
        gainers = [r for r in paged if (r.get("pagedTo") or 0) > (r.get("pagedFrom") or 0)]
        gained = sum((r["pagedTo"] or 0) - (r["pagedFrom"] or 0) for r in gainers)
        gainers.sort(key=lambda r: r["pagedFrom"] - r["pagedTo"])
        section(
            lines,
            "Долистано страниц",
            f"Всего {gained} товаров сверх первой страницы, в {len(gainers)} "
            f"магазинах. Спрошено страниц: {sum(r['pagesAsked'] for r in paged)} "
            f"у {len(paged)} магазинов — где-то следующей страницы просто не было.",
            [
                f"**{shop_name(r)}**: {r['pagedFrom']} → {r['pagedTo']} (страниц {r['pagesAsked']})"
                for r in gainers
            ],
        )

    # Магазины, до меню которых дошли перебором адресов, а не по ссылке.
    guessed = [r for r in rows if r.get("foundMenuByGuess")]
    section(
        lines,
        "Меню найдено перебором адресов",
        "Ссылки на меню на сайте не было — попробовали, где меню обычно лежит.\n"
        "Если полка при этом пустая, адрес стоит найти руками.",
        [
            f"**{shop_name(r)}**: {', '.join(r.get('guessedMenuPaths') or [])} → "
            f"{r.get('flower', 0)} сортов"
            for r in sorted(guessed, key=lambda r: -(r.get("flower") or 0))
        ],
    )

    # Магазин, у которого полка была, а сегодня пришёл ноль. Правило переноса
    # молча оставляет вчерашнюю полку — и магазин неделями показывает чтение
    # от шестнадцатого рядом с соседом, у которого сегодняшнее. Поэтому у
    # такого спрашивают второй раз, в конце партии.
    retried = [r for r in rows if r.get("retried")]
    helped = [r for r in retried if (r.get("flower") or 0) > 0]
    section(
        lines,
        "Спросили второй раз",
        f"Помогло в {len(helped)} из {len(retried)}. Сколько именно мы теряли на\n"
        "этом: столько полок каждый день выглядели пустыми не потому, что\n"
        "магазин распродался, а потому что страница не догрузилась.",
        [
            f"**{shop_name(r)}**: с первого раза "
            f"{(r.get('firstAttempt') or {}).get('status', '?')}, со второго "
            + (f"{r['flower']} сортов" if (r.get("flower") or 0) > 0 else "снова пусто")
            for r in sorted(retried, key=lambda r: -(r.get("flower") or 0))
        ],
        limit=25,
    )

    owed = [r for r in rows if r.get("retryBudgetSpent")]
    section(
        lines,
        "⚠ Второго раза не хватило времени",
        "Магазину полагался повторный заход, и на него не осталось времени в\n"
        "прогоне. Публикуется вчерашняя полка — но не потому, что мы её\n"
        "проверили, а потому что не дошли.",
        [
            f"**{shop_name(r)}**: "
            + (f"{r['status']}" if r.get("status") else "пусто")
            for r in owed
        ],
    )

    # Самая большая дыра, и до сих пор безымянная: страница открылась, JSON
    # приходил, товаров в нём не оказалось. Адрес и названные магазином
    # категории — единственное, по чему это можно разобрать, не заводя пробу.
    silent = [
        r
        for r in rows
        if not (r.get("flower") or 0)
        and r.get("menuLink") == "found"
        and not str(r.get("status") or "").startswith("error")
        and r.get("status") != "no-flower"
    ]
    section(
        lines,
        "⚠ Меню открыли — товаров ноль",
        "Страница открылась, ответы приходили, товаров в них не было. Справа —\n"
        "адрес, на котором мы в итоге стояли: по нему видно, попали ли мы на\n"
        "меню, на возрастную стену, на филиал другого города или на витрину\n"
        "сети, которой магазин не принадлежит.",
        [
            f"**{shop_name(r)}**: {(r.get('landedOn') or '—')[:90]}"
            + (f" · ответов {r['payloads']}" if r.get("payloads") else "")
            for r in sorted(silent, key=lambda r: shop_name(r))
        ],
        limit=40,
    )

    # Магазин назвал категории, и цветка среди них нет. Это либо магазин без
    # цветка, либо мы стоим не на той странице — и список категорий говорит,
    # что именно.
    wrong_shelf = [r for r in rows if r.get("status") == "no-flower" and r.get("categories")]
    section(
        lines,
        "⚠ Товары есть, цветка нет",
        "Магазин назвал свои категории — цветка среди них нет. Если в списке\n"
        "справа одни вейпы и съедобное, мы почти наверняка стоим не на той\n"
        "странице, а не нашли магазин без травы.",
        [
            f"**{shop_name(r)}**: {', '.join(r['categories'][:5])}"
            for r in sorted(wrong_shelf, key=lambda r: -(r.get("productsSeen") or 0))
        ],
        limit=20,
    )

    # Поля того, что мы прочитали и не смогли опознать. Это не товары:
    # cookie-баннер OneTrust у Curaleaf, список категорий у The Hibrary. У
    # настоящего товара есть цена, процент или вес — у них нет ничего.
    shapes = [r for r in rows if r.get("rejectedShape") and not (r.get("flower") or 0)]
    section(
        lines,
        "Что мы читаем и не можем опознать",
        "Поля первой такой записи в каждом магазине. Если в списке нет ни\n"
        "цены, ни процента, ни веса — это не товар, и читать его как товар\n"
        "нельзя: он раздувает «прочитано» и портит всю диагностику.",
        [
            f"**{shop_name(r)}** ({reason}): {keys[:150]}"
            for r in sorted(shapes, key=lambda r: shop_name(r))
            for reason, keys in (r.get("rejectedShape") or {}).items()
        ],
        limit=25,
    )

    dead = [r for r in rows if str(r.get("status") or "").startswith("error")]
    section(
        lines,
        "⚠ Сайт не открылся",
        "Не меню не нашлось — сам сайт не ответил. Это данные реестра, а не\n"
        "коллектор: адрес мёртв, сертификат сломан или имя не резолвится.\n"
        "Чинится только рукой — новым адресом в data/dispensaries.json.",
        [f"**{shop_name(r)}**: {str(r['status']).split(chr(10))[0][:110]}" for r in dead],
    )

    ignored = [r for r in rows if r.get("pagingIgnored")]
    section(
        lines,
        "Меню не слушает номер страницы",
        "На запрос следующей страницы приходит та же самая. Такому магазину\n"
        "листание не поможет — нужен свой адрес меню в data/menu-endpoints.json.",
        [f"**{shop_name(r)}**: прочитано {r.get('productsSeen', 0)}" for r in ignored],
    )

    refused = [r for r in rows if r.get("pagingRefused")]
    section(
        lines,
        "⚠ Следующую страницу не отдали",
        "Мы её спросили — сервер не дал. Слева то, что он ответил: код или\n"
        "ошибка браузера. «Failed to fetch» значит, что запрос заблокирован\n"
        "как межсайтовый; код 4xx — что серверу что-то в запросе не нравится.",
        [
            f"**{shop_name(r)}**: {r['pagingRefused']} (держим {r.get('productsSeen', 0)}"
            + (f" из {r['declaredTotal']}" if r.get("declaredTotal") else "")
            + ")"
            for r in sorted(refused, key=lambda r: -(r.get("declaredTotal") or 0))
        ],
    )

    budget = [r for r in rows if r.get("hitPagingBudget")]
    section(
        lines,
        "⚠ Листали, но не дочитали",
        "Кончилось отведённое на магазин время. Полка реальная, просто длинная —\n"
        "и то, что осталось за границей, осталось непрочитанным.",
        [
            f"**{shop_name(r)}**: дошли до {r.get('pagedTo', '?')}"
            + (f" из {r['declaredTotal']}" if r.get("declaredTotal") else "")
            for r in budget
        ],
    )

    cut = [r for r in rows if r.get("hitScrollCap") or r.get("hitScrollBudget")]
    section(
        lines,
        "⚠ Остановились, пока меню ещё росло",
        "Упёрлись в лимит прокрутки или во время, а не в конец списка.",
        [
            f"**{shop_name(r)}**: прокруток {r.get('scrollRounds', '?')}, "
            f"прочитано {r.get('productsSeen', 0)}"
            for r in cut
        ],
    )

    # Полка ровно в размер страницы. Разностная проверка такое не ловит
    # никогда: она одинакова изо дня в день и потому выглядит здоровой.
    page = [
        r
        for r in with_shelf
        if r.get("productsSeen") in PAGE_SIZES and not r.get("declaredTotal")
    ]
    page.sort(key=lambda r: shop_name(r))
    section(
        lines,
        "Полка ровно в размер страницы",
        "Подозрение, не приговор: столько товаров отдаёт одна страница меню.\n"
        "Меню своего общего числа не назвало, так что проверить нечем — но\n"
        "ассортимент, совпавший с размером страницы, обычно первая страница.",
        [f"**{shop_name(r)}**: товаров {r['productsSeen']}" for r in page],
    )

    # Товары, которые мы прочитали и выбросили. Считается уже сегодня — просто
    # никуда не доезжает.
    no_size = [(shop_name(r), (r.get("rejected") or {}).get("flower-no-size", 0)) for r in rows]
    no_size = sorted([x for x in no_size if x[1]], key=lambda x: -x[1])
    if no_size:
        total = sum(n for _, n in no_size)
        section(
            lines,
            "Цветок, отброшенный без веса",
            f"Всего {total} шт. Товар прочитан, но ни в полях, ни в названии нет\n"
            "веса. Позицию без веса публиковать нечего, так что она пропадает\n"
            "целиком — не вес пропадает, а весь сорт.",
            [f"**{s}**: {n}" for s, n in no_size],
        )

    print("\n".join(lines))
    return 0


def save():
    """Положить диагностику в репозиторий, чтобы она пережила раннер.

    Раздел отчёта живёт один день и уезжает в комментарий к issue. Список
    «кому нужен адрес меню» строится по тем же данным, и строить его не из
    чего, пока они умирают вместе с раннером. Файл маленький — по строке на
    магазин — и меняется предсказуемо, так что его не страшно держать в git.
    """
    rows = read_json(ACCUMULATED, {})
    if not rows:
        print("coverage: nothing collected, file left as it was")
        return 0
    SAVED.parent.mkdir(parents=True, exist_ok=True)
    SAVED.write_text(json.dumps(rows, ensure_ascii=False, indent=1, sort_keys=True) + "\n")
    print(f"coverage: {len(rows)} shop(s) saved to {SAVED.relative_to(ROOT)}")
    return 0


def main(action):
    if action == "collect":
        return collect()
    if action == "report":
        return report()
    if action == "save":
        return save()
    print(f"unknown action: {action}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1] if len(sys.argv) > 1 else ""))
