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
    python scripts/shelf-history.py signals    # data/shelf-signals.json для страницы сайта
    python scripts/shelf-history.py backfill   # пересобрать историю из git

Главный шум дают не магазины, а мы сами. Каждая починка сборщика, после
которой он читал меню глубже, превращала вчера недочитанное в сегодня
«новое»: 18 сентября таких появлений было 6 865. Поэтому появление
засчитывается, только если:

- магазин читался в два прошлых раза, и сравнивать есть с чем;
- сорта не было ни на одном из двух прошлых чтений, то есть это не мигание;
- новых за день не больше 15% полки — или не больше пяти сортов: на полке
  из пятнадцати три новых — завоз, а не переписанная полка. Иначе полку
  переписало наше чтение, а не завоз, и из неё не считается ничего;
- сборщик с прошлого чтения магазина не менялся — или менялся, но полка не
  выросла в одну сторону хотя бы на десятую. Починка, после которой меню
  читается глубже, добавляет позиции и ничего не убирает; настоящий завоз
  приходит вместе с продажами. Сборщик в сентябре менялся почти каждый
  прогон, и без «на десятую» каждая поставка большого магазина в такой день
  считалась бы нашим чтением. Но так же, в одну сторону, приходит и поставка целой линейкой
  бренда — Find привёз Misha's двадцать сортов разом. Поэтому из такой полки
  всё же засчитываются сорта бренда, который составил хотя бы половину нового
  и не меньше трёх сортов (вторая страница меню — смесь брендов, линейка —
  один), и сорта, которые уже пришли в другой магазин за неделю;
- это не переименование: у того же бренда в эти дни не ушёл похожий сорт;
- на следующем чтении сорт всё ещё на полке.

Дебют — сорт бренда, которого до этого дня не было ни на одной полке, что мы
читаем (Нью-Йорк и Вестчестер, с 6 сентября 2026): день его появления как
завоза — первый день, когда мы видели его вообще где-либо. known помнит этот
первый день для каждого сорта бренда и, в отличие от прочего, не забывается
через 60 дней: сорт, ушедший на три месяца и вернувшийся, — не дебют. Сорт без
бренда дебютом не бывает: «|blue dream» — чей угодно. Дебют говорит о наших
полках, а не о рынке: сорт мог стоять там, где мы не читаем.

Имя дебюту проверяется так же, как уходу: сорт, который у того же бренда уже
стоял под похожим именем («Flower Secret Stash» и «Secret Stash», «X - Chimax»
и «Chimax», «*Apple Fritter»), — не новый сорт, а новая запись старого. Меню
пишут названия вразнобой, и без этого правила две трети «дебютов» октября были
такими. Поэтому дебют — только сорт, похожего на который у бренда раньше не
было ни на одной полке; а его поздние записи — «Grape Maker» рядом с «Grape
Marker» — дебют разделяют, и магазины считаются по всем записям вместе.
Похожесть для дебюта строже к «новому», чем для переименований: ловит и
опечатки («Cap Junkie» при «Cap Junky»), а бренд — это производитель под
любой своей подписью («Major (Micro)» и «Major», «Zips OG» и «Zips», «The
Botanist» и «Botanist»; same_grower).

Первое появление не обязано быть завозом: сорт мог мелькнуть на полке, которую
в тот день переписало наше чтение, или не устоять, а завозом прийти чтением-двумя
позже. Тогда дебют — с того первого дня, но только если в тот день сорт
показали магазины, которые мы читали и раньше, и не окна в меню побольше: в
магазине, прочитанном впервые, и в окне он мог стоять давно. Завоз в окне
дебютом не бывает вовсе.

Дебют записывается в debuts, когда его завоз подтвердился, и помнится, пока
сорт помнит хоть одна полка. Сайт ведёт его дальше: первые семь дней —
«Debut (3)», где число — в скольких магазинах сорт успел появиться с первого
дня; потом — сколько недель назад его увидели впервые. Магазин считается по
лицензии: у сети с общей витриной это несколько магазинов, и сорт стоит в
каждом.

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

Уход. Сорт, который стоял в пяти и больше магазинах за две недели и остался
меньше чем в пяти, уходит; сорт, стоявший хотя бы в трёх и пропавший со
всех прочитанных полок, ушёл. Уход шумит так же, как появление, только в
другую сторону: полка, прочитанная наполовину, выглядит распроданной. Поэтому
уход с полки не засчитывается, если это чтение магазина не годится и для
завоза — или если за день с полки пропало больше 30% и больше пяти сортов:
так уходит не товар, а наше чтение. Сорт, который магазин переименовал, не ушёл, пока на той же
полке стоит похожий.

Магазин. Живая полка меняется: товар продаётся, приходят поставки. Полка,
которую мы читаем день за днём и на которой ничего не появляется и ничего не
уходит, — магазин спит, закрылся или перестал обновлять меню; снаружи эти три
не различить, поэтому «похоже, мёртвый» — повод проверить руками, а не вывод.
Тишина считается только по чтениям без изменений подряд, не меньше трёх:
любое изменение, даже на чтении, которому мы не верим, её прерывает — не
знаем, значит не тихо. Сколько дней тихо и как мала полка, решают вместе:

    без изменений   30+ сортов   10–29      меньше 10
    меньше 7 дней   живой        живой      живой
    7–13 дней       тихий        спящий     похоже, мёртвый
    14+ дней        спящий       похоже, мёртвый

Но магазин умирает раньше, чем застывает: товар ещё уходит, а новое не
приходит. Поэтому вторая мерка — сколько дней на полку не было завоза (7–13 —
не пополняется, 14 и больше — спит), и итог — худшая из двух. О завозах
судим, только если хотя бы 60% чтений магазина за две недели были надёжными:
иначе завозы могли спрятать наши же фильтры, и это чтение неустойчиво — наша
сторона, как и магазин, который три прогона не читается.

Кусок меню. Бывает, что мы читаем не полку, а окно в меню побольше: первую
страницу, первые двадцать пять позиций. Меню The Flowery — семьсот сортов, мы
видели сорок пять. Окно выдаёт себя тем, что размер полки не меняется, а
сорта в нём сменяются каждое чтение: одни выпадают, другие входят. Живая
полка так не делает — завоз добавляет, продажа убирает. Поэтому магазин, у
которого за две недели не меньше четырёх чтений при том же размере полки (не
дальше чем в 1,25 раза) и больше чем на половине из них сменилась десятая
часть полки и больше, — «видим кусок меню». Его новинки не идут ни в волны, ни в новое, его уходы —
ни в «уходит», ни в «ушёл», и о завозах в нём не судим. Сорт, который там
стоит, всё же стоит: «ушедшим» он не станет. Это тоже наша сторона.
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
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
HISTORY = ROOT / "data/shelf-history.json"
LISTINGS = ROOT / "data/flower-listings.json"
REGISTER = ROOT / "data/dispensaries.json"
SIGNALS = ROOT / "data/shelf-signals.json"
# Что решает, как читается магазин. Версия сборщика — их общий отпечаток.
READER = ("scripts/menu-render.mjs", "scripts/strain-name.mjs", "data/menu-endpoints.json")

NEW_SHARE_MAX = 0.15  # больше — полку переписало наше чтение, а не завоз…
REWRITE_MIN = 5       # …если сортов больше стольких; то же для ушедших за день
LOPSIDED_MIN = 5      # столько новых при сменившемся сборщике и почти без ушедших —
                      # это чтение стало глубже, а не завоз…
DEEPER_GROWTH = 1.1   # …если полка при этом выросла хотя бы во столько раз…
LINEUP_MIN = 3        # …если только это не линейка одного бренда: столько сортов
LINEUP_SHARE = 0.5    # и такая доля всего нового
MIN_THC_STEP = 0.1    # ближе — то же лабораторное число, записанное иначе
THC_BURST_SHARE = 0.3 # THC сменился у большей доли позиций магазина за день —
THC_BURST_MIN = 5     # поменялось наше чтение потенции, а не партии
GONE_SHARE_MAX = 0.3  # больше ушло с полки за день — ушло наше чтение, а не товар
LOW_BELOW = 5         # «уходит»: осталось меньше стольких магазинов…
LOW_PEAK = 5          # …из стольких и больше за окно
GONE_PEAK = 3         # «ушёл»: пропал отовсюду, а стоял хотя бы в стольких
MOVES_DAYS = 14       # окно для «уходит» и «ушёл»
SHAKY = "?"           # уход, записанный чтением, которому уходы не доверяются
QUIET_DAYS = 7        # без изменений столько дней — магазин тих…
ASLEEP_DAYS = 14      # …столько — спит
QUIET_READS = 3       # и тишину подтверждают хотя бы столько чтений подряд
STALE_DAYS = 7        # без нового завоза столько дней — магазин не пополняется
TRUSTED_SHARE = 0.6   # о завозах судим, только если надёжна хотя бы такая доля чтений
WINDOW_TURN = 0.1     # полка того же размера меняет такую долю за чтение — видим окно
WINDOW_READS = 4      # и это видно хотя бы на стольких чтениях за две недели
WINDOW_SIZE = 1.25    # «тот же размер» — не дальше чем во столько раз
SMALL_SHELF = 30      # меньше стольких сортов — ассортимент мал
TINY_SHELF = 10       # меньше стольких — полка почти пуста
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
    # Партия 11 курации: подписи Sensei (микролицензия, коллаборации), Wizard
    # Tree в единственном числе, линия 1937 High Values; «Major (Micro)» —
    # та же партия Felas Farm, что и «Major»; Dank By Definition и Dank, Zips
    # OG и Zips, «TOO THE MOON» и «To The Moon (TTM)». Сома складывает так же.
    "senseimicro": "sensei", "tksxsensei": "sensei", "tkssensei": "sensei", "senseismallbatch": "sensei",
    "wizardtree": "wizardtrees",
    "1937highvalues": "1937",
    "majormicro": "major",
    "dankbydefinition": "dank",
    "zipsog": "zips",
    "toomoon": "tomoon", "tomoonttm": "tomoon",
    # Партия 12 курации: те же производители под другими подписями. «Smoke» и
    # «Smoke World» — Smoke WRLD (Lunulata), Rhythm — RYTHM.
    "hepworthsungrown": "hepworth",
    "leadfarmermicro": "leadfarmer", "leadfarmers": "leadfarmer", "leadfarmersmallbatch": "leadfarmer",
    "majors": "major",
    "mechanics": "mechanic",
    "revertnewyork": "revert",
    "rhythm": "rythm",
    "roemermicro": "roemer", "roemersmallbatch": "roemer",
    "smoke": "smokewrld", "smokeworld": "smokewrld",
    "wizardtreez": "wizardtrees",
    # Партия 13 курации: STAYME7O и STAYMELO — STAYME7O™ (Grand National), BANZZY —
    # Banzzy 1305 (одна панель была разбита на три партии), The Kaleidoscope
    # Collective и TKC — Kaleidoscope, опечатка UrbanXtracs — urbanXtracts.
    "stayme7o": "stayme7otm", "staymelo": "stayme7otm",
    "banzzy": "banzzy1305",
    "kaleidoscopecollective": "kaleidoscope", "tkc": "kaleidoscope",
    "urbanxtracs": "urbanxtracts",
}


def grower_of(brand):
    if not brand:
        return None
    key = re.sub(r"[\u0300-\u036f]", "", unicodedata.normalize("NFKD", str(brand))).lower()
    key = re.sub(r"[^a-z0-9]", "", GROWER_NOISE.sub(" ", re.sub(r"[^a-z0-9 ]", " ", key)))
    return GROWER_ALIASES.get(key, key) or None


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
    # Быстрые верхние оценки отвечают «нет» за большинство пар; ответ тот же.
    m = SequenceMatcher(None, strain_a, strain_b)
    return m.real_quick_ratio() >= 0.85 and m.quick_ratio() >= 0.85 and m.ratio() >= 0.85


def shelves_read(rows, day):
    """Полки магазинов, прочитанных в этот день: {лицензия: {сорт бренда: строка}} и
    {лицензия: {сорт бренда: значения THC}}.

    Полка, которую сборщик придержал от прошлого чтения, лежит в файле со
    старым capturedAt. Это не чтение, и сравнивать её не с чем."""
    shelves, potency = {}, {}
    for row in rows:
        if ny_day(row.get("capturedAt")) != day:
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
    """«первое/последнее THC… ?» → (первое, последнее или None, если на полке, [THC],
    ушёл ли он при чтении, которому уходы не доверяются)."""
    span, *rest = entry.split(" ")
    first, last = span.split("/")
    shaky = bool(rest) and rest[-1] == SHAKY
    thc = [float(v) for v in (rest[:-1] if shaky else rest)]
    return first, (None if last == OPEN else last), thc, shaky


def written(first, last, thc=(), shaky=False):
    return " ".join([f"{first}/{last or OPEN}"] + [num(v) for v in sorted(set(thc))]
                    + ([SHAKY] if shaky and last else []))


def empty():
    return {
        "about": "Когда сорт бренда был на полке каждого магазина: первое и последнее чтение "
                 "(«..» — на полке и сейчас) и THC на последнем чтении; thc — какие значения "
                 "THC, то есть партии, сорт бренда уже показывал хоть где-то. Пишется "
                 "scripts/shelf-history.py после ежедневного прогона; правила — в его описании.",
        "rules": {
            "newShareMax": NEW_SHARE_MAX, "lopsidedMin": LOPSIDED_MIN, "lineupMin": LINEUP_MIN,
            "lineupShare": LINEUP_SHARE, "recentSweeps": RECENT_SWEEPS,
            "confirmWithin": CONFIRM_WITHIN, "waveShelves": WAVE_SHELVES,
            "waveDays": WAVE_DAYS, "keepDays": KEEP_DAYS, "minThcStep": MIN_THC_STEP,
            "thcBurstShare": THC_BURST_SHARE, "thcBurstMin": THC_BURST_MIN,
            "goneShareMax": GONE_SHARE_MAX, "lowBelow": LOW_BELOW, "lowPeak": LOW_PEAK,
            "gonePeak": GONE_PEAK, "movesDays": MOVES_DAYS, "quietDays": QUIET_DAYS,
            "asleepDays": ASLEEP_DAYS, "quietReads": QUIET_READS, "smallShelf": SMALL_SHELF,
            "tinyShelf": TINY_SHELF, "staleDays": STALE_DAYS, "trustedShare": TRUSTED_SHARE,
            "rewriteMin": REWRITE_MIN, "deeperGrowth": DEEPER_GROWTH, "windowTurn": WINDOW_TURN,
            "windowReads": WINDOW_READS, "windowSize": WINDOW_SIZE,
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
        "names": {},
        "activity": {},
        "seen": {},
        "known": {},
        "debuts": {},
        "began": None,
        "shifts": [],
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

    deferred = []
    for lic, shelf in shelves.items():
        reads = hist["reads"].setdefault(lic, [])
        seen = hist["seen"].setdefault(lic, {})
        r1 = reads[-1] if reads else None
        r2 = reads[-2] if len(reads) > 1 else None
        was = {key: parse(entry) for key, entry in seen.items()}
        thc_now = potency.get(lic, {})

        # Что ушло с полки: последний раз оно стояло на прошлом чтении.
        # Записывается ниже, когда станет ясно, можно ли этому чтению верить.
        gone = [key for key, (_f, last, _t, _s) in was.items() if last is None and key not in shelf]
        departed = len(gone)
        standing = sum(1 for _f, last, _t, _s in was.values() if last is None)

        new = []
        for key in shelf:
            got = was.get(key)
            first = day
            if got is None:
                new.append((key, False))
            else:
                first, last, _thc, _shaky = got
                # Ушёл и вернулся. Если стоял на одном из двух прошлых чтений,
                # это мигание, а не появление.
                if last is not None and (r2 is None or last < r2):
                    new.append((key, True))
            # THC сменился на полке, где сорт стоял и на прошлом чтении: before — что
            # было (пусто — меню THC не показывало), after — что стало. По этому
            # FirstOnShelf отличает партию, пришедшую сюда позже, от партии, которая
            # стояла здесь и раньше, только без THC.
            now_thc = sorted(set(thc_now.get(key, ())))
            if got is not None and got[1] is None and now_thc and now_thc != sorted(set(got[2])):
                hist["shifts"].append({"seen": day, "licence": lic, "key": key,
                                       "before": sorted(set(got[2])), "after": now_thc})
            seen[key] = written(first, None, thc_now.get(key, ()))
        reads.append(day)
        del reads[:-KEEP_READS]
        if new:
            count["appeared"] += len(new)

        before = versions.get(r1)
        deeper = bool(collector and before and before != collector
                      and len(new) >= LOPSIDED_MIN and departed * 3 < len(new)
                      and len(shelf) >= DEEPER_GROWTH * max(standing, 1))
        # Уходам верится там же, где завозам, и ещё не там, где полка за день
        # потеряла треть: так теряет не магазин, а наше чтение.
        rewritten = len(new) > max(NEW_SHARE_MAX * len(shelf), REWRITE_MIN)
        shaky = (r2 is None or r1 not in recent or rewritten
                 or deeper or departed > max(GONE_SHARE_MAX * standing, REWRITE_MIN))
        for key in gone:
            first, _last, thc, _s = was[key]
            seen[key] = written(first, r1, thc, shaky)
        # Что сделала полка с прошлого чтения: сколько на ней, сколько встало,
        # сколько ушло, и можно ли этому чтению верить. По этому видно, живёт
        # ли магазин.
        added = sum(1 for key in shelf if key not in was or was[key][1] is not None)
        hist["activity"].setdefault(lic, []).append([day, len(shelf), added, departed, 0 if shaky else 1])
        if gone:
            count["departed" + ("Shaky" if shaky else "")] += len(gone)

        if r2 is None or r1 not in recent:
            if new:
                count["unsteady"] += len(new)
            continue
        if rewritten:
            count["rewritten"] += len(new)
            count["rewrittenShops"] += 1
            continue
        # Сборщик сменился с прошлого чтения, и полка выросла в одну сторону:
        # так выглядит меню, прочитанное глубже, а не привезённый товар.
        # Настоящий завоз может попасть сюда же — пустое поле лучше догадки.
        if deeper:
            count["deeper"] += len(new)
            count["deeperShops"] += 1
            deferred.append((lic, shelf, new, seen, r2, was, thc_now))
            continue
        shelf_sig = signature(shelf)
        arrived = arrivals(hist, lic, shelf, new, seen, r2, day, shelf_sig, count)
        batches(hist, lic, shelf, was, thc_now, arrived, day, shelf_sig, count)

    keep_lineups(hist, deferred, day, count)
    hist["began"] = hist["began"] or day
    for shelf in shelves.values():
        for key in shelf:
            hist["known"].setdefault(key, day)
    note_debuts(hist, [a for a in hist["arrivals"] if a["confirmed"] == day])
    remember_potency(hist, potency, day)
    remember_names(hist, shelves)
    hist["days"][day] = dict(sorted(count.items()))
    prune(hist, day)
    return count


# Хвосты и начала, которыми один производитель подписан по-разному: «Major
# (Micro)», «Zips OG», «Purps NY», «Leal Organics», «The Botanist», «New York
# Ounce Club». Короткий ключ, который лишь начинает длинный, — ещё не тот же
# производитель: Flor и Florette, Budd и Budding Bliss, Hash и Hashtag Honey.
GROWER_TAILS = {
    "micro", "smallbatch", "og", "ny", "newyork", "s", "z", "labs", "organics", "exotics", "extracts",
    "preroll", "prerolls", "losangeles", "daily", "flower", "flowers", "growers", "worldclass",
    "heritagestrains", "collective", "genetic", "genetics", "canna", "apothecary", "tm",
}
GROWER_HEADS = ("acreagethe", "the", "newyork")
FIRST_GRACE = 2       # через сколько чтений после первого появления ещё признаётся завоз-дебют


def grower_key(brand_key):
    key = GROWER_ALIASES.get(brand_key, brand_key)
    for head in GROWER_HEADS:
        if key.startswith(head) and len(key) - len(head) >= 4:
            key = key[len(head):]
            break
    return GROWER_ALIASES.get(key, key)


def same_grower(a, b):
    """Один ли производитель за двумя ключами бренда. Правило — в описании модуля."""
    if not a or not b:
        return False
    a, b = sorted((grower_key(a), grower_key(b)), key=len)
    if a == b:
        return True
    if not b.startswith(a):
        return False
    rest = b[len(a):]
    # Подпись лицензии — «J Cannabis (Micro)» и «J», — при любом коротком ключе.
    if rest in ("micro", "smallbatch"):
        return True
    if len(a) < 4:
        return False
    return len(a) >= 6 or rest in GROWER_TAILS or rest.isdigit()


_LOOSE = {}


def loose(strain):
    """Имя сорта, сложенное как looseKey в src/lib/strain-review.ts: без упаковки и веса,
    без двойных букв, с одним окончанием для Cookies/Cookie, Junkie/Junky, Mintz/Mints.
    Возвращает (сложенное, первые буквы слов, числа)."""
    if strain not in _LOOSE:
        folded = []
        for w in re.findall(r"[a-z0-9]+", WEIGHT.sub(" ", strain.replace("'", "").replace("’", ""))):
            if w in PACKAGING:
                continue
            if len(w) > 4 and w.endswith("ies"):
                w = w[:-3] + "i"
            elif len(w) > 3 and w[-1] in "sz":
                w = w[:-1]
            if len(w) > 3 and w.endswith("ie"):
                w = w[:-1]
            elif len(w) > 3 and w.endswith("y"):
                w = w[:-1] + "i"
            folded.append(re.sub(r"(.)\1+", r"\1", w))
        _LOOSE[strain] = ("".join(folded), "".join(w[0] for w in folded), re.findall(r"\d+", strain))
    return _LOOSE[strain]


def edits(a, b):
    row = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        prev, row[0] = row[0], i
        for j, cb in enumerate(b, 1):
            prev, row[j] = row[j], min(row[j] + 1, row[j - 1] + 1, prev + (ca != cb))
    return row[-1]


def same_strain(a, b):
    """Один ли это сорт — для дебюта, где ошибиться в «новом» хуже, чем в «переименовали».
    Как similar(), без бренда: те же слова с лишними («Flower Secret Stash»), и опечатки,
    которых он не ловит: «Cap Junkie» и «Cap Junky», «B.A.M» и «BAM», «Moon Galeto» и
    «Moon Gelato». Опечатка — одна-две буквы, при тех же числах и тех же первых буквах
    слов: «Blue Cream» — не «Blue Dream», «Billionaire» — не «Millionaire»."""
    if a == b:
        return True
    wa, wb = words(a), words(b)
    if wa and wb and (wa <= wb or wb <= wa):
        return True
    (la, ia, da), (lb, ib, db) = loose(a), loose(b)
    if not la or not lb:
        return False
    if la == lb:
        return True
    if ia != ib or da != db:
        return False
    if SequenceMatcher(None, a, b).ratio() >= 0.85:
        return True
    shorter = min(len(la), len(lb))
    allowed = 2 if shorter >= 9 else 1 if shorter >= 7 else 0
    return allowed > 0 and abs(len(la) - len(lb)) <= allowed and edits(la, lb) <= allowed


def strain_of(key):
    return key.split("|", 1)[1]


class Lineage:
    """Записи сортов для дебютов: какие ключи — один производитель, что у него стояло
    когда. Считает лениво и помнит посчитанное, пока живёт."""

    def __init__(self, hist):
        self.known = hist["known"]
        self.brands = defaultdict(list)
        for key in self.known:
            self.brands[key.split("|", 1)[0]].append(key)
        self.pools = {}
        self.renamed = {}

    def pool(self, brand):
        """Все записи производителя этого бренда, под любым его ключом."""
        if brand not in self.pools:
            self.pools[brand] = [k for other, keys in self.brands.items()
                                 if same_grower(brand, other) for k in keys]
        return self.pools[brand]

    def renamed_on(self, brand, day):
        """Записи производителя, впервые увиденные в этот день и похожие на то, что у него
        стояло раньше: «White Diamonds» 8 октября при «White Diamond» с сентября."""
        if (brand, day) not in self.renamed:
            pool = self.pool(brand)
            older = [strain_of(o) for o in pool if self.known[o] < day]
            self.renamed[brand, day] = [k for k in pool if self.known[k] == day
                                        and any(same_strain(strain_of(k), o) for o in older)]
        return self.renamed[brand, day]

    def known_before(self, key, day):
        """Стоял ли у производителя до этого дня сорт, похожий на этот, — то есть этот сорт
        сам. Похожесть — и через одну запись того же дня: «HOS - White Diamonds» похож не
        на «White Diamond», а на «White Diamonds», который появился с ним в один день и
        похож на него. Только то, что было известно к этому дню, — чтобы ответ не менялся
        потом."""
        brand, strain = key.split("|", 1)
        if any(self.known[o] < day and o != key and same_strain(strain, strain_of(o)) for o in self.pool(brand)):
            return True
        return any(o != key and same_strain(strain, strain_of(o)) for o in self.renamed_on(brand, day))

    def family(self, key, first, taken=()):
        """Записи дебюта: он сам, его поздние записи и дебюты того же дня под похожим
        именем — у того же производителя, и только не похожие на то, что стояло раньше."""
        strain = strain_of(key)
        return [key] + sorted(o for o in self.pool(key.split("|", 1)[0])
                              if o != key and o not in taken and self.known[o] >= first
                              and same_strain(strain, strain_of(o)) and not self.known_before(o, first))


def note_debuts(hist, confirmed):
    """Подтверждённые завозы, которые оказались первым появлением сорта бренда на
    наших полках вообще. Правило — в описании модуля."""
    lineage, windows = None, {}

    def window(day):
        if day not in windows:
            windows[day] = windowed(hist, day)
        return windows[day]

    for a in confirmed:
        key = a["key"]
        first = hist["known"].get(key)
        if not key.split("|", 1)[0] or key in hist["debuts"] or not first or first > a["seen"]:
            continue
        # Окно в меню побольше показывает давний товар как новый — о завозах в нём не судим.
        if a["licence"] in window(a["seen"]):
            continue
        # Впервые сорт мог мелькнуть там, где завоз не считается (полку в тот день
        # переписало наше чтение, он не устоял до следующего), а завозом прийти чтением-двумя
        # позже. Тогда дебют — с того первого дня, но только если в тот день сорт показали
        # магазины, которые мы читали и раньше, и не окна: в магазине, прочитанном впервые,
        # он мог стоять давно.
        if sum(1 for s in hist["sweeps"] if first < s <= a["seen"]) > FIRST_GRACE:
            continue
        shown = [lic for lic, seen in hist["seen"].items() if key in seen and parse(seen[key])[0] == first]
        if not shown or any(lic in window(first) or not any(e[0] < first for e in hist["activity"].get(lic, ()))
                            for lic in shown):
            continue
        lineage = lineage or Lineage(hist)
        if not lineage.known_before(key, first):
            hist["debuts"][key] = first


def keep_lineups(hist, deferred, day, count):
    """Из полок, выросших в одну сторону при сменившемся сборщике, — то, что всё же
    похоже на завоз. Разбирается после всех остальных магазинов дня: подтверждением
    служат и сегодняшние кандидаты других магазинов."""
    if not deferred:
        return
    kept = {}
    for lic, shelf, new, seen, r2, was, thc_now in deferred:
        brands = Counter(key.split("|", 1)[0] for key, _returned in new)
        lineup = {b for b, n in brands.items() if b and n >= LINEUP_MIN and n >= LINEUP_SHARE * len(new)}
        kept[lic] = [(key, returned) for key, returned in new if key.split("|", 1)[0] in lineup]
    since = (date.fromisoformat(day) - timedelta(days=WAVE_DAYS - 1)).isoformat()
    for lic, shelf, new, seen, r2, was, thc_now in deferred:
        elsewhere = {a["key"] for a in hist["arrivals"] + hist["pending"]
                     if a["licence"] != lic and a["seen"] >= since}
        elsewhere |= {key for other, pairs in kept.items() if other != lic for key, _r in pairs}
        mine = kept[lic] + [(key, returned) for key, returned in new
                            if key in elsewhere and (key, returned) not in kept[lic]]
        if not mine:
            continue
        count["deeperKept"] += len(mine)
        shelf_sig = signature(shelf)
        arrived = arrivals(hist, lic, shelf, mine, seen, r2, day, shelf_sig, count)
        batches(hist, lic, shelf, was, {k: thc_now[k] for k in arrived if k in thc_now}, arrived, day, shelf_sig, count)


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


def remember_names(hist, shelves):
    """Как писать сорт бренда, когда его уже нет ни на одной полке. Только для
    стоящих хотя бы в двух магазинах: ушедшим и уходящим показывается лишь то,
    что стояло шире."""
    spelled_as = defaultdict(lambda: (Counter(), Counter()))
    for shelf in shelves.values():
        for key, row in shelf.items():
            brands, strains = spelled_as[key]
            if row.get("brand"):
                brands[row["brand"]] += 1
            strain = row.get("strainNameCanonical") or row.get("strainNameRaw")
            if strain:
                strains[strain] += 1
    standing = Counter(key for seen in hist["seen"].values()
                       for key, entry in seen.items() if entry.split(" ", 1)[0].endswith("/" + OPEN))
    for key, (brands, strains) in spelled_as.items():
        if standing[key] >= 2:
            hist["names"][key] = [spelled(brands.elements()), spelled(strains.elements())]


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
    hist["names"] = {key: name for key, name in hist["names"].items() if key in alive}
    # Дебют помнится, пока стоит хоть одна его запись: первая бывает однодневной —
    # «*Orange Elixir», а сам сорт стоит под «Orange Elixir».
    dead = [key for key in hist["debuts"] if key not in alive]
    if dead:
        lineage = Lineage(hist)
        for key in dead:
            if not any(member in alive for member in lineage.family(key, hist["debuts"][key])):
                del hist["debuts"][key]
    hist["activity"] = {lic: [e for e in log if e[0] >= horizon] for lic, log in hist["activity"].items()}
    hist["activity"] = {lic: log for lic, log in hist["activity"].items() if log}
    hist["arrivals"] = [a for a in hist["arrivals"] if a["seen"] >= horizon]
    hist["batches"] = [b for b in hist["batches"] if b["seen"] >= horizon]
    hist["shifts"] = [x for x in hist["shifts"] if x["seen"] >= horizon]
    hist["days"] = {d: c for d, c in hist["days"].items() if d >= horizon}
    hist["collector"] = {d: v for d, v in hist["collector"].items() if d >= horizon}
    del hist["sweeps"][:-KEEP_SWEEPS]


def windowed(hist, day):
    """Магазины, где мы видим не полку, а окно в меню побольше. Правило — в описании модуля."""
    since = (date.fromisoformat(day) - timedelta(days=MOVES_DAYS - 1)).isoformat()
    out = set()
    for lic, log in hist["activity"].items():
        turns = sorted(min(e[2], e[3]) / e[1] for before, e in zip(log, log[1:])
                       if since <= e[0] <= day and e[1] and before[1]
                       and 1 / WINDOW_SIZE <= e[1] / before[1] <= WINDOW_SIZE)
        # Больше чем на половине чтений: один день переименований окна не делает.
        if len(turns) >= WINDOW_READS and turns[(len(turns) - 1) // 2] >= WINDOW_TURN:
            out.add(lic)
    return out


def waves(hist, day):
    """Сорт бренда, появившийся на WAVE_SHELVES и более разных полках за WAVE_DAYS дней до day."""
    since = (date.fromisoformat(day) - timedelta(days=WAVE_DAYS - 1)).isoformat()
    partial = windowed(hist, day)
    groups = defaultdict(list)
    for a in hist["arrivals"]:
        if since <= a["seen"] <= day and a["licence"] not in partial:
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


def carrying(groups, rows=None):
    """Где партия стоит сейчас — по сегодняшнему файлу полок: её первые магазины — только начало."""
    now = defaultdict(lambda: defaultdict(set))
    for row in listings_of(LISTINGS.read_text()) if rows is None else rows:
        thc = row.get("thcPercent")
        if isinstance(thc, (int, float)) and thc > 0 and key_of(row):
            now[key_of(row)][row["licenseNumber"]].add(float(thc))
    return {(key, thc): sorted(lic for lic, values in now[key].items() if any(same_batch(thc, v) for v in values))
            for key, thc in groups}


def display(hist, key, brands=(), strains=()):
    brand, strain = hist["names"].get(key, [None, None])
    return (spelled(brands) or brand or key.split("|", 1)[0] or None,
            spelled(strains) or strain or key.split("|", 1)[1])


def moves(hist, day, rows=None):
    """Что пришло за неделю, что уходит и что ушло за две — то, что показывает сайт."""
    since_new = (date.fromisoformat(day) - timedelta(days=WAVE_DAYS - 1)).isoformat()
    since_old = (date.fromisoformat(day) - timedelta(days=MOVES_DAYS - 1)).isoformat()
    window = [d for d in hist["sweeps"] if since_old <= d <= day]
    partial = windowed(hist, day)

    spans = defaultdict(dict)
    standing = defaultdict(set)
    for lic, seen in hist["seen"].items():
        for key, entry in seen.items():
            first, last, _thc, shaky = parse(entry)
            spans[key][lic] = (first, last, shaky)
            if last is None:
                standing[lic].add(key)

    arrived = defaultdict(list)
    for a in hist["arrivals"]:
        if since_new <= a["seen"] <= day and a["licence"] not in partial:
            arrived[a["key"]].append(a)
    arrivals_out = []
    for key, found in arrived.items():
        brand, strain = display(hist, key, [a["brand"] for a in found], [a["strain"] for a in found])
        arrivals_out.append({
            "brand": brand, "strain": strain, "key": key,
            "first": min(a["seen"] for a in found),
            "today": sum(1 for a in found if a["confirmed"] == day),
            "shelves": len({a["shelf"] for a in found}),
            "shops": sorted({a["licence"] for a in found}),
            "now": sum(1 for sp in spans[key].values() if sp[1] is None),
        })
    arrivals_out.sort(key=lambda a: (-(a["shelves"] >= WAVE_SHELVES), -a["shelves"], -a["now"], a["first"], a["strain"] or ""))

    groups = new_batches(hist, day)
    shops_now = carrying(groups, rows)
    batches_out = []
    for (key, thc), found in groups.items():
        brand, strain = display(hist, key, [b["brand"] for b in found], [b["strain"] for b in found])
        batches_out.append({
            "brand": brand, "strain": strain, "thc": thc, "before": found[0]["before"],
            "first": min(b["seen"] for b in found), "shops": shops_now[(key, thc)],
        })
    batches_out.sort(key=lambda b: (-len(b["shops"]), b["first"], b["strain"] or ""))

    low, gone = [], []
    for key, at in spans.items():
        # Уход, записанный чтением, которому уходы не доверяются, не считается
        # вовсе: ни что было, ни что стало.
        # Из окна сорт выпадает, не уходя с полки: такие магазины не в счёт.
        trusted = {lic: sp for lic, sp in at.items() if not sp[2] and lic not in partial}
        if len(trusted) < GONE_PEAK:
            continue
        peak, peak_day = 0, None
        for d in window:
            n = sum(1 for first, last, _s in trusted.values() if first <= d and (last is None or last >= d))
            if n > peak:
                peak, peak_day = n, d
        if peak < GONE_PEAK:
            continue
        if sum(1 for sp in trusted.values() if sp[1] is None) >= LOW_BELOW:
            continue
        # Переименованный магазином сорт стоит там же под другим названием.
        now = sorted(lic for lic, (first, last, _s) in trusted.items()
                     if last is None or any(similar(key, other) for other in standing[lic] if other != key))
        # Но что стоит в окне сейчас, то стоит.
        now += sorted(lic for lic in partial if key in standing[lic])
        brand, strain = display(hist, key)
        if now and len(now) < LOW_BELOW and peak >= LOW_PEAK:
            low.append({"brand": brand, "strain": strain, "now": now, "peak": peak, "peakDay": peak_day})
        elif not now:
            last_seen = max(last for _f, last, _s in trusted.values())
            if last_seen >= since_old:
                gone.append({"brand": brand, "strain": strain, "lastSeen": last_seen, "peak": peak,
                             "lastShops": sorted(lic for lic, (_f, last, _s) in trusted.items() if last >= since_old)})
    low.sort(key=lambda m: (len(m["now"]) - m["peak"], len(m["now"]), m["strain"] or ""))
    gone.sort(key=lambda m: (-m["peak"], m["lastSeen"], m["strain"] or ""))
    return {"arrivals": arrivals_out, "batches": batches_out, "runningLow": low, "gone": gone,
            "debuts": debut_list(hist, day)}


class FirstOnShelf:
    """Когда партия — сорт бренда при этом THC — впервые стояла на полке, что мы читаем.
    Отвечает (день, точно ли) или None.

    День — самый ранний, когда у сорта бренда было это THC где угодно, под любой
    записью производителя и сорта (same_grower, same_strain). У своей записи THC
    сравнивается как партия (same_batch), у другой — только та же цифра: до сотых, или
    округление более точной («28.2» и 28.19), но не соседняя («Special Reserve Kosher
    Kush» 34,62 — не «Kosher Kush» 34,61).

    Точно — только когда этот день и есть появление партии везде, где её видно: каждый
    магазин, где она стоит (THC тот же) и где сорт появился не позже этого дня, либо
    получил сорт именно в этот день, будучи прочитанным и раньше, надёжно и не окном,
    либо в этот день подтвердил её как новую партию. Если хоть один магазин держал сорт
    раньше и стал показывать это THC без подтверждённой новой партии — меню начали
    показывать THC позже (24 сентября 2026), или партию сменили незаметно, — день
    только нижняя граница: партия стояла уже тогда. Так же с первым днём чтений, с
    первым чтением магазина, с окном в меню побольше и с полкой, которую в тот день
    переписало наше чтение. Поступление того же сорта в другой магазин с другим THC
    партию не датирует. Через 60 дней подтверждения забываются, и точный день тоже
    становится границей.

    Без бренда, без THC и при целом THC — None: «|blue dream» при 28,41 — чей угодно,
    сорт без THC — не партия, а целое — округление, которое партии не называет (28 —
    это и 27,6, и 28,4)."""

    def __init__(self, hist):
        self.hist = hist
        self.began = load_began(hist)
        self.lineage = Lineage(hist)
        self.variants = {}
        self.batched = defaultdict(list)
        for b in hist["batches"]:
            self.batched[b["licence"], b["key"]].append((b["seen"], b["thc"]))
        self.shifted = defaultdict(list)
        for x in hist.get("shifts", ()):
            self.shifted[x["licence"], x["key"]].append((x["seen"], x["before"], x["after"]))
        self.spans = defaultdict(list)
        for lic, seen in hist["seen"].items():
            for key, entry in seen.items():
                first, _last, thc, _shaky = parse(entry)
                self.spans[key].append((lic, first, thc))
        self.windows = {}

    def family(self, key):
        """Другие записи того же сорта у того же производителя, у которых есть THC."""
        if key not in self.variants:
            brand, strain = key.split("|", 1)
            self.variants[key] = [o for o in self.lineage.pool(brand)
                                  if o != key and o in self.hist["thc"] and same_strain(strain, strain_of(o))]
        return self.variants[key]

    @staticmethod
    def same_figure(a, b):
        return abs(a - b) < 0.005 or (places(a) != places(b) and same_batch(a, b))

    def window(self, day):
        if day not in self.windows:
            self.windows[day] = windowed(self.hist, day)
        return self.windows[day]

    def steady(self, lic, day):
        """Читали ли магазин и до этого дня, надёжно ли прочитан он в этот день и не окно ли он."""
        log = self.hist["activity"].get(lic, ())
        return (lic not in self.window(day) and any(e[0] < day for e in log)
                and any(e[0] == day and (e[4] if len(e) > 4 else 1) for e in log))

    def __call__(self, key, thc):
        if not key or not key.split("|", 1)[0] or not thc:
            return None
        thc = float(thc)
        if thc.is_integer():
            return None
        keys = [key] + self.family(key)
        match = {k: (same_batch if k == key else self.same_figure) for k in keys}
        days = [first for k in keys for value, first in self.hist["thc"].get(k, ()) if match[k](value, thc)]
        if not days:
            return None
        since = min(days)
        if not self.began or since <= self.began:
            return since, False
        clean = None
        for k in keys:
            for lic, first, values in self.spans[k]:
                if first > since or not any(match[k](v, thc) for v in values):
                    continue
                new_batch = [day for day, value in self.batched[lic, k] if match[k](value, thc)]
                shifts = [(day, before) for day, before, after in self.shifted[lic, k]
                          if any(match[k](v, thc) for v in after)]
                came = [day for day in new_batch] + [day for day, _b in shifts]
                if first < since and came and min(came) > since:
                    continue  # этот магазин получил партию позже
                if first == since:
                    ok = self.steady(lic, since)
                elif since in new_batch:
                    ok = lic not in self.window(since)
                else:
                    # Сменил в этот день видимое THC на это — пополнение; было пусто —
                    # партия могла стоять здесь и раньше, без THC.
                    ok = any(day == since and before for day, before in shifts) and self.steady(lic, since)
                clean = ok if clean is None else clean and ok
        return since, bool(clean)


def debut_list(hist, day):
    """Дебюты, о которых сайту есть что сказать: стоящие сейчас хоть на одной полке и
    дебютировавшие за неделю. Дебют — со всеми записями сорта (keys): поздними
    записями его самого и дебютами того же дня под похожим именем, в том числе под
    другой подписью того же производителя. seenAt — в скольких магазинах сорт
    появлялся с первого дня, shops — где он сейчас; days — сколько дней от первого
    появления до чтения."""
    lineage = Lineage(hist)
    carried = defaultdict(dict)
    for lic, seen in hist["seen"].items():
        for key, entry in seen.items():
            carried[key][lic] = parse(entry)[1] is None
    spellings = defaultdict(list)
    for a in hist["arrivals"]:
        spellings[a["key"]].append((a["brand"], a["strain"]))
    taken = set()
    out = []
    # Раньше и шире — первым: дебют того же дня под похожим именем к нему и примкнёт.
    for key, first in sorted(hist["debuts"].items(), key=lambda kv: (kv[1], -len(carried[kv[0]]), kv[0])):
        if first > day or key in taken:
            continue
        family = lineage.family(key, first, taken)
        taken.update(family)
        shops = {}
        for member in family:
            for lic, standing in carried[member].items():
                shops[lic] = shops.get(lic, False) or standing
        now = sorted(lic for lic, standing in shops.items() if standing)
        days = (date.fromisoformat(day) - date.fromisoformat(first)).days
        if not now and days >= WAVE_DAYS:
            continue
        # Имя — той записи, что стоит в большем числе магазинов сейчас, и так, как его
        # пишут меню: в names помнятся только сорта двух магазинов и больше.
        named = max(family, key=lambda k: (sum(carried[k].values()), len(carried[k]), k == key))
        found = [sp for k in family for sp in spellings[k]]
        brand, strain = display(hist, named, [b for b, _s in found],
                                [st for st_key in (named,) for _b, st in spellings[st_key]]
                                or [st for _b, st in found])
        out.append({"key": key, "keys": sorted(k for k in family if k in carried), "brand": brand,
                    "strain": strain, "first": first, "days": days, "seenAt": len(shops), "shops": now})
    out.sort(key=lambda d: (d["days"] >= WAVE_DAYS, -d["seenAt"], d["first"], d["strain"] or ""))
    return out


STATES = ("active", "stale", "quiet", "asleep", "dead", "partial")
FROZEN = {1: "quiet", 2: "asleep", 3: "dead"}
DRY = {1: "stale", 2: "asleep"}


def vitality(hist, day):
    """Живёт ли магазин: {лицензия: состояние и почему}. Правила — в описании модуля."""
    recent = hist["sweeps"][-RECENT_SWEEPS:]
    window = (date.fromisoformat(day) - timedelta(days=MOVES_DAYS - 1)).isoformat()
    delivered = {}
    for a in hist["arrivals"] + hist["pending"]:
        delivered[a["licence"]] = max(delivered.get(a["licence"], ""), a["seen"])
    days_to = lambda d: (date.fromisoformat(day) - date.fromisoformat(d)).days
    partial = windowed(hist, day)
    out = {}
    for lic, log in hist["activity"].items():
        last_read, size = log[-1][0], log[-1][1]
        if last_read not in recent:
            out[lic] = {"state": "unread", "size": size, "lastRead": last_read}
            continue
        # Первое чтение сравнить не с чем, и в тишину оно не идёт.
        streak = 0
        for entry in reversed(log[1:]):
            if entry[2] or entry[3]:
                break
            streak += 1
        changed = log[len(log) - 1 - streak][0]
        quiet = days_to(changed)
        lately = [e for e in log[1:] if e[0] >= window]
        trusted = sum(1 for e in lately if (e[4] if len(e) > 4 else 1))
        # Завоза не было с тех пор, как начали читать, — значит, с первого чтения.
        last_delivery = delivered.get(lic) or log[0][0]
        dry = days_to(last_delivery)
        info = {"size": size, "since": changed, "quietDays": quiet, "quietReads": streak,
                "lastDelivery": last_delivery, "dryDays": dry,
                "changes": sum(e[2] + e[3] for e in lately), "lastRead": last_read}
        if len(log) <= QUIET_READS:
            out[lic] = {"state": "new", **info}
            continue
        # В окне ни завоза, ни тишины не видно.
        if lic in partial:
            out[lic] = {"state": "partial", "frozen": False, **info}
            continue
        frozen = 0
        if streak >= QUIET_READS and quiet >= QUIET_DAYS:
            frozen = 1 + min((0 if size >= SMALL_SHELF else 1 if size >= TINY_SHELF else 2)
                             + (quiet >= ASLEEP_DAYS), 2)
        steady = bool(lately) and trusted >= TRUSTED_SHARE * len(lately)
        dry_level = 0 if not steady or dry < STALE_DAYS else 1 if dry < ASLEEP_DAYS else 2
        if frozen and frozen >= dry_level:
            state = FROZEN[frozen]
        elif dry_level:
            state = DRY[dry_level]
        else:
            state = "active" if steady or frozen else "unsteady"
        # Застыла ли полка целиком — сильнейший из двух фактов, его и покажет сайт.
        out[lic] = {"state": state, "frozen": bool(frozen), **info}
    return out


def signals():
    """Страница сайта читает готовое: считать дважды, на двух языках, — значит однажды
    посчитать по-разному."""
    hist = load()
    if not hist["sweeps"]:
        raise SystemExit("история пуста — сигналам не из чего взяться")
    day = hist["sweeps"][-1]
    out = {
        "about": "Что пришло на полки за неделю, что уходит и что ушло за две — по data/shelf-history.json. "
                 "Пишется scripts/shelf-history.py signals после ежедневного прогона; читает страница /moves/.",
        "day": day,
        "rules": {"newDays": WAVE_DAYS, "waveShelves": WAVE_SHELVES, "movesDays": MOVES_DAYS,
                  "lowBelow": LOW_BELOW, "lowPeak": LOW_PEAK, "gonePeak": GONE_PEAK},
        **moves(hist, day),
        # Для сайта — только те, про кого есть что сказать: живые молчат.
        "shops": {lic: v for lic, v in sorted(vitality(hist, day).items()) if v["state"] in STATES[1:]},
    }
    tmp = SIGNALS.with_suffix(".tmp")
    tmp.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
    tmp.replace(SIGNALS)
    print(f"{SIGNALS.relative_to(ROOT)}: {day} — новых {len(out['arrivals'])}, партий {len(out['batches'])}, "
          f"уходят {len(out['runningLow'])}, ушли {len(out['gone'])}")


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
    missing = [part for part in empty() if part not in hist]
    for part, blank in empty().items():
        hist.setdefault(part, blank)
    if "known" in missing or "debuts" in missing:
        seed_debuts(hist)
    hist["began"] = load_began(hist)
    return hist


def load_began(hist):
    """День первого чтения не забывается, в отличие от sweeps, где помнятся последние
    шестьдесят; история, писанная до began, ещё помнит его в sweeps."""
    return hist.get("began") or (hist.get("sweeps") or [None])[0]


def seed_debuts(hist):
    """known и debuts для истории, писанной до них: первый день сорта — самое раннее,
    что помнят полки, дебюты — подтверждённые завозы в этот самый день. Верно, пока
    из истории ничего не забылось: ей меньше 60 дней (чтения начались 6 сентября)."""
    known = {}
    for seen in hist["seen"].values():
        for key, entry in seen.items():
            first = parse(entry)[0]
            if first < known.get(key, "9999"):
                known[key] = first
    hist["known"] = known
    hist["debuts"] = {}
    note_debuts(hist, sorted(hist["arrivals"], key=lambda a: a["seen"]))


def collector_at(ref):
    """Отпечаток того, чем читали: хеши файлов READER в этом коммите."""
    blobs = []
    for path in READER:
        got = subprocess.run(["git", "rev-parse", f"{ref}:{path}"], cwd=ROOT, capture_output=True, text=True)
        blobs.append(got.stdout.strip() if got.returncode == 0 else "-")
    return hashlib.sha1(" ".join(blobs).encode()).hexdigest()[:10]


# Промо-пробник — «(Sample) Bouket - mylar - Sunkist», продаётся за цент. Он на
# странице магазина с пометкой, но это не сорт, который магазин держит: в
# историю, партии и новинки он не идёт. Сборщик ставит PROMOTIONAL_SAMPLE; по
# названию — для полок, прочитанных до этой пометки.
SAMPLE = re.compile(r"(^|[^a-z])samples?([^a-z]|$)", re.I)


def is_sample(l):
    return "PROMOTIONAL_SAMPLE" in (l.get("warnings") or []) or bool(SAMPLE.search(l.get("strainNameRaw") or ""))


def listings_of(raw):
    rows = json.loads(raw)
    rows = rows if isinstance(rows, list) else rows.get("listings", [])
    return [l for l in rows if not is_sample(l)]


# День чтения — нью-йоркский, а не по UTC. Полночь UTC — восемь вечера в
# Нью-Йорке: 5 октября плановый прогон оборвался, ручной начался в 17:55 и
# кончил после полуночи UTC, и его полки легли в историю под 6-м — а
# настоящий прогон 6-го нашёл свой день «уже в истории» и сложить не смог.
# Магазины живут по нью-йоркским часам, и владелец смотрит по ним же.
NEW_YORK = ZoneInfo("America/New_York")


def ny_day(stamp):
    """Нью-йоркская дата момента: строки ISO (capturedAt) или секунд от эпохи."""
    if isinstance(stamp, (int, float)):
        moment = datetime.fromtimestamp(stamp, timezone.utc)
    else:
        text = str(stamp or "").strip()
        if not text:
            return ""
        try:
            moment = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return text[:10]
        if moment.tzinfo is None:
            moment = moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(NEW_YORK).strftime("%Y-%m-%d")


def today():
    return datetime.now(NEW_YORK).strftime("%Y-%m-%d")


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
            f"сборщик глубже {c.get('deeper', 0)} ({c.get('deeperShops', 0)} маг., линейкой или "
            f"с подтверждением оставлено {c.get('deeperKept', 0)}), "
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
            day_ref.setdefault(ny_day(int(stamp)), ref)
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
        f"сторону — {c.get('deeper', 0)} в {where(c.get('deeperShops', 0))} (из них всё же "
        f"засчитано как линейка бренда или подтверждено другими магазинами — {c.get('deeperKept', 0)}); "
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
    out += leaving_section(hist, day, c, names)
    out += vitality_section(hist, day, names)
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
    shops_now = carrying(groups)
    ranked = []
    for (key, thc), found in groups.items():
        shops = shops_now[(key, thc)]
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


def leaving_section(hist, day, c, names):
    m = moves(hist, day)
    shops = lambda lics: ", ".join(sorted(names.get(lic, lic) for lic in lics)[:4]) + (
        f" и ещё {len(lics) - 4}" if len(lics) > 4 else "")
    out = ["", f"**Уходят** — стоял в {LOW_PEAK} и более магазинах за {MOVES_DAYS} дней, осталось меньше "
           f"{LOW_BELOW}: {len(m['runningLow'])}; уходы с полок, прочитанных ненадёжно, не считаются "
           f"(сегодня таких {c.get('departedShaky', 0)} из {c.get('departed', 0) + c.get('departedShaky', 0)})", ""]
    for x in m["runningLow"][:12]:
        out.append(f"- **{x['brand'] or 'бренд не указан'} · {x['strain']}** — было {x['peak']} "
                   f"({x['peakDay'][8:10]}.{x['peakDay'][5:7]}), сейчас {len(x['now'])}: {shops(x['now'])}")
    if not m["runningLow"]:
        out.append("_нет_")
    out += ["", f"**Ушли** — стоял хотя бы в {GONE_PEAK} магазинах и пропал со всех прочитанных полок: "
            f"{len(m['gone'])}", ""]
    for x in m["gone"][:12]:
        out.append(f"- **{x['brand'] or 'бренд не указан'} · {x['strain']}** — было {x['peak']}, последний раз "
                   f"{x['lastSeen'][8:10]}.{x['lastSeen'][5:7]}: {shops(x['lastShops'])}")
    if not m["gone"]:
        out.append("_нет_")
    return out


def vitality_section(hist, day, names):
    v = vitality(hist, day)
    counts = Counter(x["state"] for x in v.values())
    cov_path = ROOT / "data/menu-coverage.json"
    menu = json.loads(cov_path.read_text()) if cov_path.exists() else {}
    out = ["", "**Спящие и мёртвые магазины** — полку читаем, а на неё ничего не приходит или она "
           "вовсе не меняется. Снаружи это похоже и на магазин, который не торгует, и на меню, "
           "которое не обновляют; «похоже, мёртвый» — повод проверить руками.", "",
           f"- живых {counts['active']}, не пополняются {counts['stale']}, тихих {counts['quiet']}, "
           f"спящих {counts['asleep']}, похоже, мёртвых {counts['dead']}; читаем меньше четырёх раз — "
           f"{counts['new']}; видим только кусок меню — {counts['partial']}, чтение неустойчиво — "
           f"{counts['unsteady']}, три прогона не читаются — {counts['unread']} (это наша сторона)"]
    label = {"dead": "похоже, мёртвый", "asleep": "спит", "quiet": "тихий", "stale": "не пополняется"}
    for state in ("dead", "asleep", "quiet", "stale"):
        for lic, x in sorted(((lic, x) for lic, x in v.items() if x["state"] == state),
                             key=lambda kv: (kv[1]["size"], -kv[1]["dryDays"])):
            why = [f"{x['size']} {plural(x['size'], 'сорт', 'сорта', 'сортов')} цветка"]
            seen_all = (menu.get(lic) or {}).get("productsSeen")
            if seen_all:
                why[0] += f" из {seen_all} товаров меню"
            if x["frozen"]:
                why.append(f"без изменений {x['quietDays']} {plural(x['quietDays'], 'день', 'дня', 'дней')}")
            why.append(f"без завоза {x['dryDays']} {plural(x['dryDays'], 'день', 'дня', 'дней')}")
            out.append(f"- **{names.get(lic, lic)}** — {label[state]}: " + ", ".join(why))
    # Список для сборщика: этим меню нужно читать больше, чем первую страницу.
    partial = sorted((x["size"], names.get(lic, lic)) for lic, x in v.items() if x["state"] == "partial")
    if partial:
        out.append("- видим только кусок меню — новинки и уходы отсюда не считаются: "
                   + ", ".join(f"{name} ({size})" for size, name in partial))
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
        "P": lambda i, d: shelf("P", d, extra=[f"Stock {n}" for n in range(20)])
        + ([row("P", f"Page two {n}", d, brand=f"Brand{n}") for n in range(6)] if i >= 2 else []),
        # Тот же рост, но линейкой одного бренда: это поставка.
        "L": lambda i, d: shelf("L", d, extra=[f"Stock {n}" for n in range(20)])
        + ([row("L", f"Lineup {n}", d, brand="Revert") for n in range(6)] if i >= 2 else []),
        # Смесь брендов, но один из новых сортов в тот же день пришёл в другие
        # магазины — это та же поставка.
        "K": lambda i, d: shelf("K", d, extra=[f"Stock {n}" for n in range(20)]
                                + (["Garlic Patties"] if i >= 2 else []))
        + ([row("K", f"Mix {n}", d, brand=f"Other{n}") for n in range(5)] if i >= 2 else []),
        # Тот же рост, но в день, когда сборщик не менялся, — это завоз.
        "Q": lambda i, d: shelf("Q", d, extra=[f"Stock {n}" for n in range(20)]
                                + ([f"Drop {n}" for n in range(6)] if i >= 3 else [])),
        # Маленькая полка: три новых сорта — больше 15% её, но это завоз, а не
        # переписанная полка.
        "S": lambda i, d: shelf("S", d, drop=[f"Old {n}" for n in range(10)],
                                extra=[f"Small Drop {n}" for n in range(3)] if i >= 2 else []),
        # Большая полка, сборщик сменился, шесть новых разных брендов и ни одного
        # ушедшего — но полка выросла меньше чем на десятую: это поставка.
        "U": lambda i, d: shelf("U", d, extra=[f"Stock {n}" for n in range(60)])
        + ([row("U", f"Delivery {n}", d, brand=f"Mixed{n}") for n in range(6)] if i >= 2 else []),
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
        # Завоз сорта, который с первого дня стоит у K, L, P, Q и U: не дебют.
        "M": lambda i, d: shelf("M", d, extra=["Stock 3"] if i >= 2 else []),
        # Завоз сорта без бренда: дебютом не бывает.
        "O": lambda i, d: shelf("O", d) + ([row("O", "Nameless", d, brand=None)] if i >= 2 else []),
        # Старый сорт бренда под новой записью: завоз, но не дебют.
        "RW": lambda i, d: shelf("RW", d, extra=["Old 7 - Preground"] if i >= 2 else []),
        # Дебют того же дня под другой записью и поздняя запись волны — тот же дебют.
        "HS": lambda i, d: shelf("HS", d, extra=["Find - Crusty Crustacean"] if i >= 2 else []),
        "GV": lambda i, d: shelf("GV", d, extra=["Garlic Patties Flower"] if i >= 3 else []),
        # «Find - Old 9s» не похож на «Old 9» сам, но похож на «Old 9s» того же дня.
        "HW": lambda i, d: shelf("HW", d, extra=["Old 9s"] if i >= 2 else []),
        "HX": lambda i, d: shelf("HX", d, extra=["Find - Old 9s"] if i >= 2 else []),
        # Старый сорт Find под подписью «Find OG» — тот же производитель, не дебют.
        "BR": lambda i, d: shelf("BR", d) + ([row("BR", "Old 11", d, brand="FindOG")] if i >= 2 else []),
        # Опечатка, которую similar() не ловит: «Cap Junkie» при «Cap Junky» с первого дня.
        "SP": lambda i, d: shelf("SP", d, extra=["Cap Junky"]),
        "SQ": lambda i, d: shelf("SQ", d, extra=["Cap Junkie"] if i >= 2 else []),
        # Мелькнул на третьем чтении и не устоял, завозом пришёл в другой магазин на
        # четвёртом: дебют — с третьего.
        "E2": lambda i, d: shelf("E2", d, extra=["Late Bloomer"] if i == 2 else []),
        "LB": lambda i, d: shelf("LB", d, extra=["Late Bloomer"] if i >= 3 else []),
        # Впервые увиден в магазине, который в тот день прочитан впервые, — мог стоять
        # там давно: не дебют, хоть завозом и пришёл потом в другой.
        "N2": lambda i, d: shelf("N2", d) + [row("N2", "Old Timer", d, thc=21.21)] if i >= 2 else [],
        "OT": lambda i, d: shelf("OT", d, extra=["Old Timer"] if i >= 3 else []),
        # Партия, которая у производителя с первого дня стоит под другой подписью.
        "VA": lambda i, d: shelf("VA", d) + [row("VA", "Grape Ape", d, brand="FindOG", thc=23.45)],
        "VB": lambda i, d: shelf("VB", d) + ([row("VB", "Grape Ape", d, thc=23.45)] if i >= 2 else []),
        # Сорт пришёл в AX с одним THC, а в AY, где стоял без THC, показали другое.
        "AX": lambda i, d: shelf("AX", d) + ([row("AX", "Twin Peak", d, thc=20.55)] if i >= 2 else []),
        "AY": lambda i, d: shelf("AY", d) + [row("AY", "Twin Peak", d, thc=21.55 if i >= 2 else None)],
        # Та же партия у «Find OG», записанная точнее; и соседняя цифра — другая партия.
        "PV": lambda i, d: shelf("PV", d) + [row("PV", "Purple Velvet", d, brand="FindOG", thc=31.2),
                                             row("PV", "Kosher Kush", d, brand="FindOG", thc=34.61)],
        "PW": lambda i, d: shelf("PW", d) + ([row("PW", "Purple Velvet", d, thc=31.19),
                                              row("PW", "Kosher Kush", d, thc=34.62)] if i >= 2 else []),
        # Тот же сорт у другого производителя партию не датирует.
        "LS": lambda i, d: shelf("LS", d) + [row("LS", "Lone Star", d, brand="Other", thc=25.25)]
        + ([row("LS", "Lone Star", d, thc=25.25)] if i >= 2 else []),
        # Партия пришла в LB1, а в LB2, где сорт стоял с другой партией, — днём позже.
        "LB1": lambda i, d: shelf("LB1", d) + ([row("LB1", "Late Batch", d, thc=22.22)] if i >= 2 else []),
        "LB2": lambda i, d: shelf("LB2", d) + [row("LB2", "Late Batch", d, thc=22.22 if i >= 3 else 19.19)],
    }
    # Уходит: стоял в шести магазинах, с четвёртого дня — в двух.
    for n in range(1, 7):
        plan[f"R{n}"] = lambda i, d, lic=f"R{n}": shelf(
            lic, d, extra=["Fading Strain"] if i < 3 or lic in ("R1", "R2") else [])
    # Ушёл: стоял в трёх и пропал отовсюду.
    for n in range(1, 4):
        plan[f"V{n}"] = lambda i, d, lic=f"V{n}": shelf(lic, d, extra=["Vanishing Strain"] if i < 3 else [])
    # Магазины переименовали сорт: он не ушёл.
    for n in range(1, 6):
        plan[f"W{n}"] = lambda i, d, lic=f"W{n}": shelf(
            lic, d, extra=["Rename Me"] if i < 3 else ["Rename Me Flower"])
    # Полка Z за день потеряла треть: её уходам не верится, и сорт, который
    # стоял ещё в двух магазинах, не «ушёл» из трёх.
    plan["Z"] = lambda i, d: shelf("Z", d, extra=(["Collapse Strain"] + [f"Z extra {n}" for n in range(10)])
                                   if i < 3 else [])
    for n in range(1, 3):
        plan[f"Y{n}"] = lambda i, d, lic=f"Y{n}": shelf(lic, d, extra=["Collapse Strain"] if i < 3 else [])
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
    expect("не устоял", fourth["flicker"], 2)  # E и E2
    expect("новый магазин без прошлого", third["unsteady"], 2 * (len(base) + 1) + 1)  # N и N2 с Old Timer
    expect("сборщик сменился", (third.get("collectorChanged"), fourth.get("collectorChanged")), (1, None))
    expect("чтение стало глубже", (third["deeper"], third["deeperShops"], third.get("deeperKept")), (18, 3, 7))
    expect("линейка бренда — завоз", sum(1 for a in hist["arrivals"] if a["licence"] == "L"), 6)
    expect("смесь брендов — не завоз", any(a["licence"] in ("P",) for a in hist["arrivals"]), False)
    expect("подтверждённый другими — завоз, а смесь вокруг — нет",
           sorted(a["key"] for a in hist["arrivals"] if a["licence"] == "K"), ["find|garlic patties"])
    expect("тот же рост без смены сборщика", sum(1 for a in hist["arrivals"] if a["licence"] == "Q"), 6)
    expect("мелкий завоз в день смены сборщика", any(a["licence"] == "A" for a in hist["arrivals"]), True)
    expect("завоз на маленькую полку", sum(1 for a in hist["arrivals"] if a["licence"] == "S"), 3)
    expect("поставка большой полке в день смены сборщика", sum(1 for a in hist["arrivals"] if a["licence"] == "U"), 6)
    again = [r for make in plan.values() for r in make(4, days[4])]
    expect("второй прогон того же дня", fold(hist, days[4], again, "v2"), None)
    found = waves(hist, days[4])
    expect("волна", [(k, len({a["shelf"] for a in arr})) for k, arr in found], [("find|garlic patties", 4)])
    expect("общая витрина — одна полка", len({a["shelf"] for a in hist["arrivals"] if a["licence"] in ("F1", "F2")}), 1)
    expect("ушедшее помнит последнее чтение", hist["seen"]["D"]["find|old 5"], f"{days[0]}/{days[1]}")
    expect("стоящее открыто", hist["seen"]["A"]["find|crusty crustacean"], f"{days[2]}/{OPEN}")
    expect("новая партия", [(b["licence"], b["key"], b["thc"], b["before"], b["seen"], b["confirmed"])
                            for b in hist["batches"]],
           [("T1", "find|batch strain", 22.35, [20.11], days[2], days[3]),
            # Сорт стоял в LB2 при 19.19, в LB1 пришёл при 22.22: это и завоз, и новая партия.
            ("LB1", "find|late batch", 22.22, [19.19], days[2], days[3])])
    expect("кандидат партии", (third["batchCandidates"], fourth["batchConfirmed"]), (2, 2))
    expect("чтение потенции сменилось", (third["thcRewritten"], third["thcRewrittenShops"]), (10, 1))
    expect("THC впервые показан", third["thcNewlyShown"], 2)  # T5 и AY
    expect("THC помнится по полке", hist["seen"]["T1"]["find|batch strain"], f"{days[0]}/{OPEN} 22.35")
    m = moves(hist, days[4], rows=[])
    expect("уходит", [(x["strain"], x["now"], x["peak"]) for x in m["runningLow"]],
           [("Fading Strain", ["R1", "R2"], 6)])
    expect("ушёл", [(x["strain"], x["lastSeen"], x["peak"], x["lastShops"]) for x in m["gone"]],
           [("Vanishing Strain", days[2], 3, ["V1", "V2", "V3"])])
    expect("уходы с обвалившейся полки не верятся", (fourth.get("departedShaky"),
                                                    hist["seen"]["Z"]["find|z extra 0"].endswith(" " + SHAKY)), (11, True))
    expect("имя ушедшего помнится", hist["names"].get("find|vanishing strain"), ["Find", "Vanishing Strain"])
    expect("новые за неделю — волна первой", m["arrivals"][0]["strain"], "Garlic Patties")
    arrived_keys = {a["key"] for a in m["arrivals"]}
    expect("завозы, которые не дебюты, — тоже завозы",
           ("find|stock 3" in arrived_keys, "|nameless" in arrived_keys, "find|old 7 - preground" in arrived_keys),
           (True, True, True))
    expect("дебют", (hist["debuts"].get("find|crusty crustacean"), hist["debuts"].get("find|garlic patties"),
                     "find|stock 3" in hist["debuts"], "|nameless" in hist["debuts"],
                     "find|old 7 - preground" in hist["debuts"], "find|old 9s" in hist["debuts"],
                     "find|find - old 9s" in hist["debuts"]), (days[2], days[2], False, False, False, False, False))
    expect("тот же производитель под другой подписью, опечатка, первый день — магазин, читанный впервые",
           ("findog|old 11" in arrived_keys, "findog|old 11" in hist["debuts"],
            "find|cap junkie" in arrived_keys, "find|cap junkie" in hist["debuts"],
            "find|old timer" in arrived_keys, "find|old timer" in hist["debuts"]),
           (True, False, True, False, True, False))
    expect("дебют с первого появления, если завоз пришёл чтением позже", hist["debuts"].get("find|late bloomer"),
           days[2])
    expect("один производитель", [same_grower(a, b) for a, b in (
        ("zips", "zipsog"), ("majormicro", "major"), ("purps", "purpsny"), ("thebotanist", "botanist"),
        ("acreagethebotanist", "botanist"), ("woodstock", "woodstockheritagestrains"), ("redo", "redo96"),
        ("flor", "florette"), ("budd", "buddingbliss"), ("hash", "hashtaghoney"), ("smoke", "smokeland"),
        ("find", ""))], [True] * 7 + [False] * 5)
    expect("один сорт", [same_strain(a, b) for a, b in (
        ("cap junkie", "cap junky"), ("b.a.m", "bam"), ("moon galeto", "moon gelato"), ("black scott", "black scotti"),
        ("blue cream", "blue dream"), ("gelato 33", "gelato 41"), ("billionaire", "millionaire"),
        ("lemon cherry gelato", "lemon cherry"))], [True] * 4 + [False] * 3 + [True])
    first_on_shelf = FirstOnShelf(hist)
    expect("первый день партии на полках: точно, или не раньше чем", [first_on_shelf(*q) for q in (
        ("find|brand new", 24.44),     # завоз подтвердился
        ("find|brand new", 24.4),      # та же партия, записанная короче
        ("find|batch strain", 22.35),  # новая партия подтвердилась
        ("find|batch strain", 20.11),  # стояла с первого чтения
        ("find|old timer", 21.21),     # впервые — в магазине, прочитанном впервые
        ("find|grape ape", 23.45),     # у производителя с первого дня под «Find OG»
        ("find|shown strain", 23.45),  # THC показали на полке, где сорт уже стоял без него
        ("find|twin peak", 20.55),     # пришёл в AX с этим THC
        ("find|twin peak", 21.55),     # а в AY стоял раньше, без THC: не точно
        ("find|purple velvet", 31.19), # у «Find OG» с первого дня как 31.2
        ("find|kosher kush", 34.62),   # 34.61 у «Find OG» — другая партия
        ("find|lone star", 25.25),     # у «Other» — другой производитель
        ("find|late batch", 22.22),    # в LB2 она пришла позже, сменив видимое THC
        ("find|brand new", 24.0),      # целое THC партии не называет
        ("find|brand new", None), ("|nameless", 20.5), ("find|never seen", 30.12))],
        [(days[2], True), (days[2], True), (days[2], True), (days[0], False), (days[2], False),
         (days[0], False), (days[2], False), (days[2], True), (days[2], False), (days[0], False),
         (days[2], True), (days[2], True), (days[2], True), None, None, None, None])
    expect("смена THC на полке записана", sorted((x["licence"], x["seen"], x["before"], x["after"])
                                                 for x in hist["shifts"] if x["licence"] in ("AY", "LB2")),
           [("AY", days[2], [], [21.55]), ("LB2", days[3], [19.19], [22.22])])
    window_shop = [["2026-02-01", 45, 45, 0]] + [[f"2026-02-{d}", 45, 7, 7, 1] for d in (10, 15, 16, 17)]
    calm_shop = [["2026-02-01", 45, 45, 0]] + [[f"2026-02-{d}", 45, 0, 0, 1] for d in (10, 15, 16)] + [["2026-02-17", 46, 1, 0, 1]]
    tiny = {**empty(), "began": "2026-02-01", "sweeps": ["2026-02-01", "2026-02-10", "2026-02-15", "2026-02-16", "2026-02-17"],
            "activity": {"W": window_shop, "C": calm_shop},
            "seen": {"W": {"find|window strain": "2026-02-17/.. 22.22"}, "C": {"find|calm strain": "2026-02-17/.. 21.21"}},
            "thc": {"find|window strain": [[22.22, "2026-02-17"]], "find|calm strain": [[21.21, "2026-02-17"]]},
            "known": {"find|window strain": "2026-02-17", "find|calm strain": "2026-02-17"}}
    # Партия, подтверждённая как новая, в истории, писанной до shifts.
    tiny["activity"]["B"] = calm_shop
    tiny["seen"]["B"] = {"find|batch only": "2026-02-01/.. 23.33"}
    tiny["thc"]["find|batch only"] = [[19.91, "2026-02-01"], [23.33, "2026-02-17"]]
    tiny["known"]["find|batch only"] = "2026-02-01"
    tiny["batches"] = [{"licence": "B", "key": "find|batch only", "seen": "2026-02-17", "thc": 23.33}]
    expect("окно в меню побольше дня не уточняет; новая партия уточняет",
           (FirstOnShelf(tiny)("find|window strain", 22.22), FirstOnShelf(tiny)("find|calm strain", 21.21),
            FirstOnShelf(tiny)("find|batch only", 23.33)),
           (("2026-02-17", False), ("2026-02-17", True), ("2026-02-17", True)))
    expect("подпись лицензии — тот же производитель", (same_grower("j", "jmicro"), same_grower("j", "jx")), (True, False))
    expect("первый день чтений помнится", (hist["began"], load_began({"sweeps": ["2026-09-06"]})),
           (days[0], "2026-09-06"))
    expect("через запись того же дня", (similar("find|find - old 9s", "find|old 9"),
                                        "find|find - old 9s" in arrived_keys), (False, True))
    expect("первый день помнится", hist["known"].get("find|crusty crustacean"), days[2])
    listed = {d["key"]: d for d in m["debuts"]}
    expect("дебют на сайте: записи, где появлялся, где стоит, сколько дней",
           [(d["keys"], d["seenAt"], d["shops"], d["days"])
            for d in (listed["find|garlic patties"], listed["find|crusty crustacean"])],
           [(["find|garlic patties", "find|garlic patties flower"], 6, ["F1", "F2", "G", "GV", "H", "K"], 2),
            (["find|crusty crustacean", "find|find - crusty crustacean"], 2, ["A", "HS"], 2)])
    expect("одна запись — один дебют", [d["key"] for d in m["debuts"]
                                        if {"find|find - crusty crustacean", "find|garlic patties flower"} & set(d["keys"])],
           ["find|garlic patties", "find|crusty crustacean"])
    expect("самый широкий дебют первым", m["debuts"][0]["key"], "find|garlic patties")
    reseeded = json.loads(json.dumps(hist))
    del reseeded["known"], reseeded["debuts"]
    seed_debuts(reseeded)
    expect("дебюты восстанавливаются из истории", reseeded["debuts"], hist["debuts"])
    later = (date.fromisoformat(days[4]) + timedelta(days=WAVE_DAYS)).isoformat()
    expect("неделю спустя ушедший дебют сайту не нужен",
           [d["key"] for d in debut_list({**hist, "seen": {"A": hist["seen"]["A"]}}, later)
            if d["key"] == "find|garlic patties"], [])
    forgotten = json.loads(json.dumps(hist))
    for seen in forgotten["seen"].values():
        seen.pop("find|crusty crustacean", None)
    prune(forgotten, days[4])
    expect("дебют помнится, пока стоит хоть одна его запись", "find|crusty crustacean" in forgotten["debuts"], True)
    for seen in forgotten["seen"].values():
        seen.pop("find|find - crusty crustacean", None)
    prune(forgotten, days[4])
    expect("дебют забывается вместе с сортом", ("find|crusty crustacean" in forgotten["debuts"],
                                               "find|crusty crustacean" in forgotten["known"]), (False, True))
    fake = empty()
    fake["sweeps"] = ["2026-02-01", "2026-02-10", "2026-02-15", "2026-02-16", "2026-02-17"]
    fake["arrivals"] = [{"licence": "busy", "seen": "2026-02-15"}, {"licence": "quietbig", "seen": "2026-02-08"},
                        {"licence": "stale", "seen": "2026-02-08"}]
    fake["activity"] = {
        "busy": [["2026-02-01", 80, 80, 0], ["2026-02-15", 80, 2, 1], ["2026-02-16", 81, 1, 0], ["2026-02-17", 81, 0, 0]],
        # Товар уходит, новое девять дней не приходит.
        "stale": [["2026-02-01", 60, 60, 0], ["2026-02-08", 60, 3, 1]]
        + [[f"2026-02-{d}", 60 - d + 9, 0, 1, 1] for d in (10, 15, 16, 17)],
        # Полка меняется, но наши чтения ненадёжны: о завозах не судим.
        "shaky": [["2026-02-01", 60, 60, 0]] + [[f"2026-02-{d}", 60, 5, 5, 0] for d in (10, 15, 16, 17)],
        # Размер тот же, а сорта каждый раз другие: видим окно, а не полку.
        "window": [["2026-02-01", 45, 45, 0]] + [[f"2026-02-{d}", 45, 7, 7, 1] for d in (10, 15, 16, 17)],
        "quietbig": [["2026-02-01", 80, 80, 0], ["2026-02-08", 80, 1, 1]] + [[f"2026-02-{d}", 80, 0, 0] for d in (10, 15, 16, 17)],
        "asleepsmall": [["2026-02-01", 20, 20, 0], ["2026-02-08", 20, 0, 1]] + [[f"2026-02-{d}", 20, 0, 0] for d in (10, 15, 16, 17)],
        "deadtiny": [["2026-01-20", 2, 2, 0]] + [[f"2026-02-{d:02d}", 2, 0, 0] for d in (1, 10, 15, 16, 17)],
        "fresh": [["2026-02-16", 40, 40, 0], ["2026-02-17", 40, 0, 0]],
        "gone": [["2026-02-01", 50, 50, 0], ["2026-02-10", 50, 0, 0]],
    }
    got = {lic: x["state"] for lic, x in vitality(fake, "2026-02-17").items()}
    expect("живёт ли магазин", got, {"busy": "active", "quietbig": "quiet", "asleepsmall": "asleep",
                                     "deadtiny": "dead", "fresh": "new", "gone": "unread",
                                     "stale": "stale", "shaky": "unsteady", "window": "partial"})
    expect("одна партия", (same_batch(28, 28.41), same_batch(28.4, 28.41), same_batch(22.3, 22.36),
                           same_batch(25, 25.3), same_batch(28.41, 28.51), same_batch(27, 30.52),
                           same_batch(26.49, 28.41)), (True, True, True, True, False, False, False))
    expect("похожие", (similar("find|old 5", "find|old 5 flower"), similar("find|gelato", "jeeter|gelato"),
                       similar("|crusty crustacean", "find|crusty crustacean"),
                       similar("find|blue dream", "find|blueberry")), (True, False, True, False))
    # Ручной прогон вечера 5 октября кончил в 01:01 UTC 6-го: это ещё 5-е.
    expect("день по Нью-Йорку", (ny_day("2026-10-06T01:01:00.000Z"), ny_day("2026-10-06T15:36:00Z"),
                                 ny_day("2026-01-15T04:30:00Z"), ny_day(1791248460)),
           ("2026-10-05", "2026-10-06", "2026-01-14", "2026-10-05"))
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
    elif command == "signals":
        signals()
    else:
        raise SystemExit(__doc__)
