# ТЗ: три задачи, которые можно делать параллельно с кодом

Проект: справочник лицензированных диспансеров NY (NYC + Вестчестер).
Репозиторий: `Adisabeba33/dispensery-list`, ветка `agent/menu-endpoints-nyc`.
Сайт уже работает: 456 магазинов, 696 сортов цветка с 13 магазинов.

Задачи ниже независимы друг от друга и от того, что делается в коде. Делайте по
порядку: первая даёт результат, который включается в работу в тот же день.

**Общие правила доступа — те же, что и раньше, и они не обсуждаются.**
robots.txt читается и соблюдается по каждому хосту. Запросы — по одному, с
паузой. User-Agent честный. Капчи, логины и антибот-защиту не обходим. Простую
кнопку «мне 21» нажимаем — это уведомление, а не защита. Если ToS платформы
запрещает автоматический сбор — останавливаемся и пишем об этом в отчёт, а не
ищем обход. Меню, живущие на Leafly и Weedmaps, — чужая собственность и вне
области работ.

**Правило, важнее всех остальных: пустое поле лучше правдоподобной догадки.**
Не знаете — оставляйте `null` и пишите почему. Выдуманное значение здесь стоит
дороже, чем отсутствующее, потому что весь смысл справочника в том, что его
можно проверить.

---

## Задача 1 (главная). Адреса меню для 27 магазинов, до которых сборщик не дошёл

### Зачем

Сборщик обошёл 40 магазинов. 13 отдали витрину, 25 не отдали вообще ничего, ещё
2 отдали только съедобное. Причина не в том, что у них нет цветка, а в том, что
код не нашёл вход: кнопка «Меню» — не ссылка, или меню живёт на другом хосте,
который сайт нигде не называет. Человек находит это за десять секунд, краулер —
нет.

Код уже умеет читать такой файл: если в `data/menu-endpoints.json` есть адрес
для лицензии, сборщик идёт прямо туда и не ищет ссылку сам. То есть ваш
результат подключается без единой строчки доработки.

### Что сдать

Файл `data/menu-endpoints.json` — массив объектов, по одному на магазин:

```json
[
  {
    "licenseNumber": "OCM-RETL-24-000171",
    "menuUrl": "https://dutchie.com/embedded-menu/guardian-wellness/products/flower",
    "platform": "DUTCHIE",
    "robotsAllows": true,
    "flowerVisibleWithoutLogin": true,
    "ageGate": "simple-button",
    "checkedAt": "2026-09-06",
    "notes": "Меню в iframe с dutchie.com; на самом сайте ссылки нет, кнопка на JS."
  }
]
```

Поля:

- `licenseNumber` — из таблицы ниже, не менять.
- `menuUrl` — **прямой адрес страницы, где видны товары**. Не главная страница
  магазина. Если есть отдельная категория «Flower» — давайте её, это лучше
  всего. Проверьте, что адрес открывается в чистом браузере (новое приватное
  окно) и товары там видны.
- `platform` — `DUTCHIE` | `BLAZE` | `TREEZ` | `IHEARTJANE` | `MEADOW` |
  `PROPRIETARY` | `OTHER`. Смотрите, на какой домен уходят запросы за товарами.
- `robotsAllows` — `true`/`false` по `robots.txt` **того хоста, где лежит
  меню**, для `User-agent: *`. Если `false` — всё равно сдайте запись с
  `menuUrl` и `false`: нам важно знать, что путь есть, но закрыт. Сборщик такой
  адрес не тронет.
- `flowerVisibleWithoutLogin` — виден ли цветок без регистрации и без ввода
  даты рождения полем (кнопка «мне 21» — это не логин).
- `ageGate` — `none` | `simple-button` | `date-of-birth-form` | `login`.
- `notes` — одна строка: что именно мешало найти вход. Это ценнее самого
  адреса, потому что по нему чинится код для остальных двухсот магазинов.

Если у магазина меню нет вообще (сайт-визитка, «coming soon», ссылка ведёт на
Weedmaps) — сдайте запись с `"menuUrl": null` и объяснением в `notes`. Это
такой же полезный результат: он снимает магазин из очереди навсегда.

### Магазины

| Лицензия | Магазин | Платформа (наша догадка) | Сайт | Что вернул сборщик |
|---|---|---|---|---|
| `OCM-CAURD-25-000281` | Flynnstoned Cannabis Company | PROPRIETARY | https://flynnstoned.com | no-flower |
| `OCM-CAURD-24-000165` | Frass Box Cannabis LLC | PROPRIETARY | https://frassboxcannabis.com | no-flower |
| `OCM-CAURD-24-000051` | ARE WE GOOD ENTERPRISES INC. | BLAZE | https://thespotdispensary.com | no-products |
| `OCM-RETL-25-000360` | BK Greenery LLC | DUTCHIE | https://www.bkgreenery.com | no-products |
| `OCM-CAURD-24-000145` | BY ANY OTHER NAME | DUTCHIE | https://byanyothernamebk.com | no-products |
| `OCM-RETL-24-000063` | Bud City Cannabis LLC | DUTCHIE | https://budcityny.com | no-products |
| `OCM-RETL-25-000285` | Buzzy NY, LLC | DUTCHIE | https://www.getbuzzy.com | no-products |
| `OCM-RETL-24-000144` | Case Management | DUTCHIE | https://qualitycontroldispensary.com/ | no-products |
| `OCM-CAURD-26-000336` | Emerald Dispensary Carroll Gardens | DUTCHIE | https://www.theemeraldny.com/carrollgardens | no-products |
| `OCM-CAURD-24-000196` | Fireleaf, LLC | DUTCHIE | https://www.fireleafny.com | no-products |
| `OCM-RETL-24-000171` | GUARDIAN WELLNESS LLC | DUTCHIE | https://guardianwellnessretail.com | no-products |
| `OCM-RETL-24-000260` | Herbwell | DUTCHIE | https://www.herbwellcannabis.com | no-products |
| `OCM-CAURD-24-000131` | Hibernica | DUTCHIE | https://shophibernica.com | no-products |
| `OCM-RETL-24-000008` | My Bud 420 Inc. | DUTCHIE | https://mybud420.com | no-products |
| `OCM-CAURD-25-000304` | Say Less | DUTCHIE | http://www.saylessny.com | no-products |
| `OCM-RETL-24-000261` | Stash House | DUTCHIE | https://stashhouseus.com | no-products |
| `OCM-RETL-24-000189` | DISPO/BK LLC | MEADOW | https://dispostore.com | no-products |
| `OCM-RETL-24-000151` | All Good Cannabis Dispensary | OTHER | https://stayallgood.com | no-products |
| `OCM-CAURD-26-000325` | Brooklyn Urban | OTHER | https://bkurbanbud.com | no-products |
| `OCM-RETL-24-000055` | ELEVATED | OTHER | https://elevated718.com | no-products |
| `OCM-CAURD-25-000305` | Flower Daddy | OTHER | https://flowerdaddy.nyc | no-products |
| `OCM-RETL-26-000488` | Freshly Baked NYC | OTHER | https://freshlybaked.nyc/ | no-products |
| `OCM-CAURD-25-000292` | Celestial Herbs | PROPRIETARY | https://celestialherbsllc.com | no-products |
| `OCM-CAURD-25-000284` | Chrome Flwrs | PROPRIETARY | https://chromeflwrs.com | no-products |
| `OCM-RETL-24-000133` | Forever 4 20 | TREEZ | https://www.forever420ny.com | no-products |
| `OCM-CAURD-25-000324` | Victory Dispensary LLC | TREEZ | https://www.victorydispensaryny.com | no-products |
| `OCM-RETL-25-000466` | 4081 Companies, LLC | — | — | no-products |
`no-flower` — магазин отдал товары, но среди них не было цветка. Скорее всего
мы попали на категорию «съедобное». Найдите категорию с цветком.

### Как проверять

Откройте сайт в приватном окне. Откройте инструменты разработчика, вкладку
Network, фильтр XHR/Fetch. Пройдите на меню как обычный посетитель. Смотрите,
на какой адрес уходит запрос, после которого появляются товары, — хост этого
запроса и есть платформа. В `menuUrl` пишите адрес **страницы**, которую видит
человек, а не адрес API.

---

## Задача 2. Терпены: сертификаты анализа

### Зачем

Из 696 собранных позиций терпены есть у 21. Это главный пробел проекта:
сенсорный профиль строится на терпенах, а магазины их почти не публикуют.
Кодом это не чинится — цифр просто нет на страницах.

Зато их публикуют **лаборатории и бренды**: COA (certificate of analysis) на
партию, обычно PDF, часто открыто лежит на сайте бренда или по QR с банки.

### Что сдать

Файл `data/strain-reference.json` по схеме `data/schema/strain-reference.schema.json`
(прочитайте её, она короткая и обязательна к соблюдению). По каждому сорту:
каноническое имя, происхождение данных, терпеновый профиль с процентами,
лаборатория, дата анализа, ссылка на сам COA.

Начните с брендов, которые уже стоят на наших полках — их 158, список в
`data/flower-listings.json` в поле `brand`. Первыми берите те, что встречаются
чаще всего: один найденный COA закрывает сразу несколько магазинов.

**Жёсткое требование к происхождению.** В поле источника:

- `LAB_COA` — только если вы держите в руках ссылку на сам сертификат.
- `MENU_LISTING` — цифра напечатана в меню магазина без сертификата.
- `STRAIN_REFERENCE` — усреднённый профиль сорта из внешней базы. Тогда
  `basis.datasetLicence` обязателен: под какой лицензией эта база отдаёт
  данные. Без указания лицензии запись не принимается.

Смешивать нельзя. Средний профиль сорта, выданный за лабораторный анализ
партии, — это ровно та ложь, ради невозможности которой построена вся схема.

---

## Задача 3. Долги реестра

Четыре списка, по каждому нужна проверка по официальному источнику
(`cannabis.ny.gov/dispensary-location-verification` и датасет
`data.ny.gov/Economic-Development/Current-OCM-Licenses/jskf-tt3q`):

1. **16 записей со статусом `UNKNOWN`** — работает магазин или нет. Найдите
   подтверждение и дайте ссылку с датой.
2. **15 лицензий, помеченных активными, но с истёкшей датой** — продлены или
   действительно истекли.
3. **17 расхождений по ZIP** между реестром и адресом магазина — какой верный.
4. **Медицинские Registered Organizations (лицензии вида `MM####D`).** В
   справочнике их нет ни одной. Схема их уже принимает — шаблон был расширен
   специально. Нужны те же поля, что у остальных записей. Сколько их всего —
   определите по датасету OCM, по типу лицензии; не берите число из головы.

Списки 1–3 достаются прямо из `data/dispensaries.json`:

```bash
# 1. Статус неизвестен
jq '[.[] | select(.operationalStatus == "UNKNOWN") | .licenseNumber]' data/dispensaries.json

# 2. Лицензия активна, но дата окончания в прошлом
jq --arg today "$(date -u +%F)" \
   '[.[] | select(.licenseStatus == "ACTIVE" and .dates.licenseExpiration < $today)
    | {licence: .licenseNumber, expires: .dates.licenseExpiration}]' data/dispensaries.json

# 3. Адрес расходится с публичным списком OCM
jq '[.[] | select(.warnings[]? | startswith("OCM public-open list address differs"))
    | {licence: .licenseNumber, zip: .address.zip, warning: .warnings}]' data/dispensaries.json
```

---

## Порядок сдачи

1. Ветка `agent/menu-endpoints-nyc`.
2. Задача 1 — отдельным коммитом, как только готова. **Не ждите остальных
   двух:** этот файл включается в сборку меню сразу.
3. Задачи 2 и 3 — своими коммитами.
4. Перед каждым коммитом: `npm test` — ноль ошибок. Схемы проверяются
   валидатором, и запись, которая их нарушает, роняет всю сборку.
5. В теле коммита — что проверено, чем подтверждено, и что осталось неясным.
   Неясное перечисляйте явно: это не признание слабости, а рабочая информация.
