#!/usr/bin/env python3
"""Проверки scripts/freshness.py на выдуманных партиях."""
import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("freshness", ROOT / "scripts/freshness.py")
fr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fr)
failures = []


def check(cond, what):
    if not cond:
        failures.append(what)


def lot(strain, first, tested=None, packaged=None, since_start=False, last="2026-10-03", src="sampled"):
    l = {"brand": "Knack", "strain": strain, "thcPercent": 25.0, "shops": ["A", "B"],
         "firstOnShelf": first, "lastSeen": last}
    if tested:
        l.update(testedOn=tested, testedFrom=src)
    if packaged:
        l["packagedOn"] = packaged
    if since_start:
        l["onShelfSinceStart"] = True
    return l


doc = {"day": "2026-10-03", "lots": [
    lot("Zero-G", "2026-10-01", tested="2026-09-22", packaged="2026-09-29", src="retail-id"),
    lot("Old Stock", "2026-09-30", tested="2025-10-21"),
    lot("No Date", "2026-10-02"),
    lot("Long Ago", "2026-09-06", tested="2026-01-01"),
    lot("Since Start", "2026-10-01", tested="2026-09-01", since_start=True),
    lot("Gone", "2026-10-01", tested="2026-09-30", last="2026-10-02"),
]}
text = fr.report(doc)
check("новых партий: **3**" in text, f"новые — за 7 дней, на полке сегодня, не с первого чтения: {text}")
check("с датой теста 2 (1 из Retail ID, 1 из сертификатов)" in text, "откуда даты")
check("без дат 1" in text, "сколько без дат")
check("тест: медиана 179 дн.; до 30 дн. — 1, 31–90 дн. — 0, 91–180 дн. — 0, старше 180 дн. — 1" in text,
      f"окна по возрасту теста: {text}")
check("**Knack · Zero-G** — THC 25.0%, тест 22.09 (11 дн.), упакована 29.09, магазинов 2" in text,
      "свежие новинки названы с датами")
check("Old Stock**" not in text, "старое — не в свежих")
check("вся полка сегодня (4 партий с датой теста из 5)" in text, f"вся полка: {text}")
check("новых партий за 7 дней нет" in fr.report({"day": "2026-10-03", "lots": []}), "пусто — так и сказано")
for word in ("подделк", "обман", "фальсиф", "мошен", "махинац"):
    check(word not in text.lower(), f"в отчёте нет оценок: {word}")

if failures:
    print(f"freshness-check: {len(failures)} ошибок")
    for f in failures:
        print("  -", f)
    sys.exit(1)
print("freshness-check: ok")
