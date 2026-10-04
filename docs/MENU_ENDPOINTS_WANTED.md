# Магазины, которым нужен адрес меню

Работающих магазинов в реестре: **330**. Обход заходит в **262**, полку отдают **238**.

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

## Пусто — 24

| Магазин | Город | Сайт | Почему пусто |
|---|---|---|---|
| Astoria Bud Boutique | Astoria | https://astoriabudboutique.com | страница не открылась |
| Weed Mart By New Metro | Bayside | https://newmetro.club | страница вернула ноль товаров |
| Conbud | Bronx | https://www.conbudbx.com | страница не открылась |
| Caffiend LLC | Brooklyn | https://thebushwicknyc.com | страница вернула ноль товаров |
| HAPPY BUDS BROOKLYN | Brooklyn | https://www.happybudsbk.com | страница вернула ноль товаров |
| HERBOLOGY | Brooklyn | https://herbologynyc.com | страница вернула ноль товаров |
| MZDZ Corp | Brooklyn | http://www.coneyislandcannabisny.com | страница не открылась |
| OTEC | Brooklyn | https://oftheearthcanna.com | страница вернула ноль товаров |
| Tiki Leaves LLC | Brooklyn | http://www.tikileaves.com | ссылку на меню не нашли |
| Twisted Vibration LLC | Brooklyn | https://twistedvibration.com | ссылку на меню не нашли |
| Upstate Edge, LLC | Brooklyn | https://ignyteny.com | robots.txt запрещает — **не трогать** |
| Curaleaf NY, LLC | Forest Hills | https://curaleaf.com | товары есть (6), цветка нет |
| Purple Buds, Inc. | Jackson Heights | https://pbuds.com | страница вернула ноль товаров |
| Down To Earth Canna Inc | Jamaica | https://sageseed.com | страница не открылась |
| Dispensary Near Me by Liberty Buds | Little Neck | https://420expressway.com | страница не открылась |
| CannaBees | Maspeth | https://cannabeesdispensary.com | ссылку на меню не нашли |
| Fluent | New York | https://www.etain.com | страница вернула ноль товаров |
| Green Rise Inc. | New York | https://greenriseny.com | страница не открылась |
| Housing Works Cannabis Co. | New York | https://hwcannabis.co | страница вернула ноль товаров |
| The Hootch LLC | New York | https://www.sweetlife.nyc | страница вернула ноль товаров |
| THE GOAT DISPENSARY | Rego Park | https://www.thegoatdispensary.com | ссылку на меню не нашли |
| Green Land Retail LLC | Staten Island | https://greenlandny.com | страница вернула ноль товаров |
| Fluent | White Plains | https://etainhealth.com/ | страница вернула ноль товаров |
| Cannabis Group NY, LLC | Whitestone | https://ignyteny.com | robots.txt запрещает — **не трогать** |

✳️ — адрес в `menu-endpoints.json` уже есть, и всё равно пусто: значит записанный адрес больше не тот.

## Полка читается не до конца — 2

Здесь адрес есть и меню отвечает, но отдаёт меньше, чем само объявляет. Листание таким не помогло — им нужен прямой адрес категории.

| Магазин | Держим | Меню объявляет | Сайт |
|---|---:|---:|---|
| The Bridge A Cannabis Experience | 4 | 373 | https://thebridgecannabis.com |
| KushKlub NY LLC | 57 | 95 | https://kushklub.com |

## Сюда не ходим

- **62** магазинов на паузе (`data/menu-paused.json`): их меню Dutchie открывается в окне dutchie.com, которое с 24.09 отвечает автоматическим браузерам только проверкой «вы не бот?». Плановый прогон к ним не ходит, на сайте остаётся их последняя прочитанная полка. По воскресеньям сборщик всё-таки заходит — так будет видно, если Dutchie откроется.
- **0** магазинов держат меню на Leafly или Weedmaps. Это чужая витрина, а не витрина магазина, и читать её мы не будем — адрес такого меню в файл добавлять не нужно.
- **6** магазинов не имеют сайта в реестре; см. `docs/MISSING_WEBSITES.md`. Найдётся сайт — магазин сам попадёт в обход.

