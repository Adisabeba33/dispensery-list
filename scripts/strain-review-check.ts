/**
 * Checks for the second look at strain names (src/lib/strain-review.ts).
 *
 * Two kinds: names from the shelves it must clean, and cultivars it must leave
 * alone. The second list matters more — a name wrongly shortened is a jar the
 * site calls something nobody sells. Then the whole of today's shelf, for the
 * one promise the review makes: it takes words away, it never adds one.
 *
 *   npx tsx scripts/strain-review-check.ts
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FlowerListing } from '../src/lib/menu-format';
import { reviewListings, reviewShelf, titleCase, type LineBook } from '../src/lib/strain-review';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = <T>(p: string): T => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8')) as T;
const book = read<LineBook>('data/strain-lines.json');

let failures = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) return;
  console.log(`FAIL ${label}\n  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(actual)}`);
  failures += 1;
};

const listing = (name: string, brand: string | null = null, brandKey: string | null = null, raw = name): FlowerListing =>
  ({
    listingId: `${brandKey}-${name}`,
    licenseNumber: 'OCM-TEST',
    strainNameRaw: raw,
    strainNameCanonical: name,
    brand,
    brandKey,
  }) as unknown as FlowerListing;

/** One listing reviewed alone, or beside others when spelling is voted on. */
/** A listing at a given shop, for the rules that count how many shops write a name. */
const at = (shop: string, name: string, brand: string, brandKey: string): FlowerListing =>
  ({ ...listing(name, brand, brandKey), licenseNumber: shop, listingId: `${shop}-${name}` }) as FlowerListing;
/** What each listing of a small shelf is called once the whole of it is reviewed. */
const shelfOf = (rows: FlowerListing[]) => reviewListings(rows, book).map((l) => l.strainNameCanonical);

const one = (name: string, brand: string | null = null, brandKey: string | null = null, others: FlowerListing[] = []) =>
  reviewListings([listing(name, brand, brandKey), ...others], book)[0].strainNameCanonical;

/* ---- What it cleans ------------------------------------------------------ */

check('shouting, spoken normally', one('ACAPULCO GOLD', 'Back Home Cannabis Co.', 'backhome'), 'Acapulco Gold');
check('an OG stays an OG', one('ALIEN OG', 'ElectraLeaf', 'electraleaf'), 'Alien OG');
check('the way another shop writes it wins', one('WEDDING CAKE', null, null, [listing('Wedding Cake')]), 'Wedding Cake');
check('an apostrophe', titleCase("LAMB'S BREAD"), "Lamb's Bread");
check('an ordinal', titleCase('8TH AVE'), '8th Ave');
check('a code', titleCase('CHEM I95'), 'Chem I95');
check('a cross', titleCase('ALIEN COOKIES X HONEYMOON'), 'Alien Cookies x Honeymoon');
check('Og written small', one('Double Og Chem'), 'Double OG Chem');

check('a line before the cultivar', one('Classic Cuts Indoor Flower - Lemon Cherry Gelato', 'Claybourne Co.', 'claybourne'), 'Lemon Cherry Gelato');
check('a line after it', one('Cobra Kush - Gold Cuts', 'Claybourne Co.', 'claybourne'), 'Cobra Kush');
check('a line in brackets', one('GMO (Quiet Times)', 'Miss Grass', 'missgrass'), 'GMO');
check('a line run onto the name', one('Space Essentials Sunset Sherbert', 'To The Moon', 'tothemoon'), 'Sunset Sherbert');
check('a line with the grower run into it', one('Hashtag Honey Snowballz - Jack', 'Hashtag Honey', 'hashtaghoney'), 'Jack');
check('a line run on after it', one('Cobra Kush Gold Cuts', 'Claybourne Co.', 'claybourne'), 'Cobra Kush');
check('a line in brackets before it', one('(Fast Times) Kilimanjaro', 'Miss Grass', 'missgrass'), 'Kilimanjaro');
check('a collection opening the name', one('Collection Moonbeam Gelato', 'Grassroots', 'grassroots'), 'Moonbeam Gelato');
check('a name built of slashes', one('FLOWER/ JEALOUSY/ INDICA/ / THC', 'FLY WEIGHT', 'flyweight'), 'Jealousy');
check('the grower printed first', one('Lofty - Zombie Kush', 'Lofty Supply', 'loftysupply'), 'Zombie Kush');
check('the grower misspelt', one('Harney Brother - Jelly Donutz', 'Harney Brothers Cannabis', 'harneybrothers'), 'Jelly Donutz');
check("the grower's initials", one('TTM - Grape Ape', 'To The Moon', 'nolinesforthis'), 'Grape Ape');
check('a weight', one('Jack Herer - 1/8th', 'Ruby Farms', 'ruby'), 'Jack Herer');
check('a lean and a weight trailing it', one('Lemon Cherry Gelato Hybrid 1/8', 'Claybourne Co.', 'claybourne'), 'Lemon Cherry Gelato');
check('a grade of three words', one('Ultra-Premium Flower - Cobra Kush', 'Claybourne Co.', 'claybourne'), 'Cobra Kush');
check('the grower twice', one('Claybourne Claybourne - Purple Chem', 'Claybourne Co.', 'claybourne'), 'Purple Chem');
check("the grower and its line's initials", one('Claybourne CC - Purple Chem', 'Claybourne Co.', 'claybourne'), 'Purple Chem');
check('a way of growing', one('Gazzurple - Sunlight Assisted', 'Animal House', 'animalhouse'), 'Gazzurple');
check('packaging in brackets', one('OG (Indoor)', 'Connected Cannabis', 'connected'), 'OG');
check('a lean trailing it', one('Ice Cream Cake Indica-Leaning', 'Farmer Jims', 'farmerjims'), 'Ice Cream Cake');
check('packaging opening it', one('Mixed Light Flower Atomic Breath', 'Grocery', 'grocery'), 'Atomic Breath');
check('what is left in brackets', one('Mixed Light Flower (Rancid Fruit/ )', 'Animal House', 'animalhouse'), 'Rancid Fruit');
check('the grower left alone after a bracket', one('Sour Tangie - (Flower) Electraleaf', 'ElectraLeaf', 'electraleaf'), 'Sour Tangie');
check('an edition left alone after a line', one('Limited Edition World Cup - Dark Rainbow', 'mini MART', 'minimart'), 'Dark Rainbow');
check('a pack of three mylars', one('TTM - 3 x Mylar - Alien Cookies x Honeymoon', 'To The Moon', 'tothemoon'), 'Alien Cookies x Honeymoon');
check('a weight in grams', one('Evil Cookies indoor - 3.5GM', 'Dayzed', 'dayzed'), 'Evil Cookies');
check('a shelf code at the end', one('WALKABOUT FLOWER 6-2', 'Bouket', 'bouket'), 'Walkabout');
check('two shelf codes', one('LEMON CHERRY GLEATO 1-2 [5]', 'Herb', 'herb'), 'Lemon Cherry Gleato');
check('BX is written that way', one('Bx Runtz'), 'BX Runtz');
check("a shop's X", one('X - Alien Dawg', 'mini MART', 'minimart'), 'Alien Dawg');
check('a stray bar', one('Animal Face│', 'LEAL', 'leal'), 'Animal Face');
check('a leading star', one('*AMHERST SOUR DIESEL', 'LEFT COAST', 'leftcoast'), 'Amherst Sour Diesel');

/* ---- What it leaves alone ------------------------------------------------ */

const keeps = (label: string, name: string, brand: string | null = null, brandKey: string | null = null) =>
  check(`keeps ${label}`, one(name, brand, brandKey), name);

keeps('a cultivar named after its grower, alone', 'Runtz', 'Runtz', 'runtz');
keeps('a grower whose name is all it wrote', 'Kian', 'Kian', 'kian');
keeps('a cultivar that looks like a line and is not', 'Permanent Marker', 'Preferred Gardens', 'preferredgardens');
keeps("Mini Mart's Alien Dawg", 'Alien Dawg', 'mini MART', 'minimart');
keeps('Flower Power', 'Flower Power');
keeps('Whole Lotta Love', 'Whole Lotta Love');
keeps('Big Bud', 'Big Bud', 'Casa Verde Farms', 'casaverde');
keeps('Pack Mule', 'Pack Mule', 'Hashtag Honey', 'hashtaghoney');
keeps('Pre-98 Bubba Kush', 'Pre-98 Bubba Kush');
keeps('Bud Light Haze', 'Bud Light Haze');
keeps('Hawaiian God Bud', 'Hawaiian God Bud', '7Seaz', '7seaz');
keeps('AK-47', 'AK-47');
keeps('G-13', 'G-13');
keeps('8th Ave', '8th Ave', 'Banzzy 1305', 'banzzy1305');
keeps('GMO', 'GMO');
keeps('a number that is part of the name', 'Gelato 33');
keeps('Cookies 95', 'Cookies 95');
keeps('11:11', '11:11');
keeps('Jet Fuel 11-11', 'Jet Fuel 11-11');
keeps('a short shouted name', 'OGKB');
keeps('a censored name', 'Cherry Thunder F*ck', 'Dank', 'dank');
keeps('stars inside words', 'Cr*nch B*rries', 'Smart Bud', 'smartbud');
keeps('a date nobody can read', 'Oreoz (May 2026)', 'Rolling Green Cannabis', 'rollinggreen');
keeps('a single-word line when it is the whole name', 'Black', 'Knack', 'knack');
keeps("a knack cultivar opening with its line's word", 'Black Cherry Punch', 'Knack', 'knack');
keeps('Garlic Lime Reserve', 'Garlic Lime Reserve', 'SP Farms', 'sp');

/* ---- One grower's names, side by side ------------------------------------ */

check(
  "a pack name beside a cultivar the grower sells on its own",
  shelfOf([
    at('A', 'Crusty Crustacean', 'Find.', 'find'),
    at('B', 'Crusty Crustacean', 'Find.', 'find'),
    at('C', 'Crusty Crustacean - Big Flower Pack', 'Find.', 'find'),
  ])[2],
  'Crusty Crustacean',
);
check(
  'its parents beside it',
  shelfOf([
    at('A', 'Twin', 'Preferred Gardens', 'pg'),
    at('B', 'Twin', 'Preferred Gardens', 'pg'),
    at('C', 'Twin - Zoap X Lazer Gun', 'Preferred Gardens', 'pg'),
  ])[2],
  'Twin',
);
check(
  'not when the other piece is a cultivar it sells too',
  shelfOf([
    at('A', 'Grape Gas', 'Trap to Table', 'ttt'),
    at('B', 'Grape Gas', 'Trap to Table', 'ttt'),
    at('C', 'Purple Sunset', 'Trap to Table', 'ttt'),
    at('D', 'Purple Sunset - Grape Gas', 'Trap to Table', 'ttt'),
  ])[3],
  'Purple Sunset - Grape Gas',
);
check(
  'not when it is a pack of several',
  shelfOf([
    at('A', 'Alien Cookies', 'To The Moon', 'ttmx'),
    at('B', 'Alien Cookies', 'To The Moon', 'ttmx'),
    at('C', 'Alien Cookies - x Blue Moon - x Honeymoon - Flight Variety Pack', 'To The Moon', 'ttmx'),
  ])[2],
  'Alien Cookies - x Blue Moon - x Honeymoon - Flight Variety Pack',
);
check(
  'not when the cultivar is on one shelf only',
  shelfOf([at('A', 'Marker', 'mini MART', 'mm'), at('B', 'Colombia - Marker', 'mini MART', 'mm')])[1],
  'Colombia - Marker',
);
check(
  'the same words in the order more shops use',
  shelfOf([
    at('A', 'Paradise Pomelo', 'Claybourne Co.', 'cb'),
    at('B', 'Paradise Pomelo', 'Claybourne Co.', 'cb'),
    at('C', 'Pomelo Paradise', 'Claybourne Co.', 'cb'),
  ])[2],
  'Paradise Pomelo',
);
check(
  '"&" for "and"',
  shelfOf([
    at('A', 'Apples and Bananas', 'Claybourne Co.', 'cb'),
    at('B', 'Apples and Bananas', 'Claybourne Co.', 'cb'),
    at('C', 'Apple & Bananas', 'Claybourne Co.', 'cb'),
  ])[2],
  'Apples and Bananas',
);
const lights = [
  ...['A', 'B', 'C'].map((s) => at(s, 'Northern Lights', 'Doobie Labs', 'doobie')),
  at('D', 'Nothern Lights', 'Doobie Labs', 'doobie'),
];
check('a misspelling, written right at more shops', shelfOf(lights)[3], 'Northern Lights');
check(
  'a plural, an apostrophe, a doubled letter',
  shelfOf([
    ...['A', 'B', 'C'].map((s) => at(s, 'Melted Strawberries', 'Golden Garden', 'gg')),
    at('D', "Melted Strawberry's", 'Golden Garden', 'gg'),
  ])[3],
  'Melted Strawberries',
);
check(
  'not a different first letter',
  shelfOf([
    ...['A', 'B', 'C'].map((s) => at(s, 'Millionaire', 'The Botanist', 'botanist')),
    at('D', 'Billionaire', 'The Botanist', 'botanist'),
  ])[3],
  'Billionaire',
);
check(
  'not a cultivar another grower sells',
  shelfOf([
    ...['A', 'B', 'C'].map((s) => at(s, 'ClemDawg', '1937', 'n1937')),
    at('D', 'Chemdawg', '1937', 'n1937'),
    at('E', 'Chemdawg', 'Stranman', 'stranman'),
  ])[3],
  'Chemdawg',
);
check(
  'not a different number',
  shelfOf([
    ...['A', 'B', 'C'].map((s) => at(s, 'Gelato 33', 'Aeterna', 'aet')),
    at('D', 'Gelato 41', 'Aeterna', 'aet'),
  ])[3],
  'Gelato 41',
);

check(
  'packaging run onto a cultivar the shelves carry',
  shelfOf([
    at('A', 'Gelato 41', 'Connected', 'connected'),
    at('B', 'Gelato 41', 'Connected', 'connected'),
    at('C', 'Flower Gelato 41', 'Connected', 'connected'),
  ])[2],
  'Gelato 41',
);
check(
  'not when what is left is no cultivar',
  shelfOf([at('A', 'Flower Power', 'Seed', 'seed'), at('B', 'Power', 'Other', 'other'), at('C', 'Flower Power', 'Seed', 'seed')])[0],
  'Flower Power',
);
check(
  "not the grower's own name in a cultivar",
  shelfOf([at('A', 'Gelato', 'Runtz', 'runtz'), at('B', 'Gelato', 'Runtz', 'runtz'), at('C', 'Runtz Gelato', 'Runtz', 'runtz')])[2],
  'Runtz Gelato',
);
check(
  'a shop that writes F(Whole Flower)-Grower-Strain',
  shelfOf([
    at('A', 'Banana Papaya', 'Find.', 'find'),
    at('B', 'Banana Papaya', 'Find.', 'find'),
    at('C', 'F(Whole Flower)-Find.-Banana Papaya', 'Find.', 'find'),
  ])[2],
  'Banana Papaya',
);

/* ---- Growers ------------------------------------------------------------- */

const brands = reviewListings(
  [
    listing('A', 'Find.', 'find'), listing('B', 'Find.', 'find'), listing('C', 'FIND', 'find'), listing('D', 'Find', 'find'),
    listing('E', 'Budding Bliss Farm (Micro)', 'buddingblissmicro'),
  ],
  book,
).map((l) => l.brand);
check('one spelling per grower', brands.slice(0, 4), ['Find.', 'Find.', 'Find.', 'Find.']);
check('the licence type left off', brands[4], 'Budding Bliss Farm');

/* ---- The whole shelf ----------------------------------------------------- */

const shelf = read<FlowerListing[]>('data/flower-listings.json');
const words = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().match(/[a-z0-9]+/g) ?? [];
let added = 0;
let emptied = 0;
const reviewedShelf = reviewShelf(shelf, book);
/* What each grower is sold under somewhere, in the listing's own words. */
const ownNames = new Set<string>();
for (const r of reviewedShelf) {
  const had = new Set(words(r.before));
  if (words(r.after).every((w) => had.has(w))) ownNames.add(`${r.listing.brandKey}|${r.after.toLowerCase()}`);
}
for (const r of reviewedShelf) {
  if (!r.after.trim()) {
    emptied += 1;
    if (emptied <= 3) console.log(`FAIL left with no name: ${JSON.stringify(r.before)}`);
  }
  /* Either the listing's own words, or a name the same grower is sold under
     at another shop — the misspelling "Nothern Lights" becomes the Northern
     Lights the grower's other 45 shops print, and nothing else is allowed in. */
  const had = new Set(words(r.before));
  const extra = words(r.after).filter((w) => !had.has(w));
  if (extra.length > 0 && !ownNames.has(`${r.listing.brandKey}|${r.after.toLowerCase()}`)) {
    added += 1;
    if (added <= 5) console.log(`FAIL added ${extra.join(', ')}: ${JSON.stringify(r.before)} → ${JSON.stringify(r.after)}`);
  }
}
check('no name is made up: own words, or the same grower\'s name from another shop', added, 0);
check('no listing is left without a name', emptied, 0);

const lines = Object.values(book.lines).flat().length;
const clash = Object.entries(book.notLines ?? {}).flatMap(([k, v]) =>
  v.filter((n) => (book.lines[k] ?? []).some((l) => l.toLowerCase() === n.toLowerCase())),
);
check('nothing is both a line and a cultivar', clash, []);

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log(`strain review: all checks passed (${shelf.length} listings, ${lines} confirmed lines).`);
