# Магазины, которым нужен адрес меню

Работающих магазинов в реестре: **330**. Обход заходит в **246**, полку отдают **239**.

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
- `ageGate` — `none`, `simple-button`, `terms-checkboxes` (галочки «мне 21» и «согласен с условиями», разрешены владельцем 07.10.2026), `date-of-birth-form` или `login`.
- Пустое поле лучше правдоподобной догадки. Не уверены — `null` и напишите почему в `notes`.

Проверить перед коммитом: `python scripts/validate-menu-endpoints.py`.

## Пусто — 7

| Магазин | Город | Сайт | Почему пусто |
|---|---|---|---|
| Weed Mart By New Metro | Bayside | https://newmetro.club | стена на странице меню (cloudflare-challenge) — **не трогать** |
| Caffiend LLC ✳️ | Brooklyn | https://thebushwicknyc.com | стена на странице меню (cloudflare-challenge) — **не трогать** |
| HAPPY BUDS BROOKLYN | Brooklyn | https://www.happybudsbk.com | страница вернула ноль товаров |
| OTEC | Brooklyn | https://oftheearthcanna.com | страница вернула ноль товаров |
| Upstate Edge, LLC | Brooklyn | https://ignyteny.com | robots.txt запрещает — **не трогать** |
| Fluent | New York | https://www.etain.com | страница вернула ноль товаров |
| Cannabis Group NY, LLC | Whitestone | https://ignyteny.com | robots.txt запрещает — **не трогать** |

✳️ — адрес в `menu-endpoints.json` уже есть, и всё равно пусто: значит записанный адрес больше не тот.

## Полка читается не до конца — 9

Здесь адрес есть и меню отвечает, но отдаёт меньше, чем само объявляет. Листание таким не помогло — им нужен прямой адрес категории.

| Магазин | Держим | Меню объявляет | Сайт |
|---|---:|---:|---|
| ESH | 221 | 247 | https://esh.us/locations/rosedale-ny/ |
| Curaleaf NY, LLC | 150 | 181 | https://curaleaf.com |
| ESH | 133 | 149 | https://esh.us |
| Buzzwick Uptown | 100 | 106 | https://buzzwicknyc.com |
| Terminal 420 | 67 | 92 | https://terminal420.com |
| Society House | 79 | 80 | https://www.societyhousebk.com/ |
| Freshly Baked NYC | 41 | 49 | https://freshlybaked.nyc/ |
| OZ Dispensary | 132 | 159 | https://ozdispensary.com/ |
| MILLIGRAMS | 93 | 101 | https://milligrams.co/locations/brooklyn-ny/ |

## Сюда не ходим

- **72** магазинов на паузе (`data/menu-paused.json`): их меню Dutchie открывается в окне dutchie.com, которое с 24.09 отвечает автоматическим браузерам только проверкой «вы не бот?». Плановый прогон к ним не ходит, на сайте остаётся их последняя прочитанная полка. Проверить, не открылся ли Dutchie, можно ручным прогоном «Dutchie menus, slowly».
- **0** магазинов держат меню на Leafly или Weedmaps. Это чужая витрина, а не витрина магазина, и читать её мы не будем — адрес такого меню в файл добавлять не нужно.
- **6** магазинов не имеют сайта в реестре; см. `docs/MISSING_WEBSITES.md`. Найдётся сайт — магазин сам попадёт в обход.
- **6** магазинов запретили обход в своём `robots.txt`. Мы спросили и получили отказ — это ответ, а не пробел, и искать им адрес меню не нужно. Отказ обычно приходит не от магазина, а от платформы, на которой стоит его витрина, и тогда уходит не один магазин, а все её. Список только растёт: сайт, который не отдал `robots.txt`, считается разрешившим, так что попасть сюда можно лишь по ясно объявленному запрету.
  - MZDZ Corp — Brooklyn, http://www.coneyislandcannabisny.com
  - Tiki Leaves LLC — Brooklyn, http://www.tikileaves.com
  - Kushie — Forest Hills, https://kushieny.com
  - CannaBees — Maspeth, https://cannabeesdispensary.com
  - Good Company — New York, https://goodcompanyshop.com
  - Green Land Retail LLC — Staten Island, https://greenlandny.com

