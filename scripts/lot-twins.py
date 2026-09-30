#!/usr/bin/env python3
"""Одна партия — много названий: производители, которые продают один урожай
под разными сортами и брендами.

Splash (Pierre McClain LLC, OCM-MICR-25-000246; второй упаковщик Harlem
Blossoms LLC, OCM-MICR-24-000040) взял одну партию Metrc, протестированную
28 октября 2025 в Keystone (THC 26,1), и расфасовал её в марте как «Candy
Gelato», в июне как «Zeven Up», а в мае — как «The Wrap Up» под другим
брендом. Шесть брендов, 108 позиций в 23 магазинах — и один сертификат под
несколькими названиями у каждой партии. Меню этого не видят: каждое печатает
своё название и переписывает с сертификата те же цифры.

    python scripts/lot-twins.py                 # data/lot-twins.json, одна строка итога
    python scripts/lot-twins.py --no-network    # без Retail ID
    python scripts/lot-twins.py --budget 60     # не больше 60 запросов к Retail ID
    python scripts/lot-twins.py report          # раздел отчёта, markdown в stdout

Сигналы, от сильного к слабому:

- A. Одна партия Metrc (batchTag карточки Retail ID, или пакет переупакован
     из известного пакета — sourcePackage) под названиями, которые
     различаются после нормализации, при одном сертификате (THC до сотой и
     день теста сходятся) — РЕШАЮЩИЙ: партия одна по определению регулятора.
     Один номер партии при разных цифрах (у HPI Mom's Spaghetti 37,5 и GMO
     32,7 в партии 001670) — сертификаты разные, это только НА ЗАМЕТКУ.
- B. Один сертификат: та же лаборатория, тот же день теста и те же цифры THC
     и терпенов до четырёх знаков на карточках с разными названиями, пусть и
     у разных упаковщиков и партий — РЕШАЮЩИЙ: две пробы не сходятся до
     десятитысячной.
- C. Одна полная панель на полках (labPanelKey: THC и не меньше четырёх
     терпенов до сотой) под разными названиями, того же бренда или разных —
     СИЛЬНЫЙ, если панель с разными названиями видели два магазина и больше
     (одно меню могло ошибиться копированием, два независимых — нет);
     НА ЗАМЕТКУ, если один. Две панели — одна, когда THC и все общие терпены
     сходятся до сотой и общих не меньше четырёх: один магазин печатает
     пять веществ, другой — те же пять и шестое (GG4 у 420 Treez и Melody
     Makers у Young Gong). Магазин — это полка: сеть, которая держит одно
     меню на три лицензии (SHELF_SHARED_WITH_OTHER_LICENCES), считается
     одним магазином. Шаблонные магазины не в счёт: позиция с
     предупреждением TERPENE_PANEL_REPEATED_ACROSS_STRAINS и панель, которая
     в одном магазине стоит под тремя брендами и больше, — артефакт магазина.
     Панель одного магазина, у которой одно название другие магазины
     подтверждают теми же цифрами, а второе в других магазинах стоит только
     с другим THC, — магазин переписал панель первого на второе (Fyre: BX
     Runtz 32,37 и в других магазинах, Sour Joker там 28,36); такое
     название снимается, панель с одним оставшимся не случай.
     Карточка Retail ID с теми же цифрами (THC и четыре общих терпена до
     сотой) даёт панели партию, день теста и лабораторию; если панель видели
     два магазина и больше, её названия считаются названиями партии (A):
     так партия …012 «Cherry Runtz» на полках — «Candy Shop» и «03' Sour x
     Runtz».
- D. Тот же нецелый THC до сотых под разными названиями внутри семьи, у
     которой уже есть A, B или C — только ПОДТВЕРЖДАЮЩИЙ, и только если
     совпадений заметно больше, чем вышло бы случайно: у бренда с n парами
     (название, THC) на отрезке в s сотых случайных совпадений ждёшь
     n²/(2s) — у Dank By Definition 285 пар на 1578 сотых дают 26 ожидаемых
     и 27 наблюдаемых (шум), у Splash 46 пар дают 1 ожидаемое и 6
     наблюдаемых (сигнал). Считается, когда наблюдаемых больше удвоенного
     ожидаемого и не меньше трёх; иначе записывается, но не в счёт.
- E. Слабые идентификаторы (12-значные коды вроде UPC, коды, похожие на
     номер лота) под разными названиями — НА ЗАМЕТКУ, так и подписано: UPC
     ставит бренд, а не лаборатория. Код у названий с разным THC — артикул
     бренда («цветок 3,5 г»), не партия: у Find. Banana Burst 27,38 и
     Zangria 23,61 с одним кодом — разные сертификаты; такое не в счёт.
- F. Старые тесты: упаковано через 90 дней после теста и позже; сбор за
     год до упаковки и раньше, если он известен, — отдельный раздел по
     производствам («старый урожай продают как новый»), не случай двойников.
     Только цветок и прероллы: жвачки, картриджи и концентраты (по категории
     карточки, а без неё — по названию товара) не в счёт, их лежалость — про
     другое.

Один номер партии Metrc при разных сертификатах (у HPI Mom's Spaghetti 37,5
и GMO 32,7 в партии 001670) — не двойник: у упаковщика batchTag — это
производственный лот. Записывается у семьи для сведения (mixedBatches),
случая не создаёт.

«Разные названия»: строчные буквы, без знаков, без слов упаковки и сорта
товара (flower, indoor, premium, jar, 3.5g, коды полки 6-1), без имени
производителя и его линеек (data/strain-lines.json). Одно название — если
равны, одно содержит другое, редакционное расстояние не больше 2 (не больше
1 у названий короче семи знаков), слова одного нестрого совпадают со словами
другого («Candy Krush» и «Aurora - Candy Kush»), общее слово не из числа
расхожих покрывает половину короткого («Perm Chimera» и «Permanent
Chimera»), одно — аббревиатура другого («PBWY» и «Peach Be With You»), или
у них разные номера («Gelato 33» и «Gelato 41» — разные). «OG Kush» и
«Master Kush» остаются разными: расстояние 6, общее слово kush расхожее.
Правило «одно содержит другое» стоит первым и сильнее расхожих слов:
«Runtz» и «Cherry Runtz» — одно название, «Gelato» и «Gelato 41» — тоже.
Цена: «Runtz» у 420 Treez никогда не выйдет двойником «Cherry Runtz» у
Splash по одному названию, даже с теми же цифрами; варианты написания
дороже ложных двойников.

Семья производителя: бренды, которые связывает (a) напечатанная в меню метка
Metrc с карточкой Retail ID — её производство и упаковщик, (b) общая партия
или сертификат, (c) общая полная панель в двух магазинах и больше. Префикс
метки (первые 15 знаков) — это лицензия, но дистрибьютор печатает метки для
десятков брендов: префикс, который в меню стоит под четырьмя брендами и
больше, считается упаковщиком и брендов не сливает — он записывается у
случая отдельно. Семья названа производством и лицензией, если известны,
иначе брендами.

Статус семьи: confirmed — есть A или B с двумя и более названиями; probable —
C в двух магазинах, или C и значимый D; watch — C в одном магазине или
только E.

Retail ID (app.1a4.com) — то, что вскрыло Splash: карточка пакета отдаёт
партию, дату теста и упаковки, лабораторию, THC и терпены. Карточки с
цифрами хранятся здесь же, в разделе cards; data/retail-id.json (без цифр)
используется, где хватает. За прогон спрашиваются: метки из меню брендов
семей с сигналом C (за цифрами), исходные пакеты найденных карточек, а потом
соседние номера вокруг известных меток каждого префикса — ±8, ±24 у
префиксов, где соседи уже находились: производитель заводит пакеты подряд.
Ярусы: сначала префиксы семей с сигналом, потом производства, пакующие для
двух брендов и больше, потом остальные; префикс-дистрибьютор (метки под
четырьмя брендами и больше — у Dank это NYS Distribution) идёт последним,
что бы ни печатал бренд, иначе он съедает весь бюджет; карточки не цветка
(жвачки, картриджи) центрами колец не служат. Бюджет — 150 запросов за
прогон (--budget, не меньше нуля), по одному, через полсекунды; пять ошибок
подряд — остановка до следующего прогона (сервер лежит или ограничивает);
404 запоминается и переспрашивается через 30 дней; ошибка сети записывается
и не роняет прогон. Сколько спрошено и что не влезло в бюджет, пишется в
итог и отчёт — молчаливых ограничений нет.

Кэш карточек не растёт без края: 404 старше 30 дней выкидываются (их всё
равно спросили бы заново), карточки, которые не на полке и не в случае,
через 180 дней теряют терпены (даты для раздела старых тестов остаются),
а таких без терпенов держится не больше CARDS_LOOSE — старшие уходят.
Карточки пишутся по одной в строку, чтобы файл оставался под 5 МБ.
"""
import argparse
import importlib.util
import json
import re
import sys
import time
import unicodedata
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LISTINGS = ROOT / "data/flower-listings.json"
RETAIL_ID = ROOT / "data/retail-id.json"
PRODUCERS = ROOT / "data/producers.json"
COVERAGE = ROOT / "data/menu-coverage.json"
HISTORY = ROOT / "data/shelf-history.json"
LINES = ROOT / "data/strain-lines.json"
OUT = ROOT / "data/lot-twins.json"
API = "https://app.1a4.com/api/landingpage/data"
TAG = re.compile(r"^1A4[0-9A-F]{21}$")
LINK = re.compile(r"^https://1a4\.com/(\S+)$", re.I)

BUDGET = 150          # запросов к Retail ID за прогон
PACE = 0.5            # секунд между запросами
NEIGHBOURS = 8        # соседних номеров вокруг известной метки
NEIGHBOURS_HOT = 24   # у префикса, где соседи уже находились
RECHECK_DAYS = 30     # 404 переспрашивается через столько дней
OLD_TEST_DAYS = 90    # упаковано через столько дней после теста — старый тест
OLD_HARVEST_DAYS = 365
TEMPLATE_BRANDS = 3   # панель под столькими брендами в одном магазине — шаблон магазина
WIDE_PACKAGER = 4     # префикс под столькими брендами в меню — упаковщик, брендов не сливает
PANEL_COMPOUNDS = 4   # общих терпенов до сотой, чтобы две панели (или карточка и панель) были одной
THC_TWINS_MIN = 3     # D в счёт: совпадений не меньше стольких и больше удвоенного ожидаемого
ERRORS_IN_ROW = 5     # столько ошибок подряд — зондирование останавливается
CARDS_KEEP_DAYS = 180  # карточка не на полке и не в случае держит терпены столько дней
CARDS_LOOSE = 4000    # столько карточек без терпенов держится, старшие уходят
STRIPPED = "TERPENE_PANEL_REPEATED_ACROSS_STRAINS"
SHARED = "SHELF_SHARED_WITH_OTHER_LICENCES"
# Не цветок — по названию товара, когда карточка не говорит категории.
NON_FLOWER = re.compile(r"gumm|edible|chocolate|\bchews?\b|candy bar|vape|\bcarts?\b|cartridge|dispos|tincture|"
                        r"capsule|beverage|drink|seltzer|rosin|\bhash\b|concentrate|badder|\bresin\b|\bsauce\b|"
                        r"\bdiamonds\b|infused|\b\d+\s*mg\b|\d+\s*:\s*\d+", re.I)
FLOWER_CATEGORY = re.compile(r"bud|flower|pre.?roll|shake|trim", re.I)
STATUS_RANK = {"watch": 1, "probable": 2, "confirmed": 3}


def _load(name):
    spec = importlib.util.spec_from_file_location(name.replace("-", "_"), ROOT / f"scripts/{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


_terpenes = _load("shelf-terpenes")
grower_of = _terpenes.grower_of
_retail = _load("retail-id")

# ---------------------------------------------------------------- названия

# Слова упаковки и сорта товара — не название сорта.
PACKAGING = {
    "flower", "flowers", "bud", "buds", "indoor", "outdoor", "greenhouse", "hydroponic",
    "hydroponics", "premium", "small", "smalls", "batch", "jar", "jars", "bag",
    "bags", "pack", "packs", "xl", "eighth", "eighths", "oz", "ounce", "gram", "grams", "g",
    "gm", "gr", "half", "quarter", "sativa", "indica", "hybrid", "gold", "classic", "cuts",
    "standard", "limited", "edition", "collection", "living", "soil", "sun", "grown",
    "sungrown", "craft", "top", "shelf", "tier", "select", "exotic", "exotics", "micro",
    "mini", "large", "bulk", "whole", "popcorn", "shake", "trim", "prepack", "preroll",
}
STOPWORDS = {"the", "a", "an", "of", "and", "n", "x", "by", "with", "in"}
# Расхожие слова сортов: общее такое слово не делает названия одним сортом
# («Cherry Runtz» и «Runtz» — не одно, «Candy Shop» и «Candy Gelato» — не одно).
GENERIC = {
    "kush", "og", "gelato", "cake", "cookies", "cookie", "haze", "diesel", "dream", "punch",
    "sherb", "sherbet", "sherbert", "mints", "mintz", "mint", "glue", "candy", "cream",
    "creme", "cheese", "berry", "berries", "lemon", "lime", "sour", "purple", "blue",
    "white", "black", "pink", "gas", "fuel", "breath", "pie", "cherry", "grape", "grapes",
    "apple", "banana", "mango", "orange", "strawberry", "blueberry", "chem", "skunk", "widow",
    "crack", "mac", "zkittlez", "skittlez", "pop", "popz", "sunset", "fire", "ice", "super",
    "jack", "girl", "scout", "bubba", "animal", "gorilla", "wedding", "dosi", "dosidos",
    "gushers", "gusherz", "biscotti", "zushi", "runtz", "runts", "fruity", "tropical", "gummy",
    "gummies", "peach", "peaches", "vanilla", "chocolate", "cotton", "bubblegum", "tangie",
    "citrus", "sugar", "frost", "frosted", "glazed", "cap", "caps", "cookies", "kushmints",
    "trainwreck", "sherbs", "guava", "papaya", "melon", "watermelon", "lemonade", "jealousy",
}
WEIGHTS = re.compile(r"\b\d+(?:\.\d+)?\s*(?:g|gm|gr|grams?|oz|mg)\b|\b1/[248]\b|\b(?:3\.5|7|14|28)\s*$")
SHELF_CODE = re.compile(r"\[?\b\d{1,2}-\d{1,2}\b\]?")


def _fold(text):
    text = re.sub(r"[̀-ͯ]", "", unicodedata.normalize("NFKD", str(text or ""))).lower()
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def norm_name(name, brand=None, lines=()):
    """Название → (сжатая строка, множество слов) для сравнения.

    Снимаются: имя производителя в начале и между тире («Wizard Trees Nebula»,
    «TTM - Blue Dream»), его линейки из data/strain-lines.json, слова упаковки
    и веса, коды полки, знаки. «Bonfire (Ice Cream Cake) - Limited Edition
    Summer» → («bonfireicecreamcake», {bonfire, ice, cream, cake})."""
    text = str(name or "")
    for line in lines or ():
        text = re.sub(r"(?<![a-z0-9])" + re.escape(str(line).lower()) + r"(?![a-z0-9])", " ", text.lower())
    text = SHELF_CODE.sub(" ", WEIGHTS.sub(" ", text.lower()))
    grower = grower_of(brand) if brand else None
    parts = [p for p in re.split(r"\s+[-–—:|]\s+|\s*\(|\)\s*|\s*/\s*", text) if p and p.strip()]
    words = []
    for part in parts:
        ws = _fold(part).split()
        if grower and ws:
            # Имя производителя в начале фрагмента: «Golden Garden Superboof»
            for n in range(min(3, len(ws)), 0, -1):
                if grower_of(" ".join(ws[:n])) == grower:
                    ws = ws[n:]
                    break
            if ws and grower_of(" ".join(ws)) == grower:
                ws = []
        words.extend(ws)
    kept = [w for w in words if w not in PACKAGING and w not in STOPWORDS]
    return "".join(kept), set(kept), [w for w in words if w not in PACKAGING]


def distance(a, b):
    """Редакционное расстояние Левенштейна."""
    if a == b:
        return 0
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def _token_match(w, others):
    """То же слово: равно, в одной букве («krush»/«kush») или сокращение («fed»/«federal», «perm»/«permanent»)."""
    for o in others:
        if w == o or (min(len(w), len(o)) >= 4 and max(len(w), len(o)) >= 5 and distance(w, o) <= 1):
            return True
        short, long_ = (w, o) if len(w) < len(o) else (o, w)
        if len(short) >= 3 and short not in GENERIC and long_.startswith(short):
            return True
    return False


def same_name(a, b):
    """Одно ли это название, записанное по-разному. a, b — из norm_name."""
    ca, wa = a[0], a[1]
    cb, wb = b[0], b[1]
    if not ca or not cb:
        return True  # без названия — нечего различать
    if ca == cb or ca in cb or cb in ca:
        return True
    da, db = re.findall(r"\d+", ca), re.findall(r"\d+", cb)
    if da and db and da != db:
        return False  # «Gelato 33» и «Gelato 41»
    d = distance(ca, cb)
    short, long_ = (ca, cb) if len(ca) <= len(cb) else (cb, ca)
    if d <= (1 if len(short) < 7 else 2):
        return True
    ws, wl = (wa, wb) if len(wa) <= len(wb) else (wb, wa)
    if ws and all(_token_match(w, wl) for w in ws):
        return True  # «Candy Krush» в «Aurora - Candy Kush»
    shared = {w for w in ws if len(w) >= 4 and w not in GENERIC and _token_match(w, wl)}
    if shared and len(shared) * 2 >= len(ws):
        return True  # «Perm Chimera» и «Permanent Chimera»
    ordered = (a if len(a[0]) > len(b[0]) else b)[2] if len(a) > 2 and len(b) > 2 else []
    if len(ordered) >= 3 and "".join(w[0] for w in ordered) == short:
        return True  # «PBWY» и «Peach Be With You»
    return False


def name_clusters(items):
    """[(ключ, [варианты norm_name])] → список кластеров ключей, где все варианты — одно название."""
    keys = [k for k, _v in items]
    parent = list(range(len(items)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            if find(i) != find(j) and any(same_name(x, y) for x in items[i][1] for y in items[j][1]):
                parent[find(i)] = find(j)
    groups = defaultdict(list)
    for i, k in enumerate(keys):
        groups[find(i)].append(k)
    return list(groups.values())


# ---------------------------------------------------------------- карточки

def license_base(lic):
    """«OCM-MICR-24-000040-DX1» → «OCM-MICR-24-000040»: суффикс площадки не лицензия."""
    return re.sub(r"-[A-Z]+\d*$", "", str(lic).strip().upper()) if lic else None


def compact_card(data):
    """Сырая карточка Retail ID → только то, что нужно: даты, партия, цепочка, цифры."""
    coa = (data.get("coaCard") or {}).get("data") or {}
    while isinstance(coa, str):
        coa = json.loads(coa)
    if isinstance(coa, list):
        coa = coa[0] if coa else {}
    if not isinstance(coa, dict):
        coa = {}  # «null» в coaCard: пакет заведён, сертификата нет
    terpenes = {}
    for key, t in (coa.get("terpenes") or {}).items():
        if isinstance(t, dict) and isinstance(t.get("percent"), (int, float)) and t["percent"] > 0:
            terpenes[str(t.get("label") or key)] = round(float(t["percent"]), 4)
    totals = coa.get("totals") or {}
    thc = (totals.get("thc") or {}).get("percent")
    if thc is None:
        thc = ((coa.get("unit") or {}).get("thc") or {}).get("percent")
    manufacturer = coa.get("manufacturer") or {}
    return {
        "found": True,
        "facility": data.get("facilityName"),
        "facilityLicense": data.get("facilityLicense"),
        "product": (data.get("productCard") or {}).get("productName") or coa.get("productName") or coa.get("title"),
        "strain": coa.get("strainName") or coa.get("strain") or (data.get("productCard") or {}).get("strain"),
        "packaged": _retail.day(coa.get("packagedDate") or coa.get("packageDate")),
        "tested": _retail.day(coa.get("testedDate") or coa.get("dateTested")),
        "harvested": _retail.day(coa.get("harvestDate")),
        "lab": (coa.get("lab") or {}).get("name"),
        "batchTag": coa.get("batchTag"),
        "sourcePackage": coa.get("sourcePackage"),
        "lotNumber": coa.get("lotNumber"),
        "manufacturer": manufacturer.get("name"),
        "manufacturerLicense": manufacturer.get("licenseNumber"),
        "receivedFrom": coa.get("receivedFromFacilityName"),
        "receivedFromLicense": coa.get("receivedFromFacilityLicenseNumber"),
        "category": coa.get("category"),
        "thc": round(float(thc), 4) if isinstance(thc, (int, float)) else None,
        "cbd": (totals.get("cbd") or {}).get("percent"),
        "totalTerpenes": (totals.get("terpenes") or {}).get("percent"),
        "terpenes": dict(sorted(terpenes.items(), key=lambda kv: -kv[1])),
    }


def is_flower(card):
    """Цветок ли пакет: по категории карточки, без неё — по названию товара."""
    cat = card.get("category")
    if cat:
        return bool(FLOWER_CATEGORY.search(str(cat)))
    text = " ".join(str(card.get(k) or "") for k in ("product", "strain"))
    return not NON_FLOWER.search(text)


def days_between(later, earlier):
    """Дней между двумя датами ISO; None, если дата кривая («2026-99-99» с карточки не роняет прогон)."""
    try:
        return (date.fromisoformat(later) - date.fromisoformat(earlier)).days
    except (TypeError, ValueError):
        return None


def compound_key(label):
    """Терпен карточки → имя в labPanelKey: «βCaryophyllene» → CARYOPHYLLENE,
    «βPinene» → PINENE_BETA, «CaryophylleneOxide» → CARYOPHYLLENE_OXIDE.
    Изомер различают только у пинена, как и сборщик."""
    text = str(label or "")
    greek = "ALPHA" if text.startswith(("α", "alpha", "Alpha")) else "BETA" if text.startswith(("β", "beta", "Beta")) else None
    core = re.sub(r"^(alpha|beta|gamma|trans|cis)[- ]?", "", re.sub(r"[αβγδ]", "", text), flags=re.I)
    core = re.sub(r"(?<=[a-z])(?=[A-Z])", "_", re.sub(r"[^A-Za-z]", "", core)).upper()
    if core == "PINENE" and greek:
        core += "_" + greek
    return core


def panel_of(thc, terpenes):
    """Цифры карточки в виде панели полки: (THC до сотой, {терпен: до сотой})."""
    if not isinstance(thc, (int, float)) or thc <= 0:
        return None
    out = {}
    for label, v in (terpenes or {}).items():
        key = compound_key(label)
        if key and key not in ("OTHER", "TOTAL_TERPENES") and isinstance(v, (int, float)) and v > 0:
            out[key] = max(out.get(key, 0), round(float(v), 2))
    return (round(float(thc), 2), out) if len(out) >= PANEL_COMPOUNDS else None


def parse_panel(key):
    """labPanelKey → (THC, {терпен: доля})."""
    parts = key.split("|")
    thc = float(parts[0][4:])
    return thc, {p.split(":")[0]: float(p.split(":")[1]) for p in parts[1:]}


def panels_match(a, b):
    """Одна ли это панель: THC равен, общих терпенов не меньше PANEL_COMPOUNDS
    и все общие сходятся до сотой. Один магазин печатает пять веществ, другой
    те же пять и шестое — панель одна; четыре общих до сотой у чужих партий
    не сходятся (тот же порог, что у сборщика для labPanelKey)."""
    if a is None or b is None or abs(a[0] - b[0]) > 1e-9:
        return False
    common = a[1].keys() & b[1].keys()
    return len(common) >= PANEL_COMPOUNDS and all(abs(a[1][k] - b[1][k]) < 1e-9 for k in common)


def panel_groups(keys):
    """Ключи панелей → {ключ: ключ-представитель}: панели, сходящиеся по
    panels_match, — одна группа. Жадно, по убыванию числа веществ, и только в
    группу, с каждым членом которой панель сходится: короткая панель не
    склеит две длинные, расходящиеся в веществах, которых у короткой нет."""
    by_thc = defaultdict(list)
    parsed = {}
    for key in keys:
        parsed[key] = parse_panel(key)
        by_thc[parsed[key][0]].append(key)
    rep = {}
    for thc, ks in by_thc.items():
        groups = []  # [(представитель, [члены])]
        for key in sorted(ks, key=lambda k: (-len(parsed[k][1]), k)):
            for g in groups:
                if all(panels_match(parsed[key], parsed[m]) for m in g[1]):
                    g[1].append(key)
                    rep[key] = g[0]
                    break
            else:
                groups.append((key, [key]))
                rep[key] = key
    return rep


def fetch_card(tag):
    """Карточка пакета с Retail ID: found=True с цифрами, found=False — 404, found=None — ошибка."""
    try:
        body, code = _retail.curl(f"{API}?id={tag.lower()}&index=0")
    except Exception as e:  # curl не запустился
        return {"found": None, "error": str(e)[:80]}
    if code == "404":
        return {"found": False}
    if code != "200":
        return {"found": None, "error": f"HTTP {code}"}
    try:
        return compact_card(json.loads(body))
    except Exception as e:  # незнакомая форма карточки — ошибка, не падение
        return {"found": None, "error": f"bad card: {type(e).__name__} {str(e)[:60]}"}


def all_cards(cards, retail_packages):
    """Карточки с цифрами (свои) и без (data/retail-id.json) — одним словарём."""
    out = {}
    for tag, p in (retail_packages or {}).items():
        if p.get("found"):
            out[tag.upper()] = dict(p)
    for tag, c in (cards or {}).items():
        if c.get("found"):
            out[tag.upper()] = c
    return out


# ---------------------------------------------------------------- листинги

def tags_of(row, links):
    """Метки Metrc позиции: напечатанные и по ссылкам Retail ID."""
    out = []
    for t in row.get("packageIds") or []:
        t = str(t).strip()
        if LINK.match(t):
            t = links.get(t) or links.get(t.upper()) or ""
        t = t.upper()
        if TAG.match(t):
            out.append(t)
    return out


def codes_of(row):
    """Слабые идентификаторы: 12-значные коды и коды, похожие на номер лота."""
    out = []
    for t in row.get("packageIds") or []:
        t = str(t).strip()
        if TAG.match(t.upper()) or LINK.match(t):
            continue
        if re.fullmatch(r"\d{12}", t) or (re.fullmatch(r"[A-Za-z0-9-]{6,20}", t) and re.search(r"\d", t)
                                          and re.search(r"[A-Za-z]", t)):
            out.append(t.upper())
    return out


def variants(row, lines):
    """Варианты нормализованного названия позиции: по каноническому и по сырому."""
    brand = row.get("brand")
    own = lines.get(row.get("brandKey") or "") or ()
    seen, out = set(), []
    for name in (row.get("strainNameCanonical"), row.get("strainNameRaw")):
        if name:
            v = norm_name(name, brand, own)
            if v[0] not in seen:
                seen.add(v[0])
                out.append(v)
    return out or [("", set(), [])]


def display_name(row):
    return (row.get("strainNameCanonical") or row.get("strainNameRaw") or "").strip()


class Families:
    """Объединение брендов и лицензий в семьи производителей."""

    def __init__(self):
        self.parent = {}

    def find(self, x):
        self.parent.setdefault(x, x)
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            # Корень — по возможности лицензия: устойчивее к переименованию брендов.
            if rb.startswith("f:") and not ra.startswith("f:"):
                ra, rb = rb, ra
            self.parent[rb] = ra


def _entity_key(name):
    """Имя юрлица без формы и знаков: «PharmaCann of New York, LLC» = «Pharmacann of New York LLC»."""
    return "".join(w for w in _fold(name).split() if w not in {"llc", "inc", "corp", "co", "ltd", "the", "l", "p", "c"})


def _distinct(gaps):
    """Пакеты одной партии с одними датами — одна строка в отчёте."""
    seen, out = set(), []
    for g in gaps:
        key = (g.get("name"), g.get("tested") or g.get("harvested"), g.get("packaged"))
        if key not in seen:
            seen.add(key)
            out.append(g)
    return out


def build(rows, cards, retail, previous, producers, coverage, history, lines, today):
    """Разбор без сети: сигналы, семьи, случаи, слияние с прошлым, старые тесты."""
    links = {k.upper(): v for k, v in (retail.get("links") or {}).items()}
    known = all_cards(cards, retail.get("packages"))
    shop_name = lambda lic: (coverage.get(lic) or {}).get("shop") or lic
    entity = {p.get("licenseNumber"): p.get("entityName") for p in producers if p.get("licenseNumber")}
    # data/retail-id.json хранит производство по имени, без лицензии: имя ищется в реестре
    by_entity = defaultdict(set)
    for lic, name in entity.items():
        by_entity[_entity_key(name)].add(lic)
    for c in known.values():
        if not c.get("facilityLicense") and c.get("facility"):
            lics = by_entity.get(_entity_key(c["facility"]))
            if lics and len(lics) == 1:
                c["facilityLicense"] = next(iter(lics))

    def brand_key(row):
        return grower_of(row.get("brand")) or (row.get("brandKey") or "").lower() or None

    # Позиция без лицензии магазина ничему не принадлежит — не в счёт.
    rows = [r for r in rows if r.get("licenseNumber")]
    # Полка, а не лицензия: сеть держит одно меню на несколько лицензий
    # (Gotham — три, Flynnstoned — три), и их позиции совпадают байт в байт.
    # Такая полка считается одним магазином — младшей из лицензий, — иначе
    # одно скопированное меню сошло бы за два независимых.
    shared_licenses = defaultdict(set)
    for row in rows:
        if SHARED in (row.get("warnings") or []):
            url = ((row.get("sources") or [{}])[0] or {}).get("url")
            if url:
                shared_licenses[url].add(row["licenseNumber"])

    def shelf_of(row):
        if SHARED in (row.get("warnings") or []):
            url = ((row.get("sources") or [{}])[0] or {}).get("url")
            if url and shared_licenses.get(url):
                return min(shared_licenses[url])
        return row["licenseNumber"]

    def brand_name(b):
        # Самое частое написание; точка на конце («Dank By Definition.») — не имя.
        folded = Counter()
        for spelling, n in brand_spellings[b].items():
            folded[spelling.rstrip(". ")] += n
        return folded.most_common(1)[0][0] if folded else b

    # --- бренды, метки, ширина префиксов
    listing_tags = defaultdict(list)     # tag → [row]
    prefix_brands = defaultdict(Counter)  # prefix → brand key → позиций
    brand_prefix_tags = defaultdict(set)  # (brand key, prefix) → метки
    brand_rows = defaultdict(list)
    brand_spellings = defaultdict(Counter)
    for row in rows:
        b = brand_key(row)
        if not b:
            continue
        brand_rows[b].append(row)
        brand_spellings[b][(row.get("brand") or "").strip()] += 1
        for tag in tags_of(row, links):
            listing_tags[tag].append(row)
            prefix_brands[tag[:15]][b] += 1
            brand_prefix_tags[(b, tag[:15])].add(tag)
    wide = {p for p, c in prefix_brands.items() if len(c) >= WIDE_PACKAGER}
    prefix_license = {}
    license_name = defaultdict(Counter)
    for tag, c in known.items():
        lic = license_base(c.get("facilityLicense"))
        if lic:
            prefix_license.setdefault(tag[:15], lic)
            license_name[lic][c.get("facility")] += 1
        for name, field in ((c.get("manufacturer"), "manufacturerLicense"), (c.get("receivedFrom"), "receivedFromLicense")):
            l2 = license_base(c.get(field))
            if l2 and name:
                license_name[l2][name] += 1
    for lic, name in entity.items():
        license_name.setdefault(lic, Counter())
    wide_licenses = {prefix_license[p] for p in wide if p in prefix_license}

    def narrow(lic):
        return lic and lic not in wide_licenses

    fam = Families()
    packagers = defaultdict(set)  # brand → широкие лицензии/префиксы, чьи метки печатает

    # (a) метка в меню → производство карточки. Одна метка без карточки —
    # не связь: Strain Gang в одном магазине напечатан с меткой Harlem
    # Blossoms, которой в Retail ID нет; нужны две позиции или карточка.
    for prefix, brands in prefix_brands.items():
        lic = prefix_license.get(prefix)
        for b, n in brands.items():
            if prefix in wide:
                packagers[b].add(lic or prefix)
            elif lic and (n >= 2 or any(t in known for t in brand_prefix_tags[(b, prefix)])):
                fam.union(f"b:{b}", f"f:{lic}")

    def card_names(tag):
        """Название сорта карточки; артикул (product, «SCC201-TWU») — только если сорта нет:
        артикул один на все пакеты партии и спрятал бы разные сорта."""
        c = known[tag]
        name = c.get("strain") or c.get("product")
        return [norm_name(name)] if name else [("", set(), [])]

    def card_licenses(c):
        out = {license_base(c.get("facilityLicense")), license_base(c.get("manufacturerLicense"))}
        src = str(c.get("sourcePackage") or "").upper()
        if src:
            out.add(prefix_license.get(src[:15]))
        return {l for l in out if l}

    # --- B: сертификаты
    cert_members = defaultdict(list)
    for tag, c in known.items():
        if c.get("tested") and c.get("lab") and isinstance(c.get("thc"), (int, float)) and len(c.get("terpenes") or {}) >= 3:
            key = (c["lab"], c["tested"], round(c["thc"], 4),
                   tuple(sorted((k, round(v, 4)) for k, v in c["terpenes"].items())))
            cert_members[key].append(tag)
    certificates = {}
    for key, tags in cert_members.items():
        clusters = name_clusters([(t, card_names(t)) for t in tags])
        if len(clusters) >= 2:
            certificates[key] = {"tags": sorted(tags), "clusters": clusters}
            lics = [l for t in tags for l in card_licenses(known[t]) if narrow(l)]
            brands = [brand_key(r) for t in tags for r in listing_tags.get(t, [])]
            for x in lics[1:]:
                fam.union(f"f:{lics[0]}", f"f:{x}")
            for b in brands:
                if b:
                    fam.union(f"b:{b}", f"f:{lics[0]}" if lics else f"b:{brands[0]}")

    # --- C: панели на полках
    by_panel = defaultdict(list)
    shop_panel_brands = defaultdict(set)
    excluded = Counter()
    pasted = []
    for row in rows:
        key = row.get("labPanelKey")
        if key and brand_key(row):
            shop_panel_brands[(shelf_of(row), key)].add(brand_key(row))
    for row in rows:
        b = brand_key(row)
        if not b:
            continue
        if STRIPPED in (row.get("warnings") or []):
            # сборщик снял панель как шаблон магазина: считается до проверки
            # ключа — ключа у такой позиции уже нет
            excluded["stripped"] += 1
            continue
        key = row.get("labPanelKey")
        if not key:
            continue
        if len(shop_panel_brands[(shelf_of(row), key)]) >= TEMPLATE_BRANDS:
            excluded["template"] += 1
            continue
        by_panel[key].append(row)
    template_shops = {lic for (lic, _k), bs in shop_panel_brands.items() if len(bs) >= TEMPLATE_BRANDS}
    # одна панель, напечатанная с разным числом веществ, — одна группа
    rep = panel_groups(by_panel)
    by_group, group_keys = defaultdict(list), defaultdict(set)
    for key, rs in by_panel.items():
        by_group[rep[key]].extend(rs)
        group_keys[rep[key]].add(key)

    hist_first = {}
    for k, pairs in (history.get("thc") or {}).items():
        for thc, day in pairs:
            hist_first[(k, float(thc))] = day

    def first_seen(row):
        k = _terpenes._history.key_of(row)
        thc = row.get("thcPercent")
        day = row["capturedAt"][:10] if row.get("capturedAt") else today
        if k and isinstance(thc, (int, float)):
            return min(day, hist_first.get((k, float(thc)), day))
        return day

    def row_order(r):
        return (r["licenseNumber"], r.get("brand") or "", display_name(r), str(r.get("thcPercent")))

    def named_entries(group_rows):
        """Позиции → кластеры названий → [{brand, name, shops…}], по одному на кластер и бренд."""
        group_rows = sorted(group_rows, key=row_order)  # порядок кластеров не зависит от прогона
        items = [(i, variants(r, lines)) for i, r in enumerate(group_rows)]
        clusters = name_clusters(items)
        entries = []
        for cluster in clusters:
            per_brand = defaultdict(list)
            for i in cluster:
                per_brand[brand_key(group_rows[i])].append(group_rows[i])
            for b, rs in per_brand.items():
                names = Counter(display_name(r) for r in rs)
                entries.append({
                    "brand": brand_name(b),
                    "brandKey": b,
                    "name": names.most_common(1)[0][0],
                    "shops": sorted({shelf_of(r) for r in rs}),
                    "firstSeen": min(first_seen(r) for r in rs),
                    "lastSeen": max((r["capturedAt"][:10] for r in rs if r.get("capturedAt")), default=today),
                    "_cluster": id(cluster),
                    "_variants": [v for r in rs for v in variants(r, lines)],
                })
        return entries, len(clusters)

    def elsewhere(entry, shelf, thc, keys):
        """Что то же название того же бренда печатают другие полки: «same» —
        те же цифры (панель или THC), «different» — только другой THC, None —
        нигде больше нет."""
        same, other = False, set()
        for r in brand_rows.get(entry["brandKey"], []):
            if shelf_of(r) == shelf:
                continue
            if not any(same_name(v, w) for v in entry["_variants"] for w in variants(r, lines)):
                continue
            t = r.get("thcPercent")
            if r.get("labPanelKey") in keys or (isinstance(t, (int, float)) and abs(round(t, 2) - thc) < 1e-9):
                same = True
            elif isinstance(t, (int, float)):
                other.add(round(t, 2))
        return "same" if same else ("different" if other else None), sorted(other)

    panels = {}
    for key, group_rows in by_group.items():
        entries, n = named_entries(group_rows)
        if n < 2:
            continue
        thc = parse_panel(key)[0]
        # Название, которое с этой панелью стоит на одной полке, а на других
        # полках — только с другим THC, тогда как другое название панели
        # другие полки подтверждают (те же цифры там, или та же панель на двух
        # полках), — магазин переписал панель первого на второе (Fyre: BX
        # Runtz 32,37 и в другом магазине, Sour Joker там 28,36). Такое
        # название снимается и записывается; панель с одним оставшимся —
        # не случай. Цена: бренд, который одно имя даёт двум партиям, может
        # потерять имя с панели — оно останется в D.
        marks = {id(e): elsewhere(e, e["shops"][0], thc, group_keys[key]) if len(e["shops"]) == 1 else ("same", [])
                 for e in entries}
        contradicted = []
        if any(m[0] == "same" for m in marks.values()):
            contradicted = [{"brand": e["brand"], "name": e["name"], "shop": shop_name(e["shops"][0]),
                             "thcElsewhere": marks[id(e)][1]} for e in entries if marks[id(e)][0] == "different"]
            entries = [e for e in entries if marks[id(e)][0] != "different"]
            n = len({e["_cluster"] for e in entries})
            if n < 2:
                excluded["pasted"] += 1
                pasted.append({"shop": contradicted[0]["shop"], "thc": thc,
                               "kept": [f"{e['brand']}: {e['name']}" for e in entries],
                               "dropped": [f"{c['brand']}: {c['name']} (THC в других магазинах "
                                           f"{', '.join(map(str, c['thcElsewhere']))})" for c in contradicted]})
                continue
        shelves = {s for e in entries for s in e["shops"]}
        panels[key] = {"panelKey": key, "panelKeys": sorted(group_keys[key]), "names": entries,
                       "shops": len(shelves), "strength": "strong" if len(shelves) >= 2 else "watch",
                       "contradicted": contradicted, "cards": []}
        if len(shelves) >= 2:
            brands = sorted({e["brandKey"] for e in entries})
            for b in brands[1:]:
                fam.union(f"b:{brands[0]}", f"b:{b}")

    # Карточка Retail ID с цифрами панели (THC и четыре общих терпена до
    # сотой): панель получает партию, день теста и лабораторию — то, по чему
    # человек проверит, — а партия (ниже, A) — названия с полок.
    card_panel = {t: panel_of(c.get("thc"), c.get("terpenes")) for t, c in known.items()}
    cards_by_thc = defaultdict(list)
    for t, pp in card_panel.items():
        if pp:
            cards_by_thc[pp[0]].append(t)
    tag_panels = defaultdict(list)  # tag → [ключ панели]
    for key, p in panels.items():
        parsed = parse_panel(key)
        for t in sorted(cards_by_thc.get(parsed[0], [])):
            if panels_match(card_panel[t], parsed):
                c = known[t]
                p["cards"].append({"tag": t, "name": c.get("strain") or c.get("product"), "batch": c.get("batchTag"),
                                   "facility": c.get("facility"), "packaged": c.get("packaged"),
                                   "tested": c.get("tested"), "lab": c.get("lab")})
                tag_panels[t].append(key)
                if p["shops"] >= 2:
                    lics = [l for l in card_licenses(c) if narrow(l)]
                    for e in p["names"]:
                        if lics:
                            fam.union(f"b:{e['brandKey']}", f"f:{lics[0]}")

    # --- A: партии Metrc. Одна партия — один batchTag; пакет, переупакованный
    # из известного пакета (sourcePackage — карточка), — та же партия. Общий
    # исходный пакет двух карточек с разными batchTag — не партия: у HPI
    # Strawberry Diesel и Chocolate Diesel вышли из одного пакета, но
    # тестированы врозь (THC 32,2 и 31,4) — это два сертификата.
    chain = Families()
    for tag, c in known.items():
        batch = str(c.get("batchTag") or "").upper()
        if TAG.match(batch):
            chain.union(f"t:{tag}", f"t:{batch}")
        source = str(c.get("sourcePackage") or "").upper()
        if TAG.match(source) and source in known:
            chain.union(f"t:{tag}", f"t:{source}")
    batch_members = defaultdict(list)
    for tag in sorted(known):
        batch_members[chain.find(f"t:{tag}")].append(tag)

    def batch_id(tags):
        batches = sorted({known[t]["batchTag"] for t in tags if known[t].get("batchTag")})
        return batches[0] if batches else sorted(tags)[0]

    def one_certificate(tags):
        """Карточки партии показывают один сертификат: THC сходится до сотой и день
        теста один, где они известны. У HPI batchTag 001670 стоит под Mom's
        Spaghetti (THC 37,5) и GMO (32,7): партия одна по номеру, сертификаты
        разные — это не двойник, а вопрос к партии."""
        thc = {round(known[t]["thc"], 2) for t in tags if isinstance(known[t].get("thc"), (int, float))}
        tested = {known[t]["tested"] for t in tags if known[t].get("tested")}
        return len(thc) <= 1 and len(tested) <= 1

    def shelf_names(tags):
        """Названия с полок для партии: записи панелей, чьи цифры сошлись с
        карточкой партии и которые видели два магазина и больше (одна полка
        могла переписать панель на чужое название)."""
        out, seen = [], set()
        for t in tags:
            for key in tag_panels.get(t, ()):
                p = panels[key]
                if p["shops"] < 2:
                    continue
                for e in p["names"]:
                    k = (e["brandKey"], e["name"])
                    if k not in seen:
                        seen.add(k)
                        out.append({"brand": e["brand"], "brandKey": e["brandKey"], "name": e["name"],
                                    "shops": e["shops"], "panelKey": key, "via": "shelf"})
        return out

    batches, mixed = {}, {}
    for root, tags in batch_members.items():
        items = [(t, card_names(t)) for t in tags]
        on_shelf = shelf_names(tags) if one_certificate(tags) else []
        items += [(("shelf", i), [norm_name(e["name"], e["brand"], lines.get(e["brandKey"]) or ())])
                  for i, e in enumerate(on_shelf)]
        clusters = name_clusters(items)
        if len(clusters) >= 2 and not one_certificate(tags):
            mixed[root] = {"tags": sorted(tags), "clusters": clusters, "id": batch_id(tags)}
            continue
        batches[root] = {"tags": sorted(tags), "clusters": clusters, "id": batch_id(tags), "shelfNames": on_shelf}
        if len(clusters) >= 2:
            lics = [l for t in tags for l in card_licenses(known[t]) if narrow(l)]
            brands = [brand_key(r) for t in tags for r in listing_tags.get(t, [])] + [e["brandKey"] for e in on_shelf]
            for x in lics[1:]:
                fam.union(f"f:{lics[0]}", f"f:{x}")
            for b in brands:
                if b:
                    fam.union(f"b:{b}", f"f:{lics[0]}" if lics else f"b:{brands[0]}")
    # производство ↔ упаковщик ↔ исходный пакет одной карточки — одна семья
    for tag, c in known.items():
        lics = [l for l in card_licenses(c) if narrow(l)]
        for x in lics[1:]:
            fam.union(f"f:{lics[0]}", f"f:{x}")

    # --- семьи → случаи
    def root_of_brand(b):
        return fam.find(f"b:{b}")

    def root_of_tags(tags, extra_brands=()):
        brands = {brand_key(r) for t in tags for r in listing_tags.get(t, [])} - {None} | set(extra_brands)
        if brands:
            return fam.find(f"b:{sorted(brands)[0]}")
        lics = sorted({l for t in tags for l in card_licenses(known[t])})
        narrow_l = [l for l in lics if narrow(l)]
        if narrow_l:
            return fam.find(f"f:{narrow_l[0]}")
        return f"f:{lics[0]}" if lics else None

    cases = defaultdict(lambda: {"batches": [], "certificates": [], "shelfPanels": [], "thcTwins": [],
                                 "codes": [], "mixedBatches": [], "brandKeys": set(), "licenses": set(),
                                 "packagers": set()})

    def package_row(tag, batch):
        c = known[tag]
        return {"tag": tag, "name": c.get("strain"), "product": c.get("product"), "batch": batch,
                "facility": c.get("facility"), "packaged": c.get("packaged"), "tested": c.get("tested"),
                "harvested": c.get("harvested"), "lab": c.get("lab"),
                "thc": c.get("thc"), "terpenes": c.get("terpenes") or {},
                "brands": sorted({(r.get("brand") or "").strip() for r in listing_tags.get(tag, [])} - {""})}

    def public(entry):
        return {k: v for k, v in entry.items() if not k.startswith("_")}

    for root, b in batches.items():
        if len(b["clusters"]) < 2:
            continue
        r = root_of_tags(b["tags"], [e["brandKey"] for e in b["shelfNames"]])
        if not r:
            continue
        case = cases[r]
        case["batches"].append({
            "batch": b["id"], "names": len(b["clusters"]),
            "packages": [package_row(t, known[t].get("batchTag")) for t in b["tags"]],
            "shelfNames": [{k: v for k, v in e.items() if k != "brandKey"} for e in b["shelfNames"]],
        })
        for t in b["tags"]:
            case["licenses"].update(l for l in card_licenses(known[t]) if narrow(l))
            case["packagers"].update(l for l in card_licenses(known[t]) if not narrow(l))
            case["brandKeys"].update(brand_key(x) for x in listing_tags.get(t, []) if brand_key(x))
        case["brandKeys"].update(e["brandKey"] for e in b["shelfNames"])
    for key, c in certificates.items():
        r = root_of_tags(c["tags"])
        if not r:
            continue
        case = cases[r]
        lab, tested, thc, terps = key
        case["certificates"].append({
            "lab": lab, "tested": tested, "thc": thc, "terpenes": dict(terps), "names": len(c["clusters"]),
            "packages": [package_row(t, known[t].get("batchTag")) for t in c["tags"]],
        })
        for t in c["tags"]:
            case["licenses"].update(l for l in card_licenses(known[t]) if narrow(l))
            case["brandKeys"].update(brand_key(x) for x in listing_tags.get(t, []) if brand_key(x))
    for key, p in panels.items():
        brands = sorted({e["brandKey"] for e in p["names"]})
        r = root_of_brand(brands[0])
        case = cases[r]
        case["shelfPanels"].append({k: v for k, v in p.items()} | {"names": [public(e) for e in p["names"]]})
        case["brandKeys"].update(brands)
    # Партия с разными сертификатами — для сведения у семьи, которая и так
    # случай; сама по себе случая не делает.
    for root, b in mixed.items():
        r = root_of_tags(b["tags"])
        if not r or r not in cases:
            continue
        cases[r]["mixedBatches"].append({
            "batch": b["id"], "names": len(b["clusters"]),
            "packages": [package_row(t, known[t].get("batchTag")) for t in b["tags"]],
        })

    # бренды семьи: всё, что слилось с корнем
    members = defaultdict(set)
    for node in list(fam.parent):
        members[fam.find(node)].add(node)
    for r, case in cases.items():
        for node in members.get(r, ()):
            if node.startswith("b:"):
                case["brandKeys"].add(node[2:])
            elif node.startswith("f:") and narrow(node[2:]):
                case["licenses"].add(node[2:])
        if r.startswith("f:"):
            case["licenses"].add(r[2:]) if narrow(r[2:]) else case["packagers"].add(r[2:])
        for b in sorted(case["brandKeys"]):
            case["packagers"].update(packagers.get(b, ()))

    def decimal_thc(row):
        thc = row.get("thcPercent")
        if isinstance(thc, (int, float)) and abs(thc * 100 - round(thc * 100)) < 1e-6 and round(thc, 1) != round(thc, 2):
            return round(thc, 2)
        return None

    def code_groups(group_rows):
        """E: код под разными названиями — только при одном THC (или без THC):
        код у названий с разным THC — артикул бренда, не партия."""
        by_code = defaultdict(list)
        for row in group_rows:
            for code in codes_of(row):
                by_code[code].append(row)
        found, dropped = [], 0
        for code, crs in sorted(by_code.items()):
            thcs = {round(r["thcPercent"], 2) for r in crs if isinstance(r.get("thcPercent"), (int, float))}
            if len(thcs) > 1 or (thcs and decimal_thc(crs[[isinstance(r.get("thcPercent"), (int, float)) for r in crs].index(True)]) is None):
                dropped += 1
                continue
            entries, n = named_entries(crs)
            if n >= 2:
                found.append({"code": code, "kind": "UPC" if re.fullmatch(r"\d{12}", code) else "лот",
                              "thc": next(iter(thcs)) if thcs else None, "names": [public(e) for e in entries]})
        return found, dropped

    # --- D и E внутри семьи
    for r, case in cases.items():
        family_rows = sorted((row for b in sorted(case["brandKeys"]) for row in brand_rows.get(b, [])), key=row_order)
        by_thc = defaultdict(list)
        for row in family_rows:
            thc = decimal_thc(row)
            if thc is not None:
                by_thc[thc].append(row)
        # Ожидаемое число случайных совпадений: n пар (название, THC) на
        # отрезке в s сотых — n²/(2s). Сколько бы ни вышло, D в счёт только
        # сверх этого (см. докстринг).
        pairs = {(brand_key(row), display_name(row).lower(), thc) for thc, rs in by_thc.items() for row in rs}
        span = (max(by_thc) - min(by_thc)) * 100 if by_thc else 0
        expected = round(len(pairs) ** 2 / (2 * span), 1) if span >= 1 else 0.0
        panel_names = defaultdict(set)  # THC панели C → (бренд, название) на ней
        for p in case["shelfPanels"]:
            for e in p["names"]:
                panel_names[parse_panel(p["panelKey"])[0]].add((e["brandKey"], e["name"]))
        for thc, rs in sorted(by_thc.items()):
            entries, n = named_entries(rs)
            if n < 2:
                continue
            if thc in panel_names:
                # названия, что уже стоят на панели C с этим THC, — не второе
                # свидетельство; новые названия с тем же THC — да
                entries = [e for e in entries if (e["brandKey"], e["name"]) not in panel_names[thc]]
                if not entries:
                    continue
            case["thcTwins"].append({"thc": thc, "onPanel": thc in panel_names, "names": [public(e) for e in entries]})
        observed = len(case["thcTwins"])
        case["thcTwinsStats"] = {"pairs": len(pairs), "spanHundredths": int(span), "expectedByChance": expected,
                                 "observed": observed,
                                 "meaningful": observed >= THC_TWINS_MIN and observed > 2 * expected}
        case["codes"], case["codesDropped"] = code_groups(family_rows)
    # E у брендов без других сигналов — свой случай «на заметку»
    for b, rs in sorted(brand_rows.items()):
        r = root_of_brand(b)
        if r in cases:
            continue
        found, dropped = code_groups(sorted(rs, key=row_order))
        if found:
            case = cases[r]
            case["codes"], case["codesDropped"] = found, dropped
            case["brandKeys"].add(b)
            case["thcTwinsStats"] = {"pairs": 0, "spanHundredths": 0, "expectedByChance": 0.0, "observed": 0, "meaningful": False}

    # --- статус, слияние с прошлым
    def status_of(case):
        if case["batches"] or case["certificates"]:
            return "confirmed"
        strong = any(p["strength"] == "strong" for p in case["shelfPanels"])
        if strong or (case["shelfPanels"] and case["thcTwinsStats"]["meaningful"]):
            return "probable"
        if case["shelfPanels"] or case["codes"]:
            return "watch"
        return None

    def origin(tag):
        """Лицензия, откуда пакет родом: производитель исходного пакета, если
        цепочка известна, иначе производитель самого пакета. У Splash это
        Pierre McClain: Harlem Blossoms переупаковывает его пакеты."""
        for _ in range(5):
            src = str(known[tag].get("sourcePackage") or "").upper()
            if src not in known:
                break
            tag = src
        return license_base(known[tag].get("manufacturerLicense") or known[tag].get("facilityLicense"))

    def licenses_by_origin(case):
        packed = Counter(origin(p["tag"]) for g in case["batches"] + case["certificates"] for p in g["packages"])
        return sorted(case["licenses"], key=lambda l: (-packed.get(l, 0), l))

    def producer_name(case):
        for lic in licenses_by_origin(case):
            named = license_name.get(lic)
            if named:
                return named.most_common(1)[0][0]
            if entity.get(lic):
                return entity[lic]
        brands = ", ".join(brand_name(b) for b in sorted(case["brandKeys"]))
        if brands:
            return brands
        for p in sorted(case["packagers"]):
            named = license_name.get(p)
            return f"{named.most_common(1)[0][0] if named else p} (упаковщик)"
        return "?"

    def names_of(case):
        """Все названия случая: карточки, полки, значимый D и E."""
        out = set()
        for b in case["batches"]:
            out.update(p["name"] for p in b["packages"] if p.get("name"))
            out.update(e["name"] for e in b.get("shelfNames") or [])
        for c in case["certificates"]:
            out.update(p["name"] for p in c["packages"] if p.get("name"))
        for p in case["shelfPanels"]:
            out.update(e["name"] for e in p["names"])
        if case["thcTwinsStats"]["meaningful"]:
            for t in case["thcTwins"]:
                out.update(e["name"] for e in t["names"])
        for c in case["codes"]:
            out.update(e["name"] for e in c["names"])
        return out

    old_cases = (previous or {}).get("cases") or []
    licence_shelf = {lic: min(ls) for ls in shared_licenses.values() for lic in ls}

    def matches(old, case):
        """Тот же случай прошлого прогона: общая лицензия, бренд или — у случая
        одного упаковщика без брендов — упаковщик."""
        return bool(set(old.get("licenses") or []) & case["licenses"]
                    or set(old.get("brandKeys") or []) & case["brandKeys"]
                    or (not case["brandKeys"] and not case["licenses"]
                        and not old.get("brandKeys") and not old.get("licenses")
                        and set(old.get("packagerKeys") or []) & case["packagers"]))

    out_cases = []
    for r, case in cases.items():
        status = status_of(case)
        if not status:
            continue
        olds = [o for o in old_cases if matches(o, case)]
        # панели прошлых прогонов остаются: сила растёт с числом магазинов и дней
        seen_keys = {k for p in case["shelfPanels"] for k in p.get("panelKeys") or [p["panelKey"]]}
        for o in olds:
            for op in o.get("shelfPanels") or []:
                op_keys = set(op.get("panelKeys") or [op["panelKey"]])
                mine = next((p for p in case["shelfPanels"] if op_keys & set(p.get("panelKeys") or [p["panelKey"]])), None)
                if not mine:
                    if not op_keys & seen_keys:
                        case["shelfPanels"].append(op)
                        seen_keys |= op_keys
                    continue
                for oe in op.get("names") or []:
                    me = next((e for e in mine["names"] if e["brandKey"] == oe.get("brandKey")
                               and same_name(norm_name(e["name"]), norm_name(oe["name"]))), None)
                    old_shops = {licence_shelf.get(s, s) for s in oe.get("shops") or []}
                    if me:
                        me["shops"] = sorted(set(me["shops"]) | old_shops)
                        me["firstSeen"] = min(me["firstSeen"], oe.get("firstSeen") or me["firstSeen"])
                    else:
                        mine["names"].append({**oe, "shops": sorted(old_shops)})
                mine["shops"] = len({s for e in mine["names"] for s in e["shops"]})
                mine["strength"] = "strong" if mine["shops"] >= 2 else "watch"
        status = status_of(case)
        history_ = sorted({(h["day"], h["status"]) for o in olds for h in (o.get("statusHistory") or [])})
        if not history_ or history_[-1][1] != status:
            history_.append((today, status))
        old_names = {n for o in olds for n in (o.get("allNames") or [])}
        old_batches = {b["batch"] for o in olds for b in (o.get("batches") or [])}
        old_brands = {b for o in olds for b in (o.get("brandKeys") or [])}
        first = min([o.get("firstDetected") or today for o in olds] + [today])
        last_confirmed = max([o.get("lastConfirmed") or "" for o in olds] + [today if status == "confirmed" else ""]) or None
        names = names_of(case)
        brands = [{"key": b, "name": brand_name(b),
                   "spellings": sorted(brand_spellings[b]),
                   "listings": len(brand_rows.get(b, [])),
                   "shops": len({shelf_of(x) for x in brand_rows.get(b, [])})}
                  for b in sorted(case["brandKeys"])]
        out_cases.append({
            "id": (licenses_by_origin(case) or sorted(case["brandKeys"]) or ["?"])[0],
            "status": status,
            "producer": producer_name(case),
            "licenses": sorted(case["licenses"]),
            "packagers": sorted({f"{p} ({license_name[p].most_common(1)[0][0]})" if license_name.get(p) else p
                                 for p in case["packagers"]}),
            "packagerKeys": sorted(case["packagers"]),
            "brands": brands,
            "brandKeys": sorted(case["brandKeys"]),
            "signals": {"A": len(case["batches"]), "B": len(case["certificates"]),
                        "C": len(case["shelfPanels"]),
                        "D": len(case["thcTwins"]) if case["thcTwinsStats"]["meaningful"] else 0,
                        "E": len(case["codes"]), "mixed": len(case["mixedBatches"])},
            "batches": sorted(case["batches"], key=lambda b: b["batch"]),
            "mixedBatches": sorted(case["mixedBatches"], key=lambda b: b["batch"]),
            "certificates": sorted(case["certificates"], key=lambda c: (c["tested"], c["lab"])),
            "shelfPanels": sorted(case["shelfPanels"], key=lambda p: (-p["shops"], p["panelKey"])),
            "thcTwins": case["thcTwins"],
            "thcTwinsStats": case["thcTwinsStats"],
            "codes": case["codes"],
            "codesDropped": case.get("codesDropped", 0),
            "allNames": sorted(names),
            "statusHistory": [{"day": d, "status": s} for d, s in history_],
            "firstDetected": first,
            "lastConfirmed": last_confirmed,
            "lastSeen": today,
            "previousStatus": max((o.get("status") for o in olds), key=lambda s: STATUS_RANK.get(s, 0), default=None),
            "newSinceLastRun": {
                "names": sorted(names - old_names) if olds else sorted(names),
                "batches": sorted({b["batch"] for b in case["batches"]} - old_batches) if olds else sorted({b["batch"] for b in case["batches"]}),
                "brands": sorted(case["brandKeys"] - old_brands) if olds else sorted(case["brandKeys"]),
                "isNew": not olds,
            },
        })
    out_cases.sort(key=lambda c: (-STATUS_RANK[c["status"]], -c["signals"]["A"] - c["signals"]["B"], -c["signals"]["C"], c["producer"]))

    # --- F: старые тесты по производствам
    facilities = defaultdict(lambda: {"packages": 0, "dated": 0, "oldTest": 0, "oldHarvest": 0, "worst": [], "worstHarvest": []})
    non_flower = 0
    for tag, c in known.items():
        # Жвачки и картриджи тоже лежат долго, но раздел про цветок: по
        # категории карточки, а без неё (у карточек из data/retail-id.json
        # её нет) — по названию товара.
        if not is_flower(c):
            non_flower += 1
            continue
        lic = license_base(c.get("facilityLicense"))
        if not (lic and lic.startswith("OCM-")):
            lic = None  # имя производства в графе лицензии — не лицензия
        key = lic or c.get("facility") or tag[:15]
        f = facilities[key]
        named = license_name.get(lic) if lic else None
        f["facility"] = c.get("facility") or (named.most_common(1)[0][0] if named else key)
        f["license"] = lic
        f["packages"] += 1
        gap = days_between(c.get("packaged"), c.get("tested"))
        if gap is not None:
            f["dated"] += 1
            if gap >= OLD_TEST_DAYS:
                f["oldTest"] += 1
                f["worst"].append({"tag": tag, "name": c.get("strain") or c.get("product"), "tested": c["tested"],
                                   "packaged": c["packaged"], "days": gap})
        gap = days_between(c.get("packaged"), c.get("harvested"))
        if gap is not None and gap >= OLD_HARVEST_DAYS:
            f["oldHarvest"] += 1
            f["worstHarvest"].append({"tag": tag, "name": c.get("strain") or c.get("product"),
                                      "harvested": c["harvested"], "packaged": c["packaged"], "days": gap})
    old_tests = []
    for key, f in facilities.items():
        if f["oldTest"] or f["oldHarvest"]:
            f["worst"] = _distinct(sorted(f["worst"], key=lambda w: -w["days"]))[:5]
            f["worstHarvest"] = _distinct(sorted(f["worstHarvest"], key=lambda w: -w["days"]))[:5]
            old_tests.append(f)
    old_tests.sort(key=lambda f: (-f["oldTest"], -f["oldHarvest"], f["license"] or "", f["facility"]))

    # что понадобится зондированию
    strong = [c for c in out_cases if c["signals"]["A"] or c["signals"]["B"] or c["signals"]["C"]]
    signal_brands = {b for c in strong for b in c["brandKeys"]}
    c_brands = {b for c in out_cases if c["signals"]["C"] for b in c["brandKeys"]}
    signal_licenses = {l for c in strong for l in c["licenses"]}
    signal_prefixes = {p for p, l in prefix_license.items() if l in signal_licenses}
    for b in signal_brands:
        for row in brand_rows.get(b, []):
            for tag in tags_of(row, links):
                signal_prefixes.add(tag[:15])
    for c in strong:
        for group in c["batches"] + c["certificates"]:
            for p in group["packages"]:
                signal_prefixes.add(p["tag"][:15])
    # Префикс-дистрибьютор (метки под четырьмя брендами и больше) — не префикс
    # семьи, что бы её бренд ни печатал: у Dank это NYS Distribution, чьи
    # соседние пакеты — картриджи и жвачки чужих брендов.
    signal_prefixes -= wide
    menu_tags_of_c = sorted({t for b in c_brands for row in brand_rows.get(b, []) for t in tags_of(row, links)
                             if t[:15] not in wide})
    multi_brand_prefixes = {p for p, c in prefix_brands.items() if len(c) >= 2} - wide
    # метки, которые случаи и полки держат: их карточки не худеют
    needed = {t for row in rows for t in tags_of(row, links)}
    for c in out_cases:
        for g in c["batches"] + c["certificates"] + c["mixedBatches"]:
            needed.update(p["tag"] for p in g["packages"])
        for p in c["shelfPanels"]:
            needed.update(x["tag"] for x in p.get("cards") or [])

    return {
        "day": today,
        "cases": out_cases,
        "excluded": {"stripped": excluded["stripped"], "template": excluded["template"],
                     "templateShops": sorted(shop_name(s) for s in template_shops),
                     "pasted": excluded["pasted"], "pastedPanels": pasted[:20]},
        "oldTests": old_tests,
        "oldTestsSkippedNonFlower": non_flower,
        "_probe": {"menuTags": menu_tags_of_c, "signalPrefixes": sorted(signal_prefixes),
                   "multiBrandPrefixes": sorted(multi_brand_prefixes), "widePrefixes": sorted(wide),
                   "signalBrands": sorted(signal_brands), "signalLicenses": sorted(signal_licenses),
                   "needed": sorted(needed)},
    }


# ---------------------------------------------------------------- Retail ID

def plan_probes(built, cards, retail, today, probed):
    """Что спросить у Retail ID и почему, по порядку приоритета (без ограничения бюджета)."""
    stale = (date.fromisoformat(today) - timedelta(days=RECHECK_DAYS)).isoformat()
    packages = retail.get("packages") or {}

    def known_enough(tag):
        c = cards.get(tag)
        if c and c.get("found"):
            return True
        if c and c.get("found") is False and c.get("checked", "") > stale:
            return True
        p = packages.get(tag)
        return bool(p and p.get("found") is False and p.get("checked", "") > stale)

    planned, seen = [], set()

    def add(tag, why):
        if tag not in seen and not known_enough(tag):
            seen.add(tag)
            planned.append((tag, why))

    hint = built["_probe"]
    wide = set(hint.get("widePrefixes") or [])
    signal_prefixes = set(hint["signalPrefixes"]) - wide
    multi = set(hint["multiBrandPrefixes"]) - wide

    def tier(prefix):
        # 0 — семьи с сигналом, 1 — производства, пакующие для двух брендов и
        # больше, 2 — остальные, 3 — дистрибьюторы: их соседи — чужие товары.
        if prefix in wide:
            return 3
        if prefix in signal_prefixes:
            return 0
        if prefix in multi:
            return 1
        return 2

    # (i) метки из меню брендов с сигналом C: за цифрами
    for tag in hint["menuTags"]:
        c = cards.get(tag)
        if not (c and c.get("found")):
            add(tag, "menu")
    # исходные пакеты найденных карточек семей с сигналом: у Harlem Blossoms
    # The Wrap Up исходный пакет — Candy Gelato того же префикса. batchTag не
    # спрашивается: это номер партии, а не пакета, и Retail ID его не отдаёт.
    # Исходные пакеты у дистрибьютора — в конце, вместе с его соседями.
    found_all = all_cards(cards, packages)
    late_refs = []
    for tag, c in sorted(found_all.items()):
        src = str(c.get("sourcePackage") or "").upper()
        if not TAG.match(src):
            continue
        if tier(src[:15]) == 3 or tier(tag[:15]) == 3:
            late_refs.append(src)
        elif tag[:15] in signal_prefixes or src[:15] in signal_prefixes:
            add(src, "ref")
    # (ii) соседи известных меток по префиксам, в порядке приоритета. Центр
    # кольца — только цветок: вокруг жвачек лежат жвачки.
    centres = defaultdict(set)
    for tag, c in found_all.items():
        if not is_flower(c):
            continue
        if tag[15:].isdigit():
            centres[tag[:15]].add(int(tag[15:]))
        src = str(c.get("sourcePackage") or "").upper()
        if TAG.match(src) and src[15:].isdigit():
            centres[src[:15]].add(int(src[15:]))

    # Ярусы по очереди: сначала семьи с сигналом, потом производства, пакующие
    # для двух брендов и больше, потом давно не спрошенные, дистрибьюторы —
    # последними. Внутри яруса — кольцами (±1 у всех префиксов, потом ±2…),
    # чтобы бюджет не ушёл целиком на соседей одной метки.
    radius = {p: NEIGHBOURS_HOT if (probed.get(p) or {}).get("found") else NEIGHBOURS for p in centres}
    for level in (0, 1, 2, 3):
        if level == 3:
            for src in late_refs:
                add(src, "ref3")
        order = sorted((p for p in centres if tier(p) == level),
                       key=lambda p: ((probed.get(p) or {}).get("last") or "", p))
        for ring in range(1, NEIGHBOURS_HOT + 1):
            for prefix in order:
                if ring > radius[prefix]:
                    continue
                for n in sorted(centres[prefix]):
                    for m in (n - ring, n + ring):
                        if m >= 0:
                            add(f"{prefix}{m:09d}", f"near{level}")
    return planned


def merged_stats(a, b):
    """Статистика двух кругов зондирования — одной строкой."""
    out = dict(a)
    for k in ("requests", "found", "notFound", "errors"):
        out[k] = a[k] + b[k]
    out["planned"] = b["planned"]
    out["skippedForBudget"] = b["skippedForBudget"]
    out["stoppedAfterErrors"] = a.get("stoppedAfterErrors") or b.get("stoppedAfterErrors")
    for k in ("byReason", "foundByReason"):
        out[k] = dict(Counter(a[k]) + Counter(b[k]))
    out["prefixesAsked"] = sorted(set(a["prefixesAsked"]) | set(b["prefixesAsked"]))
    return out


def probe(planned, cards, budget, today, probed, log=print):
    """Спросить Retail ID по плану в пределах бюджета; вернуть статистику.
    Пять ошибок подряд — стоп: сервер лежит или просит реже, остальное
    останется на завтра (и так записано в статистике)."""
    budget = max(0, int(budget))
    stats = {"day": today, "budget": budget, "planned": len(planned), "requests": 0, "found": 0,
             "notFound": 0, "errors": 0, "skippedForBudget": max(0, len(planned) - budget),
             "stoppedAfterErrors": False,
             "byReason": Counter(), "foundByReason": Counter(), "prefixesAsked": set()}
    in_row = 0
    for i, (tag, why) in enumerate(planned[:budget]):
        if in_row >= ERRORS_IN_ROW:
            stats["stoppedAfterErrors"] = True
            stats["skippedForBudget"] = len(planned) - i
            log(f"  retail id: {in_row} ошибок подряд, остальное завтра", file=sys.stderr)
            break
        if i:
            time.sleep(PACE)
        card = fetch_card(tag)
        stats["requests"] += 1
        stats["byReason"][why] += 1
        stats["prefixesAsked"].add(tag[:15])
        p = probed.setdefault(tag[:15], {"last": today, "asked": 0, "found": 0})
        p["last"] = today
        p["asked"] += 1
        if card.get("found"):
            in_row = 0
            stats["found"] += 1
            stats["foundByReason"][why] += 1
            p["found"] += 1  # префикс живой: в следующий раз соседи шире
            cards[tag] = {**card, "checked": today}
        elif card.get("found") is False:
            in_row = 0
            stats["notFound"] += 1
            cards[tag] = {"found": False, "checked": today}
        else:
            in_row += 1
            stats["errors"] += 1
            log(f"  retail id {tag}: {card.get('error')}", file=sys.stderr)
            cards[tag] = {"found": None, "error": card.get("error"), "checked": today}
    stats["byReason"] = dict(stats["byReason"])
    stats["foundByReason"] = dict(stats["foundByReason"])
    stats["prefixesAsked"] = sorted(stats["prefixesAsked"])
    return stats


def prune_cards(cards, needed, today):
    """Кэш карточек в границах: 404 старше RECHECK_DAYS и ошибки старше недели
    выкидываются (их спросили бы заново), карточки не на полке и не в случае
    через CARDS_KEEP_DAYS теряют терпены (даты остаются для старых тестов), а
    таких «худых» держится не больше CARDS_LOOSE — старшие уходят. Возвращает,
    сколько чего сделано."""
    day = date.fromisoformat(today)
    stale_404 = (day - timedelta(days=RECHECK_DAYS)).isoformat()
    stale_err = (day - timedelta(days=7)).isoformat()
    keep_until = (day - timedelta(days=CARDS_KEEP_DAYS)).isoformat()
    done = Counter()
    for tag in list(cards):
        c = cards[tag]
        checked = c.get("checked") or ""
        if c.get("found") is False and checked < stale_404:
            del cards[tag]
            done["dropped404"] += 1
        elif c.get("found") is None and checked < stale_err:
            del cards[tag]
            done["droppedErrors"] += 1
        elif c.get("found") and tag not in needed and checked < keep_until and c.get("terpenes"):
            c["terpenes"] = {}
            c["trimmed"] = True
            done["trimmed"] += 1
    loose = sorted((t for t, c in cards.items() if c.get("found") and c.get("trimmed") and t not in needed),
                   key=lambda t: (cards[t].get("checked") or "", t))
    for tag in loose[:max(0, len(loose) - CARDS_LOOSE)]:
        del cards[tag]
        done["droppedLoose"] += 1
    return dict(done)


# ---------------------------------------------------------------- вывод

def read_json(path, default):
    """JSON с диска; нет файла или файл битый — default (и слово в stderr:
    потерять firstDetected лучше, чем не запускаться, пока не поправят руками)."""
    try:
        return json.loads(path.read_text())
    except FileNotFoundError:
        return default
    except ValueError as e:
        print(f"  {path.name}: не читается ({str(e)[:60]}), начинаю заново", file=sys.stderr)
        return default


def load_previous(path=OUT):
    return read_json(path, {})


def write(out, previous, path=OUT):
    cards = {k: v for k, v in (out.get("cards") or {}).items()}
    doc = {
        "about": "Одна партия — много названий: семьи брендов, у которых одна партия Metrc (A), "
                 "один сертификат (B) или одна полная панель терпенов (C) стоит под разными "
                 "названиями; D (тот же THC, сверх случайного) и E (коды UPC при одном THC) — "
                 "подтверждающие и слабые сигналы; статусы confirmed / probable / watch. "
                 "excluded — что не в счёт (шаблоны магазинов, переписанные панели). oldTests — "
                 "производства, упаковывающие цветок через 90+ дней после теста. cards — карточки "
                 "Retail ID с цифрами (свой кэш, 404 переспрашивается через 30 дней, старые "
                 "карточки вне случаев худеют), probing — что спрошено в этот прогон. "
                 "Пишется scripts/lot-twins.py после ежедневного прогона.",
        "day": out["day"],
        "cases": out["cases"],
        "excluded": out["excluded"],
        "oldTests": out["oldTests"],
        "oldTestsSkippedNonFlower": out.get("oldTestsSkippedNonFlower", 0),
        "probing": out.get("probing") or {},
        "probed": dict(sorted((out.get("probed") or {}).items())),
        "cards": dict(sorted(cards.items())),
    }
    # Случаи — с отступами, чтобы читать глазами; карточки — по одной в
    # строку: их тысячи, и с отступами файл перерос бы 5 МБ за сто дней.
    head = json.dumps({k: v for k, v in doc.items() if k != "cards"}, ensure_ascii=False, indent=1)
    assert head.endswith("\n}")
    body = ",\n".join(f'  {json.dumps(tag)}: {json.dumps(c, ensure_ascii=False, separators=(",", ":"))}'
                      for tag, c in doc["cards"].items())
    path.write_text(head[:-2] + ',\n "cards": {\n' + body + ("\n" if body else "") + " }\n}\n")
    return doc


def plural(n, one, few, many):
    n = abs(n) % 100
    if 11 <= n <= 19:
        return many
    n %= 10
    return one if n == 1 else few if 2 <= n <= 4 else many


STATUS_RU = {"confirmed": "подтверждено", "probable": "вероятно", "watch": "на заметку"}


def case_line(c, full=True):
    brands = ", ".join(b["name"] for b in c["brands"][:6]) + (" …" if len(c["brands"]) > 6 else "")
    lic = ", ".join(c["licenses"][:3])
    head = f"**{c['producer']}**" + (f" ({lic})" if lic and c["producer"] not in lic else "")
    if c["producer"] == brands:
        brands = ""
    bits = []
    if c["batches"]:
        b = c["batches"][0]
        names = []
        for p in b["packages"] + [{"name": f"{e['name']} на полке"} for e in b.get("shelfNames") or []]:
            if p.get("name") and p["name"] not in names:
                names.append(p["name"])
        bits.append(f"партий Metrc с двумя и более названиями {len(c['batches'])} "
                    f"(…{b['batch'][-6:]}: {' / '.join(names[:4])})")
    if c["certificates"]:
        s = c["certificates"][0]
        bits.append(f"сертификатов под разными названиями {len(c['certificates'])} "
                    f"({s['lab'].split(',')[0]} {s['tested']}, THC {s['thc']})")
    if c["shelfPanels"]:
        p = c["shelfPanels"][0]
        names = " / ".join(f"{e['name']} ({e['brand']})" if len(c["brands"]) > 1 else e["name"] for e in p["names"][:4])
        shops = max(x["shops"] for x in c["shelfPanels"])
        card = (p.get("cards") or [{}])[0]
        proof = (f" = партия …{card['batch'][-6:]}, тест {card.get('tested')}" if card.get("batch") else "")
        bits.append(f"панелей на полках под разными названиями {len(c['shelfPanels'])}, "
                    f"{'в одном магазине' if shops == 1 else f'в {shops} магазинах'} "
                    f"(THC {p['panelKey'].split('|')[0][4:]}: {names}{proof})")
    st = c.get("thcTwinsStats") or {}
    if c["thcTwins"] and st.get("meaningful"):
        bits.append(f"тот же THC под разными названиями: {len(c['thcTwins'])} "
                    f"(случайно ждали бы {st.get('expectedByChance', 0):g})")
    if c["codes"]:
        kinds = sorted({x.get("kind") or "UPC" for x in c["codes"]})
        thc = ", ".join(f"THC {x['thc']}" for x in c["codes"][:2] if x.get("thc") is not None)
        bits.append(f"общих кодов {'/'.join(kinds)} при одном THC (слабый сигнал): {len(c['codes'])}"
                    + (f" ({thc})" if thc else ""))
    if c.get("mixedBatches"):
        b = c["mixedBatches"][0]
        names = " / ".join(f"{p['name']} (THC {p['thc']})" for p in b["packages"][:3] if p.get("name"))
        bits.append(f"один номер партии Metrc, но разные сертификаты (слабый сигнал): {len(c['mixedBatches'])} "
                    f"(…{b['batch'][-6:]}: {names})")
    if c.get("packagers"):
        bits.append("упаковщик " + "; ".join(c["packagers"][:2]))
    tail = f"; с {c['firstDetected']}" if full else ""
    return f"{head}" + (f" — {brands}" if brands else "") + ": " + "; ".join(bits) + tail


def report(doc):
    """Раздел отчёта: новое, выросшее, стоящий список, старые тесты, зондирование."""
    lines = ["", "### Одна партия — много названий", ""]
    cases = doc.get("cases") or []
    if not cases:
        lines += ["_Семей с одной партией под разными названиями не найдено._"]
    new = [c for c in cases if (c.get("newSinceLastRun") or {}).get("isNew")]
    rose = [c for c in cases if c.get("previousStatus") and STATUS_RANK.get(c["previousStatus"], 0) < STATUS_RANK[c["status"]]]
    grew = [c for c in cases if not (c.get("newSinceLastRun") or {}).get("isNew")
            and any((c.get("newSinceLastRun") or {}).get(k) for k in ("names", "batches", "brands"))]
    if new:
        lines += [f"- **Новые случаи ({len(new)}):**"]
        lines += [f"  - {STATUS_RU[c['status']]}: {case_line(c, full=False)}" for c in new[:10]]
    if rose:
        lines += [f"- **Статус вырос ({len(rose)}):**"]
        lines += [f"  - {STATUS_RU[c['previousStatus']]} → {STATUS_RU[c['status']]}: {case_line(c, full=False)}" for c in rose[:10]]
    if grew:
        lines += [f"- **Новое в известных случаях ({len(grew)}):**"]
        for c in grew[:10]:
            n = c["newSinceLastRun"]
            parts = []
            if n.get("names"):
                parts.append("названия " + ", ".join(n["names"][:5]) + (" …" if len(n["names"]) > 5 else ""))
            if n.get("batches"):
                parts.append("партии " + ", ".join("…" + b[-6:] for b in n["batches"][:4]))
            if n.get("brands"):
                parts.append("бренды " + ", ".join(n["brands"][:4]))
            lines.append(f"  - {c['producer']}: " + "; ".join(parts))
    for status in ("confirmed", "probable", "watch"):
        group = [c for c in cases if c["status"] == status]
        if not group:
            continue
        lines += [f"- **{STATUS_RU[status].capitalize()} ({len(group)}):**"]
        limit = 12 if status != "watch" else 8
        lines += [f"  - {case_line(c)}" for c in group[:limit]]
        if len(group) > limit:
            lines.append(f"  - …и ещё {len(group) - limit}")
    ex = doc.get("excluded") or {}
    if ex.get("template") or ex.get("stripped") or ex.get("pasted"):
        shops = ", ".join(ex.get("templateShops") or [])
        pasted = ex.get("pastedPanels") or []
        example = f" ({pasted[0]['shop']}: {'; '.join(pasted[0]['dropped'][:1])})" if pasted else ""
        lines.append(f"- Не в счёт: панели-шаблоны магазинов — {ex.get('template', 0)} позиций"
                     + (f" ({shops})" if shops else "") + f", снятые сборщиком — {ex.get('stripped', 0)}"
                     f", панели одного магазина, переписанные на другое название, — {ex.get('pasted', 0)}{example}.")
    old = doc.get("oldTests") or []
    lines += ["", "### Старые тесты", ""]
    if not old:
        lines.append("_Пакетов, упакованных через 90 дней после теста и позже, среди карточек Retail ID нет._")
    else:
        total = sum(f["oldTest"] for f in old)
        skipped = doc.get("oldTestsSkippedNonFlower") or 0
        lines.append(f"Цветок, упакованный через {OLD_TEST_DAYS}+ дней после теста: {total} "
                     f"{plural(total, 'пакет', 'пакета', 'пакетов')} у {len(old)} "
                     f"{plural(len(old), 'производства', 'производств', 'производств')} "
                     f"(из карточек Retail ID; урожай за {OLD_HARVEST_DAYS}+ дней до упаковки — отдельно"
                     + (f"; {skipped} карточек не цветка не в счёт" if skipped else "") + ").")
        for f in old[:8]:
            worst = ", ".join(f"{w['name']} {w['days']} дн. ({w['tested']} → {w['packaged']})" for w in f["worst"][:3])
            harvest = f"; урожай старше года: {f['oldHarvest']}" if f.get("oldHarvest") else ""
            lic = f.get("license") if str(f.get("license") or "").startswith("OCM-") else "лицензия неизвестна"
            lines.append(f"- **{f.get('facility') or lic}** ({lic}): {f['oldTest']} из {f['dated']} "
                         f"с датами{harvest}. Худшие: {worst}")
        if len(old) > 8:
            lines.append(f"- …и ещё {len(old) - 8}")
    pr = doc.get("probing") or {}
    if pr.get("skipped"):
        lines.append(f"- Retail ID: без сети ({pr['skipped']}).")
    elif pr:
        by = ", ".join(f"{k} {v}" for k, v in sorted((pr.get("byReason") or {}).items()))
        stopped = "; остановлено после ошибок подряд" if pr.get("stoppedAfterErrors") else ""
        pruned = pr.get("pruned") or {}
        pruned_s = ("; кэш: " + ", ".join(f"{k} {v}" for k, v in sorted(pruned.items()))) if pruned else ""
        lines.append(f"- Retail ID: запросов {pr.get('requests', 0)} из бюджета {pr.get('budget')} "
                     f"(найдено {pr.get('found', 0)}, нет {pr.get('notFound', 0)}, ошибок {pr.get('errors', 0)}; {by}{stopped}); "
                     f"в план вошло {pr.get('planned', 0)}, не влезло в бюджет {pr.get('skippedForBudget', 0)}; "
                     f"карточек с цифрами всего {pr.get('cardsWithFigures', 0)}{pruned_s}.")
    return "\n".join(lines) + "\n"


def nonnegative(text):
    """--budget -5 — не «без предела», а ошибка: минус снял бы ограничение среза."""
    n = int(text)
    if n < 0:
        raise argparse.ArgumentTypeError("бюджет не меньше нуля")
    return n


def main(argv=None):
    ap = argparse.ArgumentParser(description="Одна партия — много названий")
    ap.add_argument("command", nargs="?", default="build", choices=["build", "report"])
    ap.add_argument("--no-network", action="store_true", help="не спрашивать Retail ID")
    ap.add_argument("--budget", type=nonnegative, default=BUDGET, help="запросов к Retail ID за прогон (0 и больше)")
    args = ap.parse_args(argv)
    if args.command == "report":
        sys.stdout.write(report(load_previous()))
        return 0

    started = time.time()
    rows = _terpenes.listings_of(LISTINGS.read_text())
    retail = read_json(RETAIL_ID, {})
    producers = read_json(PRODUCERS, [])
    producers = producers if isinstance(producers, list) else producers.get("producers") or []
    coverage = read_json(COVERAGE, {})
    history = read_json(HISTORY, {})
    lines = (read_json(LINES, {}).get("lines") or {})
    previous = load_previous()
    cards = dict(previous.get("cards") or {})
    probed = dict(previous.get("probed") or {})
    today = max((r["capturedAt"][:10] for r in rows if r.get("capturedAt")), default=date.today().isoformat())

    built = build(rows, cards, retail, previous, producers, coverage, history, lines, today)
    if args.no_network:
        stats = {"day": today, "skipped": "--no-network", "requests": 0}
    else:
        # Найденная карточка называет исходный пакет и связывает семьи, а те
        # меняют план: до трёх кругов, бюджет общий.
        stats, left = None, args.budget
        for _round in range(3):
            planned = plan_probes(built, cards, retail, today, probed)
            part = probe(planned, cards, left, today, probed)
            left -= part["requests"]
            stats = part if stats is None else merged_stats(stats, part)
            if not part["found"] or left <= 0:
                break
            built = build(rows, cards, retail, previous, producers, coverage, history, lines, today)
        stats["budget"] = args.budget
        if stats["requests"]:
            # новые карточки могли связать партии и семьи — разбор ещё раз
            built = build(rows, cards, retail, previous, producers, coverage, history, lines, today)
    stats["pruned"] = prune_cards(cards, set(built["_probe"]["needed"]), today)
    stats["cardsWithFigures"] = sum(1 for c in cards.values() if c.get("found") and not c.get("trimmed"))
    built["probing"], built["probed"], built["cards"] = stats, probed, cards
    write(built, previous)
    counts = Counter(c["status"] for c in built["cases"])
    print(f"{OUT.relative_to(ROOT)}: случаев {len(built['cases'])} "
          f"(подтверждено {counts['confirmed']}, вероятно {counts['probable']}, на заметку {counts['watch']}), "
          f"новых {sum(1 for c in built['cases'] if c['newSinceLastRun']['isNew'])}; "
          f"старые тесты у {len(built['oldTests'])} производств; "
          f"Retail ID: запросов {stats.get('requests', 0)}"
          + (f" ({stats['skipped']})" if stats.get("skipped") else
             f" из бюджета {stats['budget']} (найдено {stats['found']}, нет {stats['notFound']}, "
             f"ошибок {stats['errors']}; в плане {stats['planned']}, не влезло в бюджет {stats['skippedForBudget']})")
          + f"; карточек с цифрами {stats['cardsWithFigures']}; {time.time() - started:.0f} с")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
