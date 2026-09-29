#!/usr/bin/env python3
"""Даты с сертификатов партий: когда отобрали пробу, когда упаковали, когда собрали.

Сколько банка лежит — вопрос, на который меню не отвечает никогда. Отвечает
сертификат: лаборатория отбирает пробу уже из расфасованной партии («R 3.5G
PLUTO 4», партия 1920 пакетов), поэтому день отбора пробы — это день, раньше
которого пакет не существовал, а упакован он в тот же день или за несколько
дней до него. У части сертификатов есть и сама дата упаковки (Packaged Date в
карточке Metrc), и дата сбора (Harvest/Lot ID вида «H:12.01.25»).

    python scripts/coa-dates.py            # data/coa-dates.json

Берёт ссылки на сертификаты из data/shelf-terpenes.json, скачивает те, которых
ещё нет в data/coa-dates.json, и читает их через pdftotext (poppler-utils).
Сами PDF не хранятся: сертификат не меняется, прочитанное пишется один раз.
Не прочитанное (сеть, нет pdftotext, незнакомый формат) пишется с пустыми
датами и причиной — и будет перечитано при следующем запуске.

Лаборатории и где у них дата пробы:
- Kaycha:           «Sampled Date: 12/12/25» / «Sampled: 12/12/25»
- Green Analytics:  «Sampling Date: 05/19/2026»
- DRS:              «Sample Collection Date/Time: 11/14/25»
- Keystone:         «Date Sampled: 10/15/2025»
- ACT:              только «Sample Received: 01/28/2025» — день, когда проба
                    приехала в лабораторию; на день-два позже отбора
- Smithers:         «Sample Collected: 05/11/2026»
- другие:           «Date Collected: May 28, 2026»
- карточка Metrc:   «Packaged Date 02/18/2026», дата теста «On: 2026-02-03»
- в крайнем случае: «Report Date» — день отчёта, на неделю-другую позже пробы
"""
import json
import re
import shutil
import subprocess
import tempfile
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOTS = ROOT / "data/shelf-terpenes.json"
OUT = ROOT / "data/coa-dates.json"

D = r"(\d{1,2}/\d{1,2}/\d{2,4}|\d{4}-\d{2}-\d{2}|[A-Z][a-z]{2,8}\.? \d{1,2}, \d{4})"
MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}
SAMPLED = [
    re.compile(r"Sampled Date:\s*" + D),
    re.compile(r"Sampling Date:\s*" + D),
    re.compile(r"Sample Collection Date/Time:\s*" + D),
    re.compile(r"Date Sampled:\s*" + D),
    re.compile(r"\bSampled:\s*" + D),
    re.compile(r"Sample Collected:\s*" + D),
]
RECEIVED = [
    re.compile(r"Sample Received:\s*" + D),
    re.compile(r"Date Received:\s*" + D),
    re.compile(r"Date Collected:\s*" + D),
]
REPORTED = [re.compile(r"Report Date:?\s*" + D), re.compile(r"Published:\s*" + D)]
TESTED = [re.compile(r"Tested By:[^\n]*\n\s*On:\s*" + D), re.compile(r"\bOn:\s*" + D)]
PACKAGED = re.compile(r"Packaged Date\s*:?\s*" + D)
HARVEST = re.compile(r"Harvest/Lot ID:[^\n]*?\bH:\s*(\d{1,2})\.(\d{1,2})\.(\d{2,4})")
LABS = [("Kaycha", "Kaycha"), ("Green Analytics", "Green Analytics"), ("DRS Testing", "DRS"),
        ("Keystone", "Keystone"), ("ACT Lab", "ACT"), ("Reliable Labs", "Reliable"), ("Metrc", "Metrc"),
        ("metrc", "Metrc")]


def iso(text):
    """«12/12/25», «05/19/2026», «2026-02-03», «May 28, 2026» → ISO; иначе None."""
    named = re.fullmatch(r"([A-Za-z]{3})[a-z]*\.? (\d{1,2}), (\d{4})", text)
    if named:
        m, d, y = MONTHS.get(named.group(1).lower()), int(named.group(2)), int(named.group(3))
        if not m:
            return None
    elif re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        y, m, d = map(int, text.split("-"))
    else:
        m, d, y = map(int, text.split("/"))
    if y < 100:
        y += 2000
    try:
        return date(y, m, d).isoformat()
    except ValueError:
        return None


def first(patterns, text):
    for p in patterns:
        m = p.search(text)
        if m and iso(m.group(1)):
            return iso(m.group(1))
    return None


def read(text):
    lab = next((name for needle, name in LABS if needle in text), None)
    sampled = first(SAMPLED, text)
    how = "sampled"
    if not sampled:
        sampled, how = first(RECEIVED, text), "received"
    if not sampled and lab in ("Metrc", "Reliable"):
        sampled, how = first(TESTED, text), "tested"
    if not sampled:
        # Последнее средство: день отчёта. Проба отобрана раньше — на неделю-
        # другую, — так что возраст по нему занижен, и это сказано в sampledFrom.
        sampled, how = first(REPORTED, text), "reported"
    packaged = PACKAGED.search(text)
    harvest = HARVEST.search(text)
    harvested = None
    if harvest:
        m, d, y = map(int, harvest.groups())
        y += 2000 if y < 100 else 0
        try:
            harvested = date(y, m, d).isoformat()
        except ValueError:
            harvested = None
    return {
        "lab": lab,
        "sampled": sampled,
        # Какая дата стоит в «sampled»: отбор пробы, приезд пробы в лабораторию
        # (на день-два позже) или день теста (карточка Metrc без даты отбора).
        "sampledFrom": how if sampled else None,
        "packaged": iso(packaged.group(1)) if packaged else None,
        "harvested": harvested,
    }


def fetch(url, workdir):
    path = Path(workdir) / (re.sub(r"[^A-Za-z0-9]+", "_", url)[-80:] + ".pdf")
    try:
        with urllib.request.urlopen(url, timeout=40) as r:
            path.write_bytes(r.read())
        text = subprocess.run(["pdftotext", "-layout", str(path), "-"], capture_output=True,
                              text=True, timeout=60).stdout
    except Exception as e:  # сеть, битый PDF — перечитаем в следующий раз
        return url, {"lab": None, "sampled": None, "sampledFrom": None, "packaged": None,
                     "harvested": None, "unread": type(e).__name__}
    entry = read(text)
    if not entry["sampled"] and not entry["packaged"]:
        entry["unread"] = "no date found"
    return url, entry


def main():
    if not shutil.which("pdftotext"):
        raise SystemExit("pdftotext не найден: поставьте poppler-utils")
    urls = sorted({c for lot in json.loads(LOTS.read_text())["lots"] for c in lot["certificates"]})
    try:
        known = json.loads(OUT.read_text())["certificates"]
    except FileNotFoundError:
        known = {}
    todo = [u for u in urls if u not in known or known[u].get("unread")]
    with tempfile.TemporaryDirectory() as workdir, ThreadPoolExecutor(12) as pool:
        for url, entry in pool.map(lambda u: fetch(u, workdir), todo):
            known[url] = entry
    OUT.write_text(json.dumps({
        "about": "Даты с сертификатов партий из shelf-terpenes.json: отбор пробы (sampled — пакет "
                 "не старше этого дня), упаковка и сбор, где сертификат их пишет. "
                 "Пишется scripts/coa-dates.py.",
        "certificates": dict(sorted(known.items())),
    }, ensure_ascii=False, indent=1) + "\n")
    dated = sum(1 for e in known.values() if e["sampled"] or e["packaged"])
    print(f"{OUT.relative_to(ROOT)}: {len(known)} сертификатов, с датой {dated}, "
          f"с датой упаковки {sum(1 for e in known.values() if e['packaged'])}, "
          f"с датой сбора {sum(1 for e in known.values() if e['harvested'])}; "
          f"прочитано сейчас {len(todo)}")


if __name__ == "__main__":
    main()
