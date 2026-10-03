# Published COA documents

`python scripts/coa-dates.py` reads links already printed by menus, plus links
reviewed in `data/coa-sources.json`. `--brand-only --limit 20` restricts a run to
reviewed brand links. A brand link is eligible only with `scope: "ny-flower"`
and the exact `publishedOn` page. Identifiers and filenames are never expanded.

The reader uses an explicit project User-Agent, one request at a time, at least
2.1 seconds between requests, and a larger robots crawl delay when specified.
Unavailable robots policies and access walls block document reading. Every
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
