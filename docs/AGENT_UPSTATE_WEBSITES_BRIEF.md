# Task: find the upstate and Long Island shops we cannot reach

**For an agent with an open network.** Every number below was measured from
this repository on 2026-09-20 and the snippet that reproduces them is at the
end. Nothing here needs re-deriving.

The job is to answer one question, 262 times: **where is this shop's website?**

---

## Why this exists

The register now holds three territories. This is what each one can be
collected from:

| | Licences | Registry says it opened | Has a website | Both |
|---|---:|---:|---:|---:|
| New York City & Westchester | 469 | 332 | **345** | 314 |
| Upstate | 518 | 353 | **158** | 104 |
| Long Island | 45 | 17 | **9** | 4 |

Look at the two middle columns for New York City: more websites than open
shops. That is not because the city is better connected. It is because somebody
went and looked, one shop at a time, and wrote the addresses down.

Nobody has done that upstate. What is there is only what the state itself
publishes — and the state publishes an address for fewer than a third of the
licences it records as having opened to the public.

**249 upstate shops and 13 on Long Island are open, by the state's own record,
and we have no way to reach them.** They are not in the menu collector's
candidate set, they will never be visited, and not one of their strains will
ever reach a member asking "will this suit me". They are the single largest
thing standing between SŌMA and the rest of New York.

## The mechanic that makes this the gate

The collector's candidate filter requires `contact.website`. A licence without
one is skipped **even if somebody has written a perfect menu address for it**
in `data/menu-endpoints.json`, because it never becomes a candidate in the
first place.

So a website is not a nice-to-have here. It is the thing that decides whether a
shop exists as far as the collection is concerned.

---

## What you deliver

**`data/website-research.todo.json`** — already generated, 262 rows, one per
shop, sorted by territory and county. Each row carries what the state knows:
licence number, trading name, legal name, full address, county, licence type,
and the date the registry records it opened.

Fill in the empty fields. A real row, with **invented** answers — this shop has
not been looked up and the two addresses below must not be copied anywhere:

```json
{
  "territory": "upstate",
  "licenseNumber": "OCM-CAURD-24-000148",
  "shop": "82-J LLC",
  "address": "1673 Hertle Avenue, Buffalo, NY 14216",
  "county": "Erie",
  "registrySaysOpened": "2024-12-02",

  "website": "https://example-shop.com",
  "menuUrl": "https://example-shop.com/shop/categories/flower",
  "hasNoWebsite": false,
  "checkedAt": "2026-09-21",
  "notes": "Site footer gives 1673 Hertle Ave and licence OCM-CAURD-24-000148, which is how I knew it was this shop rather than another Buffalo dispensary. Flower category reached from the Shop nav; products visible without an account."
}
```

Note what the `notes` field does there. It names the two things that tie the
site to THIS licence — the address and the licence number on the page — and
that is the whole difference between research and a plausible guess. The
trading name is not one of those things.

- **`website`** — the shop's own site. Not a directory listing, not a Weedmaps
  or Leafly page, not a Facebook page. Those belong to somebody else and the
  collector refuses two of them by name.
- **`menuUrl`** — the flower category, if you can see it. Optional, and worth
  far more than the website alone: it skips the hunting step entirely. It goes
  into `data/menu-endpoints.json` as well, in the shape
  `docs/AGENT_STORE_ATTRIBUTION_BRIEF.md` describes.
- **`hasNoWebsite`** — `true` when you looked properly and the shop genuinely
  has none. **This is a real result and it is worth recording**, because it
  stops the next person spending an hour on the same shop. Plenty of small
  upstate dispensaries trade on Instagram alone.
- **`notes`** — how you knew it was this shop. This is the field a reviewer
  reads first.
- Anything you did not establish: **`null`**. Never a guess.

## The rule that outranks the rest

> **An empty field beats a plausible guess.**

A domain that merely looks like the shop's name is not the shop's website.
`716cannabis.com` might be a licensed Hamburg dispensary or it might be a
hemp store in Buffalo with a similar name. **Match on the address or the
licence number, never on the name** — trading names collide constantly in
this industry, and the register already carries two shops called Terp Bros,
three called Green Flower Wellness and six called The Flowery.

---

## Three traps, each of which has already cost us

**1. Another state's shop.** The Botanist is licensed in Farmingdale, Long
Island. shopbotanist.com is a multi-state chain whose default store is
Columbus, Ohio, and the collector read 149 Ohio products and filed them under a
New York licence. Cannabis cannot cross a state line, so an Ohio shelf under a
New York licence is a fabricated record. The collector now refuses a shelf
whose brands are unknown in New York, but it is far better not to hand it the
wrong address in the first place: **if the chain operates in several states,
give the New York store's address, and say in the notes how you knew.**

**2. A domain that has lapsed.** Two shops in the register point at dead
domains the state has not updated:

| Licence | Shop | The registry's address leads to |
|---|---|---|
| `OCM-RETL-24-000049` | Amber Jane | `forsale.godaddy.com/forsale/amberjane.com` |
| `OCM-MICR-24-000207` | Aroma Cannabis | `dropcatch.com/domain/morrishemp.com` |

Both are in the queue's spirit even though they have a "website": the field is
worse than empty, because the collector spends a visit on it. If you find these
shops' real addresses, say so in the notes; if the shop has closed, say that
instead — that is also a finding.

**3. The chain's front door.** Several upstate names are branches of one
operator. Giving all of them the chain's home page reproduces the problem this
register spent last week fixing: one shelf filed under several licences. Give
each licence the address of ITS branch, confirmed by the address the page shows.

---

## Where the work is

262 shops across 41 counties, concentrated enough to be worth doing in
clusters:

| | |
|---|---:|
| Erie (Buffalo and around) | 41 |
| Monroe (Rochester) | 23 |
| Albany | 22 |
| Dutchess | 15 |
| Orange | 15 |
| Suffolk (Long Island) | 13 |
| Ulster | 10 |
| Niagara | 9 |
| Schenectady | 9 |
| Onondaga (Syracuse) | 8 |
| Rockland | 7 |
| Broome (Binghamton) | 6 |
| the other 29 counties | 84 |

229 are adult-use retail dispensaries and 20 are microbusinesses, which sell
their own flower and are worth no less for being small.

**Erie, Monroe and Albany are 86 of the 262 between them.** If the work has to
stop early, stopping after those three leaves a third of the prize collected
rather than a scatter of half-done counties.

---

## A second, smaller queue if you have time

Shops that DO have a website, which the collector has visited and come back
from with nothing. As of batch two of four, 56 of the 80 upstate shops visited
gave no shelf, and the reasons in the run log are worth a human eye:

- a site whose menu lives behind a control that is not a link — a dropdown, a
  tab, a button that fetches
- an age wall that cannot be answered by clicking (Curaleaf's four licences all
  stop on `curaleaf.com/age-gate` and read six cookie-consent items)
- a menu that declares more than it serves (Canterra says 1,159 products and
  gave 60; Elevate ADK says 94 and gave 20)

For any of these, the deliverable is a `menuUrl` in `data/menu-endpoints.json`
— the address that actually answers with products. The collector goes straight
there and stops hunting.

The last two batches are still running, so this list will grow. Take the
website queue first; it is bigger, it is better defined, and nothing in it
depends on a run that has not finished.

---

## How to check your own work

```bash
npm run validate
node scripts/menu-render.mjs --territory upstate --count
```

The second command prints how many shops the collector can now visit. It is
158 today. Every website you establish moves it, and that number is the honest
measure of this task — not how many rows you filled.

Then, for a sample of what you added:

```bash
node scripts/menu-render.mjs --territory upstate --only OCM-RETL-24-000141 --dump-links 8
```

A one-licence run reads and reports without writing anything to the register,
and `--dump-links` prints the menu links the site publishes, scored, which
tells you whether the collector will find the shelf on its own or needs the
`menuUrl` written down.

---

## What success looks like

Not 262 filled rows. 262 shops about which this register can now say something
true — including every one where the true thing is "this shop has no website",
recorded so nobody looks again.

Report back with: websites established, menu addresses established, shops
confirmed to have none, shops you believe have closed, and the new candidate
count from `--count`.

---

## Reproducing the numbers

```python
import json
for name, p in (('upstate', 'data/upstate'), ('long-island', 'data/long-island')):
    d = json.load(open(f'{p}/dispensaries.json'))
    opened = [x for x in d if (x.get('dates') or {}).get('openedOn')]
    web = [x for x in d if (x.get('contact') or {}).get('website')]
    gap = [x for x in opened if not (x.get('contact') or {}).get('website')]
    print(name, len(d), 'licences |', len(opened), 'opened |', len(web), 'websites |', len(gap), 'unreachable')
```

## Files worth reading first

- `README.md` — the rule about empty fields, and why this register exists
- `data/website-research.todo.json` — your worklist
- `docs/AGENT_STORE_ATTRIBUTION_BRIEF.md` — the previous pass, same
  conventions, and the shape of a `menu-endpoints.json` row
- `docs/AGENT_STORE_ATTRIBUTION_RESULT.md` — what happened when its addresses
  were collected from, including the Ohio shelf
