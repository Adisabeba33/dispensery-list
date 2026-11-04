#!/usr/bin/env python3
"""Проверки scripts/menu-diff.py на выдуманных полках: что задерживает день, а что нет."""
import json
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
failures = []


def check(cond, what):
    if not cond:
        failures.append(what)


def shelf(lic, n, days_ago):
    at = (datetime.now(timezone.utc) - timedelta(days=days_ago)).strftime("%Y-%m-%dT%H:%M:%SZ")
    return [{"licenseNumber": lic, "strainNameRaw": f"{lic} strain {i}", "capturedAt": at} for i in range(n)]


def diff(before, after):
    with tempfile.TemporaryDirectory() as tmp:
        prev, cur, out = (Path(tmp) / name for name in ("before.json", "after.json", "report.md"))
        prev.write_text(json.dumps(before))
        cur.write_text(json.dumps(after))
        run = subprocess.run([sys.executable, str(ROOT / "scripts/menu-diff.py"), "--previous", str(prev),
                              "--current", str(cur), "--out", str(out)], capture_output=True, text=True)
        return run.returncode, out.read_text() if out.exists() else run.stderr


# Лицензии выдуманы: их нет ни в data/menu-paused.json, ни в data/menu-coverage.json.
steady = shelf("TEST-STEADY", 20, 0)

# Полка месячной давности, которую сборщик снял сам (CARRY_FORWARD_DAYS):
# день публикуется, а полка названа в отчёте.
code, text = diff(steady + shelf("TEST-AGED", 53, 31), steady)
check(code == 0, f"снятая за давностью полка не задерживает день: код {code}")
check("### Полки, снятые за давностью: 1" in text and "**TEST-AGED**: 53 → 0 — прочитана" in text,
      f"снятая за давностью полка названа: {text}")
check("оборванными" not in text, f"и не названа оборванной: {text}")

# Полка, прочитанная вчера и пропавшая целиком, — по-прежнему повод не публиковать.
code, text = diff(steady + shelf("TEST-FRESH", 53, 1), steady)
check(code == 1, f"пропавшая свежая полка задерживает день: код {code}")
check("**TEST-FRESH**: 53 → полка пропала целиком" in text, f"и названа: {text}")

# Обе сразу: давняя не прячет свежую.
code, text = diff(steady + shelf("TEST-AGED", 53, 31) + shelf("TEST-FRESH", 40, 1), steady)
check(code == 1, f"давняя полка не прячет пропавшую свежую: код {code}")
check("снятые за давностью: 1" in text and "**TEST-FRESH**: 40 → полка пропала целиком" in text,
      f"обе названы каждая в своём разделе: {text}")

# Полка, схлопнувшаяся вдвое со вчерашнего чтения, задерживает день, как и прежде.
code, text = diff(steady + shelf("TEST-CUT", 20, 1), steady + shelf("TEST-CUT", 3, 0))
check(code == 1, f"оборванная полка задерживает день: код {code}")

# Ничего не пропало — публикуется.
code, text = diff(steady, steady)
check(code == 0, f"ровный день публикуется: код {code}")

if failures:
    print(f"menu-diff-check: {len(failures)} ошибок")
    for f in failures:
        print("  -", f)
    sys.exit(1)
print("menu-diff-check: ok")
