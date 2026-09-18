/**
 * End-to-end check for the collection path itself.
 *
 * The fixture check next door proves the parser can map a payload. This proves
 * the browser can reach one: that the age affirmation is answered, the menu
 * link is followed, and the JSON the page fetches for itself is captured. Those
 * three steps are where fifteen of twenty-five shops were lost, and none of
 * them can be tested without a browser.
 *
 * The fixture storefront is deliberately built like the real ones — a gate on
 * every page, and a shelf that does not exist in the HTML.
 *
 *   node scripts/menu-e2e-check.mjs
 */
import { spawn } from 'node:child_process';
import { readFileSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4399;
const LISTINGS = resolve(ROOT, 'data/flower-listings.json');
const BACKUP = resolve(ROOT, 'data/.flower-listings.e2e-backup.json');

const run = (cmd, args, opts = {}) =>
  new Promise((done) => {
    const child = spawn(cmd, args, { cwd: ROOT, ...opts });
    let out = '';
    child.stdout?.on('data', (d) => (out += d));
    child.stderr?.on('data', (d) => (out += d));
    child.on('close', (code) => done({ code, out }));
  });

const server = spawn('node', ['scripts/fixtures/menu-server.mjs', String(PORT)], {
  cwd: ROOT,
  stdio: 'ignore',
});

let failures = 0;
const check = (label, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) return;
  failures += 1;
  console.log(`FAIL ${label}\n  expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}`);
};

try {
  await new Promise((r) => setTimeout(r, 1500));
  // The collector writes the real shelf file, so put it back afterwards.
  if (existsSync(LISTINGS)) copyFileSync(LISTINGS, BACKUP);

  const { code, out } = await run('node', [
    'scripts/menu-render.mjs',
    '--dataset', 'scripts/fixtures/menu-dataset.json',
    '--limit', '2',
  ]);
  if (code !== 0) {
    console.log(out.slice(-1500));
    throw new Error(`collector exited ${code}`);
  }

  const summary = JSON.parse(readFileSync(resolve(ROOT, 'enrichment-output/menu-summary.json'), 'utf8'));
  const shop = summary.perShop[0];

  check('status', shop.status, 'ok');
  check('age gate answered', shop.ageGate, true);
  /* Five products across two pages of three. The menu hands over the first
     page and offers no way to the second, so this number is 3 unless the
     collector asked for page two itself. */
  check('products captured', shop.productsSeen, 5);
  check('a second page was asked for', shop.pagesAsked >= 1, true);
  check('and the menu was not asked past its end', shop.pagesAsked <= 2, true);
  check('flower found', shop.flower, 2);
  check('pre-roll and edible refused', shop.rejected['title-not-flower'], 2);
  check('tax row refused', shop.rejected['category-not-flower'], 1);

  /* The second fixture shop is the shape forty real ones have: a site with
     nothing on it that points at the menu. Nothing here scores above zero, so
     the only way to its shelf is to try where a menu usually lives. */
  const guessed = summary.perShop.find((s) => s.licence === 'OCM-CAURD-24-000998');
  check('a shop with no menu link is not given up on', guessed?.status, 'ok');
  check('the menu was found by guessing', guessed?.foundMenuByGuess, true);
  check('and it was guessed, not stumbled on', guessed?.guessedMenuPaths, ['/menu']);
  check('its shelf came back', guessed?.flower, 2);

  const collected = JSON.parse(readFileSync(LISTINGS, 'utf8'))
    .filter((l) => l.licenseNumber === 'OCM-CAURD-24-000999')
    .sort((a, b) => a.strainNameRaw.localeCompare(b.strainNameRaw));

  check('two strains on the shelf', collected.length, 2);
  check('strain names', collected.map((l) => l.strainNameRaw), ['Blue Burst', 'Grape Cake']);
  check('every gram size read', collected[0]?.availableSizesGrams, [1, 3.5, 7, 14, 28]);
  check('potency read from a range', collected[0]?.thcPercent, 24.1);
  check('lineage read', collected.map((l) => l.lineage), ['HYBRID', 'INDICA']);
  // Shelves the run did not visit must survive it.
  check('other shelves carried forward', summary.shelvesCarriedForward > 0, true);
} finally {
  server.kill();
  if (existsSync(BACKUP)) {
    copyFileSync(BACKUP, LISTINGS);
    rmSync(BACKUP);
  }
}

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log('menu collection: end-to-end check passed.');
