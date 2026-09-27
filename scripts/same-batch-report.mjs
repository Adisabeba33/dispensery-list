/**
 * Which batches stand on more than one shelf.
 *
 * Groups every collected listing by its lab panel (scripts/lab-panel.mjs) and
 * prints the panels that appear at two shops or more. The key is recomputed
 * from THC and the terpene profile, so shelves collected before the key was
 * stored are counted too.
 *
 *   node scripts/same-batch-report.mjs            # all territories
 *   node scripts/same-batch-report.mjs --show 30  # list more groups
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LAB_PANEL_MIN_COMPOUNDS, labPanelKeyOf } from './lab-panel.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => {
  try {
    return JSON.parse(readFileSync(resolve(ROOT, path), 'utf8'));
  } catch {
    return [];
  }
};
const show = Number(process.argv[process.argv.indexOf('--show') + 1]) || 15;

const listings = [];
const shopName = new Map();
for (const t of read('data/territories.json').territories ?? []) {
  for (const d of read(`${t.dataDir}/dispensaries.json`)) shopName.set(d.licenseNumber, d.dbaName ?? d.legalName);
  for (const l of read(`${t.dataDir}/flower-listings.json`)) listings.push({ ...l, territory: t.id });
}

const withPanel = listings.filter((l) => (l.terpenes?.profile ?? []).some((t) => typeof t.percent === 'number'));
const groups = new Map();
for (const l of listings) {
  const key = l.labPanelKey ?? labPanelKeyOf(l.thcPercent, l.terpenes?.profile);
  if (!key) continue;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(l);
}
const keyed = [...groups.values()].reduce((n, g) => n + g.length, 0);
const shared = [...groups.entries()]
  .map(([key, rows]) => ({ key, rows, shops: new Set(rows.map((r) => r.licenseNumber)) }))
  .filter((g) => g.shops.size > 1)
  .sort((a, b) => b.shops.size - a.shops.size);
// One batch is one cultivator's. A group spanning two brand spellings has so
// far always been a shop printing the line or house name instead of the
// grower (Heritage Collection for Back Home, Next Stop for Dumbo Electric) —
// but it could be a coincidence, so it is listed apart for a person to look at.
const brandsOf = (g) => new Set(g.rows.map((r) => r.brandKey).filter(Boolean));
const clean = shared.filter((g) => brandsOf(g).size <= 1);
const mixed = shared.filter((g) => brandsOf(g).size > 1);
const packaged = listings.filter((l) => l.packageIds?.length).length;

console.log(`listings: ${listings.length}`);
console.log(`with quantified terpenes: ${withPanel.length}`);
console.log(`with a lab panel key (THC + ${LAB_PANEL_MIN_COMPOUNDS}+ compounds): ${keyed}, in ${groups.size} distinct panels`);
console.log(`batches on two or more shelves: ${clean.length}, covering ${clean.reduce((n, g) => n + g.rows.length, 0)} listings`);
console.log(`one panel under different brand names (look at these): ${mixed.length}`);
console.log(`listings carrying a package id: ${packaged}`);

const describe = (g) => {
  const r = g.rows[0];
  console.log(`\n${r.brand ?? '?'} — ${r.strainNameRaw}  (${g.shops.size} shops)`);
  console.log(`  ${g.key}`);
  for (const lic of g.shops) {
    const names = [...new Set(g.rows.filter((x) => x.licenseNumber === lic).map((x) => x.strainNameRaw))].join(' / ');
    console.log(`  - ${shopName.get(lic) ?? lic}: ${names}`);
  }
};
if (clean.length) console.log(`\n=== the ${Math.min(show, clean.length)} widest ===`);
clean.slice(0, show).forEach(describe);
if (mixed.length) {
  console.log('\n=== one panel, brand printed differently — worth a look ===');
  mixed.slice(0, show).forEach(describe);
}
