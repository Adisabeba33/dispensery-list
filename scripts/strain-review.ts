/**
 * What the second look at strain names does to today's shelves, and what it
 * still needs a person for.
 *
 * The site applies the review as it builds (src/lib/strain-review.ts); this
 * prints it, so a session curating names can see it and act on the two lists
 * at the end:
 *
 *   - new product-line candidates: confirm each in data/strain-lines.json,
 *     under "lines" if it is a line, under "notLines" if it is a cultivar;
 *   - names still unclear: left as they are, for the collector or by hand.
 *
 *   npx tsx scripts/strain-review.ts            # the report, as Markdown
 *   npx tsx scripts/strain-review.ts --out f.md
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FlowerListing } from '../src/lib/menu-format';
import {
  brandLabel,
  lineCandidates,
  nameKey,
  reviewListings,
  reviewShelf,
  type LineBook,
  type Reason,
} from '../src/lib/strain-review';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = <T>(p: string): T => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8')) as T;

const rows = read<FlowerListing[]>('data/flower-listings.json');
const book = read<LineBook>('data/strain-lines.json');
const reviewed = reviewShelf(rows, book);
const shown = reviewListings(rows, book);

const changed = reviewed.filter((r) => r.after !== r.before);
const byReason = new Map<Reason, typeof changed>();
for (const r of changed) for (const w of r.why) byReason.set(w, [...(byReason.get(w) ?? []), r]);

const perGrower = (names: (l: number) => string) => {
  const seen = new Set<string>();
  rows.forEach((l, i) => seen.add(`${l.brandKey ?? '-'}|${nameKey(names(i))}`));
  return seen.size;
};
const spellings = new Set(rows.map((l) => l.brand).filter(Boolean)).size;
const growers = new Set(shown.map((l) => l.brand).filter(Boolean)).size;

const out: string[] = [];
const line = (s = '') => out.push(s);
line(`# Strain names: the second look`);
line();
line(`${rows.length} listings on ${new Set(rows.map((l) => l.licenseNumber)).size} shops.`);
line(`Names changed on ${changed.length} listings at ${new Set(changed.map((r) => r.listing.licenseNumber)).size} shops.`);
line(`Distinct strains per grower: ${perGrower((i) => reviewed[i].before)} → ${perGrower((i) => reviewed[i].after)}.`);
line(`Grower spellings on cards: ${spellings} → ${growers}.`);
line();
for (const [why, list] of [...byReason].sort((a, b) => b[1].length - a[1].length)) {
  line(`## ${why} — ${list.length}`);
  const shownPairs = new Set<string>();
  for (const r of list) {
    const pair = `${r.before} → ${r.after}`;
    if (shownPairs.has(pair)) continue;
    shownPairs.add(pair);
    line(`- ${r.before} → **${r.after}** · ${brandLabel(r.listing.brand) ?? 'no grower'}`);
    if (shownPairs.size >= 8) break;
  }
  line();
}

const candidates = lineCandidates(rows, book);
line(`## New product-line candidates — ${candidates.length}`);
line(`Confirm each in data/strain-lines.json: "lines" if it is a line, "notLines" if it is a cultivar.`);
for (const c of candidates) {
  line(`- ${c.brand} (\`${c.brandKey}\`): **${c.line}**, beside ${c.cultivars} others — ${c.examples.join(' ; ')}`);
}
line();

/* Left alone because nothing here can say what they are: a year in brackets,
   an edition, a pack of two. */
const unclear = new Map<string, number>();
for (const r of reviewed) {
  if (r.after.length > 32 || /[()[\]]/.test(r.after) || /\b(collection|edition|box set|variety pack|split pack)\b/i.test(r.after)) {
    const k = `${r.after} · ${brandLabel(r.listing.brand) ?? 'no grower'}`;
    unclear.set(k, (unclear.get(k) ?? 0) + 1);
  }
}
line(`## Still unclear — ${unclear.size}`);
line(`Left as they are. Most need the collector, or a look at the shop's menu.`);
for (const [k, n] of [...unclear].sort((a, b) => b[1] - a[1]).slice(0, 60)) line(`- ${k}${n > 1 ? ` (${n} listings)` : ''}`);

const text = out.join('\n') + '\n';
const at = process.argv.indexOf('--out');
if (at > 0 && process.argv[at + 1]) writeFileSync(process.argv[at + 1], text);
else process.stdout.write(text);
