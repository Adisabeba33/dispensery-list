#!/usr/bin/env python3
"""Даты с сертификатов партий: когда отобрали пробу, когда упаковали, когда собрали.

Дата отбора, получения пробы или отчёта — отдельное событие, не дата упаковки.
У части документов дата упаковки указана явно (Packaged Date / PACKAGED ON
в карточке Metrc), как и дата сбора (Harvest/Lot ID вида «H:12.01.25»).

    python scripts/coa-dates.py            # data/coa-dates.json

Берёт опубликованные ссылки из shelf-terpenes.json и coa-sources.json, скачивает те, которых
ещё нет в data/coa-dates.json, и читает их через pdftotext (poppler-utils).
Сами PDF не хранятся: сертификат не меняется, прочитанное пишется один раз.
Не прочитанное (сеть, нет pdftotext, незнакомый формат) пишется с пустыми
датами и причиной — и будет перечитано при следующем запуске.

Кроме дат у каждого сертификата записывается отпечаток и идентификаторы
(scripts/coa-forensics.py): SHA-256 байтов, тип документа — сертификат
лаборатории или сохранённая страница Retail ID, которую магазин выложил как
сертификат, — номер образца, партия, лот и напечатанная метка Metrc: метка
ведёт к публичной карточке Retail ID пакета. Сертификаты, прочитанные до
того, как это появилось, дочитываются по BACKFILL за прогон.

Лаборатории и где у них дата пробы:
- Kaycha:           «Sampled Date: 12/12/25» / «Sampled: 12/12/25»
- Green Analytics:  «Sampling Date: 05/19/2026»
- DRS:              «Sample Collection Date/Time: 11/14/25»
- Keystone:         «Date Sampled: 10/15/2025»
- ACT:              только «Sample Received: 01/28/2025» — день, когда проба
                    приехала в лабораторию; на день-два позже отбора
- Smithers:         «Sample Collected: 05/11/2026»
- другие:           «Date Collected: May 28, 2026»
- Talon layout:     «Collection Date: 6/30/2023», «Received Date: 6/30/2023»
- MCR:              «Sample Collection\n10/9/2025 11:10\nDate and Time»
- карточка Metrc:   «Packaged Date 02/18/2026», дата теста «On: 2026-02-03»
- новая карточка:   «PACKAGED ON\n02/18/2026», «TESTED DATE\n12/17/2025»
- в крайнем случае: «Report Date» — день отчёта, на неделю-другую позже пробы
"""
import hashlib
import importlib.util
import json
import re
import shutil
import subprocess
import tempfile
import argparse
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOTS = ROOT / "data/shelf-terpenes.json"
OUT = ROOT / "data/coa-dates.json"
BACKFILL = 40  # сертификатов без отпечатка перечитывается за прогон
PANEL_BACKFILL = 60  # прочитанных до панелей — дочитывается за прогон, ссылки брендов первыми
PENDING_PER_RUN = 200  # опубликованных брендом, но не разобранных ссылок — за прогон (около четырёх дней на все 817)
SOURCES = ROOT / "data/coa-sources.json"

_spec = importlib.util.spec_from_file_location("coa_forensics", ROOT / "scripts/coa-forensics.py")
cf = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(cf)
_panel_spec = importlib.util.spec_from_file_location("coa_panel", ROOT / "scripts/coa-panel.py")
cp = importlib.util.module_from_spec(_panel_spec)
_panel_spec.loader.exec_module(cp)
_http_spec = importlib.util.spec_from_file_location("coa_source_http", ROOT / "scripts/coa-source-http.py")
http = importlib.util.module_from_spec(_http_spec)
_http_spec.loader.exec_module(http)

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
    re.compile(r"Date Collected:\s*" + D),
    re.compile(r"\bCollection Date:\s*" + D),
    re.compile(r"Sample Collection[ \t]*\n[ \t]*" + D + r"[^\n]*\n[ \t]*Date and Time"),
]
RECEIVED = [
    re.compile(r"Sample Received:\s*" + D),
    re.compile(r"Date Received:\s*" + D),
    re.compile(r"Received Date:\s*" + D),
]
REPORTED = [re.compile(r"(?:Report Date|Reported Date|Date Reported|Report Created|Date Released|Completed)\s*:?\s*" + D), re.compile(r"Published:\s*" + D)]
TESTED = [re.compile(r"Tested By:[^\n]*\n\s*On:\s*" + D), re.compile(r"\bOn:\s*" + D)]
PACKAGED = re.compile(r"Packaged Date\s*:?\s*" + D)
HARVEST = re.compile(r"Harvest/Lot ID:[^\n]*?\bH:\s*(\d{1,2})\.(\d{1,2})\.(\d{2,4})")
LABS = [("Kaycha", "Kaycha"), ("Green Analytics", "Green Analytics"), ("DRS Testing", "DRS"),
        ("Keystone", "Keystone"), ("ACT Lab", "ACT"), ("Reliable Labs", "Reliable"), ("Metrc", "Metrc"),
        ("metrc", "Metrc"), ("Smithers", "Smithers"), ("MCR Labs", "MCR")]


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
    parsed = cf.parse_text(text)
    if parsed["docType"] == "metrc-retail-id":
        tested = parsed.get("tested")
        packaged = parsed.get("packaged")
        return {"lab": parsed.get("lab"), "sampled": tested,
                "sampledFrom": "tested" if tested else None,
                "packaged": packaged, "packagedFrom": "metrc-retail-id" if packaged else None,
                "harvested": None, "harvestedFrom": None}
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
        "packagedFrom": "document" if packaged and iso(packaged.group(1)) else None,
        "harvested": harvested,
        "harvestedFrom": "document-harvest-lot-id" if harvested else None,
    }


def identifiers(text, blob):
    """Отпечаток и идентификаторы сертификата: SHA-256 байтов и то, что
    coa-forensics читает из текста. Разбор, который не удался, не отнимает дат."""
    out = {"sha256": hashlib.sha256(blob).hexdigest(), "docType": None, "sampleId": None,
           "batchTag": None, "lotNumber": None, "metrcTag": None}
    try:
        rec = cf.parse_text(text)
    except Exception:  # незнакомый формат — отпечаток остаётся, полей нет
        return out
    out.update({k: rec.get(k) for k in ("docType", "sampleId", "batchTag", "lotNumber", "metrcTag")})
    return out


def fetch(url, workdir, reader):
    path = Path(workdir) / (re.sub(r"[^A-Za-z0-9]+", "_", url)[-80:] + ".pdf")
    try:
        final_url, _, blob = reader.get(url)
        if not blob.startswith(b"%PDF-"):
            raise http.SourceBlocked("not-a-pdf")
        path.write_bytes(blob)
        text = subprocess.run(["pdftotext", "-layout", str(path), "-"], capture_output=True,
                              text=True, timeout=60, check=True).stdout
    except Exception as e:  # сеть, битый PDF — перечитаем в следующий раз
        return url, {"lab": None, "sampled": None, "sampledFrom": None, "packaged": None,
                     "harvested": None, "unread": str(e) if isinstance(e, http.SourceBlocked) else type(e).__name__}
    entry = read(text)
    if not entry["sampled"] and not entry["packaged"]:
        entry["unread"] = "no date found"
    entry.update(identifiers(text, blob))
    # What it measured: strain, THC, terpenes — what lets it be matched to a
    # shelf. None when the laboratory's layout is not one coa-panel.py reads.
    try:
        entry["panel"] = cp.panel(text)
    except Exception:  # a layout the reader trips on keeps its dates
        entry["panel"] = None
    entry["documentUrl"] = final_url
    return url, entry


def source_links(path=SOURCES, pending=False):
    """Published brand links: those reviewed as NY flower, and — with pending —
    those published but not reviewed yet. A pending link is read for what the
    document says it is (panel.matrix, its licence); sourceKind keeps the two
    apart, and nothing reviewed as another product is read."""
    if not path.exists():
        return {}
    links = {}
    for source in json.loads(path.read_text()).get("sources", []):
        for link in source.get("certificateLinks", []):
            if not (link.get("publishedOn") and link.get("url")):
                continue
            if link.get("scope") == "ny-flower":
                links[link["url"]] = {"sourceKind": "brand-page", "sourcePage": link["publishedOn"]}
            elif pending and link.get("scope") == "pending-review":
                links[link["url"]] = {"sourceKind": "brand-page-unreviewed", "sourcePage": link["publishedOn"]}
    return links


def recency(url):
    """How recent a certificate's own file name says it is: a date written in
    it (06-30-2026, 2026-06-30), then the first batch number of three or more
    digits (Florist's WF01135 after WF00354). Names that say neither keep the
    page's order."""
    from urllib.parse import unquote, urlsplit
    name = unquote(urlsplit(url).path.rsplit("/", 1)[-1])
    day = ""
    m = re.search(r"(?<!\d)(\d{1,2})[-_.](\d{1,2})[-_.](20\d{2})(?!\d)", name)
    if m:
        day = f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"
    else:
        m = re.search(r"(?<!\d)(20\d{2})[-_.](\d{2})[-_.](\d{2})(?!\d)", name)
        if m:
            day = "-".join(m.groups())
    n = re.search(r"(?<![\d.])(\d{3,})(?![\d.])", re.sub(r"1A4[0-9A-F]{21}", " ", name))
    return (day, int(n.group(1)) if n else -1)


def links_first_seen(path=SOURCES):
    """url → (when scripts/coa-sources.py first saw it on a brand page, its
    turn among the links its brand published at that moment). Within a brand
    the turn goes to the file whose name says it is newest (recency), so a
    page that lists its oldest certificates first is still read newest first."""
    if not path.exists():
        return {}
    out = {}
    for source in json.loads(path.read_text()).get("sources", []):
        groups = {}
        for i, link in enumerate(source.get("certificateLinks", [])):
            if link.get("firstSeenAt"):
                groups.setdefault(link["firstSeenAt"], []).append((i, link["url"]))
        for seen, links in groups.items():
            ranked = sorted(links, key=lambda x: x[0])
            ranked.sort(key=lambda x: recency(x[1]), reverse=True)
            for turn, (_i, url) in enumerate(ranked):
                out[url] = (seen, turn)
    return out


def pending_order(urls, first_seen):
    """Newest first: a link found today is a batch a brand just published and
    should not wait behind the backlog. Links found at the same moment take
    turns brand by brand, so one brand's long list (Florist's 444 on
    5 October) does not hold back another's thirteen."""
    def key(u):
        seen, turn = first_seen.get(u, ("", 0))
        return (seen, -turn, u)
    return sorted(urls, key=key, reverse=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--brand-only", action="store_true", help="Only reviewed links from coa-sources.json")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()
    if not shutil.which("pdftotext"):
        raise SystemExit("pdftotext не найден: поставьте poppler-utils")
    provenance = source_links(pending=True)
    if not args.brand_only:
        provenance.update({c: {"sourceKind": "menu"} for lot in json.loads(LOTS.read_text())["lots"] for c in lot["certificates"]})
    urls = sorted(provenance)
    try:
        known = json.loads(OUT.read_text())["certificates"]
    except FileNotFoundError:
        known = {}
    unreviewed = lambda u: provenance[u].get("sourceKind") == "brand-page-unreviewed"
    todo = [u for u in urls if (u not in known or known[u].get("unread")) and not unreviewed(u)]
    # Опубликованные, но не разобранные ссылки брендов — понемногу за прогон.
    # Newest first, brands taking turns (pending_order).
    pending = pending_order([u for u in urls if (u not in known or known[u].get("unread")) and unreviewed(u)],
                            links_first_seen())[:PENDING_PER_RUN]
    # Прочитанные до отпечатков — дочитываются понемногу, не все разом.
    backfill = [u for u in urls if u in known and not known[u].get("unread") and "sha256" not in known[u]][:BACKFILL]
    # Прочитанные до панелей: ссылки брендов первыми — у сертификатов из меню
    # панель уже напечатана в самом меню.
    no_panel = sorted((u for u in urls if u in known and not known[u].get("unread")
                       and "panel" not in known[u] and u not in backfill),
                      key=lambda u: provenance[u].get("sourceKind") == "menu")[:PANEL_BACKFILL]
    queue = todo + pending + backfill + no_panel
    selected = queue[:max(0, args.limit)] if args.limit is not None else queue
    reader = http.Reader(ROOT / "data/coa-http-state.json")
    with tempfile.TemporaryDirectory() as workdir:
        for url in selected:
            url, entry = fetch(url, workdir, reader)
            entry.update(provenance[url])
            if entry.get("unread") and url in known and not known[url].get("unread"):
                continue  # дочитывание не удалось — даты, что есть, остаются
            known[url] = entry
    OUT.write_text(json.dumps({
        "about": "Даты документов из меню и опубликованных ссылок брендов: sampledFrom различает "
                 "отбор, получение, тест и отчёт. Упаковка и сбор — только явно указанные даты. "
                 "Пишется scripts/coa-dates.py.",
        "certificates": dict(sorted(known.items())),
    }, ensure_ascii=False, indent=1) + "\n")
    dated = sum(1 for e in known.values() if e["sampled"] or e["packaged"])
    print(f"{OUT.relative_to(ROOT)}: {len(known)} сертификатов, с датой {dated}, "
          f"с датой упаковки {sum(1 for e in known.values() if e['packaged'])}, "
          f"с датой сбора {sum(1 for e in known.values() if e['harvested'])}; "
          f"с отпечатком {sum(1 for e in known.values() if e.get('sha256'))}, "
          f"с меткой Metrc {sum(1 for e in known.values() if e.get('metrcTag'))}; "
          f"с панелью {sum(1 for e in known.values() if e.get('panel'))}; "
          f"запрошено сейчас {len(selected)} (новых/повторных {len(todo)}, неразобранных брендов {len(pending)}, "
          f"дочитывание {len(backfill)}, до панели {len(no_panel)})")


if __name__ == "__main__":
    main()
