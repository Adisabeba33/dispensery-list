# Магазины, которым нужен адрес меню

Работающих магазинов в реестре: **330**. Обход заходит в **310**, полку отдают **192**.

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

> Причины «почему пусто» появятся здесь после первого прогона, который сохранит `data/menu-coverage.json`. Пока список без них.

## Пусто — 118

| Магазин | Город | Сайт | Почему пусто |
|---|---|---|---|
| Astoria Bud Boutique | Astoria | https://astoriabudboutique.com | не проверялся в последнем прогоне |
| The Bridge A Cannabis Experience | Astoria | https://thebridgecannabis.com | не проверялся в последнем прогоне |
| Canna Buddha Corp | Bayside | https://cannabuddha.us | не проверялся в последнем прогоне |
| Weed Mart By New Metro | Bayside | https://newmetro.club | не проверялся в последнем прогоне |
| Celestial Herbs ✳️ | Bronx | https://celestialherbsllc.com | не проверялся в последнем прогоне |
| Conbud | Bronx | https://www.conbudbx.com | не проверялся в последнем прогоне |
| Freshly Baked NYC | Bronx | https://freshlybaked.nyc | не проверялся в последнем прогоне |
| Garden Bliss LLC | Bronx | https://ourthcshop.com/bronx/ | не проверялся в последнем прогоне |
| Hush | Bronx | https://hushny.com | не проверялся в последнем прогоне |
| Nube NYC LLC | Bronx | https://nube.nyc/home# | не проверялся в последнем прогоне |
| Victory Dispensary LLC ✳️ | Bronx | https://www.victorydispensaryny.com | не проверялся в последнем прогоне |
| 4081 Companies, LLC | Brooklyn | https://transcendwps.com | не проверялся в последнем прогоне |
| AT THE FACTORY | Brooklyn | https://atthefactory.co/ | не проверялся в последнем прогоне |
| Bud City Cannabis LLC ✳️ | Brooklyn | https://budcityny.com | не проверялся в последнем прогоне |
| Caffiend LLC | Brooklyn | https://thebushwicknyc.com | не проверялся в последнем прогоне |
| Chrome Flwrs ✳️ | Brooklyn | https://chromeflwrs.com | не проверялся в последнем прогоне |
| DISPO/BK LLC ✳️ | Brooklyn | https://dispostore.com | не проверялся в последнем прогоне |
| Flynnstoned Cannabis Company ✳️ | Brooklyn | https://flynnstoned.com | не проверялся в последнем прогоне |
| Forever 4 20 ✳️ | Brooklyn | https://www.forever420ny.com | не проверялся в последнем прогоне |
| HAPPY BUDS BROOKLYN | Brooklyn | https://www.happybudsbk.com | не проверялся в последнем прогоне |
| HERBOLOGY | Brooklyn | https://herbologynyc.com | не проверялся в последнем прогоне |
| High of Brooklyn LLC | Brooklyn | https://kayablissnyc.com | не проверялся в последнем прогоне |
| KBAT ENTERPRISES INC. | Brooklyn | https://beleafny.com | не проверялся в последнем прогоне |
| MZDZ Corp | Brooklyn | http://www.coneyislandcannabisny.com | не проверялся в последнем прогоне |
| OTEC | Brooklyn | https://oftheearthcanna.com | не проверялся в последнем прогоне |
| PACHA PRODUCTS NY LLC | Brooklyn | https://www.pachadispensary.com | не проверялся в последнем прогоне |
| PRIME TIME CANNABIS | Brooklyn | https://primetimecannabisnyc.com | не проверялся в последнем прогоне |
| Ramon Reyes LLC | Brooklyn | https://happymunkey.com | не проверялся в последнем прогоне |
| Rustik 471, LLC | Brooklyn | https://rustiksmokes.com | не проверялся в последнем прогоне |
| Salt City Naturals, LLC | Brooklyn | https://dagmarcannabis.com | не проверялся в последнем прогоне |
| The GARDEN CLUB | Brooklyn | https://thegardenclubbk.com/ | не проверялся в последнем прогоне |
| The Gallery at Dumbo | Brooklyn | https://thegalleryny.com | не проверялся в последнем прогоне |
| The Travel Agency Downtown Brooklyn | Brooklyn | http://thetravelagency.co | не проверялся в последнем прогоне |
| Tiki Leaves LLC | Brooklyn | http://www.tikileaves.com | не проверялся в последнем прогоне |
| Twisted Vibration LLC | Brooklyn | https://twistedvibration.com | не проверялся в последнем прогоне |
| Upstate Edge, LLC | Brooklyn | https://ignyteny.com | не проверялся в последнем прогоне |
| HIGH CLASS CONVENIENCE CORPORATION | Far Rockaway | https://www.kingsofbud.com | не проверялся в последнем прогоне |
| Gaea's Garden | Flushing | https://gaeas.garden/ | не проверялся в последнем прогоне |
| Curaleaf NY, LLC | Forest Hills | https://curaleaf.com | не проверялся в последнем прогоне |
| Kushie | Forest Hills | https://kushieny.com | не проверялся в последнем прогоне |
| RAGTIME NEWSTAND AND LOTTO, INC. | Howard Beach | https://www.indoortreez.com | не проверялся в последнем прогоне |
| Purple Buds, Inc. | Jackson Heights | https://pbuds.com | не проверялся в последнем прогоне |
| Down To Earth Canna Inc | Jamaica | https://sageseed.com | не проверялся в последнем прогоне |
| ESH | Jamaica | https://esh.us | не проверялся в последнем прогоне |
| Nirvana Springs, LLC | Jamaica | https://nirvana-springs-prod-theta.treezecomm.app | не проверялся в последнем прогоне |
| Dispensary Near Me by Liberty Buds | Little Neck | https://420expressway.com | не проверялся в последнем прогоне |
| MAMBO WELLNESS INC. | Long Island City | https://saintcannabisny.com | не проверялся в последнем прогоне |
| CannaBees | Maspeth | https://cannabeesdispensary.com | не проверялся в последнем прогоне |
| Flower Power Dispensers | Maspeth | https://www.flowerpowerdispensers.com | не проверялся в последнем прогоне |
| ZenZest Cannabis Dispensary | New Hyde Park | https://zenzest.com | не проверялся в последнем прогоне |
| Highlife Health, LLC | New Rochelle | https://highlifehealth.co | не проверялся в последнем прогоне |
| 2147 44th LLC | New York | https://carnegiehillcannabis.com | не проверялся в последнем прогоне |
| 69 Graham Dispensary LLC | New York | https://www.thealchemy.nyc | не проверялся в последнем прогоне |
| Authentic 212 LLC | New York | https://www.indoortreez.com | не проверялся в последнем прогоне |
| Ava Flower Co | New York | https://www.avaflowerco.com | не проверялся в последнем прогоне |
| Bad Maryjane | New York | https://maryjanecannabisco.com | не проверялся в последнем прогоне |
| Blue Forest Farms Dispensary LLC | New York | https://blueforestfarmsdispensary.com | не проверялся в последнем прогоне |
| Bright Elephant, LLC | New York | https://flynnstoned.com | не проверялся в последнем прогоне |
| CONBUD LLC | New York | https://conbud.com | не проверялся в последнем прогоне |
| Charlie Fox | New York | https://www.shopcharliefox.com | не проверялся в последнем прогоне |
| Dagmar Cannabis | New York | https://dagmarcannabis.com | не проверялся в последнем прогоне |
| Elevate Soho Cannabis | New York | https://elevatesohocannabis.com | не проверялся в последнем прогоне |
| FLYNNSTONED CANNABIS COMPANY | New York | https://flynnstoned.com | не проверялся в последнем прогоне |
| Flower Power Dispensers | New York | https://www.flowerpowerdispensers.com | не проверялся в последнем прогоне |
| Fluent | New York | https://www.etain.com | не проверялся в последнем прогоне |
| FlynnStoned Cannabis Company | New York | https://flynnstoned.com/dispensaries/new-york/midtown-manhattan/ | не проверялся в последнем прогоне |
| Good Company | New York | https://goodcompanyshop.com | не проверялся в последнем прогоне |
| Green Rise Inc. | New York | https://greenriseny.com | не проверялся в последнем прогоне |
| Happy Munkey | New York | https://happymunkey.com | не проверялся в последнем прогоне |
| Hells Kitchen Cannabis Company | New York | https://www.hkcc.nyc | не проверялся в последнем прогоне |
| Indoor Treez Corp. | New York | https://www.indoortreez.net | не проверялся в последнем прогоне |
| KushKlub NY LLC | New York | https://kushklub.com | не проверялся в последнем прогоне |
| Leafy NYC II LLC | New York | https://www.newamsterdam.nyc | не проверялся в последнем прогоне |
| Liberty Buds | New York | https://libertybudsnyc.com | не проверялся в последнем прогоне |
| Nucleus Dispensary Inc. | New York | https://nucleusdispensary.com | не проверялся в последнем прогоне |
| Rezidue | New York | https://rezidueny.com/ | не проверялся в последнем прогоне |
| SOFACLUB CANNABIS | New York | https://www.sofaclub.nyc | не проверялся в последнем прогоне |
| Sparkboro Inc | New York | https://sparkborony.com | не проверялся в последнем прогоне |
| Stoops NYC | New York | https://stoopsnyc.com | не проверялся в последнем прогоне |
| Swan Lake Equity LLC | New York | https://www.sofaclub.nyc | не проверялся в последнем прогоне |
| THE FLOWERY | New York | https://www.thefloweryny.com | не проверялся в последнем прогоне |
| THE HERBAL CARE THC LLC | New York | https://thctheherbalcare.com/ | не проверялся в последнем прогоне |
| THE TRAVEL AGENCY SOHO | New York | https://www.thetravelagency.co | не проверялся в последнем прогоне |
| Terrapin Greens | New York | https://www.thetravelagency.co | не проверялся в последнем прогоне |
| The Alchemy | New York | https://www.thealchemy.nyc | не проверялся в последнем прогоне |
| The Flower Pot | New York | https://www.cannabisonlex.com | не проверялся в последнем прогоне |
| The Flowery | New York | https://www.thefloweryny.com | не проверялся в последнем прогоне |
| The Flowery | New York | https://www.thefloweryny.com | не проверялся в последнем прогоне |
| The Flowery | New York | https://www.thefloweryny.com | не проверялся в последнем прогоне |
| The Hootch LLC | New York | https://www.sweetlife.nyc | не проверялся в последнем прогоне |
| The Yetti Club Corp | New York | https://www.theyetti.club/ | не проверялся в последнем прогоне |
| Tru Cannabis | New York | https://trucannabisny.com | не проверялся в последнем прогоне |
| Twinn Leaf LLC | New York | https://twinnleafnyc.com | не проверялся в последнем прогоне |
| Union Square Travel Agency: A Cannabis Store | New York | https://www.thetravelagency.co | не проверялся в последнем прогоне |
| Upstate State Collective LLC | New York | https://dagmarcannabis.com/ | не проверялся в последнем прогоне |
| Weedish LLC | New York | https://blissandlex.com | не проверялся в последнем прогоне |
| Piffords Inc | Peekskill | https://piffords.online/ | не проверялся в последнем прогоне |
| CANNABIS COWBOY | Queens | https://cannabiscowboyny.com | не проверялся в последнем прогоне |
| GreenCup | Rego Park | https://greencup.nyc | не проверялся в последнем прогоне |
| THE GOAT DISPENSARY | Rego Park | https://www.thegoatdispensary.com | не проверялся в последнем прогоне |
| Caurd Wellness LLC | Ridgewood | https://herbarium.la | не проверялся в последнем прогоне |
| Munchie's Dispensary NY LLC | Rockaway Beach | https://munchiesdispensaryny.com | не проверялся в последнем прогоне |
| Hudson Park Agency LLC | Rosedale | https://ourthcshop.com | не проверялся в последнем прогоне |
| 960 bloomingdale road LLC | Staten Island | https://www.thefloweryny.com/ | не проверялся в последнем прогоне |
| Clouditude Dispensary | Staten Island | https://clouditudedispensary.com | не проверялся в последнем прогоне |
| GEORGIA HEIGHTS, LLC | Staten Island | https://flynnstoned.com/?loc=nyc-staten-island | не проверялся в последнем прогоне |
| Green Land Retail LLC | Staten Island | https://greenlandny.com | не проверялся в последнем прогоне |
| Happy Times Cannabis Co. | Staten Island | https://happytimescannabis.com | не проверялся в последнем прогоне |
| Studio57NY | Staten Island | https://studio57ny.com | не проверялся в последнем прогоне |
| The Flowery | Staten Island | https://thefloweryny.com/ | не проверялся в последнем прогоне |
| ZenZest LLC | Staten Island | https://zenzest.com | не проверялся в последнем прогоне |
| RENAISSANT NYC | Sunnyside | https://renaissant.nyc | не проверялся в последнем прогоне |
| Fluent | White Plains | https://etainhealth.com/ | не проверялся в последнем прогоне |
| NY Flos LLC | White Plains | https://www.getflos.com/ | не проверялся в последнем прогоне |
| Cannabis Group NY, LLC | Whitestone | https://ignyteny.com | не проверялся в последнем прогоне |
| MECCA CANNABIS | Woodhaven | https://meccany.com | не проверялся в последнем прогоне |
| Budr Cannabis | Yonkers | https://budrcannabis.com | не проверялся в последнем прогоне |
| 3JsUmiNDre LLC | new york | https://flynnstoned.com/stores/flynnstoned-cannabis-dispensary-astoria-ny/ | не проверялся в последнем прогоне |

✳️ — адрес в `menu-endpoints.json` уже есть, и всё равно пусто: значит записанный адрес больше не тот.

## Сюда не ходим

- **14** магазинов держат меню на Leafly или Weedmaps. Это чужая витрина, а не витрина магазина, и читать её мы не будем — адрес такого меню в файл добавлять не нужно.
- **6** магазинов не имеют сайта в реестре; см. `docs/MISSING_WEBSITES.md`. Найдётся сайт — магазин сам попадёт в обход.

