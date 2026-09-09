# Menu endpoint research report — NYC gap set

Checked: **2026-09-06**  
Brief: `docs/AGENT_MENU_ENDPOINTS_BRIEF.md`  
Deliverable: `data/menu-endpoints.json`

## Result

The 27-store gap set was researched individually.

- Targets: **27**
- Direct human-facing menu endpoints found: **26**
- Direct Flower/category endpoints where the platform exposes one: **25**
- No public menu/site found: **1** (`OCM-RETL-25-000466`, 4081 Companies, LLC)
- Known menu hosts with robots allowing the selected route: **26 / 26**
- Flower browseable without account login: **26 / 26** endpoints
- Endpoints requiring only a simple 21+ confirmation: **23 / 26**
- Endpoints with no age gate observed: **3 / 26**
- Date-of-birth forms required: **0 / 26**
- Login required to browse Flower: **0 / 26**

The one unresolved location keeps `menuUrl`, `platform`, and `robotsAllows` as `null`. This is intentional: with no menu host there is no honest robots boolean or platform to assign.

## Platform distribution

| Platform | Stores |
|---|---:|
| DUTCHIE | 13 |
| OTHER | 5 |
| PROPRIETARY | 3 |
| BLAZE | 2 |
| TREEZ | 2 |
| MEADOW | 1 |
| IHEARTJANE | 0 |
| **No public endpoint found** | **1** |

`OTHER` was resolved further in the notes because that information is useful to the collector:

- **Dispense:** 2 — All Good, Elevated
- **Sweed:** 2 — Flower Daddy, Freshly Baked NYC Midtown
- **Flowhub Ecommerce (`dispensary.shop`):** 1 — Celestial Herbs

Flowhub itself documents `dispensary.shop` as its Ecommerce URL family, including `/rec/flower` category routes.

## Corrections to provisional guesses in the brief

### Brooklyn Urban — BLAZE, not OTHER

`OCM-CAURD-26-000325` resolves to a public Flower storefront at:

`https://shop.bkurbanbud.com/shop/categories/flower/`

The rendered page carries BLAZE markers. A visible Login link is optional and is not an access wall; products are browseable without authenticating.

### Celestial Herbs — Flowhub Ecommerce

`OCM-CAURD-25-000292` uses:

`https://celestialherbs.dispensary.shop/rec/flower/nb/k3w`

The host is Flowhub Ecommerce (`dispensary.shop`), so the schema value remains `OTHER` and the actual platform name is retained in `notes`.

### Flower Daddy / Freshly Baked — Sweed

Both storefronts expose product-bearing Flower routes on their own domains and identify Sweed in the page/runtime. The age prompt is a simple `Are you 21 or older? Confirm` notice, not a date-of-birth form.

## Dutchie robots.txt note

The GitHub-hosted audit runner received HTTP 403 while requesting `https://dutchie.com/robots.txt`, so the automated audit conservatively refused to probe two direct Dutchie-hosted menu URLs. An independent retrieval of the actual robots file on 2026-09-06 returned:

```text
User-agent: *
Disallow:
Sitemap: https://dutchie.com/sitemap.xml
```

Therefore `robotsAllows: true` is used for the Emerald Carroll Gardens and Herbwell Bronx Dutchie routes. The 403 was an environment/access artifact, not a `Disallow` rule, and no anti-bot mechanism was bypassed.

### The same artifact, in code

That incident took a human to undo, and the code that produced it kept the
defect until 2026-09-09. `scripts/menu-probe.py` and `scripts/menu-collect.py`
resolved robots.txt through `urllib.robotparser.RobotFileParser.read()`, which
swallows the HTTP status: a 401 or 403 on `/robots.txt` silently becomes
`disallow_all`, indistinguishable from a host that actually wrote `Disallow`.
A sweep run behind a blocking egress proxy proved it — two shops on plain
`http://` were reported as `robots.txt consulted` / disallowed, having been
consulted by nobody.

Both scripts now fetch robots.txt themselves and keep the status. Only a
robots.txt that was read and whose content disallows produces `false`; a 401
or 403 produces `null` — we still stay away, but the record says the policy is
unknown rather than forbidding. `scripts/validate-menu-endpoints.py` accepts
that `null` when `notes` explains it. Nothing else changed: an absent, broken
or briefly unreachable robots.txt still states no restriction, as before.

The three `"menuLink": "robots-disallowed"` records in
`data/menu-endpoints.todo.json` are unaffected. They came from
`scripts/menu-render.mjs`, which parses the robots body itself and treats any
non-200 as empty — those three followed a `Disallow` line that was actually
served.

## Why the original collector missed these stores

The failures clustered into a few repeatable patterns:

1. **Client-rendered embedded menu.** The page returned a valid HTML shell, while product inventory arrived after JavaScript execution. This accounts for much of the Dutchie gap set and the Meadow case.
2. **Category route not discoverable from a normal `<a href>`.** Some sites use buttons, router state, or an embedded storefront. Supplying the direct category URL removes that discovery problem.
3. **Menu lives on another first-party/ecommerce host.** Examples include `shop.bkurbanbud.com`, `shop.flowerdaddy.nyc`, and `*.dispensary.shop`.
4. **Multi-location routing.** Quality Control and Hibernica require location-specific menu paths.
5. **Wrong provisional platform guess.** Brooklyn Urban was detected as BLAZE rather than OTHER.

These are endpoint-discovery problems, not evidence that the stores lack Flower inventory.

## Unresolved: 4081 Companies, LLC

For `OCM-RETL-25-000466`, no public storefront/menu URL attributable to the licensed location was found in this pass. No substitute Leafly/Weedmaps page was used, and no guessed domain was created. The record is retained with a null endpoint so it can be revisited if the operator publishes a site later.

## Access discipline

The audit used an identifying User-Agent, sequential requests with a pause, and checked `robots.txt` before requesting candidate menu pages. It did not submit logins, create accounts, solve CAPTCHAs, bypass anti-bot controls, place orders, or ingest Leafly/Weedmaps menus. Simple 21+ notices were classified but not treated as authentication.
