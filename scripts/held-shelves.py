#!/usr/bin/env python3
"""Собрать придержанные полки со всех партий прогона.

Ежедневный прогон читает магазины партиями по тридцать пять, и каждая партия
перезаписывает enrichment-output/menu-summary.json целиком. Значит список
придержанных полок, который читает отчёт, описывает последние тридцать пять
магазинов из четырёхсот шестидесяти восьми — остальные придерживались молча.
Тихо придержанная полка это способ спрятать поломку коллектора на две недели,
ровно от этого раздел в отчёте и защищает.

    python scripts/held-shelves.py collect   # после каждой партии
    python scripts/held-shelves.py merge     # один раз, перед отчётом
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SUMMARY = ROOT / "enrichment-output" / "menu-summary.json"
ACCUMULATED = Path("/tmp/held-shelves.json")
FIELD = "shelvesHeldAtPreviousReading"


def read_json(path, fallback):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return fallback


def main(action):
    if action == "collect":
        kept = read_json(ACCUMULATED, [])
        kept += read_json(SUMMARY, {}).get(FIELD) or []
        ACCUMULATED.write_text(json.dumps(kept))
        return 0

    if action == "merge":
        kept = read_json(ACCUMULATED, [])
        if not kept:
            return 0
        seen, unique = set(), []
        for h in kept:
            if h not in seen:
                seen.add(h)
                unique.append(h)
        data = read_json(SUMMARY, {})
        data[FIELD] = unique
        SUMMARY.parent.mkdir(parents=True, exist_ok=True)
        SUMMARY.write_text(json.dumps(data, indent=2))
        print(f"{len(unique)} held shelf/shelves across the run")
        return 0

    print(f"unknown action: {action}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1] if len(sys.argv) > 1 else ""))
