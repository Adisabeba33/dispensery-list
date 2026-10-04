#!/usr/bin/env python3
"""Насколько свежо то, что пришло на полки: раздел ежедневного отчёта.

    python scripts/freshness.py            # Markdown в stdout

Читает data/shelf-terpenes.json — партии с панелью терпенов и их даты: тест
(сертификат или Metrc Retail ID), упаковка, первый день на полке. Новая партия —
впервые на полке за последние NEW_DAYS дней и не стоявшая там с первого
чтения реестра. Возраст считается от дня выгрузки, не от сегодняшнего.

Мы видим партию в первый же день, когда читаем меню магазина; сколько
ей самой — говорит дата теста и упаковки. Раздел считает именно это и сколько
новых партий вообще имеют дату: чем больше их без даты, тем меньше мы знаем.
"""
import json
import statistics
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOTS = ROOT / "data/shelf-terpenes.json"
NEW_DAYS = 7
BANDS = ((30, "до 30 дн."), (90, "31–90 дн."), (180, "91–180 дн."), (None, "старше 180 дн."))
FRESH_DAYS = 30
SHOW = 10


def days(day, value):
    try:
        return (day - date.fromisoformat(str(value)[:10])).days
    except (TypeError, ValueError):
        return None


def spread(ages):
    """«медиана N дн.; до 30 дн. — a, 31–90 — b …» — сколько партий в каждом окне."""
    ages = sorted(a for a in ages if a is not None and a >= 0)
    if not ages:
        return None
    parts, low = [], -1
    for high, label in BANDS:
        n = sum(1 for a in ages if a > low and (high is None or a <= high))
        parts.append(f"{label} — {n}")
        low = high if high is not None else low
    return f"медиана {statistics.median(ages):.0f} дн.; " + ", ".join(parts)


def report(doc):
    day = date.fromisoformat(doc["day"])
    on_shelf = [l for l in doc["lots"] if l.get("lastSeen") == doc["day"]]
    new = [l for l in on_shelf if not l.get("onShelfSinceStart")
           and (days(day, l.get("firstOnShelf")) or 0) <= NEW_DAYS and l.get("firstOnShelf")]
    lines = [f"### Свежесть партий: что пришло за {NEW_DAYS} дней", ""]
    lines.append("Партия здесь — сорт бренда с панелью терпенов при одном THC. Мы видим её в первый "
                 "же день, когда читаем меню (раз в сутки); сколько ей самой, говорят дата теста "
                 "(сертификат или Metrc Retail ID) и дата упаковки.")
    lines.append("")
    if not new:
        lines.append(f"- новых партий за {NEW_DAYS} дней нет")
        return "\n".join(lines) + "\n"
    tested = [l for l in new if l.get("testedOn")]
    packaged = [l for l in new if l.get("packagedOn")]
    from_card = sum(1 for l in tested if l.get("testedFrom") == "retail-id")
    lines.append(f"- новых партий: **{len(new)}**; с датой теста {len(tested)} "
                 f"({from_card} из Retail ID, {len(tested) - from_card} из сертификатов), "
                 f"с датой упаковки {len(packaged)}, без дат {sum(1 for l in new if not l.get('testedOn') and not l.get('packagedOn'))}")
    t = spread(days(day, l["testedOn"]) for l in tested)
    if t:
        lines.append(f"- тест: {t}")
    p = spread(days(day, l["packagedOn"]) for l in packaged)
    if p:
        lines.append(f"- упаковка: {p}")
    whole = spread(days(day, l["testedOn"]) for l in on_shelf if l.get("testedOn"))
    if whole:
        lines.append(f"- вся полка сегодня ({sum(1 for l in on_shelf if l.get('testedOn'))} партий с датой теста "
                     f"из {len(on_shelf)}): {whole}")
    fresh = sorted((l for l in tested if (days(day, l["testedOn"]) or 10**6) <= FRESH_DAYS),
                   key=lambda l: (l["testedOn"], len(l.get("shops") or [])), reverse=True)
    if fresh:
        lines.append("")
        lines.append(f"**Самые свежие новинки** — тест не старше {FRESH_DAYS} дней: {len(fresh)}")
        lines.append("")
        for l in fresh[:SHOW]:
            shops = len(l.get("shops") or [])
            packed = f", упакована {l['packagedOn'][8:10]}.{l['packagedOn'][5:7]}" if l.get("packagedOn") else ""
            lines.append(f"- **{l['brand']} · {l['strain']}** — THC {l['thcPercent']}%, тест "
                         f"{l['testedOn'][8:10]}.{l['testedOn'][5:7]} ({days(day, l['testedOn'])} дн.){packed}, "
                         f"магазинов {shops}")
        if len(fresh) > SHOW:
            lines.append(f"- …и ещё {len(fresh) - SHOW}")
    return "\n".join(lines) + "\n"


def main():
    print(report(json.loads(LOTS.read_text())))


if __name__ == "__main__":
    main()
