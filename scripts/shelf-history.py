#!/usr/bin/env python3
"""Когда сорт бренда появился на полке магазина — и что из этого завоз.

Идея такая: одна и та же позиция бренда появляется в магазинах один за
другим, значит, пришла партия, и пачка в ней, скорее всего, свежая. Проверить
«свежая» нам нечем: даты упаковки нет ни у одной позиции. Проверить
«появилась» можно, и здесь записывается именно это: день, когда мы впервые
увидели сорт бренда на полке магазина. Это не дата упаковки, и в отчёте она
так не называется.

    python scripts/shelf-history.py check      # правила на выдуманной неделе
    python scripts/shelf-history.py update     # сложить сегодняшнее чтение в историю
    python scripts/shelf-history.py report     # раздел ежедневного отчёта, markdown в stdout
    python scripts/shelf-history.py backfill   # пересобрать историю из git

Главный шум дают не магазины, а мы сами. Каждая починка сборщика, после
которой он читал меню глубже, превращала вчера недочитанное в сегодня
«новое»: 18 сентября таких появлений было 6 865. Поэтому появление
засчитывается, только если:

- магазин читался в два прошлых раза, и сравнивать есть с чем;
- сорта не было ни на одном из двух прошлых чтений, то есть это не мигание;
- новых за день не больше 15% полки. Иначе полку переписало наше чтение, а
  не завоз, и из неё не считается ничего;
- сборщик с прошлого чтения магазина не менялся — или менялся, но полка не
  выросла в одну сторону. Починка, после которой меню читается глубже,
  добавляет позиции и ничего не убирает; настоящий завоз приходит вместе с
  продажами;
- это не переименование: у того же бренда в эти дни не ушёл похожий сорт;
- на следующем чтении сорт всё ещё на полке.

Самый сильный сигнал — волна: один и тот же сорт бренда появился на трёх и
более разных полках за неделю. Магазины сети с общей витриной считаются как
одна полка.

Единица — сорт бренда в магазине, а не позиция меню. Позиций у одного сорта
бывает несколько («14g», «28g», «(Indoor)»), и их идентификаторы меняются
вместе с тем, как магазин или наш разбор пишут название. Сорт от этого не
меняется.

Партия. THC до сотых — это число из лабораторного сертификата партии, и
меню переписывают его как есть: у 93% сортов бренда, стоящих в нескольких
магазинах, значение совпадает до сотых, а у партий, чьи терпены публикуют
два магазина, совпадают и терпены. Поэтому значение THC, которого у сорта
бренда раньше не было ни в одном магазине, — это новая партия. Это сигнал
точнее, чем «впервые увидели в магазине»: сорт мог стоять на полке давно,
а партия в нём — новая. Считается так же осторожно:

- магазин устойчив, как для завоза, и сорт стоял на прошлом чтении с THC —
  или сам только что появился и прошёл как кандидат в завоз;
- целое число — округление, партию оно не называет; «28» и 28.41, 22.3 и
  22.34 — одна партия, как и значения ближе 0,1;
- THC, который раньше не показывали вовсе, — новое в нашем чтении, а не в
  партии;
- если за день THC сменился у многих позиций магазина сразу, поменялось
  наше чтение потенции, а не партии;
- значение держится до следующего чтения магазина.
"""
import hashlib
import json
import re
import subprocess
import sys
import unicodedata
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import ROUND_DOWN, ROUND_HALF_UP, Decimal
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HISTORY = ROOT / "data/shelf-history.json"
LISTINGS = ROOT / "data/flower-listings.json"
REGISTER = ROOT / "data/dispensaries.json"
# Что решает, как читается магазин. Версия сборщика — их общий отпечаток.
READER = ("scripts/menu-render.mjs", "scripts/strain-name.mjs", "data/menu-endpoints.json")

NEW_SHARE_MAX = 0.15  # больше — полку переписало наше чтение, а не завоз
LOPSIDED_MIN = 5      # столько новых при сменившемся сборщике и почти без ушедших —
                      # это чтение стало глубже, а не завоз
MIN_THC_STEP = 0.1    # ближе — то же лабораторное число, записанное иначе
THC_BURST_SHARE = 0.3 # THC сменился у большей доли позиций магазина за день —
THC_BURST_MIN = 5     # поменялось наше чтение потенции, а не партии
RECENT_SWEEPS = 3     # прошлое чтение магазина не старше стольких прогонов
CONFIRM_WITHIN = 3    # столько прогонов ждём следующего чтения магазина
WAVE_SHELVES = 3
WAVE_DAYS = 7
KEEP_DAYS = 60        # что ушло с полки раньше, забываем
KEEP_READS = 8
KEEP_SWEEPS = 60
OPEN = ".."           # ISO 8601: открытый конец интервала — «и сейчас на полке»

# Слова, которыми одна и та же пачка отличается от себя же в другом меню.
PACKAGING = {
    "flower", "flowers", "indoor", "outdoor", "greenhouse", "sungrown", "sun",
    "grown", "premium", "small", "smalls", "bud", "buds", "popcorn", "whole",
    "jar", "bag", "pack", "prepack", "eighth", "quarter", "half", "ounce",
    "oz", "gram", "grams", "the", "and",
}
WEIGHT = re.compile(r"\b\d+(?:\.\d+)?\s*(?:g|gr|grams?|oz)\b")
BRAND_NOISE = re.compile(r"\b(cannabis|co|company|farms?|labs?|brands?|nyc?|llc|inc)\b")


def brand_key_of(brand):
    """Как brandKeyOf в scripts/menu-render.mjs. До 20 сентября сборщик ключ бренда не
    писал, и без него «|sour diesel» склеивал Sour Diesel всех брендов в одну волну."""
    if not brand:
        return None
    key = re.sub(r"[\u0300-\u036f]", "", unicodedata.normalize("NFKD", str(brand))).lower()
    key = BRAND_NOISE.sub(" ", re.sub(r"[^a-z0-9 ]", " ", key))
    return re.sub(r"[^a-z0-9]", "", key) or None


def key_of(row):
    strain = (row.get("strainNameCanonical") or row.get("strainNameRaw") or "").strip().lower()
    strain = re.sub(r"\s+", " ", strain)
    brand = row.get("brandKey") or brand_key_of(row.get("brand")) or ""
    return f"{brand}|{strain}" if strain else None


def words(strain):
    return {w for w in re.findall(r"[a-z0-9]+", WEIGHT.sub(" ", strain)) if w not in PACKAGING}


def similar(a, b):
    """Похоже ли, что это один сорт, записанный по-разному."""
    brand_a, strain_a = a.split("|", 1)
    brand_b, strain_b = b.split("|", 1)
    # Бренд, который появился или пропал, чаще всего пропал из нашего
    # разбора, а не из пачки. Два разных названных бренда — разные товары.
    if brand_a and brand_b and brand_a != brand_b:
        return False
    if strain_a == strain_b:
        return True
    wa, wb = words(strain_a), words(strain_b)
    if wa and wb and (wa <= wb or wb <= wa):
        return True
    return SequenceMatcher(None, strain_a, strain_b).ratio() >= 0.85


def shelves_read(rows, day):
    """Полки магазинов, прочитанных в этот день: {лицензия: {сорт бренда: строка}} и
    {лицензия: {сорт бренда: значения THC}}.

    Полка, которую сборщик придержал от прошлого чтения, лежит в файле со
    старым capturedAt. Это не чтение, и сравнивать её не с чем."""
    shelves, potency = {}, {}
    for row in rows:
        if (row.get("capturedAt") or "")[:10] != day:
            continue
        key = key_of(row)
        if not key:
            continue
        shelves.setdefault(row["licenseNumber"], {}).setdefault(key, row)
        thc = row.get("thcPercent")
        # Ноль — не ответ: так сборщик до 23 сентября записывал молчание меню.
        if isinstance(thc, (int, float)) and thc > 0:
            potency.setdefault(row["licenseNumber"], {}).setdefault(key, set()).add(float(thc))
    return shelves, potency


def signature(shelf):
    """Магазины сети на общей витрине отдают одну и ту же полку. Для волны это одна полка."""
    return hashlib.sha1("\n".join(sorted(shelf)).encode()).hexdigest()[:10]


def num(v):
    """26.49 → «26.49», 28.0 → «28»: столько знаков, сколько написало меню."""
    return format(Decimal(repr(float(v))).normalize(), "f")


def places(v):
    text = num(v)
    return len(text.split(".")[1]) if "." in text else 0


def same_batch(a, b):
    """Одна партия, записанная разными меню: ближе MIN_THC_STEP, или менее точное
    значение — округление либо отсечение более точного («28» и 28.41)."""
    if round(abs(a - b), 2) < MIN_THC_STEP:
        return True
    pa, pb = places(a), places(b)
    if pa == pb:
        return False
    rough, exact = (a, b) if pa < pb else (b, a)
    step = Decimal(1).scaleb(-min(pa, pb))
    exact = Decimal(repr(float(exact)))
    return Decimal(repr(float(rough))) in (exact.quantize(step, ROUND_HALF_UP), exact.quantize(step, ROUND_DOWN))


def parse(entry):
    """«первое/последнее THC…» → (первое, последнее или None, если на полке, [THC])."""
    span, *thc = entry.split(" ")
    first, last = span.split("/")
    return first, (None if last == OPEN else last), [float(v) for v in thc]


def written(first, last, thc=()):
    return " ".join([f"{first}/{last or OPEN}"] + [num(v) for v in sorted(set(thc))])


def empty():
    return {
        "about": "Когда сорт бренда был на полке каждого магазина: первое и последнее чтение "
                 "(«..» — на полке и сейчас) и THC на последнем чтении; thc — какие значения "
                 "THC, то есть партии, сорт бренда уже показывал хоть где-то. Пишется "
                 "scripts/shelf-history.py после ежедневного прогона; правила — в его описании.",
        "rules": {
            "newShareMax": NEW_SHARE_MAX, "lopsidedMin": LOPSIDED_MIN, "recentSweeps": RECENT_SWEEPS,
            "confirmWithin": CONFIRM_WITHIN, "waveShelves": WAVE_SHELVES,
            "waveDays": WAVE_DAYS, "keepDays": KEEP_DAYS, "minThcStep": MIN_THC_STEP,
            "thcBurstShare": THC_BURST_SHARE, "thcBurstMin": THC_BURST_MIN,
        },
        "sweeps": [],
        "collector": {},
        "days": {},
        "arrivals": [],
        "pending": [],
        "batches": [],
        "pendingBatches": [],
        "reads": {},
        "thc": {},
        "seen": {},
    }


def fold(hist, day, rows, collector=None):
    """Сложить в историю один прогон. None — если в этот день не прочитан ни один магазин
    или история уже дальше. collector — версия сборщика, которым читали."""
    shelves, potency = shelves_read(rows, day)
    sweeps = hist["sweeps"]
    if not shelves or (sweeps and day <= sweeps[-1]):
        return None
    recent = sweeps[-RECENT_SWEEPS:]
    versions = hist["collector"]
    count = Counter(read=len(shelves))
    if collector:
        if sweeps and versions.get(sweeps[-1]) not in (None, collector):
            count["collectorChanged"] = 1
        versions[day] = collector
    sweeps.append(day)

    # Кандидаты прошлых прогонов: стоят ли они на полке при следующем чтении
    # магазина. Сорт, который сборщик за ночь записал иначе, — всё тот же сорт.
    settle(hist, "pending", "arrivals", shelves, sweeps, day, count,
           ("confirmed", "flicker", "unconfirmed"),
           lambda c: c["key"] in shelves[c["licence"]]
           or any(similar(c["key"], k) for k in shelves[c["licence"]]))
    settle(hist, "pendingBatches", "batches", shelves, sweeps, day, count,
           ("batchConfirmed", "batchFlicker", "batchUnconfirmed"),
           lambda c: any(same_batch(c["thc"], v)
                         for v in potency.get(c["licence"], {}).get(c["key"], ())))

    for lic, shelf in shelves.items():
        reads = hist["reads"].setdefault(lic, [])
        seen = hist["seen"].setdefault(lic, {})
        r1 = reads[-1] if reads else None
        r2 = reads[-2] if len(reads) > 1 else None
        was = {key: parse(entry) for key, entry in seen.items()}
        thc_now = potency.get(lic, {})

        # Что ушло с полки: последний раз оно стояло на прошлом чтении.
        departed = 0
        for key, (first, last, thc) in was.items():
            if last is None and key not in shelf:
                seen[key] = written(first, r1, thc)
                departed += 1

        new = []
        for key in shelf:
            got = was.get(key)
            first = day
            if got is None:
                new.append((key, False))
            else:
                first, last, _thc = got
                # Ушёл и вернулся. Если стоял на одном из двух прошлых чтений,
                # это мигание, а не появление.
                if last is not None and (r2 is None or last < r2):
                    new.append((key, True))
            seen[key] = written(first, None, thc_now.get(key, ()))
        reads.append(day)
        del reads[:-KEEP_READS]
        if new:
            count["appeared"] += len(new)

        if r2 is None or r1 not in recent:
            if new:
                count["unsteady"] += len(new)
            continue
        if len(new) > NEW_SHARE_MAX * len(shelf):
            count["rewritten"] += len(new)
            count["rewrittenShops"] += 1
            continue
        # Сборщик сменился с прошлого чтения, и полка выросла в одну сторону:
        # так выглядит меню, прочитанное глубже, а не привезённый товар.
        # Настоящий завоз может попасть сюда же — пустое поле лучше догадки.
        before = versions.get(r1)
        if (collector and before and before != collector
                and len(new) >= LOPSIDED_MIN and departed * 3 < len(new)):
            count["deeper"] += len(new)
            count["deeperShops"] += 1
            continue
        shelf_sig = signature(shelf)
        arrived = arrivals(hist, lic, shelf, new, seen, r2, day, shelf_sig, count)
        batches(hist, lic, shelf, was, thc_now, arrived, day, shelf_sig, count)

    remember_potency(hist, potency, day)
    hist["days"][day] = dict(sorted(count.items()))
    prune(hist, day)
    return count


def settle(hist, queue, done, shelves, sweeps, day, count, names, holds):
    """Кандидат подтверждается на следующем чтении своего магазина; магазин, который
    CONFIRM_WITHIN прогонов не читался, его не подтвердит."""
    confirmed, flicker, expired = names
    waiting = []
    for cand in hist[queue]:
        if cand["licence"] in shelves:
            if holds(cand):
                hist[done].append({**cand, "confirmed": day})
                count[confirmed] += 1
            else:
                count[flicker] += 1
        elif sum(1 for s in sweeps if s > cand["seen"]) < CONFIRM_WITHIN:
            waiting.append(cand)
        else:
            count[expired] += 1
    hist[queue] = waiting


def arrivals(hist, lic, shelf, new, seen, r2, day, shelf_sig, count):
    """Кандидаты в завоз из новых на полке устойчивого магазина. Возвращает их ключи."""
    if not new:
        return set()
    lately = [k for k, entry in seen.items() if (parse(entry)[1] or "") >= r2]
    arrived = set()
    for key, returned in new:
        if any(similar(key, gone) for gone in lately):
            count["renamed"] += 1
            continue
        row = shelf[key]
        hist["pending"].append({
            "seen": day,
            "licence": lic,
            "key": key,
            "brand": row.get("brand"),
            "strain": row.get("strainNameCanonical") or row.get("strainNameRaw"),
            "shelf": shelf_sig,
            "returned": returned,
        })
        count["candidates"] += 1
        arrived.add(key)
    return arrived


def batches(hist, lic, shelf, was, thc_now, arrived, day, shelf_sig, count):
    """Кандидаты в новую партию: THC, которого у сорта бренда не было ни в одном магазине."""
    changed, comparable = [], 0
    for key, values in thc_now.items():
        got = was.get(key)
        if got is None or got[1] is not None:
            continue  # на прошлом чтении сорта на полке не было: это не смена партии на полке
        if not got[2]:
            count["thcNewlyShown"] += 1  # THC раньше не показывали: новое здесь наше чтение
            continue
        comparable += 1
        fresh = [v for v in values if not v.is_integer() and not any(same_batch(v, p) for p in got[2])]
        if fresh:
            changed.append((key, fresh))
    if len(changed) >= THC_BURST_MIN and len(changed) > THC_BURST_SHARE * comparable:
        count["thcRewritten"] += len(changed)
        count["thcRewrittenShops"] += 1
        return
    for key in sorted(arrived):
        fresh = [v for v in thc_now.get(key, ()) if not v.is_integer()]
        if fresh:
            changed.append((key, fresh))
    for key, fresh in changed:
        market = [v for v, _first in hist["thc"].get(key, [])]
        if not market:
            continue  # сорт бренда, которого мы раньше не видели: это завоз, а не новая партия
        for v in sorted(set(fresh)):
            if any(same_batch(v, m) for m in market):
                continue  # эта партия уже стояла в других магазинах
            row = shelf[key]
            hist["pendingBatches"].append({
                "seen": day,
                "licence": lic,
                "key": key,
                "thc": v,
                "before": sorted(market),
                "brand": row.get("brand"),
                "strain": row.get("strainNameCanonical") or row.get("strainNameRaw"),
                "shelf": shelf_sig,
            })
            count["batchCandidates"] += 1


def remember_potency(hist, potency, day):
    """Какие значения THC сорт бренда показывал хоть в одном магазине — с любых полок,
    устойчивых или нет: партия, которую уже видели, не новая. Целое — округление, и
    в память оно не идёт: «28» заслонило бы всё от 27,5 до 29."""
    for keys in potency.values():
        for key, values in keys.items():
            for v in sorted(values):
                if v.is_integer():
                    continue
                have = hist["thc"].setdefault(key, [])
                if all(v != known for known, _first in have):
                    have.append([v, day])


def prune(hist, day):
    horizon = (date.fromisoformat(day) - timedelta(days=KEEP_DAYS)).isoformat()
    for seen in hist["seen"].values():
        for key in [k for k, entry in seen.items() if (parse(entry)[1] or horizon) < horizon]:
            del seen[key]
    alive = {key for seen in hist["seen"].values() for key in seen}
    hist["thc"] = {key: values for key, values in hist["thc"].items() if key in alive}
    hist["arrivals"] = [a for a in hist["arrivals"] if a["seen"] >= horizon]
    hist["batches"] = [b for b in hist["batches"] if b["seen"] >= horizon]
    hist["days"] = {d: c for d, c in hist["days"].items() if d >= horizon}
    hist["collector"] = {d: v for d, v in hist["collector"].items() if d >= horizon}
    del hist["sweeps"][:-KEEP_SWEEPS]


def waves(hist, day):
    """Сорт бренда, появившийся на WAVE_SHELVES и более разных полках за WAVE_DAYS дней до day."""
    since = (date.fromisoformat(day) - timedelta(days=WAVE_DAYS - 1)).isoformat()
    groups = defaultdict(list)
    for a in hist["arrivals"]:
        if since <= a["seen"] <= day:
            groups[a["key"]].append(a)
    found = [(key, found) for key, found in groups.items()
             if len({a["shelf"] for a in found}) >= WAVE_SHELVES]
    return sorted(found, key=lambda kv: (-len({a["shelf"] for a in kv[1]}), kv[0]))


def new_batches(hist, day):
    """Новые партии за WAVE_DAYS дней до day: {(сорт бренда, THC): подтверждения}."""
    since = (date.fromisoformat(day) - timedelta(days=WAVE_DAYS - 1)).isoformat()
    groups = defaultdict(list)
    for b in hist["batches"]:
        if since <= b["seen"] <= day:
            groups[(b["key"], b["thc"])].append(b)
    return groups


def render(value, indent=0, depth=3):
    """JSON по строке на запись, чтобы ежедневная разница в git была разницей полок,
    а не всего файла."""
    pad = " " * (indent + 1)
    if isinstance(value, dict) and value and depth > 0 and not all(
            isinstance(v, (int, float)) for v in value.values()):
        items = sorted(value.items()) if indent else value.items()
        body = ",\n".join(f"{pad}{json.dumps(k, ensure_ascii=False)}: {render(v, indent + 1, depth - 1)}"
                          for k, v in items)
        return "{\n" + body + "\n" + " " * indent + "}"
    if isinstance(value, list) and value and isinstance(value[0], dict):
        body = ",\n".join(pad + json.dumps(v, ensure_ascii=False, sort_keys=True) for v in value)
        return "[\n" + body + "\n" + " " * indent + "]"
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def save(hist):
    tmp = HISTORY.with_suffix(".tmp")
    tmp.write_text(render(hist) + "\n")
    tmp.replace(HISTORY)


def load():
    """История с диска. Раздел, которого в ней ещё нет (файл писала прежняя версия
    скрипта), начинается пустым, а не роняет прогон."""
    hist = json.loads(HISTORY.read_text()) if HISTORY.exists() else {}
    for part, blank in empty().items():
        hist.setdefault(part, blank)
    return hist


def collector_at(ref):
    """Отпечаток того, чем читали: хеши файлов READER в этом коммите."""
    blobs = []
    for path in READER:
        got = subprocess.run(["git", "rev-parse", f"{ref}:{path}"], cwd=ROOT, capture_output=True, text=True)
        blobs.append(got.stdout.strip() if got.returncode == 0 else "-")
    return hashlib.sha1(" ".join(blobs).encode()).hexdigest()[:10]


def listings_of(raw):
    rows = json.loads(raw)
    return rows if isinstance(rows, list) else rows.get("listings", [])


def today():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def plural(n, one, few, many):
    n = abs(n) % 100
    if 11 <= n <= 19:
        return many
    n %= 10
    return one if n == 1 else few if 2 <= n <= 4 else many


def spelled(values):
    """Самое частое написание; КАПСЛОК проигрывает ничью — как на странице сортов."""
    counted = Counter(v for v in values if v)
    if not counted:
        return None
    return sorted(counted.items(), key=lambda kv: (-kv[1], kv[0].isupper(), kv[0]))[0][0]


def where(n):
    return f"{n} {plural(n, 'магазине', 'магазинах', 'магазинах')}"


def line(day, c):
    return (f"{day}: прочитано {c.get('read', 0)}, появилось {c.get('appeared', 0)} — "
            f"магазин без двух прошлых чтений {c.get('unsteady', 0)}, "
            f"полка переписана {c.get('rewritten', 0)} ({c.get('rewrittenShops', 0)} маг.), "
            f"сборщик глубже {c.get('deeper', 0)} ({c.get('deeperShops', 0)} маг.), "
            f"переименовано {c.get('renamed', 0)}, кандидатов {c.get('candidates', 0)}; "
            f"подтверждено {c.get('confirmed', 0)}, мигнуло {c.get('flicker', 0)}; "
            f"партии: кандидатов {c.get('batchCandidates', 0)}, подтверждено {c.get('batchConfirmed', 0)}, "
            f"THC переписан {c.get('thcRewritten', 0)} ({c.get('thcRewrittenShops', 0)} маг.), "
            f"THC впервые показан {c.get('thcNewlyShown', 0)}")


def backfill():
    """История заново: последний коммит каждого дня на первой линии — то, что было опубликовано."""
    log = subprocess.run(
        ["git", "log", "--first-parent", "HEAD", "--format=%H %ct", "--", "data/flower-listings.json"],
        cwd=ROOT, capture_output=True, text=True, check=True).stdout.split("\n")
    day_ref = {}
    for entry in log:
        if entry.strip():
            ref, stamp = entry.split()
            day_ref.setdefault(datetime.fromtimestamp(int(stamp), timezone.utc).strftime("%Y-%m-%d"), ref)
    hist = empty()
    for day in sorted(day_ref):
        raw = subprocess.run(["git", "show", f"{day_ref[day]}:data/flower-listings.json"],
                             cwd=ROOT, capture_output=True, text=True, check=True).stdout
        c = fold(hist, day, listings_of(raw), collector_at(day_ref[day]))
        print(line(day, c) if c else f"{day}: ни одного магазина не прочитано в этот день")
    save(hist)
    print(f"\n{HISTORY.relative_to(ROOT)}: {len(hist['sweeps'])} прогонов, "
          f"{sum(len(s) for s in hist['seen'].values())} сортов в магазинах, "
          f"{len(hist['arrivals'])} подтверждённых появлений, {len(hist['batches'])} новых партий")


def update(day):
    hist = load()
    # Сборщик за время прогона не меняется: партии коммитят только данные.
    c = fold(hist, day, listings_of(LISTINGS.read_text()), collector_at("HEAD"))
    if c is None:
        print(f"{day}: сложить нечего — ни одного магазина не прочитано, или день уже в истории")
        return
    save(hist)
    print(line(day, c))


def report(day):
    hist = load()
    c = hist["days"].get(day)
    out = ["", "### Свежие завозы", ""]
    if c is None:
        out.append("_Сегодня в историю полок нечего сложить: ни один магазин не прочитан._")
        print("\n".join(out))
        return
    names = {d["licenseNumber"]: (d.get("dbaName") or d["legalName"])
             for d in json.loads(REGISTER.read_text())}
    confirmed = [a for a in hist["arrivals"] if a.get("confirmed") == day]
    shops_today = len({a["licence"] for a in confirmed})
    out += [
        "Сорт бренда, которого не было на двух прошлых чтениях магазина и который "
        "устоял до следующего. Дата — когда мы его впервые увидели, а не дата "
        "упаковки: её не указывает ни одна позиция. Пока это только отчёт — "
        "смотрим, насколько чистый сигнал.",
        "",
        f"- подтверждено сегодня: **{len(confirmed)}** в {where(shops_today)}",
        f"- ждут следующего чтения магазина: {len(hist['pending'])}",
        f"- отсеяно при появлении: полку переписало наше чтение — {c.get('rewritten', 0)} "
        f"в {where(c.get('rewrittenShops', 0))}; сборщик менялся, и полка выросла в одну "
        f"сторону — {c.get('deeper', 0)} в {where(c.get('deeperShops', 0))}; "
        f"переименования — {c.get('renamed', 0)}; магазин не читался два прошлых раза — "
        f"{c.get('unsteady', 0)}",
        f"- не устояли до следующего чтения: {c.get('flicker', 0)}",
        f"- сборщик с прошлого прогона: {'менялся' if c.get('collectorChanged') else 'тот же'}",
    ]
    found = waves(hist, day)
    out += ["", f"**Волны за {WAVE_DAYS} дней** — сорт бренда появился на {WAVE_SHELVES} и более полках: "
            f"{len(found)}", ""]
    for _key, arr in found[:15]:
        first = min(a["seen"] for a in arr)
        shelves = len({a["shelf"] for a in arr})
        shops = sorted({names.get(a["licence"], a["licence"]) for a in arr})
        grew = sum(1 for a in arr if a["confirmed"] == day)
        out.append(f"- **{spelled(a['brand'] for a in arr) or 'бренд не указан'} · "
                   f"{spelled(a['strain'] for a in arr)}** — {shelves} "
                   f"{plural(shelves, 'полка', 'полки', 'полок')}, с {first[8:10]}.{first[5:7]}"
                   + (f", сегодня +{grew}" if grew else "") + ": "
                   + ", ".join(shops[:5]) + (f" и ещё {len(shops) - 5}" if len(shops) > 5 else ""))
    if not found:
        out.append("_нет_")
    out += batch_section(hist, day, c, names)
    # Бренд — по ключу: GRASSROOTS и Grassroots — один бренд, написанный двумя меню.
    by_brand = defaultdict(list)
    for a in confirmed:
        by_brand[a["key"].split("|", 1)[0]].append(a["brand"])
    ranked = sorted(by_brand.values(), key=lambda v: (-len(v), spelled(v) or ""))
    if ranked:
        out += ["", "**Сегодня по брендам:** " + " · ".join(
            f"{spelled(v) or 'бренд не указан'} {len(v)}" for v in ranked[:12])]
    print("\n".join(out))


def batch_section(hist, day, c, names):
    groups = new_batches(hist, day)
    # Где партия стоит сейчас: её первые магазины — это только начало.
    carrying = defaultdict(lambda: defaultdict(set))
    for row in listings_of(LISTINGS.read_text()):
        thc = row.get("thcPercent")
        if isinstance(thc, (int, float)) and thc > 0 and key_of(row):
            carrying[key_of(row)][row["licenseNumber"]].add(float(thc))
    ranked = []
    for (key, thc), found in groups.items():
        shops = {lic for lic, values in carrying[key].items() if any(same_batch(thc, v) for v in values)}
        ranked.append((len(shops), min(b["seen"] for b in found), key, thc, found, shops))
    ranked.sort(key=lambda r: (-r[0], r[1], r[2]))
    today_n = sum(1 for b in hist["batches"] if b["confirmed"] == day)
    out = ["", f"**Новые партии за {WAVE_DAYS} дней** — у сорта бренда THC, которого раньше не было "
           f"ни в одном магазине (THC до сотых — число из сертификата партии): {len(ranked)}", "",
           f"- подтверждено сегодня: {today_n}; ждут следующего чтения: {len(hist['pendingBatches'])}",
           f"- отсеяно: THC сменился разом у многих позиций магазина — {c.get('thcRewritten', 0)} "
           f"в {where(c.get('thcRewrittenShops', 0))} (поменялось наше чтение потенции); "
           f"THC раньше не показывали — {c.get('thcNewlyShown', 0)}", ""]
    for n, first, key, thc, found, shops in ranked[:15]:
        before = found[0]["before"]
        named = sorted(names.get(lic, lic) for lic in shops)
        out.append(f"- **{spelled(b['brand'] for b in found) or 'бренд не указан'} · "
                   f"{spelled(b['strain'] for b in found)}** — THC {num(thc)}% "
                   f"(раньше {', '.join(num(v) for v in before[:4])}{' …' if len(before) > 4 else ''}), "
                   f"с {first[8:10]}.{first[5:7]}, сейчас в {where(n)}"
                   + (": " + ", ".join(named[:5]) + (f" и ещё {len(named) - 5}" if len(named) > 5 else "")
                      if named else ""))
    if not ranked:
        out.append("_нет_")
    return out


def check():
    """Правила на выдуманной неделе: каждое должно сработать и не задеть соседнее."""
    def row(lic, strain, day, brand="Find", thc=None):
        return {"licenseNumber": lic, "strainNameCanonical": strain, "brand": brand,
                "brandKey": brand.lower() if brand else None, "capturedAt": f"{day}T12:00:00Z",
                "thcPercent": thc}

    base = [f"Old {n}" for n in range(20)]
    days = ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05"]

    def shelf(lic, day, extra=(), drop=(), house=None):
        # У каждого магазина свой товар, у сети на общей витрине — общий.
        own = [f"House {house or lic}"]
        return [row(lic, s, day) for s in base + own if s not in drop] + [row(lic, s, day) for s in extra]

    def potent(lic, day, values):
        return shelf(lic, day) + [row(lic, s, day, thc=v) for s, v in values.items()]

    plan = {
        # Настоящий завоз: появился на третьем чтении и устоял на четвёртом.
        "A": lambda i, d: shelf("A", d, extra=["Crusty Crustacean"] if i >= 2 else []),
        # Мигание: был, пропал на одно чтение, вернулся — не появление.
        "B": lambda i, d: shelf("B", d, drop=["Old 3"] if i == 1 else []),
        # Наше чтение переписало полку: полка выросла вдвое за один день.
        "C": lambda i, d: shelf("C", d, extra=[f"Deep {n}" for n in range(20)] if i >= 2 else []),
        # Переименование: тот же сорт с «Flower» в конце.
        "D": lambda i, d: (shelf("D", d, drop=["Old 5"], extra=["Old 5 Flower"]) if i >= 2 else shelf("D", d)),
        # Появился и не устоял до следующего чтения.
        "E": lambda i, d: shelf("E", d, extra=["Blink"] if i == 2 else []),
        # Волна: одна сеть на общей витрине (F1, F2) и ещё два магазина.
        "F1": lambda i, d: shelf("F1", d, extra=["Garlic Patties"] if i >= 2 else [], house="F"),
        "F2": lambda i, d: shelf("F2", d, extra=["Garlic Patties"] if i >= 2 else [], house="F"),
        "G": lambda i, d: shelf("G", d, extra=["Garlic Patties"] if i >= 2 else []),
        "H": lambda i, d: shelf("H", d, extra=["Garlic Patties"] if i >= 3 else []),
        # Первый раз прочитан на третий день: сравнивать не с чем.
        "N": lambda i, d: shelf("N", d) if i >= 2 else [],
        # Сборщик сменился на третий день, и полка выросла на шесть без единого
        # ушедшего — чтение стало глубже.
        "P": lambda i, d: shelf("P", d, extra=[f"Stock {n}" for n in range(20)]
                                + ([f"Page two {n}" for n in range(6)] if i >= 2 else [])),
        # Тот же рост, но в день, когда сборщик не менялся, — это завоз.
        "Q": lambda i, d: shelf("Q", d, extra=[f"Stock {n}" for n in range(20)]
                                + ([f"Drop {n}" for n in range(6)] if i >= 3 else [])),
        # Новая партия: THC сорта сменился на значение, которого не было нигде.
        # Рядом — сорт, пришедший впервые с THC: это завоз, а не новая партия.
        "T1": lambda i, d: potent("T1", d, {"Batch Strain": 20.11 if i < 2 else 22.35,
                                            **({"Brand New": 24.44} if i >= 2 else {})}),
        # «25» и 25.3 — одна партия, записанная точнее.
        "T2": lambda i, d: potent("T2", d, {"Round Strain": 25 if i < 2 else 25.3}),
        # Магазин получил партию, которая уже стояла в другом магазине.
        "T3": lambda i, d: potent("T3", d, {"Known Strain": 19.87 if i < 2 else 21.5}),
        "T4": lambda i, d: potent("T4", d, {"Known Strain": 21.5}),
        # THC раньше не показывали — новое здесь наше чтение.
        "T5": lambda i, d: potent("T5", d, {"Shown Strain": None if i < 2 else 23.45}),
        # THC сменился у всех позиций сразу — поменялось чтение потенции.
        "T6": lambda i, d: potent("T6", d, {f"Burst {n}": 20.11 + n + (3 if i >= 2 else 0) for n in range(10)}),
    }
    version = ["v1", "v1", "v2", "v2", "v2"]
    hist = empty()
    counts = {}
    for i, d in enumerate(days):
        rows = [r for make in plan.values() for r in make(i, d)]
        counts[d] = fold(hist, d, rows, version[i])
    fails = []

    def expect(what, got, want):
        if got != want:
            fails.append(f"{what}: {got!r}, ожидалось {want!r}")

    third, fourth = counts[days[2]], counts[days[3]]
    arrived = {(a["licence"], a["key"]) for a in hist["arrivals"]}
    expect("завоз подтверждён", ("A", "find|crusty crustacean") in arrived, True)
    expect("дата — первое появление", next(a["seen"] for a in hist["arrivals"] if a["licence"] == "A"), days[2])
    expect("мигание не появление", any(a["licence"] == "B" for a in hist["arrivals"] + hist["pending"]), False)
    expect("переписанная полка", (third["rewritten"], third["rewrittenShops"]), (20, 1))
    expect("переименование", third["renamed"], 1)
    expect("не устоял", fourth["flicker"], 1)
    expect("новый магазин без прошлого", third["unsteady"], len(base) + 1)
    expect("сборщик сменился", (third.get("collectorChanged"), fourth.get("collectorChanged")), (1, None))
    expect("чтение стало глубже", (third["deeper"], third["deeperShops"]), (6, 1))
    expect("тот же рост без смены сборщика", sum(1 for a in hist["arrivals"] if a["licence"] == "Q"), 6)
    expect("мелкий завоз в день смены сборщика", any(a["licence"] == "A" for a in hist["arrivals"]), True)
    again = [r for make in plan.values() for r in make(4, days[4])]
    expect("второй прогон того же дня", fold(hist, days[4], again, "v2"), None)
    found = waves(hist, days[4])
    expect("волна", [(k, len({a["shelf"] for a in arr})) for k, arr in found], [("find|garlic patties", 3)])
    expect("общая витрина — одна полка", len({a["shelf"] for a in hist["arrivals"] if a["licence"] in ("F1", "F2")}), 1)
    expect("ушедшее помнит последнее чтение", hist["seen"]["D"]["find|old 5"], f"{days[0]}/{days[1]}")
    expect("стоящее открыто", hist["seen"]["A"]["find|crusty crustacean"], f"{days[2]}/{OPEN}")
    expect("новая партия", [(b["licence"], b["key"], b["thc"], b["before"], b["seen"], b["confirmed"])
                            for b in hist["batches"]],
           [("T1", "find|batch strain", 22.35, [20.11], days[2], days[3])])
    expect("кандидат партии", (third["batchCandidates"], fourth["batchConfirmed"]), (1, 1))
    expect("чтение потенции сменилось", (third["thcRewritten"], third["thcRewrittenShops"]), (10, 1))
    expect("THC впервые показан", third["thcNewlyShown"], 1)
    expect("THC помнится по полке", hist["seen"]["T1"]["find|batch strain"], f"{days[0]}/{OPEN} 22.35")
    expect("одна партия", (same_batch(28, 28.41), same_batch(28.4, 28.41), same_batch(22.3, 22.36),
                           same_batch(25, 25.3), same_batch(28.41, 28.51), same_batch(27, 30.52),
                           same_batch(26.49, 28.41)), (True, True, True, True, False, False, False))
    expect("похожие", (similar("find|old 5", "find|old 5 flower"), similar("find|gelato", "jeeter|gelato"),
                       similar("|crusty crustacean", "find|crusty crustacean"),
                       similar("find|blue dream", "find|blueberry")), (True, False, True, False))
    if fails:
        print("shelf history: правила не сходятся\n  " + "\n  ".join(fails))
        raise SystemExit(1)
    print("shelf history: правила сходятся.")


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    when = sys.argv[2] if len(sys.argv) > 2 else today()
    if command == "check":
        check()
    elif command == "update":
        update(when)
    elif command == "report":
        report(when)
    elif command == "backfill":
        backfill()
    else:
        raise SystemExit(__doc__)
