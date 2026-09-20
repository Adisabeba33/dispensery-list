# Task: give each shop back its own menu

**For an agent with an open network.** Everything below was measured offline
from this repository on 2026-09-20; nothing in it needs to be re-derived, and
where a number appears it is reproducible with the snippet at the end.

The job is narrow and it is a data job, not an engineering one. You are
finding **one URL per licence** and writing it into one file. Do not change the
collector.

---

## Why this exists

Shelf presence — a strain counted once per shop carrying it — is the unit
SŌMA's coverage is measured in. It is only meaningful if a shop's shelf is
that shop's shelf.

Right now, for twenty licences, it is not. A chain publishes one website, the
state registry lists that one website against every one of its licences, and
the collector reads whatever store that site defaults to and files the result
under all of them. The landing addresses say so in as many words:
`terp-bros-astoria` was read for the Ozone Park licence too;
`green-flower-wellness-oakland-gardens` for Glen Oaks and Ozone Park;
`hii-williamsburg` for a second Hii; `dankley-manhattan` for Queens Village.

**1,393 listings sit under a shop whose own menu has never been opened.**

The register already marks them `SHELF_SHARED_WITH_OTHER_LICENCES` and the
validator holds that marking, so nothing here is being hidden. What the
marking cannot do is find the other stores' menus. That is this task.

---

## The one rule that outranks the rest

> **An empty field beats a plausible guess.**

If a chain genuinely publishes no per-store menu — one shared shelf, one
warehouse — then say so and leave the licence alone. A URL you constructed by
pattern rather than opened and read is worse than no URL: it will be collected
from daily, silently, and the register will assert a shelf nobody checked.

You will be judged on how many of these you got RIGHT, not on how many rows
you filled.

---

## What you deliver

Rows appended to **`data/menu-endpoints.json`** — an array the collector reads
at startup, keyed by licence. Where a licence has a row, the collector goes
straight to that address instead of hunting for a link.

The shape, with an INVENTED example — this address has not been checked and
must not be copied into the file:

```json
{
  "licenseNumber": "OCM-CAURD-25-000294",
  "menuUrl": "https://terpbrosnyc.com/stores/terp-bros-ozone-park/products/flower",
  "platform": "OTHER",
  "robotsAllows": true,
  "flowerVisibleWithoutLogin": true,
  "ageGate": "click-through",
  "checkedAt": "2026-09-20",
  "notes": "Store picker in the header lists Astoria and Ozone Park; this is the Ozone Park slug, and the page's own header shows the Crossbay Blvd address. 60 flower products visible without logging in, none of them the same as Astoria's. Nothing on the page names a platform, so platform is OTHER rather than a guess."
}
```

Field rules:

- `menuUrl` — the **flower category** of **that store**, not the site's front
  page and not a promotional sub-category. Open it. Confirm it lists flower.
- `platform` — only if the page says so (a script host, a `powered by`, a
  `__NEXT_DATA__` key). Otherwise `"OTHER"`. Do not infer it from the design.
- `robotsAllows` — read `/robots.txt` at that origin and answer for that path.
  **If it disallows, say `false` and stop: do not collect, do not work around
  it.** A browser does not change who is welcome.
- `flowerVisibleWithoutLogin` — did YOU see products without an account?
- `ageGate` — `"none"`, `"click-through"`, `"date-of-birth"`, or `"account"`.
- `checkedAt` — the day you opened it.
- `notes` — how you knew it was the right store. This is the field a reviewer
  reads first; "found the store picker in the header and chose Glen Oaks" is
  worth more than every other field combined.
- Anything you did not check: **`null`**. Never `false`.

Leave the existing 35 rows alone.

---

## Queue A — one page, several shops (the main job)

Twenty licences, nine pages. For each group: find the site's store picker
(usually a header dropdown, sometimes `/stores`, sometimes a location page),
and get the flower category URL for **each** address below.

Several of these are platform sites whose URL already carries a store slug —
`/stores/<slug>/products/flower`. The other stores' slugs are usually siblings.
**Confirm each one by opening it and checking the address the page itself
shows.** A slug that 404s or silently redirects to the default store is the
failure mode to watch: if the products are identical to the page already in
this brief, you have the same store again, not a second one.

### 6 licences read from one page — 46 listings each

Page read: `https://www.thefloweryny.com/shop/category/flower`

| Licence | Shop | Address | Website in the registry |
|---|---|---|---|
| `OCM-CAURD-23-000041` | The Flowery | 3022 Veterans Rd W, Staten Island | https://thefloweryny.com/ |
| `OCM-CAURD-24-000222` | The Flowery | 2465 Broadway, New York | https://www.thefloweryny.com |
| `OCM-CAURD-25-000271` | The Flowery | 70 Canal St, New York | https://www.thefloweryny.com |
| `OCM-CAURD-25-000282` | The Flowery | 112 Christopher St, New York | https://www.thefloweryny.com |
| `OCM-CAURD-25-000287` | THE FLOWERY | 101 E 10th St, New York | https://www.thefloweryny.com |
| `OCM-RETL-24-000114` | 960 bloomingdale road LLC | 2059 Richmond Ave, Staten Island | https://www.thefloweryny.com/ |

### 3 licences read from one page — 84 listings each

Page read: `https://gotham.nyc/cannabis/flower`

| Licence | Shop | Address | Website in the registry |
|---|---|---|---|
| `OCM-CAURD-23-000009` | Gotham Bowery | 3 E 3rd St, New York | https://gotham.nyc/ |
| `OCM-CAURD-24-000206` | Gotham Williamsburg | 300 Kent Avenue, Brooklyn | https://gotham.nyc |
| `OCM-CAURD-25-000238` | Gotham Chelsea | 146 10th Ave, New York | https://www.gotham.nyc |

### 3 licences read from one page — 159 listings each

Page read: `https://greenflowerwellness.com/stores/green-flower-wellness-oakland-gardens/products/flower`

| Licence | Shop | Address | Website in the registry |
|---|---|---|---|
| `OCM-RETL-24-000064` | GREEN FLOWER WELLNESS | 214 24 73rd Ave, OAKLAND GARDEN | https://greenflowerwellness.com |
| `OCM-RETL-24-000233` | GREEN FLOWER WELLNESS 5 LLC | 270-01 HILLSIDE AVE, GLEN OAKS | https://greenflowerwellness.com |
| `OCM-RETL-25-000438` | GREEN FLOWER WELLNESS | 8508 Pitkin Ave, Ozone Park | https://greenflowerwellness.com |

### 2 licences read from one page — 170 listings each

Page read: `https://terpbrosnyc.com/stores/terp-bros-astoria/products/flower`

| Licence | Shop | Address | Website in the registry |
|---|---|---|---|
| `OCM-CAURD-23-000020` | Terp Bros | 3610 Ditmars Blvd, Astoria | https://www.terpbrosnyc.com/ |
| `OCM-CAURD-25-000294` | Terp Bros | 135-26 Crossbay Blvd, Ozone Park | https://www.terpbrosnyc.com |

### 2 licences read from one page — 10 listings each

Page read: `https://cannabisrealmny.com/rockland/menu/categories/new-flower-drops`

| Licence | Shop | Address | Website in the registry |
|---|---|---|---|
| `OCM-CAURD-24-000046` | Cannabis Realm of New York | 475 Central Ave, White Plains | https://cannabisrealmny.com |
| `OCM-RETL-24-000244` | Comfort Care Services inc. | 172-02 Hillside Ave, Jamaica | https://cannabisrealmny.com |

### 2 licences read from one page — 33 listings each

Page read: `https://www.nycbud.com/shop/queens/categories/flower`

| Licence | Shop | Address | Website in the registry |
|---|---|---|---|
| `OCM-CAURD-24-000060` | BudBiz LLC | 4445 Vernon Blvd, Long Island City | https://www.nycbud.com |
| `OCM-CAURD-25-000291` | NYC Bud Midtown | 405 W 39th St, New York | https://www.nycbud.com |

### 2 licences read from one page — 238 listings each

Page read: `https://hiinyc.com/stores/hii-williamsburg/products/flower`

| Licence | Shop | Address | Website in the registry |
|---|---|---|---|
| `OCM-CAURD-24-000102` | HII | 152 Bedford Ave, Brooklyn | https://www.hiinyc.com |
| `OCM-CAURD-26-000330` | Hii | 9206 3rd Ave, Brooklyn | https://hiinyc.com |

### 2 licences read from one page — 113 listings each

Page read: `https://shophibernica.com/dispensary-bronx-menu`

| Licence | Shop | Address | Website in the registry |
|---|---|---|---|
| `OCM-CAURD-24-000131` | Hibernica | 3220 Westchester Ave, Bronx | https://shophibernica.com |
| `OCM-RETL-26-000511` | Hibernica Central Park | 111 Central Park North, New York | https://shophibernica.com/ |

### 2 licences read from one page — 121 listings each

Page read: `https://dankley.com/stores/dankley-manhattan/products/flower`

| Licence | Shop | Address | Website in the registry |
|---|---|---|---|
| `OCM-RETL-25-000319` | Dankley Canna | 21917 Hillside Ave, Queens Village | https://dankley.com |
| `OCM-RETL-25-000450` | Dankley Canna | 85 Nassau Street, New York | https://dankley.com |


**Listings filed under a shop whose own menu was never opened: 1393.**

### One of these is not like the others

`cannabisrealmny.com` is listed by the registry against **Cannabis Realm of
New York** in White Plains *and* **Comfort Care Services inc.** in Jamaica,
Queens — thirty miles apart, different legal entities. The state registry
holds exactly one licence trading as Cannabis Realm, so either these are one
operator under two entities, or one of the two website fields is wrong.

Establish which, and say which. If Comfort Care's real site is something else
entirely, that belongs in the notes — a wrong `contact.website` in the
registry is a finding in its own right and changes what the collector should
do with that licence.

---

## Queue B — landed on a slice of the shelf

These five were read from a promotional sub-category rather than the flower
category. The collector was changed on 2026-09-20 to rank such slices below
the real category, so **if the real category is linked from the page, the next
run finds it on its own** and these need no row.

Your job here is to check whether it is linked at all. If the flower category
is reachable only through a control that is not a link — a dropdown, a tab, a
button that fetches — then the collector will keep taking the slice, and the
licence needs a row.

| Read | Licence | Shop | Page the collector landed on |
|---:|---|---|---|
| 10 | `OCM-CAURD-24-000046` | Cannabis Realm of New York | `/rockland/menu/categories/new-flower-drops` |
| 10 | `OCM-RETL-24-000244` | Comfort Care Services inc. | same page |
| 25 | `OCM-CAURD-24-000200` | Smoking Scholars LLC | `menus.dispenseapp.com/f1c1…/menu/categories/35-flower-sale` |
| 20 | `OCM-CAURD-24-000080` | The Cannabis Place | `thecannabisplace.org/store/new-york/` |
| 0 | `OCM-CAURD-23-000021` | CONBUD LLC | a **blog post** with a category query on it |

Cannabis Realm is the one that prompted this brief: a large Westchester menu
that carries exclusives, reading as ten strains while its neighbours on the
same street read 173 and 166.

CONBUD's is a different fault again — the collector followed a link into an
article, not a menu. Worth a row if the real menu is findable.

---

## Queue C — the shop said it had more than we read

The menu declared a total and we came back with less. This is paging or
scrolling giving up, not attribution, and it is the largest single loss in the
register:

| Missing | Shop | Declared | Read | Flower kept |
|---:|---|---:|---:|---:|
| 473 | ENFLOR LLC | 523 | 50 | 23 |
| 181 | Stashmaster | 231 | 50 | 22 |
| 37 | Mello Tymes LLC | 145 | 108 | 21 |
| 36 | Studio57NY | 86 | 50 | 0 |
| 25 | Emerald Dispensary | 116 | 91 | 26 |

The three that stopped at exactly 50 are the interesting ones: 50 is a page
size, and stopping on the first page means the collector never found the knob
that turns it.

**Do not fix the collector.** Open each menu, watch the network tab, and
record in `notes` **the request the page makes for its second page** — the
parameter name and how it changes (`?page=2`, `&offset=50`, a POST body
field). That one line is what makes the paging fixable, and it is not
recoverable from the outside.

Run `node scripts/menu-render.mjs --dump-requests 8 --only <licence>` if you
want the collector's own view of the addresses it asked for.

---

## How to check your own work before you hand it in

```bash
npm run validate      # schema + semantic rules
node scripts/menu-render.mjs --only-endpoints --only OCM-CAURD-25-000294
```

The second command collects ONLY the licences you gave addresses to. Then:

1. Two licences in the same group must come back with **different** shelves.
   Identical ones mean the store picker did not actually switch stores, and
   the row is wrong — delete it rather than keep it.
2. `SHELF_SHARED_WITH_OTHER_LICENCES` should disappear from the licences you
   fixed. If it does not, the addresses still resolve to one page.
3. No licence should come back with FEWER listings than it has now. If one
   does, you have pointed it at a narrower page than the collector found by
   itself.

---

## What success looks like

Not twenty rows. Twenty licences about which the register can now say
something true — including any where the true thing is "this chain publishes
one shelf for all its stores, and we have written that down rather than
inventing four menus."

Report back with: rows added, licences deliberately left empty and why, the
Cannabis Realm / Comfort Care question answered, and the paging parameters
from queue C.

---

## Reproducing the numbers in this brief

```python
import json, collections
cov = json.load(open('data/menu-coverage.json'))
norm = lambda u: (u or '').split('?')[0].split('#')[0].rstrip('/').lower()
g = collections.defaultdict(list)
for k, v in cov.items():
    if v.get('flower', 0) > 0:
        g[norm(v.get('landedOn'))].append(k)
shared = {u: ks for u, ks in g.items() if u and len(ks) > 1}
print(len(shared), 'pages serving more than one licence')
print(sum(sum(cov[k]['flower'] for k in ks) - max(cov[k]['flower'] for k in ks)
          for ks in shared.values()), 'listings under a shop we never opened')
```

## Files worth reading first

- `README.md` — the rule about empty fields, and why this register exists
- `docs/AGENT_MENU_ENDPOINTS_BRIEF.md` — the earlier pass that produced the 35
  rows already in `data/menu-endpoints.json`; same file, same conventions
- `data/menu-coverage.json` — what the last collection run saw, per licence
- `scripts/menu-render.mjs`, around `pickMenuLink` — how a menu link is chosen,
  and the comments recording every way it has been wrong before
