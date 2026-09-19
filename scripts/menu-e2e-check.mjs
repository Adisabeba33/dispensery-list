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
import { readFileSync, writeFileSync, rmSync, copyFileSync, existsSync } from 'node:fs';
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

const serve = () =>
  spawn('node', ['scripts/fixtures/menu-server.mjs', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
/* Restartable: the flaky shop's menu is empty to its first caller and stocked
   to every one after, and the second run below needs it to be flaky again. */
let server = serve();

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

  /* The third shop is given a shelf it was read from before. That is the whole
     precondition for asking a second time — the collector will not knock twice
     at a shop it has never read anything from — and it lives in this file, so
     the file is what has to say so. */
  const shelves = existsSync(LISTINGS) ? JSON.parse(readFileSync(LISTINGS, 'utf8')) : [];
  writeFileSync(
    LISTINGS,
    JSON.stringify(
      [
        ...shelves.filter((l) => !l.licenseNumber.startsWith('OCM-CAURD-24-0009')),
        {
          ...shelves[0],
          licenseNumber: 'OCM-CAURD-24-000997',
          listingId: 'OCM-CAURD-24-000997::fixture-yesterday',
          strainNameRaw: 'Yesterday Kush',
          capturedAt: new Date(Date.now() - 86400000).toISOString(),
        },
      ],
      null,
      1,
    ),
  );

  const { code, out } = await run('node', [
    'scripts/menu-render.mjs',
    '--dataset', 'scripts/fixtures/menu-dataset.json',
    '--limit', '10',
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
  /* Both addresses exist on the fixture host; the flower one is tried first.
     A general menu makes the classifier do the filter's work, and that is
     where the mistakes are — 38 of 193 real shelves are read from a page that
     names no category at all. */
  check('and it was guessed, not stumbled on', guessed?.guessedMenuPaths, ['/menu/flower', '/menu']);
  check('the flower address was the one taken', guessed?.landedOn?.endsWith('/menu/flower'), true);
  check('its shelf came back', guessed?.flower, 2);

  /* A shop that had a shelf and came back empty, asked once more. Its menu
     answers the first caller with an empty list and every caller after that
     with its real shelf, which is what the collector cannot tell from a shop
     that has sold out — except by asking again. */
  const flaky = summary.perShop.find((s) => s.licence === 'OCM-CAURD-24-000997');
  check('an empty shelf that used to have products is not believed', flaky?.retried, true);
  check('what the first visit saw is kept', flaky?.firstAttempt?.status, 'no-products');
  check('and the first visit really did come back empty', flaky?.firstAttempt?.productsSeen, 0);
  check('the second visit found the shelf', flaky?.flower, 2);
  check('one row for the shop, not two', summary.perShop.filter((s) => s.licence === 'OCM-CAURD-24-000997').length, 1);
  check('the run counted the second visits', summary.askedAgain, 1);
  check('and says the asking worked', summary.askedAgainAndAnswered, 1);

  /* The bound on all of this. A shop we have never read a shelf from is read
     once and left alone however empty it is — otherwise a day on which nothing
     is reachable costs the run twice its time, and the batches at the end of
     it never run. */
  const neverRead = summary.perShop.find((s) => s.licence === 'OCM-CAURD-24-000996');
  check('an empty shop with nothing to compare against is read once', neverRead?.status, 'no-products');
  check('and is not asked again', neverRead?.retried, undefined);
  // Nor is a shop that answered the first time.
  check('a shop that answered is not asked twice', summary.perShop[0].retried, undefined);

  /* The retry replaces the empty reading rather than being carried alongside
     it: the shelf published for this shop is today's, not yesterday's held
     one. */
  const flakyShelf = JSON.parse(readFileSync(LISTINGS, 'utf8')).filter(
    (l) => l.licenseNumber === 'OCM-CAURD-24-000997',
  );
  check('the second reading is what gets published', flakyShelf.length, 2);
  check(
    'and the held shelf is gone',
    flakyShelf.some((l) => l.strainNameRaw === 'Yesterday Kush'),
    false,
  );

  const collected = JSON.parse(readFileSync(LISTINGS, 'utf8'))
    .filter((l) => l.licenseNumber === 'OCM-CAURD-24-000999')
    .sort((a, b) => a.strainNameRaw.localeCompare(b.strainNameRaw));

  check('two strains on the shelf', collected.length, 2);
  check('strain names', collected.map((l) => l.strainNameRaw), ['Blue Burst', 'Grape Cake']);
  check('every gram size read', collected[0]?.availableSizesGrams, [1, 3.5, 7, 14, 28]);
  check('potency read from a range', collected[0]?.thcPercent, 24.1);
  check('lineage read', collected.map((l) => l.lineage), ['HYBRID', 'INDICA']);
  /* The total a menu states is the total for the query it is answering. This
     shop answers with its five-product shelf and, beside it, the counts for
     every other category it sells — 500 edibles, 320 vapes — the way a real
     menu fills its filter sidebar. Read as "the largest number in the answer",
     this shop has 500 products and we have read five of them. */
  const facets = summary.perShop.find((s) => s.licence === 'OCM-CAURD-24-000995');
  check('the shelf was read', facets?.flower, 2);
  /* Its answer also carries a list of its own categories and a cookie banner,
     both shaped exactly like the real ones: a name, a category, and nothing
     for sale. Counted as products they were 178 of Curaleaf's 182. */
  check('only the things for sale were counted', facets?.productsSeen, 5);
  check('the total is the one beside the products', facets?.declaredTotal, 5);
  check('and it is compared against that query alone', facets?.pagedQueryProducts, 5);
  check('so the shop reads as complete', facets?.pagingStoppedBecause, 'read-everything-declared');

  /* The biggest answer is not always the one that can be paged. This shop's
     carousels arrive in one answer carrying six products with no page number
     anywhere in the request; its product list carries two and pages to four. */
  const carousel = summary.perShop.find((s) => s.licence === 'OCM-CAURD-24-000994');
  check('a pageable request was preferred to a bigger one', carousel?.pagedQueryIsPageable, true);
  check('the list was paged, not the carousel', carousel?.pagesAsked >= 1, true);
  check('to the end of it', carousel?.pagingStoppedBecause, 'read-everything-declared');
  check('the total is the list_s, not a carousel_s', carousel?.declaredTotal, 4);
  check('and the whole list was read', carousel?.pagedQueryProducts, 4);

  /* Products with no category field at all. What they are is in the name —
     the word Flower, the weight, the potency — and refusing to read the name
     because a field is missing is what cost Liberty Buds all 206 of its
     products, read off its own flower page. */
  const nocat = summary.perShop.find((s) => s.licence === 'OCM-CAURD-24-000993');
  check('an uncategorised product named as flower is kept', nocat?.flower, 2);
  check('one named as something else is still refused', nocat?.rejected?.['title-not-flower'], 1);
  check('and one that names nothing is not guessed at', nocat?.rejected?.['no-category'], 1);

  const nocatShelf = JSON.parse(readFileSync(LISTINGS, 'utf8'))
    .filter((l) => l.licenseNumber === 'OCM-CAURD-24-000993')
    .flatMap((l) => l.availableSizesGrams ?? [])
    .sort((a, b) => a - b);
  /* 3.5 from "| 3.5g |", and 7 from a name that ends "- 7" with the unit left
     off, which is how The Hibrary writes an eighth. */
  check('both weights were read, unit or no unit', nocatShelf, [3.5, 7]);

  /* A menu link that bounces to a wall which answers nothing and names, in its
     own query string, the address it bounced us from. The wall here is
     deliberately unanswerable — a date-of-birth form, no button — so a shelf
     coming back proves the address was read, not that something was clicked. */
  const parked = summary.perShop.find((s) => s.licence === 'OCM-CAURD-24-000992');
  check('we noticed we were parked', parked?.parkedOn, '/gate');
  check('and went where the page said', parked?.wentOnwardTo, '/parked-shelf');
  check('the shelf came back', parked?.flower, 2);

  /* The same bounce onto a captcha. That is a control the shop put there on
     purpose, and it is left alone however clearly the address names what is
     behind it. */
  const walled = summary.perShop.find((s) => s.licence === 'OCM-CAURD-24-000991');
  check('a captcha is not followed', walled?.wentOnwardTo, undefined);
  check('nor even noted as somewhere to go', walled?.parkedOn, undefined);
  check('and the shop stays empty', walled?.flower, 0);

  /* Three things between the door and the shelf, as QUBE serves them: an age
     question on top, a newsletter box under it, a prize draw under that. The
     draw is rendered first, so "Continue" — which submits a name and an email
     — is the first control on the page to match the old age vocabulary.

     The fixture poisons itself: press Join Now, Continue, or NOT YET and the
     shelf is never served. Two strains coming back is proof that only the
     declines were pressed. */
  const walls = summary.perShop.find((s) => s.licence === 'OCM-CAURD-24-000990');
  check('the age question was answered', walls?.ageGate, true);
  check(
    'and both offers were declined, in the order they were met',
    walls?.offersDismissed,
    ['No Thanks', 'No thanks, let me browse'],
  );
  /* The newsletter box prints "You Must Be 21+" across its top, so a wall
     detected by its words would still look up here and nothing would ever be
     dismissed. It is detected by its buttons. */
  check('the shelf behind all three came back', walls?.flower, 2);

  // Shelves the run did not visit must survive it.
  check('other shelves carried forward', summary.shelvesCarriedForward > 0, true);

  /* And the bound on the bound: what happens when the run has no time left to
     ask again. A shop that was owed a second visit and did not get one must say
     so — it looks identical to one that got its second visit and stayed empty,
     and those want opposite things done about them.

     The same flaky shop, a fresh server so its menu is empty again, and a
     retry budget of nothing. It now has yesterday's shelf from the run above,
     which is the precondition for being asked at all. */
  server.kill();
  await new Promise((r) => setTimeout(r, 500));
  server = serve();
  await new Promise((r) => setTimeout(r, 1500));

  const broke = await run(
    'node',
    ['scripts/menu-render.mjs', '--dataset', 'scripts/fixtures/menu-dataset.json', '--limit', '1', '--offset', '2'],
    { env: { ...process.env, MENU_RETRY_BUDGET_MS: '0' } },
  );
  if (broke.code !== 0) {
    console.log(broke.out.slice(-1500));
    throw new Error(`collector exited ${broke.code}`);
  }
  const outOfTime = JSON.parse(
    readFileSync(resolve(ROOT, 'enrichment-output/menu-summary.json'), 'utf8'),
  );
  const owed = outOfTime.perShop.find((s) => s.licence === 'OCM-CAURD-24-000997');
  check('the shop still needed asking again', owed?.willAskAgain, true);
  check('it did not get asked', owed?.retried, undefined);
  check('and the run says why', owed?.retryBudgetSpent, true);
  check('counted in the summary', outOfTime.owedASecondVisit, 1);
  // The shelf we could not re-read is still the one that gets published.
  check(
    'yesterday\'s shelf is held rather than emptied',
    JSON.parse(readFileSync(LISTINGS, 'utf8')).filter((l) => l.licenseNumber === 'OCM-CAURD-24-000997')
      .length,
    2,
  );
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
