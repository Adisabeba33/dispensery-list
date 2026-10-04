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

Retail ID — страница для покупателя с телефоном у банки, и спрашивается она
так же: по одному запросу, с паузой PAUSE секунд, не больше MAX_PER_RUN за
прогон (ссылки и карточки вместе). Сначала новые метки — самые свежие на
полках первыми (день, когда метка впервые попала в меню, хранится в waiting,
пока её не спросили), потом перепроверки —
самые давние первыми, и им не меньше RECHECK_MIN мест, если они ждут. Что не
влезло, ждёт следующего прогона. До 3 октября 2026 всё спрашивалось разом в
восемь потоков: 29 сентября — 5 028 запросов за минуты, и через две недели
они все разом пришли бы на перепроверку. После STOP_AFTER_ERRORS ответов
подряд не 200 и не 404 прогон перестаёт спрашивать.
"""
import json
import random
import re
import subprocess
import time
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LISTINGS = ROOT / "data/flower-listings.json"
OUT = ROOT / "data/retail-id.json"
API = "https://app.1a4.com/api/landingpage/data"
TAG = re.compile(r"^1A4[0-9A-F]{21}$")
LINK = re.compile(r"^https://1a4\.com/(\S+)$", re.I)
LANDING = re.compile(r"landingpage/([0-9a-fA-F]{24})/")
RECHECK_DAYS = 30
MAX_PER_RUN = 150
RECHECK_MIN = 30
PAUSE = (6, 14)
STOP_AFTER_ERRORS = 5


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


class Budget:
    """Сколько ещё можно спросить в этом прогоне, с паузой перед каждым
    запросом, кроме первого, и остановкой после ошибок подряд."""

    def __init__(self, limit, pause=PAUSE, sleep=time.sleep):
        self.left, self.pause, self.sleep = limit, pause, sleep
        self.asked = self.errors = 0

    def take(self):
        if self.left <= 0 or self.errors >= STOP_AFTER_ERRORS:
            return False
        if self.asked:
            self.sleep(random.uniform(*self.pause))
        self.left -= 1
        self.asked += 1
        return True

    def answered(self, ok):
        self.errors = 0 if ok else self.errors + 1


def plan(tags, packages, stale, room, waiting=None):
    """Какие метки спросить: новые и неотвеченные — самые свежие на полке
    первыми, потом перепроверки ненайденных — самые давние первыми, не меньше
    RECHECK_MIN мест им."""
    waiting = waiting or {}
    fresh = sorted((t for t in tags if (packages.get(t) or {}).get("found") is None),
                   key=lambda t: (waiting.get(t, ""), t), reverse=True)
    recheck = sorted((t for t in tags if (packages.get(t) or {}).get("found") is False
                      and packages[t].get("checked", "") <= stale),
                     key=lambda t: (packages[t].get("checked", ""), t))
    room = max(room, 0)
    take_recheck = min(len(recheck), room, max(RECHECK_MIN, room - len(fresh)))
    return fresh[:room - take_recheck] + recheck[:take_recheck], len(fresh), len(recheck)


def card(tag):
    try:
        return read_card(tag)
    except (ValueError, TypeError, AttributeError) as e:
        return {"found": None, "error": f"unreadable: {e}"[:200]}


def read_card(tag):
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


def main(budget=None):
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

    budget = budget or Budget(MAX_PER_RUN)

    new_links = sorted(t for t in seen if LINK.match(t) and t not in links)
    for link in new_links:
        if not budget.take():
            break
        tag = resolve(link)
        if tag:
            links[link] = tag
    tags = {t.upper() for t in seen if TAG.match(t.upper())} | set(links.values())

    # Когда метка впервые попала в меню — пока её не спросили: новые на полке
    # спрашиваются первыми, если всех за прогон не успеть.
    waiting = {t: d for t, d in known.get("waiting", {}).items() if t in tags}
    for t in tags:
        if (packages.get(t) or {}).get("found") is None:
            waiting.setdefault(t, today.isoformat())
    todo, fresh, recheck = plan(tags, packages, stale, budget.left, waiting)
    done = []
    for tag in todo:
        if not budget.take():
            break
        entry = card(tag)
        budget.answered(entry.get("found") is not None)
        packages[tag] = {**entry, "checked": today.isoformat()}
        done.append(tag)
        if entry.get("found") is not None:
            waiting.pop(tag, None)

    OUT.write_text(json.dumps({
        "about": "Карточки пакетов из Metrc Retail ID (app.1a4.com) для меток, которые печатают "
                 "меню: даты упаковки, теста и сбора. found=false — пакета нет в Retail ID "
                 "(перепроверяется раз в месяц). Спрашивается по одному, с паузой, не больше 150 "
                 "запросов за прогон, новые на полке первыми; waiting — день, когда ещё не спрошенная "
                 "метка впервые попала в меню. Пишется scripts/retail-id.py.",
        "links": dict(sorted(links.items())),
        "packages": dict(sorted(packages.items())),
        "waiting": dict(sorted(waiting.items())),
    }, ensure_ascii=False, indent=1) + "\n")
    found = [p for p in packages.values() if p.get("found")]
    stopped = " — остановились после ошибок подряд" if budget.errors >= STOP_AFTER_ERRORS else ""
    print(f"{OUT.relative_to(ROOT)}: меток {len(tags)}, запросов сейчас {budget.asked} из {MAX_PER_RUN} "
          f"(карточек {len(done)}; новых ждало {fresh}, перепроверок ждало {recheck}){stopped}; "
          f"в Retail ID {len(found)}, с датой упаковки {sum(1 for p in found if p.get('packaged'))}, "
          f"с датой сбора {sum(1 for p in found if p.get('harvested'))}")


if __name__ == "__main__":
    main()
