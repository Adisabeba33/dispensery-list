# Published COA documents

`python scripts/coa-dates.py` reads links already printed by menus, plus links
reviewed in `data/coa-sources.json`. `--brand-only --limit 20` restricts a run to
reviewed brand links. A brand link is eligible only with `scope: "ny-flower"`
and the exact `publishedOn` page. Identifiers and filenames are never expanded.

The reader uses an explicit project User-Agent, one request at a time, at least
2.1 seconds between requests, and a larger robots crawl delay when specified.
A robots.txt that answers with a web page instead of rules, or with an empty
success, states no rules, and no rules means no restriction, as with 404 (the
owner's rule of 5 October 2026, as RFC 9309 reads it). A robots.txt that
answers with an error (403, 5xx) or a bot wall, and an access wall on any
page, block document reading. Every
redirect target receives its own robots check. Five consecutive host errors
stop that host for 24 hours; `data/coa-http-state.json` preserves that deadline.
Request logs are temporary and are not published.

`sampledFrom` states the event actually printed by the document: sampled,
received, tested, or reported. A test or report date is not a packaging date.
`packagedFrom` distinguishes an explicit document date from a printed Metrc
card. Harvest codes are kept separately from cultivation dates. Brand entries
also retain `sourcePage`, `sourceKind`, and the final `documentUrl`.

Offline checks cover Kaycha, Green Analytics, DRS, ACT, Keystone, Smithers,
and both Metrc card layouts. Missing identifiers stay null. Lab recognition
does not imply that every document from that laboratory prints a Metrc tag.

## Menu inventory, 2026-10-03

Only GoodGrades yielded a fresh full product object: `package_id` is printed;
there are no COA, expiry, or packaging-date fields. `created_at` and `updated_at`
are record timestamps. Other inspected pages did not expose full objects in
static HTML. A Hush page was left unread because robots.txt returned HTML.
Browser-based inspection was stopped after automatic approval review rejected
storefront tracking requests. No additional COA field was confirmed.

Existing fixtures cover Alleaves `coa`, Dutchie
`POSMetaData.canonicalLabResultUrl` and `canonicalPackageId`, Treez
`expirationDate` / `customExpirationDateNew`, and Dutchie
`expiresWithinDays`. The latter is a bound, not a packaging date.

No expiry-based packaging date is emitted without a stable shelf-life estimate
from at least five real pairs with p10–p90 spread at most seven days.

## Panels, 2026-10-03

`scripts/coa-panel.py` reads what a certificate measured — the strain or
product it names, total THC, total terpenes and the leading terpenes, keyed as
`data/shelf-terpenes.json` keys them — and `coa-dates.py` stores it as
`panel` on each certificate. The column a terpene result sits in is decided
per laboratory (Kaycha, Kaycha 2023, DRS, Green Analytics, Keystone, ACT,
MCR; `scripts/coa-panel-check.py` pins each layout); a laboratory not listed
gives no panel rather than a guess. `panel.matrix` is what the document says
it tested, `panel.licence` the client's New York licence (never the lab's).

Certificates read before panels are re-read 60 a run, brand links first.
Brand links published but still `pending-review` are read 200 a run (from
4 October 2026; 60 before) as
`sourceKind: "brand-page-unreviewed"`; links reviewed as another product are
not read.

## Brand pages read daily, from 5 October 2026

`scripts/coa-sources.py` reads again, every day before `coa-dates.py`, the
pages listed in `data/coa-sources.json` for sources whose certificates were
published as links (`published-links`, `published-list-folder`): 16 brands,
20 pages on 5 October. Brands add certificates there as batches are tested,
often before the jars reach a shelf. Only listed pages are read; no link is
followed, guessed or enumerated, and the reader is the one above (robots.txt,
2.1 seconds apart, five host errors stop a host for a day).

A listed page can be the feed a brand's own page loads its list from, when
the page itself carries no links: Florist Farms' lab-results page calls the
File Directory app, SP Farms' strains page calls its public API. The feed's
host has its own robots check like any page.

A link counts as a certificate when its path ends in `.pdf` or it points at a
laboratory's report portal. A Google Drive or Docs viewer does not: its page is
not the document and Drive's robots.txt disallows the download, so Smoke
(about 75 Drive files) and Royal Genetics (a Drive folder) are recorded but not
read. One document has one spelling: the path is percent-encoded once, and a
yourcoa.com viewer link becomes the same sample's download link. A link not
seen before is added as `pending-review` with `firstSeenAt`, the moment the
scan first saw it; reviewed links are never changed. `coa-dates.py` reads
pending links newest first, brands taking turns among links found at the same
moment, so one brand's long list does not hold back another's. The run report
names the new links per brand and the pages that could not be read.
`scripts/coa-sources-check.py` (part of `npm test`) checks link detection and a
scan offline.

On 5 October: Dank By Definition 44 and Miss Grass 1 in the first scan; then
Florist Farms 1,683 (1,239 reviewed as other products by file name — pre-rolls,
vapes, gummies, infused — 444 pending), Animal House 55 and SP Farms 13.
Platinum Reserve's robots.txt answers with SiteGround's captcha, as does every
Nautical Blaze page: a wall, not read. Connected Cannabis' list app answers
"Subscription plan is inactive". Toke Folks' robots.txt did not answer.
