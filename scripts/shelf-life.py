#!/usr/bin/env python3
"""Срок годности против даты упаковки: сколько производитель отводит банке.

Меню не печатают дату упаковки никогда, но печатают срок годности (Treez —
на каждой партии остатка). Карточка Retail ID печатает дату упаковки, но
есть лишь у части пакетов. Там, где у одной банки известно и то и другое,
видно, какой срок ставит производитель: часто ровно год от упаковки. Если у
бренда срок постоянен, дата упаковки остальных его банок — это срок минус
этот срок, без единого запроса куда-либо.

    python scripts/shelf-life.py            # таблица по брендам в stdout,
                                            # enrichment-output/shelf-life.json

Пара «срок — упаковка» берётся с позиции, у которой есть expiresOn и метка
пакета (packageIds), найденная в data/retail-id.json с датой упаковки.
Печатается по брендам: пар, медиана срока в днях, разброс (10-й и 90-й
процентили). Бренд с пятью и больше парами и разбросом в неделю считается
постоянным (stable) — у него срок годности можно читать как дату упаковки.
"""
import json
import re
import statistics
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LISTINGS = ROOT / "data/flower-listings.json"
RETAIL_ID = ROOT / "data/retail-id.json"
OUT = ROOT / "enrichment-output/shelf-life.json"
TAG = re.compile(r"^1A4[0-9A-F]{21}$")
LINK = re.compile(r"^https://1a4\.com/(\S+)$", re.I)
MIN_PAIRS = 5
STABLE_SPREAD_DAYS = 7


def days_between(later, earlier):
    return (date.fromisoformat(later) - date.fromisoformat(earlier)).days


def main():
    raw = json.loads(LISTINGS.read_text())
    rows = raw if isinstance(raw, list) else raw["listings"]
    retail = json.loads(RETAIL_ID.read_text()) if RETAIL_ID.exists() else {}
    links = retail.get("links", {})
    packages = retail.get("packages", {})

    pairs = defaultdict(list)
    with_expiry = 0
    with_both = 0
    for r in rows:
        exp = r.get("expiresOn")
        if not exp:
            continue
        with_expiry += 1
        for raw_tag in r.get("packageIds") or []:
            t = str(raw_tag).strip()
            tag = links.get(t) if LINK.match(t) else (t.upper() if TAG.match(t.upper()) else None)
            card = packages.get(tag or "")
            if not card or not card.get("packaged"):
                continue
            with_both += 1
            pairs[r.get("brandKey") or r.get("brand") or "?"].append(
                (days_between(exp, card["packaged"]), r.get("brand"), r.get("strainNameCanonical"), exp, card["packaged"]))
            break

    table = []
    for key, items in pairs.items():
        days = sorted(d for d, *_ in items)
        n = len(days)
        p10 = days[int(0.1 * (n - 1))]
        p90 = days[int(0.9 * (n - 1))]
        table.append({
            "brandKey": key,
            "brand": items[0][1],
            "pairs": n,
            "medianDays": int(statistics.median(days)),
            "p10": p10,
            "p90": p90,
            "stable": n >= MIN_PAIRS and p90 - p10 <= STABLE_SPREAD_DAYS,
            "examples": [{"strain": s, "expiresOn": e, "packaged": p, "days": d} for d, _b, s, e, p in items[:3]],
        })
    table.sort(key=lambda t: (-t["stable"], -t["pairs"]))

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps({
        "about": "Срок годности минус дата упаковки по брендам, где у банки известно и то и другое "
                 "(expiresOn из меню, packaged из карточки Retail ID). stable — пар не меньше "
                 f"{MIN_PAIRS} и разброс p10–p90 не больше {STABLE_SPREAD_DAYS} дней. Пишется scripts/shelf-life.py.",
        "day": date.today().isoformat(),
        "listingsWithExpiry": with_expiry,
        "pairs": with_both,
        "brands": table,
    }, ensure_ascii=False, indent=1) + "\n")

    print(f"позиций со сроком годности: {with_expiry} из {len(rows)}; пар срок+упаковка: {with_both}; "
          f"брендов: {len(table)}, постоянных: {sum(1 for t in table if t['stable'])}")
    for t in table[:30]:
        flag = "stable" if t["stable"] else "      "
        print(f"  {flag} {t['brand'][:28]:28} пар {t['pairs']:3}  медиана {t['medianDays']:4} дн.  p10–p90 {t['p10']}–{t['p90']}")


if __name__ == "__main__":
    main()
