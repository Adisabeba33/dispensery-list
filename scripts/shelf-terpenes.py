#!/usr/bin/env python3
"""Терпеновые панели с полок — по партиям, для Сомы.

Меню, которое показывает терпены, переписывает их с сертификата партии: у
Alley Oop от ElectraLeaf четыре магазина Gotham и BudBiz печатают 0.37, 0.23,
0.18, 0.12, 0.07 — ровно то, что Сома вручную переписала с сертификата Kaycha
той же партии. Поэтому единица здесь — партия, а не позиция меню: сорт бренда
при одном значении THC (оно тоже с сертификата). Одна партия в десяти магазинах —
одно измерение, подтверждённое десять раз, а не десять измерений.

    python scripts/shelf-terpenes.py    # data/shelf-terpenes.json

Как собирается партия:

- позиции одного сорта бренда с одним THC — одна партия; «31» и 30.64 — тоже
  одна (то же правило, что для партий в shelf-history.py); но близкий и не
  тот же THC при заметно разных панелях — два сертификата, две партии;
- позиция без THC присоединяется к партии, только если её панель совпадает
  с панелью партии по всем общим терпенам; иначе к какой партии она относится,
  неизвестно, и она не идёт никуда;
- меню часто печатает не всю панель, а первые несколько терпенов, и разные
  меню — разные несколько. Панель партии — объединение того, что напечатали
  её магазины;
- если магазины расходятся в цифре одного терпена, берётся цифра большинства;
  при равенстве терпен не пишется. Если одно меню назвало терпен дважды с
  разными цифрами («Pinene» и «Alpha-Pinene» сборщик читает одним именем), из
  этой позиции он не берётся: пустое поле лучше правдоподобной догадки;
- в выгрузку идут партии, у которых в панели хотя бы три терпена.

У партии две даты возраста: packagedOn — с сертификата (день пробы из уже
расфасованной партии или сама дата упаковки; packagedFrom говорит, какая) и
firstOnShelf — первый день, когда такой THC у сорта бренда появился на полке
хоть одного магазина (из data/shelf-history.json). Первая — сколько пакет
лежит; вторая — сколько он уже на полках.

Срок жизни партии — 16 недель с последнего дня, когда её видели на полке.
Партия, которой сегодня нет ни в одном меню, из выгрузки не пропадает: её
панель остаётся измерением этого сорта, пока партия могла ещё стоять у кого-то
дома или на складе. Та же партия (сорт бренда, тот же THC) на сегодняшних
полках обновляет свой последний день и сохраняет первый. Партия, не виденная
16 недель, уходит в data/shelf-terpenes-archive.json — не удаляется.
"""
import importlib.util
import json
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LISTINGS = ROOT / "data/flower-listings.json"
OUT = ROOT / "data/shelf-terpenes.json"
ARCHIVE = ROOT / "data/shelf-terpenes-archive.json"
COA_DATES = ROOT / "data/coa-dates.json"
RETAIL_ID = ROOT / "data/retail-id.json"
HISTORY = ROOT / "data/shelf-history.json"
# Оценка даты упаковки по номеру метки — только между двумя известными
# пакетами той же лицензии, которые упакованы не дальше этого друг от друга.
# На 465 пакетах с известной датой, спрятанной по одному: медиана ошибки
# 0 дней, у 90% — не больше 7.
TAG_WINDOW_DAYS = 14
LIFETIME = timedelta(weeks=16)
MIN_TERPENES = 3
SAME = 0.005  # ближе — одна и та же цифра, записанная иначе

_spec = importlib.util.spec_from_file_location("shelf_history", ROOT / "scripts/shelf-history.py")
_history = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_history)
same_batch, listings_of = _history.same_batch, _history.listings_of

# Производитель партии. Ключ бренда реестра (brandKey) складывает регистр,
# акценты и «Cannabis», «Co», «Farms»; для партий этого мало: «Kings and
# Queens» и «Kings & Queens», «The Botanist» и «Botanist», «VOP» и «Voice of the
# Plant» — один производитель, а ключей у них два, и сорт, который продаёт он
# один, выглядел как сорт двух производителей и не измерялся вовсе. Поэтому
# здесь выпадают ещё «and», «the», «of», а сокращения сводятся таблицей.
# Сома складывает производителя так же (shelfGrowerKey в src/lib/terpenes.ts).
# Ключ бренда в выгрузке меню не меняется: на нём стоит история полок.
GROWER_NOISE = re.compile(r"\b(cannabis|co|company|farms?|labs?|brands?|nyc?|llc|inc|and|the|of)\b")
GROWER_ALIASES = {
    "vop": "voiceplant", "voiceplants": "voiceplant", "voiceplantvop": "voiceplant", "voiceplanet": "voiceplant",
    "kingqueens": "kingsqueens",
    "preferred": "preferredgardens",
    "doobies": "doobie",
    "grassrootsdarkheartcollection": "grassroots",
    "bouketflower": "bouket", "boukets": "bouket",
    "naticoke": "nanticoke",
    "5borodimebag": "5boro",
}


def grower_of(brand):
    if not brand:
        return None
    key = re.sub(r"[\u0300-\u036f]", "", unicodedata.normalize("NFKD", str(brand))).lower()
    key = re.sub(r"[^a-z0-9]", "", GROWER_NOISE.sub(" ", re.sub(r"[^a-z0-9 ]", " ", key)))
    return GROWER_ALIASES.get(key, key) or None


def key_of(row):
    strain = re.sub(r"\s+", " ", (row.get("strainNameCanonical") or row.get("strainNameRaw") or "").strip().lower())
    return f"{grower_of(row.get('brand')) or ''}|{strain}" if strain else None


def panel_of(row):
    """{терпен: %} одной позиции; терпен, названный дважды по-разному, не берётся."""
    seen = defaultdict(set)
    for p in (row.get("terpenes") or {}).get("profile") or []:
        if p.get("percent") is not None and p.get("name") and p["name"] != "OTHER":
            seen[p["name"]].add(round(float(p["percent"]), 4))
    return {name: values.pop() for name, values in seen.items() if len(values) == 1}


def agrees(a, b):
    shared = a.keys() & b.keys()
    return bool(shared) and all(abs(a[t] - b[t]) <= SAME for t in shared)


def differs(a, b):
    """Заметно разные панели: общий терпен расходится больше чем на 0.03 и на десятую."""
    return any(abs(a[t] - b[t]) > max(0.03, 0.1 * max(a[t], b[t])) for t in a.keys() & b.keys())


def merged(panels, certified=()):
    """Панель партии из панелей её магазинов; и сколько терпенов пришлось отбросить.

    При равенстве голосов побеждает цифра магазина, приложившего сертификат:
    он её переписал с документа. У Funk Bomb от Knack так терялся ведущий
    α-пинен 0.67 — и партия читалась не тем растением. Если сертификата нет
    ни у одной из спорящих цифр, терпен по-прежнему не пишется."""
    votes = defaultdict(Counter)
    backed = defaultdict(set)
    for i, panel in enumerate(panels):
        for name, value in panel.items():
            votes[name][value] += 1
            if i in certified:
                backed[name].add(value)
    out, dropped = {}, 0
    for name, counted in votes.items():
        (value, n), *rest = counted.most_common()
        if rest and rest[0][1] == n and abs(rest[0][0] - value) > SAME:
            tied = [v for v, c in counted.items() if c == n]
            sure = [v for v in tied if v in backed[name]]
            if len(sure) != 1:
                dropped += 1
                continue
            value = sure[0]
        out[name] = value
    return dict(sorted(out.items(), key=lambda kv: -kv[1])), dropped


def same_panel(a, b):
    """Одна и та же панель, напечатанная разными меню: разные меню печатают
    разное число терпенов, поэтому сравниваются общие — их не меньше четырёх,
    среди них по три ведущих у каждой панели, и все сходятся до цифры."""
    shared = a.keys() & b.keys()
    lead = lambda p: set(sorted(p, key=p.get, reverse=True)[:3])
    return (len(shared) >= 4 and lead(a) <= shared and lead(b) <= shared
            and all(abs(a[t] - b[t]) <= SAME for t in shared))


def fold_twins(groups):
    def panel_of_group(g):
        return merged([p for _r, p in g[1]])[0]

    def weight(g):
        return (len({r["licenseNumber"] for r, _p in g[1]}),
                any((r.get("terpenes") or {}).get("coaUrl") for r, _p in g[1]))

    out = []
    for g in sorted(groups, key=weight, reverse=True):
        mine = panel_of_group(g)
        twin = next((h for h in out if same_panel(mine, panel_of_group(h))), None)
        if twin:
            twin[1].extend(g[1])
        else:
            out.append([g[0], list(g[1])])
    return out


def lots(rows):
    by_strain = defaultdict(list)
    for row in rows:
        if (row.get("terpenes") or {}).get("source") != "MENU_LISTING":
            continue
        panel = panel_of(row)
        key = key_of(row)
        if panel and key:
            by_strain[key].append((row, panel))

    # «Connected Gascotti» у Connected — это Gascotti: производитель вписал своё
    # имя в название. Снимается, только если тот же производитель продаёт и
    # голое название — у Bouket «Bouket Noir» остаётся, «Noir» он не продаёт.
    for key in list(by_strain):
        grower, strain = key.split("|", 1)
        words = strain.split(" ")
        for n in range(1, min(4, len(words))):
            rest = f"{grower}|{' '.join(words[n:])}"
            if grower_of(" ".join(words[:n])) == grower and rest in by_strain:
                by_strain[rest].extend(by_strain.pop(key))
                break

    out, stray, conflicts = [], 0, 0
    for key, found in by_strain.items():
        groups = []  # [точный THC, [(row, panel)]]
        # Сначала точные значения, чтобы «31» пристало к 30.64, а не наоборот.
        dated = sorted((f for f in found if isinstance(f[0].get("thcPercent"), (int, float))),
                       key=lambda f: -len(repr(float(f[0]["thcPercent"]))))
        for row, panel in dated:
            thc = float(row["thcPercent"])
            # Близкий, но не тот же THC — та же партия, только если панели не
            # расходятся заметно: у Lemon Creamsicle от Find 26.14 и 26.22 — два
            # сертификата (мирцен 0.33 и 0.21), и склеенные они давали панель
            # одного под ссылками обоих. Округление меню (0.66 и 0.65) — не спор.
            home = next((g for g in groups if same_batch(g[0], thc)
                         and not (g[0] != thc and any(differs(panel, p) for _r, p in g[1]))), None)
            if home:
                home[1].append((row, panel))
            else:
                groups.append([thc, [(row, panel)]])
        for row, panel in (f for f in found if not isinstance(f[0].get("thcPercent"), (int, float))):
            homes = [g for g in groups if any(agrees(panel, p) for _r, p in g[1])]
            if len(homes) == 1:
                homes[0][1].append((row, panel))
            else:
                stray += 1

        # Один сертификат под двумя цифрами THC: у Platinum Z от Rolling Green
        # 23.27 и 23.72 — одна и та же панель и один документ (23.7166), а в
        # выгрузке было две партии. Одинаковые панели из четырёх и больше
        # терпенов — одна партия; THC — той цифры, что стоит в большем числе
        # магазинов (при равенстве — у той, где приложен сертификат).
        # Меню печатают разное число терпенов, поэтому сравниваются общие.
        # Так же складывается панель, которую меню приложило к нескольким
        # партиям с разным THC: измерение одно, и считать его дважды нельзя.
        groups = fold_twins(groups)
        for thc, members in groups:
            panel, dropped = merged([p for _r, p in members],
                                    {i for i, (r, _p) in enumerate(members) if (r.get("terpenes") or {}).get("coaUrl")})
            conflicts += dropped
            if len(panel) < MIN_TERPENES:
                continue
            rows_ = [r for r, _p in members]
            terps = [r.get("terpenes") or {} for r in rows_]
            out.append({
                "brand": Counter(r.get("brand") for r in rows_).most_common(1)[0][0],
                "strain": Counter(r.get("strainNameCanonical") or r.get("strainNameRaw") for r in rows_).most_common(1)[0][0],
                "key": key,
                "thcPercent": thc,
                "terpenes": panel,
                "totalPercent": max((t.get("totalPercent") for t in terps if t.get("totalPercent")), default=None),
                "shops": sorted({r["licenseNumber"] for r in rows_}),
                "certificates": sorted({t["coaUrl"] for t in terps if t.get("coaUrl")}),
                "lineageStated": sorted({r["lineage"] for r in rows_ if r.get("lineage") not in (None, "UNKNOWN")}),
                "read": min(r["capturedAt"][:10] for r in rows_),
                "lastSeen": max(r["capturedAt"][:10] for r in rows_),
                "_history": sorted({_history.key_of(r) for r in rows_} - {None}),
            })
    out.sort(key=lambda lot: (lot["key"], -lot["thcPercent"]))
    return out, stray, conflicts


def carried(fresh, before, day):
    """Партии прошлых выгрузок, ещё живые, рядом с сегодняшними; и те, что ушли в архив.

    Сегодняшняя партия, та же, что прошлая (тот же сорт бренда, тот же THC),
    остаётся сегодняшней — с первым днём прошлой. Прошлая партия, которой
    сегодня нет, остаётся, пока с её последнего дня не прошло 16 недель."""
    horizon = (date.fromisoformat(day) - LIFETIME).isoformat()
    kept, gone = list(fresh), []
    fresh_keys = {l["key"] for l in fresh}
    for old in before:
        # Прошлая выгрузка могла сложить производителя иначе; ключ пересчитывается.
        grower, strain = f"{grower_of(old.get('brand')) or ''}", old["key"].split("|", 1)[1]
        # и так же снимается имя производителя в начале названия
        words = strain.split(" ")
        for n in range(1, min(4, len(words))):
            if grower_of(" ".join(words[:n])) == grower and f"{grower}|{' '.join(words[n:])}" in fresh_keys:
                strain = " ".join(words[n:])
                break
        old = {**old, "key": f"{grower}|{strain}"}
        last = old.get("lastSeen") or old["read"]
        twin = next((l for l in fresh if l["key"] == old["key"] and (same_batch(l["thcPercent"], old["thcPercent"])
                                                                   or same_panel(l["terpenes"], old["terpenes"]))), None)
        if twin:
            twin["read"] = min(twin["read"], old["read"])
        elif last >= horizon:
            same = next((l for l in kept if l["key"] == old["key"] and (same_batch(l["thcPercent"], old["thcPercent"])
                                                                        or same_panel(l["terpenes"], old["terpenes"]))), None)
            if same:
                same["read"] = min(same["read"], old["read"])
                same["lastSeen"] = max(same.get("lastSeen") or same["read"], last)
            else:
                kept.append({**old, "lastSeen": last})
        else:
            gone.append({**old, "lastSeen": last})
    kept.sort(key=lambda lot: (lot["key"], -lot["thcPercent"]))
    return kept, gone


def load_lots(path):
    try:
        return json.loads(path.read_text()).get("lots") or []
    except FileNotFoundError:
        return []


def tag_reader(packages):
    """Метка → дата упаковки по Retail ID: точно, оценкой или границей.

    Метки одной лицензии (первые 15 знаков) выдаются по порядку, и порядковый
    номер (последние 9) растёт со временем. Между двумя пакетами с известной
    датой упаковки, упакованными не дальше TAG_WINDOW_DAYS друг от друга, дата
    читается интерполяцией. Метка новее всех известных — пакет упакован не
    раньше самого нового из них: это граница «не старше», а не дата."""
    exact = {t: p["packaged"] for t, p in packages.items() if p.get("found") and p.get("packaged")}
    anchors = defaultdict(list)
    for t, d in exact.items():
        anchors[t[:15]].append((int(t[15:]), date.fromisoformat(d).toordinal()))
    for pts in anchors.values():
        pts.sort()

    def read(tag):
        if tag in exact:
            return "exact", exact[tag]
        pts = anchors.get(tag[:15])
        if not pts:
            return None
        n = int(tag[15:])
        lower = [p for p in pts if p[0] < n]
        upper = [p for p in pts if p[0] > n]
        if lower and upper:
            (n0, d0), (n1, d1) = lower[-1], upper[0]
            if 0 <= d1 - d0 <= TAG_WINDOW_DAYS:
                return "tag", date.fromordinal(round(d0 + (d1 - d0) * (n - n0) / (n1 - n0))).isoformat()
            return None
        if lower:
            return "after", date.fromordinal(lower[-1][1]).isoformat()
        return None
    return read


def dated(found, before, rows):
    """Три времени партии и откуда каждое.

    - testedOn — день пробы по сертификату (data/coa-dates.json) или день теста
      по Retail ID; testedFrom говорит, какая дата (проба, приезд пробы в
      лабораторию, отчёт — у отчёта проба раньше).
    - packagedOn — когда запечатали банку: по Retail ID (retail-id), по дате
      упаковки в сертификате (certificate) или оценкой по номеру метки (tag).
      Упаковок у партии бывает несколько, и Retail ID это видит: packagedOn —
      самая ранняя (сказать «свежее», чем есть, хуже), packagedUntil — самая
      поздняя, если они разные. Без даты — packagedAfter, граница: банка
      запечатана не раньше этого дня.
    - harvestedOn — сбор, по сертификату или Retail ID.

    Проба и упаковка — разные дни: партию часто тестируют целиком, а по банкам
    раскладывают потом, иногда через месяцы. До v1.23.0 день пробы стоял в
    packagedOn; теперь он в testedOn.

    Метки берутся у пакетов той же партии в любом магазине — того же сорта
    бренда при том же THC: меню с метками и меню с панелями — разные магазины.

    Полка — по истории полок (data/shelf-history.json): в какой день такой THC
    у этого сорта бренда впервые появился хоть в одном магазине. История
    ведётся с первого прогона, и партия, стоявшая уже тогда, отмечена
    onShelfSinceStart: на полке она дольше, чем видно."""
    try:
        coa = json.loads(COA_DATES.read_text())["certificates"]
    except FileNotFoundError:
        coa = {}
    try:
        rid = json.loads(RETAIL_ID.read_text())
    except FileNotFoundError:
        rid = {}
    packages, links = rid.get("packages", {}), rid.get("links", {})
    read_tag = tag_reader(packages)
    try:
        hist = json.loads(HISTORY.read_text())
    except FileNotFoundError:
        hist = {"thc": {}, "sweeps": []}
    start = (hist.get("sweeps") or [None])[0]
    was = {(l["key"], l["thcPercent"]): l for l in before}

    tagged = defaultdict(list)
    for row in rows:
        key = key_of(row)
        tags = [links.get(t, t).upper() for t in (row.get("packageIds") or []) if t]
        tags = [t for t in tags if re.fullmatch(r"1A4[0-9A-F]{21}", t)]
        if key and tags and isinstance(row.get("thcPercent"), (int, float)):
            tagged[key].append((row["thcPercent"], tags))

    for lot in found:
        keys = lot.pop("_history", [])
        for field in ("packagedOn", "packagedFrom", "packagedUntil", "packagedAfter",
                      "testedOn", "testedFrom", "harvestedOn"):
            lot.pop(field, None)
        certs = [coa.get(u) or {} for u in lot["certificates"]]
        tags = sorted({t for thc, ts in tagged.get(lot["key"], []) if same_batch(thc, lot["thcPercent"]) for t in ts})
        cards = [packages[t] for t in tags if (packages.get(t) or {}).get("found")]
        reads = [r for r in map(read_tag, tags) if r]

        sampled = sorted((c["sampled"], c.get("sampledFrom") or "sampled") for c in certs if c.get("sampled"))
        tested = sorted(c["tested"] for c in cards if c.get("tested"))
        if sampled:
            lot["testedOn"], lot["testedFrom"] = sampled[0]
        elif tested:
            lot["testedOn"], lot["testedFrom"] = tested[0], "retail-id"

        exact = sorted(d for kind, d in reads if kind == "exact")
        printed = sorted(c["packaged"] for c in certs if c.get("packaged"))
        estimated = sorted(d for kind, d in reads if kind == "tag")
        after = sorted(d for kind, d in reads if kind == "after")
        for days, source in ((exact, "retail-id"), (printed, "certificate"), (estimated, "tag")):
            if days:
                lot["packagedOn"], lot["packagedFrom"] = days[0], source
                if days[-1] != days[0]:
                    lot["packagedUntil"] = days[-1]
                break
        else:
            if after:
                lot["packagedAfter"] = after[-1]

        harvested = sorted([c["harvested"] for c in certs if c.get("harvested")]
                           + [c["harvested"] for c in cards if c.get("harvested")])
        if harvested:
            lot["harvestedOn"] = harvested[0]

        # Партия, чьих пакетов сегодня нет ни в одном меню, держит даты, которые
        # у неё были: пакет, прочитанный вчера, сегодня не стал моложе.
        prior = was.get((lot["key"], lot["thcPercent"]), {})
        if "packagedOn" not in lot and prior.get("packagedFrom") in ("retail-id", "tag"):
            for field in ("packagedOn", "packagedFrom", "packagedUntil"):
                if prior.get(field):
                    lot[field] = prior[field]
        if "packagedOn" not in lot and "packagedAfter" not in lot and prior.get("packagedAfter"):
            lot["packagedAfter"] = prior["packagedAfter"]
        if "harvestedOn" not in lot and prior.get("harvestedOn"):
            lot["harvestedOn"] = prior["harvestedOn"]
        if "testedOn" not in lot and prior.get("testedFrom") == "retail-id":
            lot["testedOn"], lot["testedFrom"] = prior["testedOn"], "retail-id"

        seen = [day for k in keys for thc, day in hist.get("thc", {}).get(k, [])
                if same_batch(thc, lot["thcPercent"])]
        first = min(seen + [lot["read"]])
        prior_first = prior.get("firstOnShelf")
        lot["firstOnShelf"] = min(first, prior_first) if prior_first else first
        if start and lot["firstOnShelf"] <= start:
            lot["onShelfSinceStart"] = True
    return found


def main():
    rows = listings_of(LISTINGS.read_text())
    found, stray, conflicts = lots(rows)
    day = max((r["capturedAt"][:10] for r in rows if r.get("capturedAt")), default=None)
    today = len(found)
    before = load_lots(OUT)
    found, gone = carried(found, before, day)
    found = dated(found, before, rows)
    OUT.write_text(json.dumps({
        "about": "Терпеновые панели с полок Нью-Йорка, по партиям: сорт бренда при одном THC. "
                 "Пишется scripts/shelf-terpenes.py из data/flower-listings.json; читает Сома. "
                 "Партия живёт 16 недель с последнего дня на полке (lastSeen), потом уходит в архив.",
        "day": day,
        "lots": found,
    }, ensure_ascii=False, indent=1) + "\n")
    if gone:
        archived = load_lots(ARCHIVE)
        seen = {(l["key"], l["thcPercent"], l["lastSeen"]) for l in archived}
        archived += [l for l in gone if (l["key"], l["thcPercent"], l["lastSeen"]) not in seen]
        ARCHIVE.write_text(json.dumps({
            "about": "Партии, которых не было на полках 16 недель; выгрузка shelf-terpenes.json их больше не несёт.",
            "lots": sorted(archived, key=lambda lot: (lot["key"], -lot["thcPercent"], lot["lastSeen"])),
        }, ensure_ascii=False, indent=1) + "\n")
    print(f"{OUT.relative_to(ROOT)}: {len(found)} партий ({today} на сегодняшних полках, "
          f"{len(found) - today} из прошлых выгрузок, ещё живы), в архив ушло {len(gone)}; "
          f"{len({l['key'] for l in found})} сортов брендов, "
          f"с сертификатом {sum(1 for l in found if l['certificates'])}, "
          f"с датой теста {sum(1 for l in found if l.get('testedOn'))}, "
          f"с датой упаковки {sum(1 for l in found if l.get('packagedOn'))} "
          f"({', '.join(f'{k} {v}' for k, v in Counter(l['packagedFrom'] for l in found if l.get('packagedOn')).items())}), "
          f"с границей упаковки {sum(1 for l in found if l.get('packagedAfter'))}, "
          f"в двух магазинах и больше {sum(1 for l in found if len(l['shops']) > 1)}; "
          f"позиций без THC, не узнанных ни в одной партии, {stray}; "
          f"терпенов, где магазины разошлись поровну, {conflicts}")


if __name__ == "__main__":
    main()
