#!/usr/bin/env python3
"""Паспорт доверия бренда: что справочник знает о бренде за его этикеткой.

Бренд — это этикетка. Что за ней стоит, видно по трём вещам, которых нет у
покупателя: карточка Metrc Retail ID пакета (кто вырастил и упаковал, партия,
урожай, лаборатория, день теста и упаковки, THC, состояние теста, отзыв),
слова меню о том же пакете (название, THC, дата упаковки) и семьи двойников
детектора (scripts/lot-twins.py). Паспорт складывает их по трём осям.

    python scripts/brand-trust.py           # data/brand-trust.json, одна строка итога
    python scripts/brand-trust.py report    # раздел отчёта, markdown в stdout

Идентичность — то ли это, что написано:
- семья двойников (одна партия, урожай или сертификат под разными
  названиями): confirmed 3, probable 2, watch 0,5 — красит бренд и без
  сегодняшних карточек (Splash, чьи пакеты сегодня не на полках по меткам);
- производитель на карточках бренда — из семьи confirmed / probable, хотя сам
  бренд в деле не назван (Superdope и The Drop у Excelsior): 2 / 1;
- пакет на отзыве по карточке: 3;
- партия, у которой карточка не называет сорт, стоит в меню под разными
  названиями: 2 — такой производитель невидим для детектора;
- меню печатает THC, а на карточке нет ни теста, ни партии (THC 0): 2, от
  трёх пакетов и трети карточек (Capital Region, MVP);
- THC меню выше сертификата при одном названии, от пяти пар: в среднем на
  1,5 и больше — 2, на 0,75 — 1 (DADA: Boofberry Zilla 27,66 против 19,6);
- перетесты (RetestPassed) на пятой части карточек: 1;
- пакеты без теста (NotSubmitted): 1;
- название меню не то, что на карточке, у половины пар: 1;
- карточка не называет сорт («Hybrid») у половины карточек: 1.

Свежесть — не лежалое ли (старый урожай у честной фермы — не обман):
- упаковано через 90+ дней после теста у половины / четверти датированных
  карточек (не меньше трёх): 2 / 1;
- урожай за год до упаковки (медиана): 1;
- на полке полгода после упаковки (медиана по позициям в наличии): 1.

Доверие — положительные признаки:
- своё производство (производитель на карточке — сам бренд или его лицензия
  по реестру) у 80 % карточек: 2;
- тест и упаковка рядом (медиана до 45 дней, старых тестов нет): 1;
- дата сбора на половине карточек цветка: 1;
- THC меню равен сертификату (до 0,5 на пяти парах и больше): 1;
- 20 магазинов и больше: 1;
- на полке до 120 дней после упаковки (медиана): 1.

Ярусы: red — идентичность 3 и больше, или 2 вместе со свежестью; yellow —
идентичность 1–2 (семья «на заметку», 0,5, видна в уликах, но яруса не
меняет); orange — только свежесть; green — ничего из этого
и доверие 3 и больше; neutral — данные есть, сигналов нет; nodata — меньше
трёх карточек и нет семьи. «Нет данных» — не «чисто».

Второй уровень — по сертификатам и меню. У 146 крупных брендов меню
печатает номера пакетов, а Retail ID на все отвечает 404: публичную карточку
производитель не включил. Для бренда, у которого карточек меньше трёх, паспорт
строится по тому, что есть без регулятора (basis «certificates»): дата
отбора пробы в сертификате по ссылке из меню (data/coa-dates.json), один
сертификат под разными названиями при одном THC, лабораторные цифры в меню.
Свежесть: проба отобрана полгода назад и раньше (медиана по позициям в
наличии, от трёх датированных) — 1, год — 2. Доверие: лабораторные цифры у
половины позиций — 1, проба свежая (до 120 дней) — 1, широкая полка — 1.
Кто вырастил и из какой партии сделано, видно только на карточке, поэтому
второй уровень не даёт зелёного: без замечаний — это neutral. Нужно от пяти
позиций с цифрами или сертификатом.

THC меню, который выше карточки в 1,10–1,17 раза, — не завышение: меню
печатает THCa вместо итогового THC (итоговый = THCa × 0,877, то есть
THCa больше в 1,14 раза). Такие пары в сравнение не идут.

Бренд — это написания, сведённые grower_of (Revert, REVERT и Revert Cannabis
— один бренд). Ярус каждого бренда хранится с историей: tierHistory, когда
он сменился; отчёт называет новые красные, переходы и крупнейшие бренды без
данных. Лаборатория — контекст, не сигнал: средний THC карточек по
лабораториям пишется отдельно (labs).

Ничто здесь не говорит о нарушении: цветок законно переупаковывают под
другими названиями. Паспорт измеряет, совпадают ли этикетка и меню с записью
регулятора, и насколько свежее то, что продают. Улика всегда рядом с выводом.
"""
import argparse
import importlib.util
import json
import re
import statistics
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LISTINGS = ROOT / "data/flower-listings.json"
RETAIL_ID = ROOT / "data/retail-id.json"
TWINS = ROOT / "data/lot-twins.json"
PRODUCERS = ROOT / "data/producers.json"
OUT = ROOT / "data/brand-trust.json"
COA_DATES = ROOT / "data/coa-dates.json"

_spec = importlib.util.spec_from_file_location("lot_twins", ROOT / "scripts/lot-twins.py")
lt = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(lt)

MIN_CARDS = 3          # паспорт — от стольких карточек Retail ID (или семья двойников)
MIN_SHELF_EVIDENCE = 5  # второй уровень — от стольких позиций с лабораторными цифрами или сертификатом
OLD_SAMPLE_DAYS = 180   # проба отобрана полгода назад и раньше
STALE_SAMPLE_DAYS = 365
FRESH_SAMPLE_DAYS = 120
THCA_RATIO = (1.10, 1.17)  # меню / карточка в этих пределах — THCa вместо итогового THC
OLD_TEST_DAYS = 90
OLD_HARVEST_DAYS = 365
STALE_SHELF_DAYS = 180
FRESH_SHELF_DAYS = 120
CLOSE_TEST_DAYS = 45
WIDE_SHOPS = 20
MIN_PAIRS = 5          # пар «позиция — карточка» для сравнения THC
TIERS = ("red", "yellow", "orange", "green", "neutral", "nodata")
TIER_RU = {"red": "красный", "yellow": "жёлтый", "orange": "оранжевый", "green": "зелёный",
           "neutral": "нейтральный", "nodata": "нет данных"}
FAMILY_WEIGHT = {"confirmed": 3, "probable": 2, "watch": 0.5}
HUB_WEIGHT = {"confirmed": 2, "probable": 1}
GENERIC = re.compile(r"^(hybrid|indica|sativa|flower|bud|smalls?|popcorn|mixed|n/?a|-)$", re.I)
NOT_OWN = {"llc", "inc", "co", "corp", "cannabis", "farms", "farm", "the", "ny", "new", "york", "company",
           "brands", "of", "and"}


def read_json(path, default):
    try:
        return json.loads(Path(path).read_text())
    except FileNotFoundError:
        return default
    except json.JSONDecodeError as e:
        print(f"  {Path(path).name}: не читается ({e}), начинаю заново", file=sys.stderr)
        return default


MICRO = re.compile(r"\(\s*micro\s*\)", re.I)


def brand_key(brand):
    """Ключ бренда: написания через grower_of, «(Micro)» — та же марка
    (Milkweed и Milkweed (Micro), Hurley Grown и Hurley Grown (Micro))."""
    return lt.grower_of(MICRO.sub("", brand or "").strip()) if brand else None


def family_key(key):
    """Ключ бренда из дела детектора — к тому же виду, что brand_key."""
    return key[:-5] if key and key.endswith("micro") and len(key) > 5 else key


def _words(text):
    return {w for w in re.findall(r"[a-z0-9]+", (text or "").lower()) if w not in NOT_OWN}


def _generic(card):
    return not card.get("strain") or bool(GENERIC.match(str(card.get("strain")).strip()))


def _median(xs):
    return int(statistics.median(xs)) if xs else None


def _share(n, d):
    return round(n / d, 2) if d else None


def build(rows, cards, retail, twins, producers, previous, today, certificates=None):
    links = retail.get("links") or {}
    certificates = certificates or {}
    known = lt.all_cards(cards, retail.get("packages"))
    entity_licence = {}
    registered = defaultdict(set)  # лицензия → бренды по реестру
    for p in producers:
        lic = p.get("licenseNumber")
        if lic and p.get("entityName"):
            entity_licence.setdefault(lt._entity_key(p["entityName"]), lic)
        for b in p.get("brands") or []:
            if lic:
                registered[lic].add(brand_key(b.get("name")) or "")

    def licence(c):
        lic = lt.license_base(c.get("manufacturerLicense") or c.get("facilityLicense"))
        if lic:
            return lic
        name = c.get("manufacturer") or c.get("facility")
        return entity_licence.get(lt._entity_key(name)) if name else None

    def maker(c):
        return c.get("manufacturer") or c.get("facility")

    # семьи двойников: бренд и лицензия → сильнейший статус
    rank = lt.STATUS_RANK
    family, hub = {}, {}
    for case in twins.get("cases") or []:
        st = case["status"]
        info = {"status": st, "producer": case["producer"],
                "strong": any((case.get("signals") or {}).get(k) for k in ("A", "B", "G", "H")),
                "verified": len(case.get("verified") or [])}
        for b in map(family_key, case.get("brandKeys") or []):
            if rank[st] > rank.get((family.get(b) or {}).get("status"), 0):
                family[b] = info
        for lic in case.get("licenses") or []:
            if rank[st] > rank.get((hub.get(lic) or {}).get("status"), 0):
                hub[lic] = info

    # партия без имени на карточке под разными названиями меню
    tag_names, tag_brands = defaultdict(set), defaultdict(set)
    for r in rows:
        b = brand_key(r.get("brand"))
        for t in lt.tags_of(r, links):
            name = (r.get("strainNameCanonical") or r.get("strainNameRaw") or "").strip()
            if name:
                tag_names[t].add(name)
            if b:
                tag_brands[t].add(b)
    batch_names, batch_tags = defaultdict(set), defaultdict(set)
    for t, c in known.items():
        if c.get("batchTag") and _generic(c) and tag_names.get(t):
            batch_names[c["batchTag"]] |= tag_names[t]
            batch_tags[c["batchTag"]].add(t)
    nameless = {}
    for bt, names in batch_names.items():
        if len(names) >= 2 and len(lt.name_clusters([((i,), [lt.norm_name(n)]) for i, n in enumerate(sorted(names))])) >= 2:
            for t in batch_tags[bt]:
                for b in tag_brands[t]:
                    nameless.setdefault(b, {})[bt] = sorted(names)

    # один сертификат (по отпечатку, иначе по адресу) — какие названия и THC под ним
    cert_names = defaultdict(set)
    for r in rows:
        url = (r.get("terpenes") or {}).get("coaUrl")
        if url:
            cert = (certificates.get(url) or {}).get("sha256") or url
            cert_names[cert].add((brand_key(r.get("brand")), (r.get("strainNameCanonical") or "").strip(), r.get("thcPercent")))
    shared_cert = defaultdict(list)
    for cert, items in cert_names.items():
        items = sorted(items, key=str)
        thc = {round(x[2], 1) for x in items if isinstance(x[2], (int, float))}
        if len(thc) <= 1 and len(lt.name_clusters([((i,), [lt.norm_name(x[1])]) for i, x in enumerate(items) if x[1]])) >= 2:
            for bk in {x[0] for x in items if x[0]}:
                shared_cert[bk].append(sorted({x[1] for x in items if x[1]}))

    B = defaultdict(lambda: {"spellings": Counter(), "listings": 0, "shops": set(), "tags": set(),
                             "pairs": [], "shelfAge": [], "panels": 0, "certs": 0, "sampleAge": []})
    for r in rows:
        key = brand_key(r.get("brand"))
        if not key or not r.get("licenseNumber"):
            continue
        b = B[key]
        b["spellings"][(r.get("brand") or "").strip()] += 1
        b["listings"] += 1
        b["shops"].add(r["licenseNumber"])
        url = (r.get("terpenes") or {}).get("coaUrl")
        b["panels"] += bool(r.get("labPanelKey"))
        b["certs"] += bool(url)
        sampled = (certificates.get(url) or {}).get("sampled") if url else None
        if sampled and r.get("inStock"):
            age = lt.days_between(today, sampled)
            if age is not None and 0 <= age < 1500:
                b["sampleAge"].append(age)
        tags = lt.tags_of(r, links)
        b["tags"].update(tags)
        for t in tags:
            if t in known:
                b["pairs"].append((r.get("strainNameCanonical") or r.get("strainNameRaw"), r.get("thcPercent"), t))
        packaged = r.get("packagedOn") or next((known[t].get("packaged") for t in tags if (known.get(t) or {}).get("packaged")), None)
        if packaged and r.get("inStock"):
            age = lt.days_between(today, packaged)
            if age is not None and 0 <= age < 1500:
                b["shelfAge"].append(age)

    makers_brands = defaultdict(set)
    passports = {}
    for key, b in B.items():
        found = [(t, known[t]) for t in sorted(b["tags"]) if t in known]
        flower = [(t, c) for t, c in found if lt.is_flower(c)]
        gaps = [g for g in (lt.days_between(c.get("packaged"), c.get("tested")) for _, c in flower) if g is not None]
        harvest_ages = [g for g in (lt.days_between(c.get("packaged"), c.get("harvested")) for _, c in flower) if g is not None]
        states = Counter(c.get("testingState") for _, c in found if c.get("testingState"))
        lics = Counter(licence(c) or maker(c) or "?" for _, c in found)
        names = Counter(maker(c) for _, c in found if maker(c))
        diffs, mismatch, compared = [], 0, 0
        menu_thc = set()
        for name, thc, t in b["pairs"]:
            c = known[t]
            card_name = c.get("strain") or c.get("product")
            if isinstance(thc, (int, float)) and thc > 0:
                menu_thc.add(t)
            same = bool(name and card_name and lt.same_name(lt.norm_name(name), lt.norm_name(card_name)))
            if name and card_name and not _generic(c):
                compared += 1
                mismatch += not same
            if (same or _generic(c)) and lt.is_flower(c) and isinstance(thc, (int, float)) and isinstance(c.get("thc"), (int, float)) and c["thc"] > 0.5:
                if THCA_RATIO[0] <= thc / c["thc"] <= THCA_RATIO[1]:
                    continue  # меню печатает THCa, а не итоговый THC
                diffs.append(round(thc - c["thc"], 2))
        no_figures = sum(1 for t, c in found if t in menu_thc and not c.get("batchTag") and (c.get("thc") or 0) <= 0.5)
        own = None
        if found:
            mine = _words(max(b["spellings"], key=b["spellings"].get))
            owned = 0
            for _, c in found:
                lic = licence(c)
                theirs = _words(maker(c))
                if (mine and theirs and len(mine & theirs) / len(mine) >= 0.5) or (lic and key in registered.get(lic, ())):
                    owned += 1
            own = round(owned / len(found), 2)
        recalls = sorted(t for t, c in found if c.get("onRecall"))
        hubs = {l: hub[l] for l in lics if l in hub}
        for l in lics:
            makers_brands[l].add(key)
        passports[key] = {
            "brand": display_name(b["spellings"]),
            "spellings": sorted(b["spellings"]),
            "listings": b["listings"], "shops": len(b["shops"]), "tags": len(b["tags"]),
            "cards": len(found), "flowerCards": len(flower),
            "producers": [n for n, _ in names.most_common(3)], "licences": [l for l, _ in lics.most_common(3)],
            "own": own, "family": family.get(key), "hubs": hubs, "recalls": recalls,
            "namelessBatches": sorted((nameless.get(key) or {}).items())[:5],
            "noFigures": no_figures, "noFiguresShare": _share(no_figures, len(found)),
            "thcPairs": len(diffs), "thcMenuMinusCard": round(statistics.mean(diffs), 2) if diffs else None,
            "thcWorst": sorted(((p[0], p[1], known[p[2]].get("thc"), p[2]) for p in b["pairs"]
                                if isinstance(p[1], (int, float)) and isinstance(known[p[2]].get("thc"), (int, float))
                                and known[p[2]]["thc"] > 0.5 and p[1] - known[p[2]]["thc"] > 1
                                and not THCA_RATIO[0] <= p[1] / known[p[2]]["thc"] <= THCA_RATIO[1]),
                               key=lambda x: -(x[1] - x[2]))[:3],
            "nameMismatch": _share(mismatch, compared), "namesCompared": compared,
            "genericShare": _share(sum(1 for _, c in found if _generic(c)), len(found)),
            "states": dict(states), "retestShare": _share(states.get("RetestPassed", 0), sum(states.values())),
            "dated": len(gaps), "oldTestShare": _share(sum(1 for g in gaps if g >= OLD_TEST_DAYS), len(gaps)),
            "testToPackageMedian": _median(gaps),
            "harvestShare": _share(len(harvest_ages), len(flower)), "harvestAgeMedian": _median(harvest_ages),
            "shelfAgeMedian": _median(b["shelfAge"]), "shelfAgeN": len(b["shelfAge"]),
            "panelShare": _share(b["panels"], b["listings"]), "certListings": b["certs"],
            "sampleAgeMedian": _median(b["sampleAge"]), "sampleAgeN": len(b["sampleAge"]),
            "sharedCertificates": shared_cert.get(key, [])[:3],
            "basis": "cards" if len(found) >= MIN_CARDS else (
                "certificates" if b["panels"] + b["certs"] >= MIN_SHELF_EVIDENCE else None),
        }
    # семьи без сегодняшних позиций по ключу тоже не теряются: бренд в деле, но не на полке — не паспорт

    for key, p in passports.items():
        top = p["licences"][0] if p["licences"] else None
        if p["hubs"] and max(rank.get(h["status"], 0) for h in p["hubs"].values()) >= 2:
            p["ownership"] = "семья двойников"
        elif p["own"] is not None and p["own"] >= 0.8:
            p["ownership"] = "своё производство"
        elif top and p["cards"] and len(makers_brands[top]) >= 2:
            p["ownership"] = "дом брендов"
        elif top and p["cards"]:
            p["ownership"] = "один производитель"
        else:
            p["ownership"] = None
        p["siblings"] = sorted(passports[k]["brand"] for k in makers_brands.get(top, ()) if k != key)[:6] if top and top != "?" else []
        p["identity"], p["identityWhy"] = identity(p)
        p["freshness"], p["freshnessWhy"] = freshness(p)
        p["trust"], p["trustWhy"] = trust(p)
        p["tier"] = tier_of(p)

    # история ярусов
    old = (previous or {}).get("brands") or {}
    for key, p in passports.items():
        hist = list((old.get(key) or {}).get("tierHistory") or [])
        if not hist or hist[-1]["tier"] != p["tier"]:
            hist.append({"day": today, "tier": p["tier"]})
        p["tierHistory"] = hist
        p["previousTier"] = (old.get(key) or {}).get("tier")

    lab_thc = defaultdict(list)
    for c in known.values():
        if isinstance(c.get("thc"), (int, float)) and c["thc"] > 0.5 and lt.is_flower(c) and c.get("lab"):
            lab_thc[c["lab"]].append(c["thc"])
    labs = {k: {"cards": len(v), "thcMean": round(statistics.mean(v), 1), "share30": _share(sum(1 for x in v if x >= 30), len(v))}
            for k, v in sorted(lab_thc.items(), key=lambda kv: -len(kv[1])) if len(v) >= 5}
    return {"day": today, "brands": passports, "labs": labs,
            "coverage": {"brands": len(passports), "withCards": sum(1 for p in passports.values() if p["cards"]),
                         "withPassport": sum(1 for p in passports.values() if p["tier"] != "nodata"),
                         "listings": sum(p["listings"] for p in passports.values()),
                         "listingsWithPassport": sum(p["listings"] for p in passports.values() if p["tier"] != "nodata")}}


def display_name(spellings):
    """Самое частое написание, но не строчными и не криком, если есть другое:
    «DADA», «Dada» и «dada» — это Dada; точка на конце не имя."""
    cased = Counter()
    for sp, n in spellings.items():
        sp = sp.rstrip(". ")
        cased[sp] += n
    ranked = sorted(cased.items(), key=lambda kv: (kv[0].islower() or kv[0].isupper(), -kv[1], kv[0]))
    return ranked[0][0] if ranked else ""


def identity(p):
    s, why = 0, []
    f = p["family"]
    if f:
        w = FAMILY_WEIGHT[f["status"]]
        s += w
        why.append(f"семья двойников {f['status']}: {f['producer']}" + (f", проверено вручную партий {f['verified']}" if f.get("verified") else ""))
    elif p["hubs"]:
        h = max(p["hubs"].values(), key=lambda h: lt.STATUS_RANK[h["status"]])
        if h["status"] in HUB_WEIGHT:
            s += HUB_WEIGHT[h["status"]]
            why.append(f"сделан производителем из семьи двойников {h['status']}: {h['producer']}")
    if p.get("sharedCertificates"):
        s += 2
        why.append(f"один сертификат под разными названиями: {' / '.join(p['sharedCertificates'][0][:3])}")
    if p["recalls"]:
        s += 3
        why.append(f"на отзыве по карточке: {len(p['recalls'])} (…{p['recalls'][0][-6:]})")
    if p["namelessBatches"]:
        s += 2
        bt, names = p["namelessBatches"][0]
        why.append(f"партия …{bt[-6:]} без имени на карточке стоит в меню как {' / '.join(names[:3])}")
    if p["noFigures"] >= 3 and (p["noFiguresShare"] or 0) >= 0.3:
        s += 2
        why.append(f"меню печатает THC, а на карточке нет ни теста, ни партии: {p['noFigures']} из {p['cards']}")
    d = p["thcMenuMinusCard"]
    if p["thcPairs"] >= MIN_PAIRS and d is not None and d >= 0.75:
        s += 2 if d >= 1.5 else 1
        ex = p["thcWorst"][0] if p["thcWorst"] else None
        why.append(f"THC в меню выше сертификата в среднем на {d} ({p['thcPairs']} пар)"
                   + (f": {ex[0]} {ex[1]} против {ex[2]}" if ex else ""))
    if (p["retestShare"] or 0) >= 0.2:
        s += 1
        why.append(f"перетесты: {int(p['retestShare'] * 100)} % карточек")
    if p["states"].get("NotSubmitted"):
        s += 1
        why.append(f"пакеты без теста: {p['states']['NotSubmitted']}")
    if p["namesCompared"] >= MIN_CARDS and (p["nameMismatch"] or 0) >= 0.5:
        s += 1
        why.append(f"название в меню не то, что на карточке: {int(p['nameMismatch'] * 100)} % пар")
    if p["cards"] >= MIN_CARDS and (p["genericShare"] or 0) >= 0.5:
        s += 1
        why.append(f"карточка не называет сорт: {int(p['genericShare'] * 100)} %")
    return s, why


def freshness(p):
    s, why = 0, []
    share = p["oldTestShare"] or 0
    if p["dated"] >= MIN_CARDS and share >= 0.25:
        s += 2 if share >= 0.5 else 1
        why.append(f"упаковано через {OLD_TEST_DAYS}+ дней после теста: {int(share * 100)} % (медиана {p['testToPackageMedian']} дн.)")
    if p["flowerCards"] >= MIN_CARDS and (p["harvestAgeMedian"] or 0) >= OLD_HARVEST_DAYS:
        s += 1
        why.append(f"урожай за {p['harvestAgeMedian']} дн. до упаковки")
    if p["shelfAgeN"] >= 5 and (p["shelfAgeMedian"] or 0) >= STALE_SHELF_DAYS:
        s += 1
        why.append(f"на полке {p['shelfAgeMedian']} дн. после упаковки")
    if p.get("basis") == "certificates" and p.get("sampleAgeN", 0) >= MIN_CARDS and (p["sampleAgeMedian"] or 0) >= OLD_SAMPLE_DAYS:
        s += 2 if p["sampleAgeMedian"] >= STALE_SAMPLE_DAYS else 1
        why.append(f"проба для сертификата отобрана {p['sampleAgeMedian']} дн. назад (медиана)")
    return s, why


def trust(p):
    s, why = 0, []
    if p["cards"] >= MIN_CARDS and (p["own"] or 0) >= 0.8:
        s += 2
        why.append("своё производство")
    if p["dated"] >= MIN_CARDS and p["testToPackageMedian"] is not None and p["testToPackageMedian"] <= CLOSE_TEST_DAYS and not p["oldTestShare"]:
        s += 1
        why.append("тест и упаковка рядом")
    if p["flowerCards"] >= MIN_CARDS and (p["harvestShare"] or 0) >= 0.5:
        s += 1
        why.append("дата сбора на карточке")
    if p["thcPairs"] >= MIN_PAIRS and abs(p["thcMenuMinusCard"] or 0) <= 0.5:
        s += 1
        why.append("THC в меню = сертификат")
    if p["shops"] >= WIDE_SHOPS:
        s += 1
        why.append(f"{p['shops']} магазинов")
    if p["shelfAgeN"] >= 5 and p["shelfAgeMedian"] is not None and p["shelfAgeMedian"] <= FRESH_SHELF_DAYS:
        s += 1
        why.append(f"на полке {p['shelfAgeMedian']} дн. после упаковки")
    if p.get("basis") == "certificates":
        if (p.get("panelShare") or 0) >= 0.5:
            s += 1
            why.append("лабораторные цифры в меню")
        if p.get("sampleAgeN", 0) >= MIN_CARDS and p["sampleAgeMedian"] is not None and p["sampleAgeMedian"] <= FRESH_SAMPLE_DAYS:
            s += 1
            why.append(f"свежий тест: {p['sampleAgeMedian']} дн. назад")
    return s, why


def tier_of(p):
    has_family = p["family"] and p["family"]["status"] in ("confirmed", "probable")
    if not p.get("basis") and not has_family and not p["recalls"]:
        return "nodata"
    if p["identity"] >= 3 or (p["identity"] >= 2 and p["freshness"] >= 1):
        return "red"
    if p["identity"] >= 1:
        return "yellow"
    if p["freshness"] >= 1:
        return "orange"
    if p["trust"] >= 3 and p.get("basis") == "cards":
        return "green"  # без карточки не видно, кто вырастил: зелёного по сертификатам нет
    return "neutral"


def write(out, path=OUT):
    brands = out["brands"]
    slim = {}
    for key, p in sorted(brands.items(), key=lambda kv: (TIERS.index(kv[1]["tier"]), -kv[1]["shops"], kv[0])):
        if p["tier"] == "nodata":
            slim[key] = {k: p[k] for k in ("brand", "spellings", "listings", "shops", "tags", "cards", "tier", "tierHistory")}
        else:
            slim[key] = {k: v for k, v in p.items() if k not in ("previousTier",)}
    doc = {
        "about": "Паспорт доверия бренда: идентичность (то ли это, что написано), свежесть и доверие по "
                 "карточкам Metrc Retail ID, меню и семьям двойников (lot-twins.json); ярусы red / yellow / "
                 "orange / green / neutral / nodata, у каждого улики словами (identityWhy, freshnessWhy, "
                 "trustWhy) и история (tierHistory). Не вывод о нарушении. Метод — docstring "
                 "scripts/brand-trust.py. Пишется после ежедневного прогона.",
        "day": out["day"], "coverage": out["coverage"],
        "tiers": dict(Counter(p["tier"] for p in brands.values())),
        "labs": out["labs"], "brands": slim,
    }
    head = json.dumps({k: v for k, v in doc.items() if k != "brands"}, ensure_ascii=False, indent=1)
    body = ",\n".join(f'  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False, separators=(",", ":"))}' for k, v in slim.items())
    path.write_text(head[:-2] + ',\n "brands": {\n' + body + ("\n" if body else "") + " }\n}\n")
    return doc


def report(doc):
    lines = ["", "### Доверие брендов", ""]
    brands = doc.get("brands") or {}
    if not brands:
        return "\n".join(lines + ["_Паспортов брендов нет._"]) + "\n"
    cov = doc.get("coverage") or {}
    tiers = Counter(p["tier"] for p in brands.values())
    by_certs = sum(1 for p in brands.values() if p["tier"] != "nodata" and p.get("basis") == "certificates")
    lines.append(f"Паспорт есть у {cov.get('withPassport', 0)} из {cov.get('brands', 0)} брендов"
                 + (f", из них {by_certs} — по сертификатам и меню, без карточки регулятора" if by_certs else "") + " "
                 f"({cov.get('listingsWithPassport', 0)} из {cov.get('listings', 0)} позиций): "
                 + ", ".join(f"{TIER_RU[t]} {tiers[t]}" for t in TIERS if tiers[t]) + ".")
    moved = [(p, p["tierHistory"][-2]["tier"]) for p in brands.values()
             if len(p.get("tierHistory") or []) >= 2 and p["tierHistory"][-1]["day"] == doc.get("day")]
    if moved:
        lines.append("- **Сменили ярус:** " + "; ".join(
            f"{p['brand']} {TIER_RU[was]} → {TIER_RU[p['tier']]}" for p, was in
            sorted(moved, key=lambda m: (TIERS.index(m[0]["tier"]), -m[0]["shops"]))[:10]))
    red = sorted((p for p in brands.values() if p["tier"] == "red"), key=lambda p: (-p["identity"], -p["shops"]))
    if red:
        lines.append(f"- **Красные ({len(red)}):**")
        for p in red[:12]:
            lines.append(f"  - **{p['brand']}** ({p['shops']} маг.; {', '.join(p['producers'][:1]) or 'производитель неизвестен'}): "
                         + "; ".join(p["identityWhy"][:3]))
        if len(red) > 12:
            lines.append(f"  - …и ещё {len(red) - 12}")
    yellow = sorted((p for p in brands.values() if p["tier"] == "yellow"), key=lambda p: -p["shops"])
    if yellow:
        lines.append(f"- **Жёлтые ({len(yellow)}):** " + "; ".join(
            f"{p['brand']} — {p['identityWhy'][0]}" for p in yellow[:6]) + ("; …" if len(yellow) > 6 else ""))
    orange = sorted((p for p in brands.values() if p["tier"] == "orange"), key=lambda p: -p["shops"])
    if orange:
        lines.append(f"- **Свежесть ({len(orange)}):** " + ", ".join(p["brand"] for p in orange[:12]) + ("…" if len(orange) > 12 else ""))
    blind = sorted((p for p in brands.values() if p["tier"] == "nodata"), key=lambda p: -p["shops"])[:8]
    if blind:
        lines.append("- Без паспорта, крупнейшие: " + ", ".join(f"{p['brand']} ({p['shops']})" for p in blind) + ".")
    return "\n".join(lines) + "\n"


def main(argv=None):
    ap = argparse.ArgumentParser(description="Паспорт доверия бренда")
    ap.add_argument("command", nargs="?", default="build", choices=["build", "report"])
    args = ap.parse_args(argv)
    if args.command == "report":
        sys.stdout.write(report(read_json(OUT, {})))
        return 0
    rows = lt._terpenes.listings_of(LISTINGS.read_text())
    retail = read_json(RETAIL_ID, {})
    twins = read_json(TWINS, {})
    producers = read_json(PRODUCERS, [])
    producers = producers if isinstance(producers, list) else producers.get("producers") or []
    today = max((r["capturedAt"][:10] for r in rows if r.get("capturedAt")), default=date.today().isoformat())
    certificates = read_json(COA_DATES, {}).get("certificates") or {}
    out = build(rows, twins.get("cards") or {}, retail, twins, producers, read_json(OUT, {}), today, certificates)
    doc = write(out)
    t = Counter(p["tier"] for p in out["brands"].values())
    print(f"{OUT.relative_to(ROOT)}: брендов {len(out['brands'])}, с паспортом {out['coverage']['withPassport']} — "
          + ", ".join(f"{TIER_RU[k]} {t[k]}" for k in TIERS if t[k]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
