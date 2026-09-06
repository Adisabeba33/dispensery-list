/**
 * Writes one menu file per shop into public/shelves/.
 *
 * The directory expands a shop in place so a reader never loses their filters
 * or their position — but its cards are a client component, and a client
 * component cannot import six megabytes of shelf. So each shop's menu is
 * emitted as its own static file and fetched when its card is opened: the home
 * page carries none of it, and opening one shop costs only that shop.
 *
 * The listings are read through lib/menu rather than straight off disk, so a
 * shelf fetched by the directory carries the same reference terpenes the shop's
 * own page shows. Two readers of one dataset disagreeing is worse than either
 * of them being wrong.
 *
 *   npx tsx scripts/emit-shop-menus.ts
 */
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { listings } from '../src/lib/menu';
import type { FlowerListing } from '../src/lib/menu-format';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Not public/menus: /menus is a page, and a data file living under a route
// path invites the router to redirect the fetch out from under it.
const OUT = resolve(ROOT, 'public/shelves');

const byLicence = new Map<string, FlowerListing[]>();
for (const l of listings) {
  if (!byLicence.has(l.licenseNumber)) byLicence.set(l.licenseNumber, []);
  byLicence.get(l.licenseNumber)!.push(l);
}

// Rebuilt from scratch: a shop that lost its shelf must not keep a stale file.
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let bytes = 0;
for (const [licence, own] of byLicence) {
  own.sort((a, b) => a.strainNameRaw.localeCompare(b.strainNameRaw));
  const body = JSON.stringify(own);
  writeFileSync(resolve(OUT, `${licence}.json`), body);
  bytes += body.length;
}

console.log(
  `Wrote ${byLicence.size} shop menus (${(bytes / 1024 / 1024).toFixed(1)} MB total, ` +
    `${Math.round(bytes / byLicence.size / 1024)} kB average).`,
);
