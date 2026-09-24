# Магазины, которым нужен адрес меню

Работающих магазинов в реестре: **330**. Обход заходит в **310**, полку отдают **248**.

Этот файл собирается скриптом `scripts/menu-endpoints-wanted.py` по последнему прогону — правит его не рука, а следующий запуск.

## Что с этим делать

Открыть сайт магазина, найти страницу, где реально видны товары с весами, и дописать строку в `data/menu-endpoints.json`:

```json
{
  "licenseNumber": "OCM-CAURD-24-000051",
  "menuUrl": "https://thespotdispensary.com/menu/?category=flowers",
  "platform": "BLAZE",
  "robotsAllows": true,
  "flowerVisibleWithoutLogin": true,
  "ageGate": "none",
  "checkedAt": "2026-09-18",
  "notes": "Прямая ссылка на категорию Flower."
}
```

- `menuUrl` — адрес, на котором видно **цветок**, а не главная магазина. Категория лучше общего меню: на общем меню коллектор читает вейпы и съедобное вместе с банками.
- `platform` — `DUTCHIE`, `BLAZE`, `TREEZ`, `IHEARTJANE`, `MEADOW`, `PROPRIETARY` или `OTHER`. Не знаете — `OTHER`.
- `flowerVisibleWithoutLogin` — видно ли товары **без входа в аккаунт**. Если меню требует логин, ставьте `false` и `menuUrl: null`: за логин мы не ходим.
- `ageGate` — `none`, `simple-button`, `date-of-birth-form` или `login`.
- Пустое поле лучше правдоподобной догадки. Не уверены — `null` и напишите почему в `notes`.

Проверить перед коммитом: `python scripts/validate-menu-endpoints.py`.

## Пусто — 62

| Магазин | Город | Сайт | Почему пусто |
|---|---|---|---|
| Astoria Bud Boutique | Astoria | https://astoriabudboutique.com | страница не открылась |
| The Bridge A Cannabis Experience | Astoria | https://thebridgecannabis.com | ссылку на меню не нашли |
| Canna Buddha Corp | Bayside | https://cannabuddha.us | страница вернула ноль товаров |
| Weed Mart By New Metro | Bayside | https://newmetro.club | страница вернула ноль товаров |
| Conbud | Bronx | https://www.conbudbx.com | страница не открылась |
| Freshly Baked NYC | Bronx | https://freshlybaked.nyc | страница вернула ноль товаров |
| Garden Bliss LLC | Bronx | https://ourthcshop.com/bronx/ | ссылку на меню не нашли |
| Nube NYC LLC | Bronx | https://nube.nyc/home# | ссылку на меню не нашли |
| Victory Dispensary LLC ✳️ | Bronx | https://www.victorydispensaryny.com | страница вернула ноль товаров |
| Bud City Cannabis LLC ✳️ | Brooklyn | https://budcityny.com | товары есть (12), цветка нет |
| Caffiend LLC | Brooklyn | https://thebushwicknyc.com | страница вернула ноль товаров |
| HAPPY BUDS BROOKLYN | Brooklyn | https://www.happybudsbk.com | страница вернула ноль товаров |
| HERBOLOGY | Brooklyn | https://herbologynyc.com | страница вернула ноль товаров |
| High of Brooklyn LLC | Brooklyn | https://kayablissnyc.com | страница вернула ноль товаров |
| KBAT ENTERPRISES INC. | Brooklyn | https://beleafny.com | страница вернула ноль товаров |
| MZDZ Corp | Brooklyn | http://www.coneyislandcannabisny.com | страница не открылась |
| OTEC | Brooklyn | https://oftheearthcanna.com | страница вернула ноль товаров |
| PRIME TIME CANNABIS | Brooklyn | https://primetimecannabisnyc.com | страница вернула ноль товаров |
| Ramon Reyes LLC | Brooklyn | https://happymunkey.com | страница вернула ноль товаров |
| Rustik 471, LLC | Brooklyn | https://rustiksmokes.com | страница вернула ноль товаров |
| Tiki Leaves LLC | Brooklyn | http://www.tikileaves.com | ссылку на меню не нашли |
| Twisted Vibration LLC | Brooklyn | https://twistedvibration.com | ссылку на меню не нашли |
| Upstate Edge, LLC | Brooklyn | https://ignyteny.com | robots.txt запрещает — **не трогать** |
| Curaleaf NY, LLC | Forest Hills | https://curaleaf.com | товары есть (6), цветка нет |
| RAGTIME NEWSTAND AND LOTTO, INC. | Howard Beach | https://www.indoortreez.com | ссылку на меню не нашли |
| Purple Buds, Inc. | Jackson Heights | https://pbuds.com | страница вернула ноль товаров |
| Down To Earth Canna Inc | Jamaica | https://sageseed.com | страница не открылась |
| Dispensary Near Me by Liberty Buds | Little Neck | https://420expressway.com | страница не открылась |
| MAMBO WELLNESS INC. | Long Island City | https://saintcannabisny.com | ссылку на меню не нашли |
| CannaBees | Maspeth | https://cannabeesdispensary.com | страница вернула ноль товаров |
| ZenZest Cannabis Dispensary | New Hyde Park | https://zenzest.com | страница вернула ноль товаров |
| 69 Graham Dispensary LLC | New York | https://www.thealchemy.nyc | страница вернула ноль товаров |
| Blue Forest Farms Dispensary LLC | New York | https://blueforestfarmsdispensary.com | страница вернула ноль товаров |
| Charlie Fox | New York | https://www.shopcharliefox.com | ссылку на меню не нашли |
| Fluent | New York | https://www.etain.com | страница вернула ноль товаров |
| Good Company | New York | https://goodcompanyshop.com | ссылку на меню не нашли |
| Green Rise Inc. | New York | https://greenriseny.com | страница не открылась |
| Happy Munkey | New York | https://happymunkey.com | страница вернула ноль товаров |
| Hells Kitchen Cannabis Company | New York | https://www.hkcc.nyc | ссылку на меню не нашли |
| KushKlub NY LLC | New York | https://kushklub.com | страница вернула ноль товаров |
| Leafy NYC II LLC | New York | https://www.newamsterdam.nyc | страница вернула ноль товаров |
| Nucleus Dispensary Inc. | New York | https://nucleusdispensary.com | страница вернула ноль товаров |
| Rezidue | New York | https://rezidueny.com/ | страница вернула ноль товаров |
| SOFACLUB CANNABIS | New York | https://www.sofaclub.nyc | страница вернула ноль товаров |
| Sparkboro Inc | New York | https://sparkborony.com | ссылку на меню не нашли |
| Swan Lake Equity LLC | New York | https://www.sofaclub.nyc | страница вернула ноль товаров |
| THE HERBAL CARE THC LLC | New York | https://thctheherbalcare.com/ | страница вернула ноль товаров |
| The Alchemy | New York | https://www.thealchemy.nyc | страница вернула ноль товаров |
| The Hootch LLC | New York | https://www.sweetlife.nyc | ссылку на меню не нашли |
| Tru Cannabis | New York | https://trucannabisny.com | страница вернула ноль товаров |
| Twinn Leaf LLC | New York | https://twinnleafnyc.com | ссылку на меню не нашли |
| GreenCup | Rego Park | https://greencup.nyc | страница вернула ноль товаров |
| THE GOAT DISPENSARY | Rego Park | https://www.thegoatdispensary.com | ссылку на меню не нашли |
| Caurd Wellness LLC | Ridgewood | https://herbarium.la | ссылку на меню не нашли |
| Hudson Park Agency LLC | Rosedale | https://ourthcshop.com | страница вернула ноль товаров |
| Green Land Retail LLC | Staten Island | https://greenlandny.com | ссылку на меню не нашли |
| Studio57NY | Staten Island | https://studio57ny.com | страница вернула ноль товаров |
| ZenZest LLC | Staten Island | https://zenzest.com | страница вернула ноль товаров |
| RENAISSANT NYC | Sunnyside | https://renaissant.nyc | ссылку на меню не нашли |
| Fluent | White Plains | https://etainhealth.com/ | страница вернула ноль товаров |
| Cannabis Group NY, LLC | Whitestone | https://ignyteny.com | robots.txt запрещает — **не трогать** |
| Budr Cannabis | Yonkers | https://budrcannabis.com | страница вернула ноль товаров |

✳️ — адрес в `menu-endpoints.json` уже есть, и всё равно пусто: значит записанный адрес больше не тот.

## Полка читается не до конца — 2

Здесь адрес есть и меню отвечает, но отдаёт меньше, чем само объявляет. Листание таким не помогло — им нужен прямой адрес категории.

| Магазин | Держим | Меню объявляет | Сайт |
|---|---:|---:|---|
| Bad Maryjane | 2 | 1149 | https://maryjanecannabisco.com |
| High Tidez CI | 122 | 140 | https://hightidezci.com |

## Сюда не ходим

- **14** магазинов держат меню на Leafly или Weedmaps. Это чужая витрина, а не витрина магазина, и читать её мы не будем — адрес такого меню в файл добавлять не нужно.
- **6** магазинов не имеют сайта в реестре; см. `docs/MISSING_WEBSITES.md`. Найдётся сайт — магазин сам попадёт в обход.

