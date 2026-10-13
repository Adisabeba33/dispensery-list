/**
 * Drops the shelves of licences data/dispensaries.json no longer lists.
 *
 *   node scripts/drop-unlisted-shelves.mjs
 *
 * The daily run reads every shop of the register as it stood when the run
 * began, four hours before it publishes. On 12 October 2026 the weekly
 * registry refresh (#119) was merged in between: Just a Little Higher
 * (OCM-CAURD-25-000275) had left the state's list, the refresh took its
 * eighteen listings out, the run had read them again, and the two edits of
 * the same lines stopped the publish — the day's shelves were lost. When the
 * run's shelves are laid over such a change, the licences the registry has
 * dropped meanwhile are dropped from the shelves too, which is what the
 * refresh did and what the validator requires (a listing's licence must be in
 * data/dispensaries.json). Written as the collector writes the file, so only
 * the dropped listings change.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const REGISTER = 'data/dispensaries.json';
const SHELVES = 'data/flower-listings.json';

export const keepListed = (listings, dispensaries) => {
  const known = new Set(dispensaries.map((d) => d?.licenseNumber).filter(Boolean));
  // An empty register says nothing about any shop; the validator skips the
  // check then, and so does this.
  if (!known.size) return { kept: listings, dropped: [] };
  const kept = [];
  const dropped = [];
  for (const listing of listings) (known.has(listing.licenseNumber) ? kept : dropped).push(listing);
  return { kept, dropped };
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const dispensaries = JSON.parse(readFileSync(REGISTER, 'utf8'));
  const listings = JSON.parse(readFileSync(SHELVES, 'utf8'));
  const { kept, dropped } = keepListed(listings, Array.isArray(dispensaries) ? dispensaries : []);
  if (dropped.length) writeFileSync(SHELVES, JSON.stringify(kept, null, 2) + '\n');
  const licences = [...new Set(dropped.map((l) => l.licenseNumber))];
  console.log(`dropped ${dropped.length} listing(s) of ${licences.length} licence(s) the register no longer lists${licences.length ? `: ${licences.join(', ')}` : ''}`);
}
