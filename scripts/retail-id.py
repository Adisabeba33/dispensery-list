#!/usr/bin/env python3
"""Даты пакетов из Metrc Retail ID: когда упаковали, когда тестировали, когда собрали.

Сертификат говорит, когда лаборатория взяла пробу, — но партию часто тестируют
целиком, а по банкам раскладывают потом, иногда через месяцы (Mark Turk
Colorado Chem: урожай 17 января, тест в марте, банки 23 и 30 июля). Сколько
лежит сама банка, знает только пакет. Metrc Retail ID (1a4.com) — публичная
страница пакета, на которую ведёт QR-код на этикетке, — отдаёт его карточку:
дату упаковки, теста и сбора, лабораторию, THC.

    python scripts/retail-id.py            # data/retail-id.json

Метки берутся из data/flower-listings.json: меню печатают метку Metrc пакета
(1A4…, 24 знака) или ссылку Retail ID (https://1a4.com/…), которая
переадресует на страницу с меткой. Страница есть только у пакетов, которые
производитель завёл в Retail ID (на 2026-09-29 — 624 пакета 43 лицензий);
остальные отвечают 404.

Спрашиваются только новые метки. Найденный пакет не перечитывается: его даты
не меняются. Не найденный перепроверяется раз в RECHECK_DAYS — производитель
может завести его позже. Сеть не ответила — перепроверяется в следующий раз.
"""
import json
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LISTINGS = ROOT / "data/flower-listings.json"
OUT = ROOT / "data/retail-id.json"
API = "https://app.1a4.com/api/landingpage/data"
TAG = re.compile(r"^1A4[0-9A-F]{21}$")
LINK = re.compile(r"^https://1a4\.com/(\S+)$", re.I)
LANDING = re.compile(r"landingpage/([0-9a-fA-F]{24})/")
RECHECK_DAYS = 14


def curl(url, *extra):
    """Тело и код ответа. curl, а не urllib: он же ходит через прокси в
    песочнице, и переадресацию ссылки видно без перехода по ней."""
    out = subprocess.run(["curl", "-sS", "-m", "30", *extra, "-w", "\n%{http_code}", url],
                         capture_output=True, text=True).stdout
    body, _, code = out.rpartition("\n")
    return body, code


def resolve(link):
    """Ссылка Retail ID → метка пакета; None, если ссылка никуда не ведёт."""
    code = LINK.match(link).group(1)
    target = subprocess.run(["curl", "-sS", "-m", "30", "-o", "/dev/null", "-w", "%{redirect_url}",
                             f"https://1a4.com/{code}"], capture_output=True, text=True).stdout
    found = LANDING.search(target or "")
    return found.group(1).upper() if found else None


def day(value):
    return value[:10] if isinstance(value, str) and re.match(r"\d{4}-\d{2}-\d{2}", value) else None


def card(tag):
    body, code = curl(f"{API}?id={tag.lower()}&index=0")
    if code == "404":
        return {"found": False}
    if code != "200":
        return {"found": None, "error": f"HTTP {code}"}
    data = json.loads(body)
    coa = (data.get("coaCard") or {}).get("data") or {}
    while isinstance(coa, str):
        coa = json.loads(coa)
    if isinstance(coa, list):
        coa = coa[0] if coa else {}
    return {
        "found": True,
        "facility": data.get("facilityName"),
        "product": (data.get("productCard") or {}).get("productName") or coa.get("productName"),
        "strain": coa.get("strainName") or coa.get("strain"),
        "packaged": day(coa.get("packagedDate") or coa.get("packageDate")),
        "tested": day(coa.get("testedDate") or coa.get("dateTested")),
        "harvested": day(coa.get("harvestDate")),
        "lab": (coa.get("lab") or {}).get("name"),
        "batchTag": coa.get("batchTag"),
    }


def main():
    raw = json.loads(LISTINGS.read_text())
    rows = raw if isinstance(raw, list) else raw["listings"]
    seen = {str(t).strip() for r in rows for t in (r.get("packageIds") or [])}
    try:
        known = json.loads(OUT.read_text())
    except FileNotFoundError:
        known = {}
    links = known.get("links", {})
    packages = known.get("packages", {})
    today = date.today()
    stale = (today - timedelta(days=RECHECK_DAYS)).isoformat()

    new_links = sorted(t for t in seen if LINK.match(t) and t not in links)
    with ThreadPoolExecutor(8) as pool:
        for link, tag in zip(new_links, pool.map(resolve, new_links)):
            if tag:
                links[link] = tag
    tags = {t.upper() for t in seen if TAG.match(t.upper())} | set(links.values())

    def due(tag):
        entry = packages.get(tag)
        if not entry or entry.get("found") is None:
            return True
        return entry.get("found") is False and entry.get("checked", "") <= stale

    todo = sorted(t for t in tags if due(t))
    with ThreadPoolExecutor(8) as pool:
        for tag, entry in zip(todo, pool.map(card, todo)):
            packages[tag] = {**entry, "checked": today.isoformat()}

    OUT.write_text(json.dumps({
        "about": "Карточки пакетов из Metrc Retail ID (app.1a4.com) для меток, которые печатают "
                 "меню: даты упаковки, теста и сбора. found=false — пакета нет в Retail ID "
                 "(перепроверяется раз в две недели). Пишется scripts/retail-id.py.",
        "links": dict(sorted(links.items())),
        "packages": dict(sorted(packages.items())),
    }, ensure_ascii=False, indent=1) + "\n")
    found = [p for p in packages.values() if p.get("found")]
    print(f"{OUT.relative_to(ROOT)}: меток {len(tags)}, спрошено сейчас {len(todo)}; "
          f"в Retail ID {len(found)}, с датой упаковки {sum(1 for p in found if p.get('packaged'))}, "
          f"с датой сбора {sum(1 for p in found if p.get('harvested'))}")


if __name__ == "__main__":
    main()
