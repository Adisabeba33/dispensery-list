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

Карточка пакета — это и его сертификат: лаборатория, день теста, THC и CBD,
терпены в процентах (coaCard), и у большинства — сам PDF. До 8 октября 2026
сохранялись только даты, панель выбрасывалась; теперь она хранится
(terpenes, thc, cbd, terpenesTotal, labLicense, labDoc, coaFile), а пакеты,
найденные раньше, перечитываются отдельно — не больше BACKFILL_PER_RUN за
прогон, самые свежие упаковки первыми, — пока не перечитаны все. PDF по
ссылке карточки живёт сутки, поэтому хранится не ссылка, а то, что он есть:
открыть его можно со страницы пакета (QR-код на банке, app.1a4.com).

Кроме меток из меню спрашиваются метки, напечатанные на самих сертификатах
(metrcTag в data/coa-dates.json, с 8 октября 2026): сертификат бренда часто
называет пакет, из которого взята проба, и у части таких пакетов есть
карточка Retail ID — с панелью и PDF. Метка берётся как напечатана, ничего не
подбирается и не перебирается. Эти метки ждут после меток полок: им остаётся
только то, что меткам полок за прогон не понадобилось, и ненайденные не
перепроверяются — место перепроверок остаётся полкам.

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
BACKFILL_PER_RUN = 150  # найденные до панели перечитываются, пока не перечитаны все

# Имена терпенов карточки (bMyrcene, aPinene, caryophylleneOxide) → имена
# реестра, те же, что у меню (scripts/menu-render.mjs, TERPENES).
TERPENES = {
    "myrcene": "MYRCENE", "betamyrcene": "MYRCENE", "limonene": "LIMONENE",
    "caryophyllene": "CARYOPHYLLENE", "betacaryophyllene": "CARYOPHYLLENE",
    "caryophylleneoxide": "CARYOPHYLLENE_OXIDE", "alphapinene": "PINENE_ALPHA", "pinene": "PINENE_ALPHA",
    "betapinene": "PINENE_BETA", "linalool": "LINALOOL", "terpinolene": "TERPINOLENE",
    "humulene": "HUMULENE", "alphahumulene": "HUMULENE", "ocimene": "OCIMENE", "betaocimene": "OCIMENE",
    "bisabolol": "BISABOLOL", "alphabisabolol": "BISABOLOL", "nerolidol": "NEROLIDOL",
    "transnerolidol": "NEROLIDOL", "valencene": "VALENCENE", "camphene": "CAMPHENE",
    "eucalyptol": "EUCALYPTOL", "guaiol": "GUAIOL", "farnesene": "FARNESENE", "geraniol": "GERANIOL",
    "borneol": "BORNEOL", "terpineol": "TERPINEOL", "alphaterpineol": "TERPINEOL",
    "phellandrene": "PHELLANDRENE", "alphaphellandrene": "PHELLANDRENE", "carene": "CARENE",
    "sabinene": "SABINENE", "fenchol": "FENCHOL", "terpinene": "TERPINENE",
    "alphaterpinene": "TERPINENE", "gammaterpinene": "TERPINENE", "isopulegol": "ISOPULEGOL",
    "cymene": "CYMENE", "pcymene": "CYMENE", "paracymene": "CYMENE",
}
GREEK = {"a": "alpha", "b": "beta", "g": "gamma"}


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


def terpene_name(key):
    """bMyrcene → MYRCENE; имя, которого реестр не знает, — None."""
    k = re.sub(r"[^a-z]", "", str(key).lower())
    return TERPENES.get(k) or (TERPENES.get(GREEK[k[0]] + k[1:]) if k[:1] in GREEK else None)


def number(value):
    return round(float(value), 4) if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def panel(data, coa):
    """Сертификат из карточки: терпены выше нуля (ноль — «не найдено»), THC,
    CBD, сумма терпенов, лаборатория. Два имени карточки, ставшие одним
    именем реестра, оба с цифрой, — терпен не пишется: пустое поле лучше
    догадки."""
    terpenes, twice = {}, set()
    for key, t in (coa.get("terpenes") or {}).items():
        name, pct = terpene_name(key), number((t or {}).get("percent"))
        if name and pct:
            if name in terpenes:
                twice.add(name)
            terpenes[name] = pct
    totals = coa.get("totals") or {}
    lab = coa.get("lab") or {}
    return {
        "thc": number((totals.get("thc") or {}).get("percent")),
        "cbd": number((totals.get("cbd") or {}).get("percent")),
        "terpenesTotal": number((totals.get("terpenes") or {}).get("percent")),
        "terpenes": {k: v for k, v in sorted(terpenes.items()) if k not in twice},
        "labLicense": lab.get("licenseNumber"),
        "labDoc": lab.get("docId"),
        "coaFile": bool((data.get("coaCard") or {}).get("fileLink")),
    }


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
        **panel(data, coa),
    }


def certificate_tags():
    """Метки Metrc, напечатанные на прочитанных сертификатах (coa-dates.py)."""
    try:
        certificates = json.loads((ROOT / "data/coa-dates.json").read_text())["certificates"]
    except (FileNotFoundError, KeyError, ValueError):
        return set()
    return {str(c["metrcTag"]).strip().upper() for c in certificates.values()
            if c.get("metrcTag") and TAG.match(str(c["metrcTag"]).strip().upper())}


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
    printed = certificate_tags() - tags

    # Когда метка впервые попала в меню — пока её не спросили: новые на полке
    # спрашиваются первыми, если всех за прогон не успеть.
    waiting = {t: d for t, d in known.get("waiting", {}).items() if t in tags}
    for t in tags:
        if (packages.get(t) or {}).get("found") is None:
            waiting.setdefault(t, today.isoformat())
    todo, fresh, recheck = plan(tags, packages, stale, budget.left, waiting)
    # Метки с сертификатов — после меток полок, на оставшееся место.
    todo += sorted(t for t in printed if (packages.get(t) or {}).get("found") is None)
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

    # Найденные до панели — перечитываются, пока не перечитаны все: свежие
    # упаковки первыми. Своё место, сверх MAX_PER_RUN, чтобы не отнимать его
    # у новых меток; остановка после ошибок подряд — та же.
    unread = sorted((t for t in tags if (packages.get(t) or {}).get("found") is True
                     and "terpenes" not in packages[t] and "panelChecked" not in packages[t]),
                    key=lambda t: (packages[t].get("packaged") or "", t), reverse=True)
    budget.left += BACKFILL_PER_RUN
    refilled = 0
    for tag in unread:
        if not budget.take():
            break
        entry = card(tag)
        budget.answered(entry.get("found") is not None)
        if entry.get("found") is True:
            packages[tag] = {**packages[tag], **entry}
            refilled += 1
        elif entry.get("found") is False:
            packages[tag]["panelChecked"] = today.isoformat()

    OUT.write_text(json.dumps({
        "about": "Карточки пакетов из Metrc Retail ID (app.1a4.com) для меток, которые печатают "
                 "меню и сертификаты: даты упаковки, теста и сбора и панель сертификата — THC, CBD, терпены в % выше "
                 "нуля (имена реестра), лаборатория, есть ли PDF (coaFile). found=false — пакета нет в Retail ID "
                 "(перепроверяется раз в месяц). Спрашивается по одному, с паузой, не больше 150 "
                 "запросов за прогон, новые на полке первыми, и до 150 перечитываний найденных без панели; waiting — день, когда ещё не спрошенная "
                 "метка впервые попала в меню. Пишется scripts/retail-id.py.",
        "links": dict(sorted(links.items())),
        "packages": dict(sorted(packages.items())),
        "waiting": dict(sorted(waiting.items())),
    }, ensure_ascii=False, indent=1) + "\n")
    found = [p for p in packages.values() if p.get("found")]
    with_panel = [p for p in found if p.get("terpenes")]
    stopped = " — остановились после ошибок подряд" if budget.errors >= STOP_AFTER_ERRORS else ""
    print(f"{OUT.relative_to(ROOT)}: меток {len(tags)}, запросов сейчас {budget.asked} "
          f"(до {MAX_PER_RUN} новых и перепроверок, до {BACKFILL_PER_RUN} перечитываний) "
          f"(карточек {len(done)}; новых ждало {fresh}, перепроверок ждало {recheck}, "
          f"меток с сертификатов не спрошено {sum(1 for t in printed if (packages.get(t) or {}).get('found') is None)}){stopped}; "
          f"в Retail ID {len(found)}, с датой упаковки {sum(1 for p in found if p.get('packaged'))}, "
          f"с датой сбора {sum(1 for p in found if p.get('harvested'))}; с панелью терпенов {len(with_panel)} "
          f"(перечитано сейчас {refilled}, ждут перечитывания {len(unread) - refilled}), "
          f"с PDF сертификата {sum(1 for p in found if p.get('coaFile'))}")


if __name__ == "__main__":
    main()
