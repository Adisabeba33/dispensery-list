# Working on this repository

## Every pull request raises the version

The home page shows which build is live, in the mono line under the header,
before the date of the registry data: `v1.0.0 · 0cfa60f · built Sep 24, 10:05
AM ET`. The owner checks it to see whether a merged change has reached the
site or the old build is still being served.

- Raise `version` in `package.json` in every pull request that changes the site
  or the collector: the patch number (`1.0.0` → `1.0.1`) for a fix, the minor
  (`1.0.x` → `1.1.0`) for something new.
- Raise it above the highest version main has ever had, not above the one your
  branch started from. Two sessions work here at once: on 25 September a branch
  cut at 1.2.2 merged as 1.2.3 after main had reached 1.3.1, and the home page
  went backwards — the owner could no longer tell a new build from an old one.
  Before merging, look:

      git fetch origin main
      git log origin/main --format=%s -- package.json | grep -o '^v[0-9.]*' | sort -V | tail -1

  and if main is at or past your version, raise yours again.
- Start the commit subject with the version (`v1.3.2: …`), as the history does,
  so the highest one is found by the command above.
- Name the new version in the pull request's description, so the owner knows
  what to look for.
- The commit and the build time fill themselves in at build (`next.config.mjs`);
  nothing to do for those.

## Strain names get a second look at build

The collector cleans each name as it reads it (`scripts/strain-name.mjs`). The
site then reviews the whole shelf at once (`src/lib/strain-review.ts`, applied
in `src/lib/menu.ts`): shouted names calmed, a grower's product lines and its
own name taken off, one spelling per grower, and `by <grower>` under the name.
It also settles one grower's names against each other: a cultivar with a pack,
edition or parents beside it, the same words in another order, a misspelling
(`settleWithinGrower`). A name is only ever the listing's own words or a name
the same grower is sold under at another shop; `strainNameRaw` keeps the
shop's text. The strain index groups across growers by `looseKey`, so "Blue
Nerds" and "Blue Nerdz" are one row.

- Product lines are removed only when listed for that brand in
  `data/strain-lines.json`. `npx tsx scripts/strain-review.ts` prints new
  candidates and the names still unclear; put each candidate under `lines` or,
  if it is a cultivar, under `notLines`.
- `scripts/strain-review-check.ts` (part of `npm test`) holds the cultivars the
  review must not shorten. Add to it when a new rule could touch a real name.
- One strain sold under several names across growers is one row and one page
  (owner's rule, 18 October 2026): `data/strain-synonyms.json` lists them —
  "GG4", "Gorilla Glue #4" and "Original Glue" are Gorilla Glue. It groups; it
  never renames: each grower is shown with the name it sells under. Numbered
  cuts stay apart (Gelato 33 is not Gelato 41), and so does anything ambiguous
  ("GG", "Glue"). The check file holds what must stay apart.
- A strain gets its own page (`/menus/strains/<slug>/`) once it is on three
  shelves or more (`PAGE_MIN_SHELVES` in `src/lib/shelf.ts`).

## An index, not a guide to buying

The owner's rule (18 October 2026), for the whole site: the register says what
is on the shelves — this strain, from these growers, on so many shelves, at
these places (a shop's name and its district) — and never where or how to buy.

- No "near me", no ZIP search, no distances.
- No "in stock" or "sold out": a listing on a shelf we read is on the shelf.
- No links out to a shop's website, its online menu, a map, or a lab
  certificate. Links inside the register stay, as do the sources a record rests
  on (the state registry, the regulator) and the state's verification tool.
- No services (delivery, pickup) and no filter on them. The address, the
  phone number as plain text, and the hours stay.
- Shop names are shown without the company form: "Garden Bliss LLC" is Garden
  Bliss (`withoutEntityForm` in `src/lib/format.ts`); the legal name stays
  beside the licence.
- A shop's lamp is green when we read its shelf and red when we do not; a red
  shop says "No data yet".

## robots.txt: no rules means no restriction

Every reader here honours robots.txt. The owner's rule (5 October 2026): a
robots.txt that answers with a web page instead of rules, or with nothing,
states no rules, and no rules means the site may be read, as with a 404.
Rules that are there are obeyed. A file store that refuses a robots.txt it
does not hold — an S3-style XML `AccessDenied`, a bare "Forbidden" — states no
rules too (6 October 2026). A robots.txt that answers with any other error
(a 403 page, 5xx) stops the reader, and a bot wall or captcha — at robots.txt or on
any page — is never worked around (`scripts/coa-source-http.py`). A robots.txt that
redirects to a web page states no rules as well (8 October 2026: Keystone's
labware.cloud portal sends it to the vendor's home page).

The menu collector keeps the same rule (`robotsVerdict` in
`scripts/menu-render.mjs`). It asks robots.txt with the browser that reads the
pages and, when that answer is an error, with Node's fetch too: firewalls tell
the two apart, so rules from either are obeyed, and a wall from either stops it.

A request the collector makes itself to a menu platform's API — the next page
of a shelf — follows the owner's decision of 7 October 2026: an explicit rule is
obeyed (web-ui-prime.sweedpos.com's `Disallow: /`), but an API that answers
/robots.txt as it answers every unknown path, with 401 or 403
(api.dispenseapp.com: "provide a valid api-key"), has published no robots.txt,
and that is no restriction. A wall there still stops it (`apiRequestAllowed`).
