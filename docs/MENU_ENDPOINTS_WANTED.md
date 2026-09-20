# Магазины, которым нужен адрес меню

Работающих магазинов в реестре: **330**. Обход заходит в **310**, полку отдают **216**.

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

## Пусто — 94

| Магазин | Город | Сайт | Почему пусто |
|---|---|---|---|
| Astoria Bud Boutique | Astoria | https://astoriabudboutique.com | ссылку на меню не нашли |
| The Bridge A Cannabis Experience | Astoria | https://thebridgecannabis.com | ссылку на меню не нашли |
| Canna Buddha Corp | Bayside | https://cannabuddha.us | страница вернула ноль товаров |
| Weed Mart By New Metro | Bayside | https://newmetro.club | страница вернула ноль товаров |
| Celestial Herbs ✳️ | Bronx | https://celestialherbsllc.com | страница вернула ноль товаров |
| Conbud | Bronx | https://www.conbudbx.com | страница не открылась |
| Freshly Baked NYC | Bronx | https://freshlybaked.nyc | страница вернула ноль товаров |
| Garden Bliss LLC | Bronx | https://ourthcshop.com/bronx/ | ссылку на меню не нашли |
| Hush | Bronx | https://hushny.com | страница вернула ноль товаров |
| Nube NYC LLC | Bronx | https://nube.nyc/home# | ссылку на меню не нашли |
| Victory Dispensary LLC ✳️ | Bronx | https://www.victorydispensaryny.com | страница вернула ноль товаров |
| 4081 Companies, LLC | Brooklyn | https://transcendwps.com | страница вернула ноль товаров |
| AT THE FACTORY | Brooklyn | https://atthefactory.co/ | ссылку на меню не нашли |
| Bud City Cannabis LLC ✳️ | Brooklyn | https://budcityny.com | товары есть (12), цветка нет |
| Caffiend LLC | Brooklyn | https://thebushwicknyc.com | страница вернула ноль товаров |
| DISPO/BK LLC ✳️ | Brooklyn | https://dispostore.com | страница вернула ноль товаров |
| Forever 4 20 ✳️ | Brooklyn | https://www.forever420ny.com | страница вернула ноль товаров |
| HAPPY BUDS BROOKLYN | Brooklyn | https://www.happybudsbk.com | страница вернула ноль товаров |
| HERBOLOGY | Brooklyn | https://herbologynyc.com | страница вернула ноль товаров |
| High of Brooklyn LLC | Brooklyn | https://kayablissnyc.com | страница вернула ноль товаров |
| KBAT ENTERPRISES INC. | Brooklyn | https://beleafny.com | страница вернула ноль товаров |
| MZDZ Corp | Brooklyn | http://www.coneyislandcannabisny.com | страница не открылась |
| OTEC | Brooklyn | https://oftheearthcanna.com | страница вернула ноль товаров |
| PRIME TIME CANNABIS | Brooklyn | https://primetimecannabisnyc.com | страница вернула ноль товаров |
| Ramon Reyes LLC | Brooklyn | https://happymunkey.com | страница вернула ноль товаров |
| Rustik 471, LLC | Brooklyn | https://rustiksmokes.com | страница вернула ноль товаров |
| The GARDEN CLUB | Brooklyn | https://thegardenclubbk.com/ | страница вернула ноль товаров |
| The Gallery at Dumbo | Brooklyn | https://thegalleryny.com | страница вернула ноль товаров |
| The Travel Agency Downtown Brooklyn | Brooklyn | http://thetravelagency.co | страница вернула ноль товаров |
| Tiki Leaves LLC | Brooklyn | http://www.tikileaves.com | ссылку на меню не нашли |
| Twisted Vibration LLC | Brooklyn | https://twistedvibration.com | ссылку на меню не нашли |
| Upstate Edge, LLC | Brooklyn | https://ignyteny.com | robots.txt запрещает — **не трогать** |
| HIGH CLASS CONVENIENCE CORPORATION | Far Rockaway | https://www.kingsofbud.com | страница вернула ноль товаров |
| Gaea's Garden | Flushing | https://gaeas.garden/ | ссылку на меню не нашли |
| Curaleaf NY, LLC | Forest Hills | https://curaleaf.com | товары есть (6), цветка нет |
| RAGTIME NEWSTAND AND LOTTO, INC. | Howard Beach | https://www.indoortreez.com | ссылку на меню не нашли |
| Purple Buds, Inc. | Jackson Heights | https://pbuds.com | страница вернула ноль товаров |
| Down To Earth Canna Inc | Jamaica | https://sageseed.com | страница не открылась |
| ESH | Jamaica | https://esh.us | страница вернула ноль товаров |
| Nirvana Springs, LLC | Jamaica | https://nirvana-springs-prod-theta.treezecomm.app | страница вернула ноль товаров |
| Dispensary Near Me by Liberty Buds | Little Neck | https://420expressway.com | страница не открылась |
| MAMBO WELLNESS INC. | Long Island City | https://saintcannabisny.com | ссылку на меню не нашли |
| CannaBees | Maspeth | https://cannabeesdispensary.com | ссылку на меню не нашли |
| Flower Power Dispensers | Maspeth | https://www.flowerpowerdispensers.com | страница вернула ноль товаров |
| ZenZest Cannabis Dispensary | New Hyde Park | https://zenzest.com | страница вернула ноль товаров |
| Highlife Health, LLC | New Rochelle | https://highlifehealth.co | страница вернула ноль товаров |
| 2147 44th LLC | New York | https://carnegiehillcannabis.com | страница вернула ноль товаров |
| 69 Graham Dispensary LLC | New York | https://www.thealchemy.nyc | страница вернула ноль товаров |
| Authentic 212 LLC | New York | https://www.indoortreez.com | ссылку на меню не нашли |
| Ava Flower Co | New York | https://www.avaflowerco.com | страница вернула ноль товаров |
| Bad Maryjane | New York | https://maryjanecannabisco.com | страница вернула ноль товаров |
| Blue Forest Farms Dispensary LLC | New York | https://blueforestfarmsdispensary.com | страница вернула ноль товаров |
| Charlie Fox | New York | https://www.shopcharliefox.com | ссылку на меню не нашли |
| Flower Power Dispensers | New York | https://www.flowerpowerdispensers.com | страница вернула ноль товаров |
| Fluent | New York | https://www.etain.com | страница вернула ноль товаров |
| Good Company | New York | https://goodcompanyshop.com | ссылку на меню не нашли |
| Green Rise Inc. | New York | https://greenriseny.com | страница не открылась |
| Happy Munkey | New York | https://happymunkey.com | страница вернула ноль товаров |
| Hells Kitchen Cannabis Company | New York | https://www.hkcc.nyc | ссылку на меню не нашли |
| Indoor Treez Corp. | New York | https://www.indoortreez.net | ссылку на меню не нашли |
| KushKlub NY LLC | New York | https://kushklub.com | страница вернула ноль товаров |
| Leafy NYC II LLC | New York | https://www.newamsterdam.nyc | страница вернула ноль товаров |
| Nucleus Dispensary Inc. | New York | https://nucleusdispensary.com | страница вернула ноль товаров |
| Rezidue | New York | https://rezidueny.com/ | страница вернула ноль товаров |
| SOFACLUB CANNABIS | New York | https://www.sofaclub.nyc | страница вернула ноль товаров |
| Sparkboro Inc | New York | https://sparkborony.com | ссылку на меню не нашли |
| Swan Lake Equity LLC | New York | https://www.sofaclub.nyc | страница вернула ноль товаров |
| THE HERBAL CARE THC LLC | New York | https://thctheherbalcare.com/ | страница вернула ноль товаров |
| THE TRAVEL AGENCY SOHO | New York | https://www.thetravelagency.co | страница вернула ноль товаров |
| Terrapin Greens | New York | https://www.thetravelagency.co | страница вернула ноль товаров |
| The Alchemy | New York | https://www.thealchemy.nyc | страница вернула ноль товаров |
| The Flower Pot | New York | https://www.cannabisonlex.com | товары есть (100), цветка нет |
| The Hootch LLC | New York | https://www.sweetlife.nyc | ссылку на меню не нашли |
| The Yetti Club Corp | New York | https://www.theyetti.club/ | страница вернула ноль товаров |
| Tru Cannabis | New York | https://trucannabisny.com | страница вернула ноль товаров |
| Twinn Leaf LLC | New York | https://twinnleafnyc.com | ссылку на меню не нашли |
| Union Square Travel Agency: A Cannabis Store | New York | https://www.thetravelagency.co | страница вернула ноль товаров |
| Weedish LLC | New York | https://blissandlex.com | страница вернула ноль товаров |
| Piffords Inc | Peekskill | https://piffords.online/ | страница вернула ноль товаров |
| CANNABIS COWBOY | Queens | https://cannabiscowboyny.com | страница вернула ноль товаров |
| GreenCup | Rego Park | https://greencup.nyc | страница вернула ноль товаров |
| THE GOAT DISPENSARY | Rego Park | https://www.thegoatdispensary.com | ссылку на меню не нашли |
| Caurd Wellness LLC | Ridgewood | https://herbarium.la | ссылку на меню не нашли |
| Munchie's Dispensary NY LLC | Rockaway Beach | https://munchiesdispensaryny.com | ссылку на меню не нашли |
| Hudson Park Agency LLC | Rosedale | https://ourthcshop.com | ссылку на меню не нашли |
| Green Land Retail LLC | Staten Island | https://greenlandny.com | ссылку на меню не нашли |
| Studio57NY | Staten Island | https://studio57ny.com | страница вернула ноль товаров |
| ZenZest LLC | Staten Island | https://zenzest.com | страница вернула ноль товаров |
| RENAISSANT NYC | Sunnyside | https://renaissant.nyc | ссылку на меню не нашли |
| Fluent | White Plains | https://etainhealth.com/ | страница вернула ноль товаров |
| NY Flos LLC | White Plains | https://www.getflos.com/ | товары есть (49), цветка нет |
| Cannabis Group NY, LLC | Whitestone | https://ignyteny.com | robots.txt запрещает — **не трогать** |
| MECCA CANNABIS | Woodhaven | https://meccany.com | страница вернула ноль товаров |
| Budr Cannabis | Yonkers | https://budrcannabis.com | страница вернула ноль товаров |

✳️ — адрес в `menu-endpoints.json` уже есть, и всё равно пусто: значит записанный адрес больше не тот.

## Полка читается не до конца — 15

Здесь адрес есть и меню отвечает, но отдаёт меньше, чем само объявляет. Листание таким не помогло — им нужен прямой адрес категории.

| Магазин | Держим | Меню объявляет | Сайт |
|---|---:|---:|---|
| 3JsUmiNDre LLC | 21 | 605 | https://flynnstoned.com/stores/flynnstoned-cannabis-dispensary-astoria-ny/ |
| ENFLOR LLC | 24 | 512 | https://enflor.com |
| Clouditude Dispensary | 22 | 364 | https://clouditudedispensary.com |
| FlynnStoned Cannabis Company | 20 | 403 | https://flynnstoned.com/dispensaries/new-york/midtown-manhattan/ |
| Happy Times Cannabis Co. | 38 | 121 | https://happytimescannabis.com |
| Frass Box Cannabis LLC | 39 | 135 | https://frassboxcannabis.com |
| Mello Tymes LLC | 22 | 148 | https://mellotymes.com |
| Twenty8Gramz | 31 | 208 | https://www.twenty8gramz.com |
| FLYNNSTONED CANNABIS COMPANY | 39 | 88 | https://flynnstoned.com |
| Bright Elephant, LLC | 39 | 88 | https://flynnstoned.com |
| Flynnstoned Cannabis Company | 39 | 88 | https://flynnstoned.com |
| Stoops NYC | 46 | 82 | https://stoopsnyc.com |
| The Cannabis Reserve | 12 | 160 | https://www.thereservenewyork.com |
| GEORGIA HEIGHTS, LLC | 39 | 88 | https://flynnstoned.com/?loc=nyc-staten-island |
| Exotic Herbals LLC | 90 | 112 | https://theplugny.com/ |

## Сюда не ходим

- **14** магазинов держат меню на Leafly или Weedmaps. Это чужая витрина, а не витрина магазина, и читать её мы не будем — адрес такого меню в файл добавлять не нужно.
- **6** магазинов не имеют сайта в реестре; см. `docs/MISSING_WEBSITES.md`. Найдётся сайт — магазин сам попадёт в обход.

