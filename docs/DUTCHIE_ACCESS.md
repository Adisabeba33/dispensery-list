# Dutchie: почему часть магазинов перестала читаться

_Заметка от 2026-09-24. Решение — после планового прогона 25.09._

## Что случилось

С 24.09 примерно треть магазинов на Dutchie перестала читаться. Сборщик
держит их последнюю удачную полку, поэтому на сайте они видны как «still
carry an earlier reading».

| Прогон | Dutchie прочитано |
|---|---|
| 23.09, плановый (#24) | 74 из 101 (73%) |
| 24.09, внеплановый (#25) | 42 из 101 (41%) |
| 24.09, плановый (#26) | 44 из 101 (43%) |

## Что выяснили

Падают не случайные магазины, а один тип.

- **Dutchie Plus** — меню встроено в сайт самого магазина (адреса вида
  `/stores/…/products/flower`). Эти магазины читались во всех трёх прогонах.
- **Окно dutchie.com** — сайт магазина показывает меню в окне с dutchie.com
  (адреса с `?dtche[…]`), или меню открывается прямо на dutchie.com. Эти
  магазины прочитались 23.09 и не прочитались ни в одном прогоне 24.09.

Диагностика (menu-collect, run 36055631047, 14 таких магазинов): сборщик
приходит на правильный адрес, никуда не уходит, но от dutchie.com не приходит
ни одного ответа с товарами — только пустые документы и служебные скрипты
проверки «вы не бот?». Этому контейнеру dutchie.com отвечал прямо: 403.
Регрессию в нашем коде проверили и исключили: правило «зайти в Flower изнутри»
на этих страницах не срабатывает.

Две гипотезы, между которыми выберет завтрашний прогон:

1. **Нагрузка.** 24.09 мы ходили к Dutchie необычно много: внеплановый прогон,
   плановый, три диагностики и ручные пробы. Защита стала строже к нам.
2. **Новая защита Dutchie** на dutchie.com с 24.09 для всех автоматических
   браузеров. В пользу этого — одни и те же магазины падали на разных
   серверах GitHub.

## Что уже готово (v1.2.1)

- `menu-render.mjs --provider DUTCHIE | --skip-provider DUTCHIE | --pause <сек>`.
- Workflow **Dutchie menus, slowly** (`.github/workflows/menu-dutchie.yml`) —
  только ручной запуск, пауза 60 с перед каждым магазином, та же очередь, что
  у планового прогона (никогда не идут одновременно).
- Плановый прогон не менялся (кроме исправления старта со свежего main).

## Медленный прогон 25.09 — результат

Run 36130424372, 11:37–15:15 UTC: только Dutchie, пауза 60 с перед каждым
магазином, партии по 15 — в 20–30 раз мягче обычного прогона.

| | Прочитано |
|---|---|
| Всего Dutchie | 44 из 101 (44%) — как 24.09 |
| «Сломались 24.09» (окно dutchie.com) | 1 из 30 (Emerald Carroll Gardens) |
| «Стабильные» (Dutchie Plus) | 40 из 41 |

Медленность не помогла: при в разы меньшей нагрузке результат тот же до
магазина. Значит, это не наша нагрузка, а защита dutchie.com от автоматических
браузеров — третий исход ниже. Dutchie Plus (меню на сайте магазина) открыт.
Публикация прошла, все партии валидны. Плановый прогон того же дня — второе
измерение на обычной скорости.

## Решение после планового прогона 25.09

Посчитать, прочитались ли магазины из списка «Сломались 24.09» ниже.

- **Вернулись (≈ как 23.09)** — виновата была нагрузка 24.09. Оставляем как
  есть, лишних прогонов к Dutchie не делаем.
- **Вернулись частично** — снижаем нагрузку: выносим из планового прогона
  только магазины с окном dutchie.com и читаем их отдельным медленным
  прогоном. Сейчас медленный прогон берёт всех на Dutchie — сузить его до
  окна dutchie.com (Dutchie Plus пусть остаётся в плановом).
- **Не вернулись совсем (те же 30)** — это защита Dutchie, паузы её не
  пробьют. Обходить её (маскировать бота под человека, менять адреса ради
  блокировки) не будем. Честный путь: договориться — попросить магазины или
  Dutchie о доступе к их API для партнёров.

Пока решение не принято, у этих магазинов на сайте видна дата их последнего
чтения.

### Сломались 24.09 — встроенное окно dutchie.com (прочитаны 23.09, не прочитаны ни в одном прогоне 24.09) — 30

| Лицензия | Магазин |
|---|---|
| OCM-RETL-24-000178 | AA 301 W. 45th St Inc. |
| OCM-RETL-24-000242 | Bellanova |
| OCM-CAURD-25-000279 | Cannafamily Dispensary |
| OCM-RETL-24-000087 | Cloud 914 |
| OCM-CAURD-24-000084 | ENFLOR LLC |
| OCM-CAURD-24-000146 | Emerald Dispensary |
| OCM-CAURD-26-000336 | Emerald Dispensary Carroll Gardens |
| OCM-CAURD-24-000210 | Exotic Herbals LLC |
| OCM-CAURD-26-000350 | GOOD VIBES NYC, inc |
| OCM-RETL-24-000171 | GUARDIAN WELLNESS LLC |
| OCM-CAURD-23-000023 | Gotham Buds LLC |
| OCM-RETL-25-000418 | Green Bar |
| OCM-RETL-24-000106 | HEALTHY CHOICE SEAVIEW LLC |
| OCM-CAURD-24-000131 | Hibernica |
| OCM-RETL-26-000511 | Hibernica Central Park |
| OCM-CAURD-26-000340 | Mello Tymes LLC |
| OCM-CAURD-24-000065 | Mighty Lucky Inc. |
| OCM-RETL-24-000008 | My Bud 420 Inc. |
| OCM-RETL-25-000460 | NATURAL LEAF INC. |
| OCM-RETL-24-000147 | NY Cannabis Co |
| OCM-CAURD-24-000153 | NY ELITE CANNABIS |
| OCM-CAURD-25-000229 | OC DISPENSARY |
| OCM-CAURD-24-000127 | QUBE |
| OCM-CAURD-24-000096 | SMILEY EXOTICS |
| OCM-RETL-24-000241 | SOULMATE |
| OCM-CAURD-25-000304 | Say Less |
| OCM-RETL-24-000261 | Stash House |
| OCM-RETL-25-000441 | Sunflower Dispensary |
| OCM-CAURD-24-000057 | The Emerald Dispensary |
| OCM-MICR-25-000223 | Three Cord Cannabis |

### Стабильно читаются — Dutchie Plus на сайте магазина (прочитаны во всех трёх прогонах) — 41

| Лицензия | Магазин |
|---|---|
| OCM-RETL-24-000104 | Alta Dispensary |
| OCM-CAURD-24-000064 | BRONX JOINT |
| OCM-RETL-25-000450 | Dankley Canna |
| OCM-RETL-25-000319 | Dankley Canna |
| OCM-CAURD-25-000254 | EXCITE UNLIMITED LLC |
| OCM-CAURD-23-000030 | Elevate Cannabis |
| OCM-RETL-24-000064 | GREEN FLOWER WELLNESS |
| OCM-RETL-25-000438 | GREEN FLOWER WELLNESS |
| OCM-RETL-24-000233 | GREEN FLOWER WELLNESS 5 LLC |
| OCM-CAURD-24-000173 | Gaslight Dispensary |
| OCM-CAURD-23-000009 | Gotham Bowery |
| OCM-CAURD-25-000238 | Gotham Chelsea |
| OCM-CAURD-24-000206 | Gotham Williamsburg |
| OCM-RETL-24-000266 | Green Apple Distribution Ltd. |
| OCM-CAURD-24-000166 | Green Genius NYC |
| OCM-CAURD-24-000102 | HII |
| OCM-RETL-24-000154 | Herbwell |
| OCM-RETL-24-000260 | Herbwell |
| OCM-RETL-24-000170 | High Tidez CI |
| OCM-CAURD-24-000185 | Highstone |
| OCM-CAURD-26-000330 | Hii |
| OCM-CAURD-24-000104 | Kings House of Fire |
| OCM-CAURD-24-000112 | Leafology Cannabis Company |
| OCM-CAURD-25-000290 | Lighthouse Cannabis |
| OCM-RETL-24-000048 | MIDNIGHT MOON CORP |
| OCM-RETL-25-000403 | MILLIGRAMS |
| OCM-RETL-24-000032 | Maison Canal |
| OCM-CAURD-24-000047 | NYCCE |
| OCM-CAURD-24-000151 | Nicklz |
| OCM-CAURD-24-000183 | NugHub NY LLC |
| OCM-CAURD-24-000140 | Nuna Harvest LLC |
| OCM-CAURD-24-000077 | Polanco Brothers Corp |
| OCM-CAURD-24-000073 | Puro vita enterprises inc. |
| OCM-CAURD-24-000207 | R & R Remedies |
| OCM-CAURD-24-000062 | Silk Road NYC |
| OCM-RETL-24-000026 | Silky Strain |
| OCM-CAURD-25-000288 | Strains for Life Powered by Indoor Treez |
| OCM-RETL-24-000103 | THE VAULT |
| OCM-CAURD-23-000020 | Terp Bros |
| OCM-CAURD-25-000294 | Terp Bros |
| OCM-CAURD-24-000124 | The purple owl Dispensary |
| OCM-CAURD-23-000044 | VERDI |
| OCM-RETL-24-000146 | Vaporize, Inc. |
| OCM-RETL-25-000298 | Verdi Park Slope |
| OCM-RETL-24-000020 | YONKERS DREAM LLC |

### Не читаются ни разу (23.09 и оба прогона 24.09) — отдельные причины — 26

| Лицензия | Магазин |
|---|---|
| OCM-RETL-25-000368 | 69 Graham Dispensary LLC |
| OCM-RETL-25-000360 | BK Greenery LLC |
| OCM-CAURD-24-000145 | BY ANY OTHER NAME |
| OCM-CAURD-24-000142 | Bud & Honey Dispensary Inc. |
| OCM-RETL-24-000063 | Bud City Cannabis LLC |
| OCM-RETL-25-000285 | Buzzy NY, LLC |
| OCM-CAURD-24-000052 | Cannavita |
| OCM-RETL-24-000144 | Case Management |
| OCM-CAURD-24-000196 | Fireleaf, LLC |
| OCM-MICR-24-000186 | Green Klub Inc. |
| OCM-RETL-25-000274 | Greene street cannabis co. |
| OCM-CAURD-23-000034 | Grow Together |
| OCM-RETL-24-000127 | High of Brooklyn LLC |
| OCM-CAURD-24-000211 | Kaya Bliss Dispensary |
| OCM-RETL-24-000011 | OET INC. |
| OCM-RETL-25-000454 | Poppin |
| OCM-CAURD-25-000303 | Rezidue |
| OCM-CAURD-24-000217 | Stashmaster |
| OCM-RETL-25-000351 | Studio57NY |
| OCM-CAURD-25-000270 | Superfly Dispensary LLC |
| OCM-CAURD-25-000317 | Take N Toke Herbal Healing Solutions Inc |
| OCM-CAURD-24-000214 | The Alchemy |
| OCM-RETL-25-000417 | The Highline |
| OCM-CAURD-26-000351 | Tru Cannabis |
| OCM-RETL-25-000318 | Twenty8Gramz |
| OCM-RETL-25-000428 | Twinn Leaf LLC |

Остальные 4 магазина меняли статус между прогонами: Big City Flavors, FUMI Dispensary LLC, Late Bloomers NYC LLC, OZ Dispensary.
