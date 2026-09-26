/**
 * Fixture check for the menu parser.
 *
 * Three collection runs were spent fixing this parser blind, each costing a
 * round trip through CI because the only evidence was a truncated log. The
 * fixtures below are built from the key names those runs actually reported —
 * capitalised on one platform, an opaque id beside a readable name on another —
 * so a mapping mistake is caught here in a second rather than there in six
 * minutes.
 *
 *   node scripts/menu-parse-check.mjs
 */
import {
  brandKeyOf, categoryFromProductUrl, classify, cleanStrainName,
  decodeFlight, decodeTurboStream, destinationOf, flattenJsonApiProducts, flattenSearchHits, flattenStockRecords,
  flowerIn, foreignShelfShare, isProductPage, lineageSegmentOf, looksLikeAgeWall, menuKey,
  mergeBySize, pagedRequest, pickFlowerInside, pickMenuLink, pickStore,
  placeNamesOf, rankMenuLink, registerTextOf, sameEstate, signatureOf, sizeFromText,
  toListing, wallAction
} from './menu-render.mjs';
import { canonicalStrain, strainKey } from './strain-name.mjs';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const shop = { licenseNumber: 'OCM-CAURD-24-000001' };
const SRC = 'https://example-dispensary.test/menu';

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) return;
  failures += 1;
  console.log(`FAIL ${label}\n  expected ${e}\n  actual   ${a}`);
};

/* ---------------------------------------------------------------- Dutchie --
 * 105 of 242 candidate shops. Keys are capitalised: Name, Options, CBDContent.
 * Sizes arrive as bare strings, potency as { range: [...] }.
 */
const dutchie = {
  _id: 'a1',
  id: 'a1',
  brandName: 'STIIIZY',
  Name: 'STIIIZY - Blue Burst - 3.5g',
  type: 'Flower',
  subcategory: 'Whole Flower',
  strainType: 'Hybrid',
  THC: { range: [24.1, 24.1], unit: 'PERCENTAGE' },
  CBDContent: { range: [0.1, 0.1], unit: 'PERCENTAGE' },
  Options: ['1g', '1/8oz', '1/4oz', '1/2oz', '1oz'],
  Prices: [12, 35, 65, 120, 220],
};
check('dutchie classify', classify(dutchie), 'flower');
const d = toListing(dutchie, shop, SRC, {});
check('dutchie strain', d?.strainNameRaw, 'Blue Burst');
check('dutchie sizes', d?.availableSizesGrams, [1, 3.5, 7, 14, 28]);
check('dutchie thc', d?.thcPercent, 24.1);
check('dutchie lineage', d?.lineage, 'HYBRID');
check('dutchie brand', d?.brand, 'STIIIZY');

/* ------------------------------------------------------------------ OTHER --
 * The category id is opaque and the readable word lives in a second field.
 * Reading only the first of the two was why seven shops looked flowerless.
 */
const other = {
  id: 'b2',
  name: 'Leal - Grape Cake - Flower - 3.5g',
  brand: 'Leal',
  productCategory: '66f2ab19c0de4a0012',
  productCategoryName: 'Flower',
  cannabisType: 'Indica',
  weightInGrams: 3.5,
  terpenes: [{ name: 'BetaMyrcene', value: 0.4 }],
};
check('other classify', classify(other), 'flower');
const o = toListing(other, shop, SRC, {});
check('other strain', o?.strainNameRaw, 'Grape Cake');
check('other sizes', o?.availableSizesGrams, [3.5]);
check('other lineage', o?.lineage, 'INDICA');
check('other terpene', o?.terpenes.profile[0], { name: 'MYRCENE', rawName: null, percent: 0.4 });
check('other terpene source', o?.terpenes.source, 'MENU_LISTING');

/* ------------------------------------------------------------ PROPRIETARY --
 * The one shape that already worked. It must keep working.
 */
const proprietary = {
  id: 'c3',
  name: 'ILLUMINATI (H) 3.5g - F42',
  brand: 'Grow Op',
  category: 'Flower',
  subcategory: 'Flower',
  strainType: 'hybrid',
  potencyThc: 27.4,
  variants: [{ gramAmount: 3.5 }, { gramAmount: 7 }],
  terpenes: [{ name: 'Limonene', value: 0 }],
};
check('proprietary classify', classify(proprietary), 'flower');
const pr = toListing(proprietary, shop, SRC, {});
check('proprietary strain', pr?.strainNameRaw, 'ILLUMINATI');
check('proprietary sizes', pr?.availableSizesGrams, [3.5, 7]);
check('proprietary lineage', pr?.lineage, 'HYBRID');
// A menu printing 0% is stating nothing, not stating zero.
check('proprietary blank terpene', pr?.terpenes.profile[0].percent, null);

/* --------------------------------------------------------- what to refuse --
 * Everything the user asked us to treat as noise: rolled, infused, not flower.
 */
check('pre-roll', classify({ Name: 'Blue Dream Pre-Roll 1g', type: 'Pre-Rolls', Options: ['1g'] }), 'title-not-flower');
check('roll by category', classify({ Name: 'Sunset Sherbet', type: 'Pre-Rolls' }), 'category-not-flower');
check('eighths category', classify({ name: 'Gelato 41', category: '8ths  regular' }), 'flower');
check('eighth pre-roll pack', classify({ name: 'Gelato 41', category: '8ths pre-roll pack' }), 'category-not-flower');
/* Ground flower is shake, whatever the shop calls it after the word. The rule
   was the phrase "ground flower", so a shop writing "Bulky's Ground" or
   "Pluto - Indica Ground" put two-ounce bags of shake on a flower shelf. Found
   by a person checking one Westchester shop against its own menu and asking
   what those were. The word appears 98 times in 22,289 collected listings and
   is a product every single time. */
check('ground is shake, however it is worded',
  classify({ Name: "Bulky's Ground", type: 'Flower' }), 'title-not-flower');
check('and pre-ground is too',
  classify({ Name: 'Amnesia Haze - Pre Ground', type: 'Flower' }), 'title-not-flower');
check('and ground leading the name',
  classify({ Name: 'Ground - Tahoe OG', type: 'Flower' }), 'title-not-flower');
/* Glued to "pre" or conjugated, it is the same bag: 73 of these stood on 23
   shelves on 25 September because none is "ground" on a word boundary. */
for (const name of [
  'Applescotti Preground', 'Citrus Slurp - PreGround Tin', 'Punch Breath - Pre-Grounded Flower',
  'Grounded Flower - Titan Express', 'Nic The Bruiser - Grounded Flower', 'Sativa Grounds',
  'Dumbo Electric ( WHITE HOT GUAVA PRE-GROUNDED FLOWER )', 'Inf. Flower - Preground - Tangerine Dream',
]) {
  check(`ground, glued or conjugated: ${name}`, classify({ Name: name, type: 'Flower' }), 'title-not-flower');
}
/* On a word boundary, so a cultivar that merely contains the letters keeps its
   place — no catalog name carries "ground" as a word. */
check('but a name that only contains the letters is flower',
  classify({ Name: 'Playground Punch', type: 'Flower' }), 'flower');
check('nor one where the letters run on',
  classify({ Name: 'Underground Groundhog Kush', type: 'Flower' }), 'flower');
check('infused', classify({ Name: 'Infused Pouch 14g', type: 'Flower' }), 'title-not-flower');
check('vape', classify({ Name: 'Blue Dream Cartridge', type: 'Vaporizers' }), 'title-not-flower');
check('edible', classify({ Name: 'Peach Gummies 10mg', type: 'Edibles' }), 'title-not-flower');
check('no category', classify({ Name: 'Mystery Item' }), 'no-category');
check('unrelated type field', classify({ name: 'Grape Cake', type: 'variant', categoryName: 'Flower' }), 'flower');

// Flower with no weight anywhere is dropped: the shelf view is entirely about
// which strains come by the eighth, quarter, half or ounce.
check('flower without a size', toListing({ Name: 'Nameless Bud', type: 'Flower' }, shop, SRC, {}), null);

/* Where the twelve sites that published no THC keep it — shapes as a probe
   read them off Bleu Leaf, StarLife, Misha's and Elevation HQ. */
const lab = (extra, Name = 'Lab Shape') => toListing({ Name, type: 'Flower', Options: ['3.5g'], ...extra }, shop, SRC, {});
check('labs: the THC figure',
  lab({ labs: { thc: 32.44, thcMax: 32.44, thcA: null, thcContentUnit: '%', cbd: null, cbdMax: 0.1 } })?.thcPercent, 32.44);
check('labs: CBD beside it', lab({ labs: { thc: 32.44, cbd: null, cbdMax: 0.1, cbdContentUnit: '%' } })?.cbdPercent, 0.1);
check('labs: the Max when nothing else is filled', lab({ labs: { thc: null, thcMax: 27.1, thcContentUnit: null } })?.thcPercent, 27.1);
check('labs: a zero THC is still silence', lab({ labs: { thc: 0, thcMax: 0, thcContentUnit: '%' } })?.thcPercent, null);
check('labs: milligrams are not a percentage', lab({ labs: { thc: 250, thcContentUnit: 'mg' } })?.thcPercent, null);
check('variants: the lab test on the size',
  lab({ variants: [{ labTests: { thc: { value: [27.1], unitAbbr: '%' }, cbd: null } }] }, 'GMO 3.5g')?.thcPercent, 27.1);
check('variants: the first size that states one',
  lab({ variants: [{ labTests: { thc: null } }, { labTests: { thc: { value: [34.7444], unitAbbr: '%' } } }] }, 'Hickory Hash 3.5g')?.thcPercent, 34.74);
check('thcPercentage beside labResults', lab({ thcPercentage: 32.13, thcDisplay: '32.13%' })?.thcPercent, 32.13);
check('a named field wins over the lab block',
  lab({ THCContent: { range: [24.1, 24.1] }, labs: { thc: 32.44, thcContentUnit: '%' } })?.thcPercent, 24.1);

/* ------------------------------------------------------- HARVEST & PACKAGE --
 * Three fields the mapper wrote null into whatever the payload said:
 * harvestedOn, packagedOn and the whole-panel cannabinoid figure. The
 * validator has warned on a stale packagedOn since it was written and never
 * had one to warn about.
 *
 * Freshness is the field a reader most wants and the one most easily faked by
 * a bad parse, so a date that cannot be read is left empty rather than
 * guessed. */
const dated = (extra) => toListing({ Name: 'Datey', type: 'Flower', Options: ['3.5g'], ...extra }, shop, SRC, {});

check('an ISO packaged date is read', dated({ packagedOn: '2026-08-14' })?.packagedOn, '2026-08-14');
check('so is one written with slashes', dated({ packagedDate: '08/14/2026' })?.packagedOn, '2026-08-14');
check('an epoch in seconds is read', dated({ packageDate: 1786665600 })?.packagedOn, '2026-08-14');
check('and the same epoch in milliseconds', dated({ packagedAt: 1786665600000 })?.packagedOn, '2026-08-14');
check('an epoch arriving as a string is still an epoch', dated({ packagedOn: '1786665600' })?.packagedOn, '2026-08-14');
check('a harvest date is read from its own names', dated({ harvestDate: '2026-06-02' })?.harvestedOn, '2026-06-02');

/* The refusals. A wrong date here reads as freshness, which is worse than an
   empty field — so anything unreadable, anything from before adult-use flower
   could have been grown, and anything dated after today is refused. */
check('a date that is not a date is refused', dated({ packagedOn: 'fresh!' })?.packagedOn, null);
check('an empty string is refused', dated({ packagedOn: '' })?.packagedOn, null);
check('a date before the trade existed is refused', dated({ packagedOn: '1999-01-01' })?.packagedOn, null);
check(
  'a date in the future is refused',
  dated({ packagedOn: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) })?.packagedOn,
  null,
);
check('and a shop with nothing to say still says nothing', dated({})?.packagedOn, null);

check('the whole cannabinoid panel is read', dated({ totalCannabinoids: 31.4 })?.totalCannabinoidsPercent, 31.4);

/* ------------------------------------------------------------- POTENCY -----
 * The platform behind /categories/flower states nothing under thc or
 * potencyThc. Four thousand listings came off it with potency on eighteen per
 * cent of them and CBD on none, against two thirds and a third everywhere
 * else — not because the menu is quiet but because we were reading the wrong
 * names. */
const potent = (extra) => toListing({ Name: 'Potent', type: 'Flower', Options: ['3.5g'], ...extra }, shop, SRC, {});

check('a display value carries the figure', potent({ potencyThcDisplayValue: '24.1%' })?.thcPercent, 24.1);
check('so does the low end of a range', potent({ potencyThcRangeLow: 19.8, potencyThcRangeHigh: 22 })?.thcPercent, 19.8);
/* A platform that knows only the top writes the bottom as zero, and zero per
   cent THC is not a thing a flower menu means. */
check('a zero low end falls through to the top', potent({ potencyThcRangeLow: 0, potencyThcRangeHigh: 22 })?.thcPercent, 22);
check('CBD is read the same way', potent({ potencyCbdDisplayValue: '0.4%' })?.cbdPercent, 0.4);
/* The night the zero-skip ran over CBD, the share of listings with a CBD figure
   fell from 23.3 per cent to 4.3: ninety-five in every hundred of those figures
   were an honest zero. A zero THC is a field nobody filled; a zero CBD is what
   nearly every jar actually contains. */
check('a stated zero CBD is a reading', potent({ cbd: 0 })?.cbdPercent, 0);
check('and so is a zero CBD range', potent({ potencyCbdRangeLow: 0, potencyCbdRangeHigh: 0 })?.cbdPercent, 0);
check('a stated zero THC is not', potent({ thc: 0 })?.thcPercent, null);
check('a zero CBD in a panel is a reading too', potent({ cannabinoids: [{ name: 'CBD', value: 0 }] })?.cbdPercent, 0);
check('and a quiet menu still says nothing', potent({})?.thcPercent, null);

/* The array form, read only after every named field has stayed quiet. */
const panel = [{ name: 'THCA', value: 26.5 }, { name: 'CBD', value: 0.9 }, { name: 'CBG', value: 1.1 }];
check('a cannabinoid panel yields THC', potent({ cannabinoids: panel })?.thcPercent, 26.5);
check('and CBD', potent({ cannabinoids: panel })?.cbdPercent, 0.9);
check('a named field still wins over the panel', potent({ thc: 21, cannabinoids: panel })?.thcPercent, 21);
check('CBG is not mistaken for CBD', potent({ cannabinoids: [{ name: 'CBG', value: 1.1 }] })?.cbdPercent, null);
check('under its other name too', dated({ tac: 28 })?.totalCannabinoidsPercent, 28);
check('a panel above a hundred per cent is refused', dated({ totalCannabinoids: 140 })?.totalCannabinoidsPercent, null);

/* --------------------------------------------------------------- brand key --
 * The register stores a brand exactly as each shop prints it, which is right.
 * It also means ElectraLeaf arrives six ways and one outreach target splits
 * six ways with it. brandKey is the cultivator's identity behind the spelling.
 */
check('case and spacing collapse', ['ElectraLeaf', 'ELECTRALEAF', 'Electra Leaf', 'Electraleaf NY'].map(brandKeyOf),
  ['electraleaf', 'electraleaf', 'electraleaf', 'electraleaf']);
check('accents fold', brandKeyOf('Boukét'), brandKeyOf('Bouket'));
check('corporate words dropped', brandKeyOf('Rolling Green Cannabis'), brandKeyOf('Rolling Green'));
// Null rather than "": an empty key would merge every brandless listing into
// one enormous cultivator.
check('nothing left is null, not empty', brandKeyOf('Cannabis Co'), null);
check('no brand is null', brandKeyOf(null), null);
// Two genuinely different cultivators must not collide.
check('different brands stay different', brandKeyOf('Florist Farms') === brandKeyOf('Hurley Grown'), false);
check('the listing carries it', toListing({ Name: 'X', type: 'Flower', Options: ['3.5g'], brandName: 'ElectraLeaf NY' }, shop, SRC, {})?.brandKey, 'electraleaf');

/* ----------------------------------------------------------------- terpenes --
 * Audited against what the register actually filed as OTHER: 772 entries over
 * ten spellings. Four defects, each of which silently lost or invented data.
 */
const terps = (list) =>
  toListing({ Name: 'Zoap', type: 'Flower', Options: ['3.5g'], terpenes: list }, shop, SRC, {})?.terpenes;

// 394 entries were stored under the literal name "[object Object]" because the
// platform files the compound's name as an object of its own.
check('nested name read, not stringified',
  terps([{ name: { en: 'Limonene' }, value: 0.4 } ])?.profile[0],
  { name: 'LIMONENE', rawName: null, percent: 0.4 });
check('unreadable name skipped, never stored as a placeholder',
  terps([{ name: { code: 7 }, value: 0.4 }])?.profile, []);

// Real compounds the map did not know. Caryophyllene oxide is NOT
// caryophyllene: it is what accumulates as flower ages.
check('caryophyllene oxide is its own compound',
  terps([{ name: 'Caryophyllene Oxide', value: 0.2 }])?.profile[0]?.name, 'CARYOPHYLLENE_OXIDE');
check('isopulegol mapped', terps([{ name: 'Isopulegol', value: 0.1 }])?.profile[0]?.name, 'ISOPULEGOL');
check('p-cymene mapped', terps([{ name: 'pCymene', value: 0.1 }])?.profile[0]?.name, 'CYMENE');
check('terpinene mapped', terps([{ name: '\u03b1-Terpinene', value: 0.1 }])?.profile[0]?.name, 'TERPINENE');

// Summary rows are not compounds. Storing them invents one and double-counts
// the mass it stands for.
const withTotals = terps([
  { name: 'Limonene', value: 0.4 },
  { name: 'Total Terpenes', value: 1.8 },
  { name: 'Other Terpenes', value: 0.2 },
]);
check('total goes to totalPercent', withTotals?.totalPercent, 1.8);
check('residual bucket dropped', withTotals?.profile.map((t) => t.name), ['LIMONENE']);

/* ------------------------------------------------------- product page + copy --
 * Both were hardcoded null for every one of 9,542 collected listings, which is
 * why 127 collected terpene panels are leads rather than records: without a
 * product page there is no route to the batch id a tier-C reading requires.
 */
const withUrl = (v) => toListing({ Name: 'Blue Burst', type: 'Flower', Options: ['3.5g'], url: v }, shop, SRC, {});
check('absolute product url kept', withUrl('https://x.test/p/a')?.productUrl, 'https://x.test/p/a');
check('root-relative url resolved', withUrl('/product/b')?.productUrl, 'https://example-dispensary.test/product/b');
// A bare slug is NOT a URL. Building one would invent a link: the platform's
// real path might be /product/, /menu/, /shop/p/ or nothing at all.
check('bare slug refused', withUrl('blue-burst')?.productUrl, null);
check('junk url refused', withUrl('javascript:void(0)')?.productUrl, null);
check('missing url stays null', toListing({ Name: 'X', type: 'Flower', Options: ['3.5g'] }, shop, SRC, {})?.productUrl, null);

const withDesc = (v) => toListing({ Name: 'Blue Burst', type: 'Flower', Options: ['3.5g'], description: v }, shop, SRC, {});
check('menu copy kept, tags stripped',
  withDesc('<p>A <b>Gelato</b> x Sherb cross, sweet citrus.</p>')?.description,
  'A Gelato x Sherb cross, sweet citrus.');
check('entities decoded', withDesc('Sweet &amp; loud, the grower&#39;s pick')?.description, "Sweet & loud, the grower's pick");
// Rule 5 evidence is only worth keeping when there is a sentence to read.
check('too short to be copy', withDesc('Nice')?.description, null);
check('missing copy stays null', toListing({ Name: 'X', type: 'Flower', Options: ['3.5g'] }, shop, SRC, {})?.description, null);

/* --------------------------------------------- one product per weight ----
 * Some platforms publish each weight as its own product with an empty variants
 * array. The two rows must end up as one strain carrying both sizes.
 */
{
  const eighth = toListing(
    { name: 'WARRIOR | FRESH POWDER | FLOWER | 3.5G', brand: 'Operator', productCategoryName: 'Flower', weightInGrams: 3.5, variants: [] },
    shop, SRC, {},
  );
  const ounce = toListing(
    { name: 'WARRIOR | FRESH POWDER | FLOWER | 28G', brand: 'Operator', productCategoryName: 'Flower', weightInGrams: 28, variants: [] },
    shop, SRC, {},
  );
  check('same strain, two weights, same id', eighth?.listingId, ounce?.listingId);
  const merged = mergeBySize([eighth, ounce].filter(Boolean));
  check('merged into one strain', merged.length, 1);
  check('carrying both weights', merged[0]?.availableSizesGrams, [3.5, 28]);
}

/* ------------------------------------------------------------ size strings */
check('size 1/8oz', sizeFromText('1/8oz'), 3.5);
check('size eighth', sizeFromText('Eighth'), 3.5);
check('size 1oz', sizeFromText('1oz'), 28);
check('size 28 Grams', sizeFromText('28 Grams'), 28);
check('size half', sizeFromText('1/2 oz'), 14);
check('no size', sizeFromText('Blue Dream'), null);
// A hundredth of a gram is some other field read as a weight.
check('implausible size refused', toListing({ Name: 'Star Dawg', type: 'Flower', size: 0.01 }, shop, SRC, {}), null);
// A key that names grams is trusted; a bare number under `size` is not — that
// is how quantities and prices arrived on the shelf as eleven- and
// twenty-seven-gram packs.
check('small real pack kept', toListing({ Name: 'Dime Bag', type: 'Flower', weightInGrams: 0.7 }, shop, SRC, {})?.availableSizesGrams, [0.7]);
check('bare number is not a weight', toListing({ Name: 'Mystery', type: 'Flower', size: 26 }, shop, SRC, {}), null);
check('unit in text is a weight', toListing({ Name: 'Mystery', type: 'Flower', size: '3.5g' }, shop, SRC, {})?.availableSizesGrams, [3.5]);
check('variant value is not a weight', toListing({ Name: 'Mystery', type: 'Flower', variants: [{ name: '3.5g', value: 27 }] }, shop, SRC, {})?.availableSizesGrams, [3.5]);
check('shake refused', classify({ Name: 'Blue Dream Shake', type: 'Flower' }), 'title-not-flower');
check('ground flower refused', classify({ Name: 'Ready To Roll - Golden Lemons - Ground Flower', type: 'Flower' }), 'title-not-flower');
check('sampler refused', classify({ Name: 'Flower Flight: Alien Cookies, Blue Moon Dream', type: 'Flower' }), 'title-not-flower');

/* ------------------------------------------------- merging what shares an id --
 * The id folds punctuation and the canonical name did not, so an eighth and an
 * ounce of one strain could carry one id and still be two shelf items — which
 * failed validation as a duplicate and lost the ounce's weight on the way.
 */
{
  const a = toListing({ Name: 'Cherry Pie', brandName: 'The Plug Pack', type: 'Flower', Options: ['1/8oz'] }, shop, SRC, {});
  const b = toListing({ Name: 'Cherry Pie ( )', brandName: 'The Plug Pack', type: 'Flower', Options: ['1oz'] }, shop, SRC, {});
  check('empty brackets are not part of a name', b?.strainNameRaw, 'Cherry Pie');
  check('both carry one id', a?.listingId, b?.listingId);
  const merged = mergeBySize([a, b].filter(Boolean));
  check('and merge into one shelf item', merged.length, 1);
  check('carrying both weights', merged[0]?.availableSizesGrams, [3.5, 28]);
}

/* ------------------------------------------------------------- on the shelf --
 * The menu carries no quantity, so a product it returns is a product it lists.
 * But a status that is not Active, and a product still marked coming soon, are
 * not on the shelf whatever else the payload says.
 */
check('listed with no stock field is on the shelf',
  toListing({ Name: 'A', type: 'Flower', Options: ['3.5g'], Status: 'Active' }, shop, SRC, {})?.inStock, true);
check('an inactive status is not on the shelf',
  toListing({ Name: 'B', type: 'Flower', Options: ['3.5g'], Status: 'Archived' }, shop, SRC, {})?.inStock, false);
check('coming soon is not on the shelf',
  toListing({ Name: 'C', type: 'Flower', Options: ['3.5g'], comingSoon: true }, shop, SRC, {})?.inStock, false);
check('an empty status says nothing either way',
  toListing({ Name: 'D', type: 'Flower', Options: ['3.5g'], Status: '' }, shop, SRC, {})?.inStock, true);

/* ------------------------------------------------------- choosing the link --
 * From a real page: a promotional tile saying "Shop now" appears before the
 * Flower nav item, and taking the first match landed a run on an offer with
 * five products while the shop's actual flower category went unread.
 */
{
  const links = [
    { href: 'https://shop.test/stores/x/specials/offer/331687', text: 'Shop now' },
    { href: 'https://shop.test/about', text: 'About us' },
    { href: 'https://shop.test/stores/x/categories/flower', text: 'Flower' },
    { href: 'https://shop.test/stores/x/categories/edibles', text: 'Edibles' },
  ];
  check('picks the flower category over a promo', pickMenuLink(links), 'https://shop.test/stores/x/categories/flower');
  check('a specials route is never followed', rankMenuLink('https://shop.test/specials/offer/1', 'Shop now'), 0);
  /* One item's own page is not the shelf. BX Buddiez's ninety-two strains were
     replaced by the sixteen that sit on /product/nanticoke-coconut-cream-flower/,
     because the slug ends in "flower" and the pattern could not tell a segment
     that IS "flower" from one that merely ends in it. Both runs that day read
     it the same way: a wrong page is steadier than a flaky one, and steadier
     is worse. */
  check('one product\'s page is never the menu',
    rankMenuLink('https://bxbuddiez.com/product/nanticoke-coconut-cream-flower/', 'Coconut Cream'), 0);
  check('and the category still is',
    rankMenuLink('https://bxbuddiez.com/categories/flower/?sort=NAME_ASC', 'Flower'), 100);
  check('the shelf wins over the item',
    pickMenuLink([
      { href: 'https://bxbuddiez.com/product/nanticoke-coconut-cream-flower/', text: 'Coconut Cream' },
      { href: 'https://bxbuddiez.com/categories/flower/', text: 'Flower' },
    ], 'https://bxbuddiez.com', 'BX Buddiez'),
    'https://bxbuddiez.com/categories/flower/');
  /* products, plural, is a menu route on several platforms — the word boundary
     after "product" does not fall inside it. */
  check('a plural products route survives',
    rankMenuLink('https://verdicannabis.com/stores/verdi/products/flower', 'Flower'), 100);
  check('a brand page is never followed', rankMenuLink('https://shop.test/brands/dada', 'Shop Dada'), 0);

  /* A shelf that is not this state's. The Botanist is licensed in Farmingdale,
     Long Island; shopbotanist.com defaults to its Columbus, Ohio store, and
     149 Ohio products were filed under a New York licence. Cannabis cannot
     cross a state line, so a New York shelf is made of brands New York shelves
     carry — and on the first Long Island collection the three real shops
     shared 83%, 83% and 100% of their brands with what 202 New York shops
     stock, against the Ohio shelf's 12%. */
  const ny = new Set(['nanticoke', 'preferred', 'alchemypure', 'bouket', 'find', 'highfalls',
    'grassroots', 'flyweight', 'gypsy', '1937', 'zizzle', 'roemerfarms']);
  const ohio = ['buckeye', 'butterflyeffectbygrowohio', 'kingcitygardens', 'meigscounty',
    'rivieracreek', 'woodwardfinecannabis', 'certified', 'modernflower', 'seeker', 'supply',
    'rythm', 'goodgreen'];
  check('an Ohio shelf under a New York licence is refused',
    foreignShelfShare(ohio, ny) !== null, true);
  check('a New York shelf is not', foreignShelfShare([...ny], ny), null);

  /* One "www." was enough to hide a shared shelf. AMSM LLC and East Leaf
     Dispensary read the identical Cheektowaga menu — same 256 products, same
     21 strains — under two licences, and went unmarked because the two source
     addresses differed by a subdomain. */
  check('www is not a different menu',
    menuKey('https://www.eastleafdispensary.com/store#/cheektowaga/'),
    menuKey('https://eastleafdispensary.com/store#/cheektowaga/'));
  check('nor is a trailing slash',
    menuKey('https://shop.test/menu/flower/'), menuKey('https://shop.test/menu/flower'));
  /* But the fragment names the STORE on this very page, so folding it in would
     merge a chain's branches and make the opposite mistake. */
  check('a fragment that names a branch keeps them apart',
    menuKey('https://eastleafdispensary.com/store#/cheektowaga/')
      !== menuKey('https://eastleafdispensary.com/store#/buffalo/'),
    true);
  check('and so does a store id in the query',
    menuKey('https://menus.test/menu?retailer=a') !== menuKey('https://menus.test/menu?retailer=b'),
    true);
  /* Too few brands to judge. A small shop with one unusual supplier must not
     lose its shelf to arithmetic. */
  check('a shelf of three brands is not judged at all',
    foreignShelfShare(['buckeye', 'meigscounty', 'rivieracreek'], ny), null);
  /* The multi-state house brands are exactly the overlap that exists in both
     places, and three of them is not enough to vouch for twenty-two others. */
  check('house brands common to both states do not vouch for the rest',
    foreignShelfShare(ohio, new Set(['rythm', 'goodgreen', 'botanist'])) !== null, true);
  /* A category slug that merely CARRIES the word flower is not the flower
     category. Cannabis Realm of New York publishes ten items on
     /menu/categories/new-flower-drops and its whole shelf elsewhere; that slug
     scored 100, and the depth tie-break then preferred it for being deeper.
     The shop reads as a ten-strain shop, which for a large Westchester menu
     with exclusives on it is worse than reading as none. */
  check('a new-drops slice ranks below the shelf it came from',
    rankMenuLink('https://cannabisrealmny.com/rockland/menu/categories/new-flower-drops', 'New Drops')
      < rankMenuLink('https://cannabisrealmny.com/rockland/menu/categories/flower', 'Flower'),
    true);
  check('a sale slice does too, leading number and all',
    rankMenuLink('https://menus.dispenseapp.com/f1c1/menu/categories/35-flower-sale', 'Sale')
      < rankMenuLink('https://menus.dispenseapp.com/f1c1/menu/categories/flower', 'Flower'),
    true);
  check('but a slice still beats a bare menu route, being real flower',
    rankMenuLink('https://cannabisrealmny.com/rockland/menu/categories/new-flower-drops', 'New Drops')
      > rankMenuLink('https://cannabisrealmny.com/rockland/menu', 'Menu'),
    true);
  check('the whole shelf wins even when the slice sits deeper',
    pickMenuLink([
      { href: 'https://cannabisrealmny.com/rockland/menu/categories/new-flower-drops', text: 'New Drops' },
      { href: 'https://cannabisrealmny.com/menu/categories/flower', text: 'Flower' },
    ], 'https://cannabisrealmny.com', 'Cannabis Realm of New York'),
    'https://cannabisrealmny.com/menu/categories/flower');
  /* A qualifier is not a promotion. These name the whole of a flower category,
     not a slice of it, and must keep scoring as the category. */
  check('a qualified flower category is still the category',
    rankMenuLink('https://s.test/menu/categories/whole-flower', 'Whole Flower'), 100);
  check('and so is a shop that brands its own',
    rankMenuLink('https://www.thealchemy.nyc/categories/cannabis-flower-nyc', 'Flower'), 100);
  check('a flower category beats a bare menu', rankMenuLink('https://s.test/menu/flower', 'x') > rankMenuLink('https://s.test/menu', 'Menu'), true);
  check('a nav item reading Flower counts', rankMenuLink('https://s.test/c/1b9f87', 'Flower') > 0, true);
  check(
    'the menu is still followed when no category is offered',
    pickMenuLink([{ href: 'https://s.test/menu', text: 'Menu' }]),
    'https://s.test/menu',
  );
  check('nothing usable gives nothing', pickMenuLink([{ href: 'https://s.test/careers', text: 'Careers' }]), null);

  /* A shop's site linked out to the theme vendor it was built from, and the
     demo storefront there became forty-seven invented products under a
     licensed shop's name. A menu is on the shop's own estate or on the
     platform serving it — never anywhere else. */
  const site = 'https://emeralddispensary.nyc';
  check('a theme vendor is not the shop', sameEstate('https://codegearthemes.com/products/acoustics', site), false);
  check('the shop itself is', sameEstate('https://emeralddispensary.nyc/menu/flower', site), true);
  check('and its subdomain', sameEstate('https://menu.emeralddispensary.nyc/flower', site), true);
  check('and the platform serving it', sameEstate('https://dutchie.com/embedded-menu/x/flower', site), true);
  /* The register holds one address per shop, and shops move: Take N Toke is
     filed under a Vercel preview and keeps its menu on its own name. Its name
     is what says it is still the shop. */
  check('a shop under another of its own domains',
    sameEstate('https://takentoke.com/menu/', 'https://take-n-toke-livid.vercel.app/',
               'Take N Toke Herbal Healing Solutions Inc'), true);
  check('and the theme vendor still is not, name or no name',
    sameEstate('https://codegearthemes.com/products/acoustics', site, 'Emerald Dispensary'), false);
  check('a menu off the estate is never followed',
    pickMenuLink([{ href: 'https://codegearthemes.com/products/acoustics', text: 'Flower' }], site), null);

  /* A chain page and a shop page score the same; the one that names a shop is
     deeper, and three licences got the chain's eight placeholders because the
     tie went to whichever came first in the markup. */
  check('a shop\'s own menu beats the chain\'s', pickMenuLink([
    { href: 'https://greenflowerwellness.com/stores/products/flower', text: 'Flower' },
    { href: 'https://greenflowerwellness.com/stores/oakland-gardens/products/flower', text: 'Flower' },
  ], 'https://greenflowerwellness.com'), 'https://greenflowerwellness.com/stores/oakland-gardens/products/flower');
}

/* ---------------------------------------------------------- name cleaning */
check('strip sku and marker', cleanStrainName('ILLUMINATI (H) 3.5g - F42', null), 'ILLUMINATI');
check('strip brand', cleanStrainName('LEAL - Grape Cake - Flower - 28 Grams', 'Leal'), 'Grape Cake');
check('strip grade word', cleanStrainName('Flower - Whole - Bubblegum Gushers', null), 'Bubblegum Gushers');
check('keep strain that starts with a grade word', cleanStrainName('Whole Lotta Love', null), 'Whole Lotta Love');
/* A bracketed weight leaves brackets behind, and the cleanup used to run
   before the weight was removed — so 136 shelf names read "Afghani - ( )".
   Tidying now runs after the stripping, and repeats until the name settles. */
check('bracketed weight leaves nothing behind', cleanStrainName('Afghani - (3.5g)', 'Dank'), 'Afghani');
check('and the ounce likewise', cleanStrainName('Gumbo - (28g)', 'Puff'), 'Gumbo');
check('a number the weight left behind goes too',
  cleanStrainName('3 Point Cherry Bomb Flower - 1 (3.5g)', 'Grocery'), '3 Point Cherry Bomb Flower');

/* --------------------------------------------- flower vs not, by the title */
/* A word inside another word is not that word. The stem "cart" was rejecting
   Cartel OG, and "diamond" was rejecting Black Diamond — real strains, sold
   as flower by the eighth, silently absent from every shelf that carried
   them. These are the names that must survive the filter, and the product
   forms that must not. */
{
  const flower = (name) => ({ name, category: 'Flower' });
  const keeps = [
    'Black Diamond', 'Diamond OG', 'Cartel OG', 'Cartier', 'Carter Kush',
    'Gumbo', 'Shakedown', 'Jointer Kush', 'Vaporub OG', 'Trimble Haze',
  ];
  for (const name of keeps) {
    check(`kept as flower: ${name}`, classify(flower(name)), 'flower');
  }
  const drops = [
    'Blue Dream Diamonds', 'Diamond Sauce', 'Infused Pre-Roll', 'Gelato Pre Roll',
    'Runtz Blunt', 'Sour Joint', 'Wedding Cake Cart', 'GMO Cartridge',
    'Peach Gummies', 'Assorted Edibles', 'Sour Diesel Shake', 'House Trim',
    'Moon Rocks', 'Pre-Ground Flower', 'Ready to Roll', 'Flower Flight',
  ];
  for (const name of drops) {
    check(`dropped, not flower: ${name}`, classify(flower(name)), 'title-not-flower');
  }
}

/* --------------------------------------------------- the strain behind the name */
/* A menu writes the grower, the packaging, its own stock number and a lab
   figure around the cultivar. Counted raw, New York's shelves held 5771
   "strains"; read this way, 3065. The guards matter as much as the stripping:
   Flower Power and Whole Lotta Love open with packaging words and are still
   cultivars, Runtz is a brand AND a cultivar, and Gelato 41 is not Gelato. */
{
  const brands = new Set([
    'Dank', 'GRASSROOTS', "Papa's Herb", 'Runtz', 'TTM', 'Bouket', 'Matter',
    // Growers whose names sit in the shelf-label cases below.
    '5 Boro', 'Leal', 'Honest PharmCo', 'Grassroots',
  ]);
  const c = (raw, brand = null) => canonicalStrain(raw, brand, brands);

  check('packaging around the name', c('Premium Cannabis Flower Jar Sour Diesel'), 'Sour Diesel');
  check('the shop\'s own stock number', c('#337 - Black Maple Flower'), 'Black Maple');
  check('a lab figure is not a name', c('BANANA KUSH - THC 28.8%'), 'BANANA KUSH');
  check('grade words at both ends', c('Banana Kush - Indoor Large Bud Flower'), 'Banana Kush');
  check('a grower fenced by a dash', c('Matter - Grape Gas', 'Matter'), 'Grape Gas');
  check('a grower with no fence at all', c('Dank Agent Orange Flower'), 'Agent Orange');
  check('an item code left at the end', c("Papa's Herb - OG Kush - ITEM #513KH"), 'OG Kush');
  check('emptied brackets', c('ICE CREAM CAKE ( BAG)'), 'ICE CREAM CAKE');

  /* What must survive. Each of these was broken by an earlier draft. */
  check('a cultivar that opens with a packaging word', c('Flower Power'), 'Flower Power');
  check('and another', c('Whole Lotta Love'), 'Whole Lotta Love');
  check('a brand that is also a cultivar, alone', c('Runtz', 'Runtz'), 'Runtz');
  check('a brand that is also the head of a cultivar', c('Runtz Cake'), 'Runtz Cake');
  check('a numbered cut is not its parent', c('Gelato 41'), 'Gelato 41');
  check('Gelato 41 and Gelato stay apart', strainKey(c('Gelato 41')) === strainKey(c('Gelato')), false);

  /* What a shop writes around the cultivar. Each line below is a real menu
     entry that the register counted as a strain of its own. */
  check('a shelf label is not a strain',
    c('Amnesia Haze -Sativa- 21.04% THC - Dime Bag . Flower - 5 Boro -gg11 FRONT'), 'Amnesia Haze');
  check('nor the aisle it sits in', c('Trump Runtz -Hybrid - (Flower) - Y1'), 'Trump Runtz');
  check('a shop code glued to a grade word', c('R14-Flower -Black Magic'), 'Black Magic');
  check('a grower carrying packaging', c('Leal Flower- Lemon Venom'), 'Lemon Venom');
  check('a grade word behind a hyphen', c('Sherb - Micro Grown'), 'Sherb');
  check('a grower ahead of a grade word',
    c('Runtz Premium Flower', 'Honest PharmCo'), 'Runtz');

  /* And what must survive all of that. A cultivar whose name is a letter and
     a number reads as noise twice over — "g" is a unit, "13" is a number —
     and an earlier draft of the shelf-label rule deleted it outright. */
  check('a cultivar that is a letter and a number', c('G-13'), 'G-13');
  check('and another', c('AK-47'), 'AK-47');
  check('a bare code that is a cultivar', c('GG4'), 'GG4');
  check('a code the shop did name a strain', c('RS11 Premium Cannabis Flower'), 'RS11');
  check('a numbered cut with no grade word', c('Z1 #4'), 'Z1 #4');

  /* How a jar was filled, which Find's shelves print in five ways. On the
     brand's own page each was a strain of its own. */
  check('prepack with a lineage between colons', c('Prepack Whole Flower :Indica:Tri Berry'), 'Tri Berry');
  check('and a grower ahead of it', c('Grassroots Prepack Whole Flower :Sativa:Orange Z', 'Grassroots'), 'Orange Z');
  check('bagged', c('Bagged Flower - Agent Z'), 'Agent Z');
  check('a lineage abbreviation after the grade', c('Silver Dollar Flower - IND'), 'Silver Dollar');
  check('preground', c('Pomme Jelly - Preground'), 'Pomme Jelly');
  check('a bracketed lineage mark', c('Tri Berry (IN)'), 'Tri Berry');
  /* The colon rule must not split a name made of a time. */
  check('a cultivar with a colon in it', c('11:11 (Indoor)'), '11:11');

  /* Spelling and punctuation fold away; the strain does not. */
  check('spacing and case fold', strainKey('Sunset  SHERBERT') === strainKey('sunset-sherbert'), true);
  check('Superboof meets Super Boof', strainKey(c('Superboof')) === strainKey(c('Super Boof')), true);
}

/* ---------------------------------------------------------------- Routing --
 * Which address is the shelf. Every URL below was read off a real run's log,
 * including the two that cost us a shelf each.
 */
{
  const page = (url) => isProductPage(url);
  // NY Flos: 107 products declared, none read — we were standing on one packet
  // of gummies, which won the tie-break for being the deepest link on the page.
  check('a product under its brand and category',
    page('https://getflos.com/menu/products/ayrloom-766427/edibles/ayrloom-island-time-100mg-8453750/'), true);
  // BX Buddiez: sixteen items where the shop has ninety-two.
  check('a product under /product/', page('https://bxbuddiez.com/product/nanticoke-coconut-cream-flower/'), true);
  check('a slug on its own is still a product', page('https://example.test/products/blue-dream-3-5g-8453750'), true);

  /* And what must not be mistaken for one. */
  check('a category listing', page('https://qualityhigh.com/store/categories/flower/'), false);
  check('a branch category listing', page('https://www.nycbud.com/shop/queens/categories/flower/?order=-x'), false);
  check('products/flower is a listing', page('https://example.test/products/flower'), false);
  check('a bare products route', page('https://example.test/shop/products/'), false);
  check('a one-word category', page('https://example.test/products/edibles'), false);

  /* Link sets copied from a run's own log, in the order the page gave them. */
  const flos = [
    { href: 'https://getflos.com/menu/?search_active=true', text: '' },
    { href: 'https://getflos.com/menu/?open_cart=true', text: '' },
    { href: 'https://getflos.com/locations/menu', text: 'NY FLOS LLC' },
    { href: 'https://getflos.com/menu/signup/', text: 'Sign Up' },
    { href: 'https://getflos.com/menu/', text: 'SHOP NOW' },
    { href: 'https://getflos.com/menu/categories/accessories/', text: 'Accessories' },
    { href: 'https://getflos.com/menu/categories/beverages/', text: 'Beverages' },
    { href: 'https://getflos.com/menu/categories/cbd/', text: 'CBD' },
  ];
  // NY Flos publishes no flower link at all. The whole menu is the answer;
  // sixteen grinders was the old one.
  check('no flower link means the whole menu',
    pickMenuLink(flos, 'https://www.getflos.com/', 'NY Flos LLC'), 'https://getflos.com/menu/');
  check('a category we do not collect is not a menu',
    rankMenuLink('https://getflos.com/menu/categories/accessories/', 'Accessories'), 0);
  check('nor is the signup page', rankMenuLink('https://getflos.com/menu/signup/', 'Sign Up'), 0);

  const caldwell = [
    { href: 'https://caldwellsny.com/menu/', text: 'SHOP NOW' },
    { href: 'https://caldwellsny.com/menu/categories/flower/', text: '' },
    { href: 'https://caldwellsny.com/menu/categories/vape/', text: '' },
    { href: 'https://caldwellsny.com/menu/categories/edibles/', text: '' },
  ];
  check('the flower category still beats the menu root',
    pickMenuLink(caldwell, 'https://caldwellsny.com', 'CALDWELL CANNABIS CO'),
    'https://caldwellsny.com/menu/categories/flower/');

  /* The rule the depth tie-break was written for, which must survive its
     reversal: three licences all took the chain page and its eight
     placeholder items. */
  const chain = [
    { href: 'https://gfw.test/stores/products/flower', text: 'Flower' },
    { href: 'https://gfw.test/stores/harlem/products/flower', text: 'Flower' },
  ];
  check('a branch page still beats its chain',
    pickMenuLink(chain, 'https://gfw.test', 'Green Flower Wellness'),
    'https://gfw.test/stores/harlem/products/flower');

  check('a product page cannot be the menu',
    rankMenuLink('https://getflos.com/menu/products/ayrloom-766427/edibles/ayrloom-island-100mg-8453750/', 'Shop'), 0);
  check('the flower category still wins',
    rankMenuLink('https://qualityhigh.com/store/categories/flower/', 'Flower'), 100);
}

/* --------------------------------------------------------------- JSON:API --
 * Tymber/Blaze. Nineteen shops declared a hundred products apiece and handed
 * us none of them, because a product here is a resource — its own keys are
 * id, type, attributes, relationships — and the shelf fields are one floor
 * down, with the category and the brand held as ids into `included`.
 *
 * The two products below are copied from a resource a diagnostic run printed
 * in full, so what is tested is the payload the shop really sends: an edible
 * that must be rejected, and the same shape carrying flower.
 */
{
  const edible = {
    id: 3976845,
    type: 'products',
    attributes: {
      id: 3976845,
      name: 'Level | Edible | Hybrid Protab | 5ct/100MG',
      size: { amount: 1, display_text: null, type: 'EACH', units: 'each' },
      weight_prices: null,
      unit_prices: [{ display_name: '1 each', quantity: 1, price: { amount: 2400, currency: 'usd' } }],
      potency: { thc: 25, units: 'mg' },
      terpenoids: null,
      strain: null,
      flower_type: 'Hybrid',
      in_stock: true,
      store_url: 'https://urbanweedsny.com/menu/products/level-384256/edibles/level-edible-hybrid-protab-5ct100mg-3976845',
    },
    relationships: {
      category: { data: { id: 14966, type: 'product_categories' } },
      brand: { data: { id: 384256, type: 'product_brands' } },
    },
  };

  /* The same product arriving a second time with fewer fields — the response
     that broke the first reading of this menu, because on its own it has no
     title at all. */
  const sparse = {
    id: 7781002,
    type: 'products',
    attributes: {
      id: 7781002,
      potency: { thc: 27.4, units: '%' },
      terpenoids: [{ name: 'β-Caryophyllene', value: 0.61 }, { name: 'Limonene', value: 0.44 }],
      in_stock: true,
      store_url: 'https://urbanweedsny.com/menu/products/hepworth-2211/flower/hepworth-blue-dream-3-5g-7781002',
    },
  };
  const full = {
    id: 7781002,
    type: 'products',
    attributes: {
      id: 7781002,
      name: 'Hepworth | Blue Dream | 3.5g',
      flower_type: 'Sativa',
      size: { amount: 3.5, display_text: '3.5g', type: 'WEIGHT', units: 'g' },
      weight_prices: [{ display_name: '3.5g', price: { amount: 4000, currency: 'usd' } }],
    },
    relationships: {
      category: { data: { id: 14970, type: 'product_categories' } },
      brand: { data: { id: 2211, type: 'product_brands' } },
    },
  };

  const payloads = [
    { data: [sparse], included: [] },
    {
      data: [edible, full],
      included: [
        { id: 14966, type: 'product_categories', attributes: { name: 'Edibles' } },
        { id: 14970, type: 'product_categories', attributes: { name: 'Flower' } },
        { id: 384256, type: 'product_brands', attributes: { name: 'Level' } },
        { id: 2211, type: 'product_brands', attributes: { name: 'Hepworth' } },
      ],
    },
  ];

  const rows = flattenJsonApiProducts(payloads);
  check('two products, not four', rows.length, 2);

  const byId = new Map(rows.map((r) => [r.id, r]));
  const e = byId.get(3976845);
  check('attributes are lifted', e?.name, 'Level | Edible | Hybrid Protab | 5ct/100MG');
  check('category is resolved to a word', e?.category, 'Edibles');
  check('brand is resolved to a word', e?.brand, 'Level');
  // Caught by the title before the category is even read; both would do.
  check('an edible is not flower', classify(e), 'title-not-flower');

  const f = byId.get(7781002);
  check('a product split across payloads keeps its title', f?.name, 'Hepworth | Blue Dream | 3.5g');
  check('and its terpenes', f?.terpenoids?.length, 2);
  check('flower is flower', classify(f), 'flower');

  const listing = toListing(f, shop, SRC, {});
  check('jsonapi strain', listing?.strainNameRaw, 'Blue Dream');
  check('jsonapi brand', listing?.brand, 'Hepworth');
  check('jsonapi size', listing?.availableSizesGrams, [3.5]);
  check('jsonapi lineage', listing?.lineage, 'SATIVA');
  check('jsonapi terpenes', listing?.terpenes?.profile?.map((t) => t.name), ['CARYOPHYLLENE', 'LIMONENE']);
  check('jsonapi terpene source', listing?.terpenes?.source, 'MENU_LISTING');

  /* "each" is a count, not a weight. Reading it as one put single gummies on
     the shelf as one-gram flower in an earlier draft of the size reader. */
  check('an each is not a gram', toListing(edible, shop, SRC, {}), null);

  check('category off the product address', categoryFromProductUrl(
    'https://urbanweedsny.com/menu/products/hepworth-2211/flower/hepworth-blue-dream-3-5g'), 'flower');
}

/* ------------------------------------------------------------------ paging --
 * Asking a menu for its second page. Every shape below was taken off a real
 * request: Dutchie keeps the page inside a query parameter that is itself JSON,
 * others put it in the address, and a GraphQL POST keeps it in the body.
 *
 * These matter more than they look. A wrong guess here does not fail loudly —
 * it re-fetches page one over and over, and the shelf comes out the same size
 * it was before, with the shop asked ten times for it.
 */
{
  const dutchie = {
    method: 'GET',
    url: 'https://dutchie.com/api-3/graphql?operationName=FilteredProducts&variables='
      + encodeURIComponent(JSON.stringify({
        productsFilter: { dispensaryId: '64a2', pricingType: 'rec', Status: 'Active' },
        page: 0,
        perPage: 25,
      })),
    body: null,
  };
  const variablesOf = (url) => JSON.parse(new URL(url).searchParams.get('variables'));

  check('dutchie page 1', variablesOf(pagedRequest(dutchie, 1).url).page, 1);
  check('dutchie page 3 is not three page-ones', variablesOf(pagedRequest(dutchie, 3).url).page, 3);
  check('dutchie filter survives', variablesOf(pagedRequest(dutchie, 1).url).productsFilter.dispensaryId, '64a2');
  check('dutchie page size untouched', variablesOf(pagedRequest(dutchie, 1).url).perPage, 25);

  // A plain address, one-based, as several storefronts write it.
  const plain = { method: 'GET', url: 'https://shop.test/api/products?category=flower&page=1', body: null };
  check('plain page', new URL(pagedRequest(plain, 1).url).searchParams.get('page'), '2');
  check('plain filter survives', new URL(pagedRequest(plain, 1).url).searchParams.get('category'), 'flower');

  /* An offset advances by the page size, not by one. Reading it as a page
     number would ask for item 1, then item 2 — and re-read the whole shelf
     minus its first product, twenty times over. */
  const offset = { method: 'GET', url: 'https://shop.test/products?offset=0&limit=24', body: null };
  check('offset steps by the size', new URL(pagedRequest(offset, 1).url).searchParams.get('offset'), '24');
  check('offset page 2', new URL(pagedRequest(offset, 2).url).searchParams.get('offset'), '48');
  check('limit untouched', new URL(pagedRequest(offset, 1).url).searchParams.get('limit'), '24');

  /* Algolia keeps the whole query inside an array — {"requests":[{…}]} — and
     the search for a page knob used to refuse arrays outright and report that
     this menu could not be paged at all. The Flowery's shelf backs six
     licences and had never been read past its first fifty products. */
  const algolia = {
    method: 'POST',
    url: 'https://r72-dsn.algolia.net/1/indexes/*/queries',
    body: JSON.stringify({
      requests: [
        { indexName: 'staging_thefloweryny', hitsPerPage: 50, page: 0, query: '' },
        { indexName: 'staging_thefloweryny', hitsPerPage: 0, page: 0 },
      ],
    }),
  };
  check('a query inside an array is still pageable', JSON.parse(pagedRequest(algolia, 1).body).requests[0].page, 1);
  check('its page size is left alone', JSON.parse(pagedRequest(algolia, 1).body).requests[0].hitsPerPage, 50);
  check('and the index it asks is unchanged', JSON.parse(pagedRequest(algolia, 2).body).requests[0].indexName, 'staging_thefloweryny');
  check('page three is three, not one thrice', JSON.parse(pagedRequest(algolia, 3).body).requests[0].page, 3);
  check('the second query of the batch turns with the first', JSON.parse(pagedRequest(algolia, 2).body).requests[1].page, 2);

  /* Typesense's multi-search, as Piffords' Carrot store sends it on its flower
     page: the whole store first, for facet counts, then the flower query. The
     first page knob found is the store's; turning only that one asked page two
     of the store and page one of the flower, again and again. Each query turns
     from its own number. */
  const typesense = {
    method: 'POST',
    url: 'https://api.nevada.getcarrot.io/api/v1/store/search-products?locId=1',
    body: JSON.stringify({
      searches: [
        { q: '*', facet_by: 'masterCategoryName', page: 1 },
        { q: '*', filter_by: 'masterCategoryName:=[`Flower`]', per_page: 10, page: 1 },
      ],
    }),
  };
  const turned = JSON.parse(pagedRequest(typesense, 1).body).searches;
  check('a multi-search turns every query — the store', turned[0].page, 2);
  check('and the flower query beside it', turned[1].page, 2);
  check('its filter is left alone', turned[1].filter_by, 'masterCategoryName:=[`Flower`]');
  const staggered = {
    ...typesense,
    body: JSON.stringify({ searches: [{ q: '*', page: 1 }, { q: 'x' }, { q: '*', page: 4 }] }),
  };
  const s3 = JSON.parse(pagedRequest(staggered, 1).body).searches;
  check('each from its own number', [s3[0].page, s3[1].page, s3[2].page], [2, undefined, 5]);

  /* Elasticsearch, which the joint-ecommerce menus run on. The offset sits at
     the top of the query; a facet several levels down inside aggs keeps its
     own `size`, and that number is not the page size. Shallowest wins. */
  const elastic = {
    method: 'POST',
    url: 'https://shop.test/wp-json/joint-ecommerce/v1/products/ecommerce-production/_search',
    body: JSON.stringify({ from: 0, size: 20, aggs: { facet_bucket_category: { terms: { field: 'category', size: 100 } } } }),
  };
  check('the query offset advances', JSON.parse(pagedRequest(elastic, 1, 20).body).from, 20);
  check("a facet's own size is not the page size", JSON.parse(pagedRequest(elastic, 1, 20).body).aggs.facet_bucket_category.terms.size, 100);

  /* And the refusal that matters most. `from` is an offset at the top of a
     query and the low end of a range filter inside one. Turning the filter's
     does not ask for the next page — it asks a different question, and the
     menu answers with nothing, which is exactly what fourteen shelves
     reported. */
  const ranged = {
    method: 'POST',
    url: 'https://shop.test/_search',
    body: JSON.stringify({ query: { range: { price: { from: 0, to: 99 } } } }),
  };
  check('a range filter is not a page knob', pagedRequest(ranged, 1, 20), null);
  const bothOf = {
    method: 'POST',
    url: 'https://shop.test/_search',
    body: JSON.stringify({ from: 0, query: { range: { price: { from: 5, to: 99 } } } }),
  };
  check('the query offset is taken, not the filter', JSON.parse(pagedRequest(bothOf, 1, 20).body).from, 20);
  check('and the filter is left exactly as it was', JSON.parse(pagedRequest(bothOf, 1, 20).body).query.range.price.from, 5);

  /* No size stated: the step is what the first answer carried, which is what
     the menu itself used. */
  const bare = { method: 'GET', url: 'https://shop.test/products?skip=0', body: null };
  check('offset falls back to what arrived', new URL(pagedRequest(bare, 1, 20).url).searchParams.get('skip'), '20');
  check('offset with no step at all is refused', pagedRequest(bare, 1), null);

  // GraphQL over POST keeps everything in the body.
  const post = {
    method: 'POST',
    url: 'https://shop.test/graphql',
    body: JSON.stringify({ operationName: 'Products', variables: { menuId: 'x', page: 2, perPage: 50 } }),
  };
  check('post body page', JSON.parse(pagedRequest(post, 1).body).variables.page, 3);
  check('post body address untouched', pagedRequest(post, 1).url, 'https://shop.test/graphql');
  check('post body keeps its menu', JSON.parse(pagedRequest(post, 1).body).variables.menuId, 'x');

  /* A request with no page in it at all. Returning something here would send
     the collector round a loop against a menu that answers the same thing
     every time. */
  check('no page, no request', pagedRequest({ method: 'GET', url: 'https://shop.test/menu.json', body: null }, 1), null);
  check('nothing to advance to', pagedRequest(dutchie, 0), null);
}

/* Where a page that is not the menu says the menu was. Built from the twenty-two
   shops that end their visit parked on one, and from the three that park on a
   captcha, which is never followed. */
{
  const at = (u) => destinationOf(u);
  check(
    'an age wall names where we were going',
    at('https://shop.test/age-gate?returnUrl=%2Fmenu%2Fflower'),
    'https://shop.test/menu/flower',
  );
  check(
    'a splash screen does too',
    at('https://shop.test/welcome?r=%2Fshop%2Fcategory%2Fflower'),
    'https://shop.test/shop/category/flower',
  );
  check('and the parameter may be spelled otherwise', at('https://shop.test/gate?next=%2Fmenu'), 'https://shop.test/menu');

  /* A captcha is a control the shop put there deliberately. Going near one is
     not something this collector does, whatever the address says. */
  check('a captcha is never followed', at('https://shop.test/.well-known/sgcaptcha/?r=%2Fmenu%2Fflower'), null);
  check('nor a challenge page', at('https://shop.test/cdn-cgi/challenge?next=%2Fmenu'), null);

  // Same site only: a leading slash is not a promise about the host.
  check('no protocol-relative hop', at('https://shop.test/age-gate?returnUrl=%2F%2Felsewhere.test%2Fmenu'), null);
  check('no absolute hop', at('https://shop.test/age-gate?returnUrl=https%3A%2F%2Felsewhere.test%2Fmenu'), null);

  // Nothing new named, nothing to follow.
  check('the door we came in by names nothing', at('https://shop.test/age-gate?returnUrl=%2F'), null);
  check('nor does a parameter pointing at itself', at('https://shop.test/age-gate?r=%2Fage-gate'), null);
  check('a page with no destination at all', at('https://shop.test/menu/flower'), null);
  check('and rubbish is refused, not thrown', at('not a url'), null);
}

/* Both shapes below were read off live shops by a probe, key for key.
   4081 Companies (transcendwps.com) sends items of
     { price, location_id, stock, product }
   and Hush (hushny.com) sends data of
     { _id, productDetails, inventoryId, hubQuantity, productPrice, variants, category }
   Between them: a hundred payloads, and not one product recognised, because
   from outside neither record has a name. */
{
  const fourOhEightOne = {
    items: [
      {
        price: 45,
        location_id: 26,
        stock: 7,
        product: {
          name: 'Kilimanjaro Mixed Bud',
          category: 'Flower',
          brand: '1937',
          weight: '3.5g',
          strain: { moods: [{ id: 1, mood: 'calm' }] },
        },
      },
      {
        price: 70,
        location_id: 26,
        stock: 3,
        product: { name: 'Lemon Sherbert', category: 'Flower', brand: 'JULIA', weight: '7g' },
      },
    ],
  };
  const lifted = flattenStockRecords([fourOhEightOne]);
  check('the product inside a stock record is found', lifted.length, 2);
  check('and it is named by the thing inside', lifted[0].name, 'Kilimanjaro Mixed Bud');
  /* The price lives on the record, not on the product. Dropping the record
     would lose it, and with it the size reader's best evidence. */
  check('the price the record around it knew survives', lifted[0].price, 45);
  check('so does the stock', lifted[1].stock, 3);

  const hush = {
    meta: {},
    data: [
      {
        _id: 'a1',
        inventoryId: 'i1',
        hubQuantity: 4,
        totalQuantity: 4,
        productPrice: 50,
        variants: [{ weight: '3.5', price: 50 }],
        category: [{ _id: 'c1', categoryId: 9, categoryName: 'Flower', slug: 'flower' }],
        productDetails: { productName: 'Blue Dream', productCategory: 'Flower', brandName: 'Somebody' },
      },
      {
        _id: 'a2',
        inventoryId: 'i2',
        hubQuantity: 1,
        totalQuantity: 1,
        productPrice: 90,
        variants: [{ weight: '7', price: 90 }],
        category: [{ _id: 'c1', categoryId: 9, categoryName: 'Flower', slug: 'flower' }],
        productDetails: { productName: 'Gelato 41', productCategory: 'Flower', brandName: 'Somebody' },
      },
    ],
  };
  const fromHush = flattenStockRecords([hush]);
  check('a productDetails record opens the same way', fromHush.length, 2);
  check('with the name from inside', fromHush[0].productName, 'Blue Dream');
  check('and the pack sizes from outside', fromHush[1].variants[0].weight, '7');
}

/* What must NOT be opened. Each of these would turn something that is not a
   product into one, which is the mistake this register refuses to make. */
{
  // A product in its own right. Opening it would throw away its own name.
  const plain = {
    rows: [
      { name: 'Wedding Cake', category: 'Flower', price: 40, product: { id: 1, sku: 'x', note: 'ref' } },
      { name: 'Gelato', category: 'Flower', price: 40, product: { id: 2, sku: 'y', note: 'ref' } },
    ],
  };
  const kept = flattenStockRecords([plain]);
  check('a record that already has a name is left alone', kept.length, 0);

  // A reference, not a thing: an id and a slug is not a product.
  const stubs = {
    rows: [
      { price: 10, product: { id: 1, slug: 'a' } },
      { price: 20, product: { id: 2, slug: 'b' } },
    ],
  };
  check('a stub of two fields is not opened', flattenStockRecords([stubs]).length, 0);

  // Brands and categories are objects too, and they are not products.
  const brands = {
    rows: [
      { count: 12, brand: { id: 1, name: 'Bouket', logo: 'x.png', slug: 'bouket' } },
      { count: 9, brand: { id: 2, name: '1937', logo: 'y.png', slug: '1937' } },
    ],
  };
  check('a brand beside a count is not a shelf', flattenStockRecords([brands]).length, 0);

  // One record is not an array worth lifting.
  const single = {
    items: [{ price: 45, product: { name: 'Solo', category: 'Flower', brand: 'X', weight: '3.5g' } }],
  };
  check('one record alone is not lifted', flattenStockRecords([single]).length, 0);
}

/* The fork where a chain asks which of its shops you are standing in. Both
   wordings below were read off live pages by a probe. */
{
  const at = (city, zip, extra) => placeNamesOf({ address: { city, zip, ...extra } });

  check('the register is read most telling first',
    at('Brooklyn', '11215', { borough: 'BROOKLYN' }), ['11215', 'Brooklyn']);
  check('a neighbourhood counts, and outranks the city',
    at('New York', '10032', { neighborhood: 'Washington Heights', borough: 'MANHATTAN' }),
    ['10032', 'Washington Heights', 'New York', 'MANHATTAN']);

  const brooklyn = at('Brooklyn', '11215', { borough: 'BROOKLYN' });

  // DISPO/BK. Three of its four shops are in Minnesota.
  check('the Brooklyn licence takes the Brooklyn shop',
    pickStore(['Brooklyn', 'Minneapolis', 'St Paul', 'Rochester'], brooklyn).index, 0);

  // Beleaf, where every option carries the chain's name as well as the town.
  check('the town is found inside the shop name',
    pickStore(['Beleaf Brooklyn', 'Beleaf Calverton', 'Beleaf Medford'], brooklyn).index, 0);

  /* Canna Buddha is licensed in Bayside, Queens, and the address it lands on
     is /store/thief-river/ — Minnesota. Nothing here is ours, and the right
     answer is to press nothing. */
  const bayside = at('Bayside', '11361', { borough: 'QUEENS' });
  const nothingOurs = pickStore(['Thief River Falls', 'Bemidji', 'Brainerd'], bayside);
  check('a fork with none of our shops in it is not answered', nothingOurs.index, -1);
  check('and the run says so', nothingOurs.why, 'no-match');

  // Two branches in the same town cannot be told apart by the town.
  const twoBrooklyns = pickStore(['Brooklyn - Atlantic Ave', 'Brooklyn - 4th Ave'], brooklyn);
  check('two shops in our town is not a choice we may make', twoBrooklyns.index, -1);
  check('and it is recorded as the ambiguity it is', twoBrooklyns.why, 'ambiguous');

  // Unless the postcode is on them, which is why it is tried first.
  check('a postcode settles what the town cannot',
    pickStore(['Brooklyn 11238', 'Brooklyn 11215'], brooklyn).index, 1);

  /* Rochester is a city in New York and a city in Minnesota, and the name
     alone cannot tell them apart. */
  const rochester = at('Rochester', '14604', { borough: null });
  check('the one that says which state it is in wins',
    pickStore(['Rochester, MN', 'Rochester, NY'], rochester).index, 1);
  check('and if the only Rochester is the other one, we take nothing',
    pickStore(['Rochester, MN', 'Minneapolis, MN'], rochester).index, -1);

  /* Washington Heights is a neighbourhood of Manhattan, not the state of
     Washington, which is why a state is only read where an address writes
     one — after a comma, or at the end. */
  const heights = at('New York', '10032', { neighborhood: 'Washington Heights' });
  check('a neighbourhood is not mistaken for a state',
    pickStore(['Washington Heights', 'Harlem'], heights).index, 0);

  // Whole words only: Brooklynville is not Brooklyn.
  check('the town is matched whole',
    pickStore(['Brooklynville', 'Brooklyn'], brooklyn).index, 1);

  // One option is not a fork, and nothing about it needs answering.
  check('a single option is not a fork', pickStore(['Brooklyn'], brooklyn).why, 'not-a-fork');

  // A licence the register knows no place for may not answer a fork at all.
  check('no place, no choice', pickStore(['Brooklyn', 'Queens'], []).index, -1);

  /* Hibernica has two licences and its chain offers two branches. The Bronx
     one is settled by the city. The other is licensed at 111 Central Park
     North, in a city the register calls New York and a borough it calls
     MANHATTAN — so none of its words for the place is in either option, while
     the words "Central Park" sit in its own street address. Read the other way
     round, the option is inside what the register wrote down. */
  const park = {
    address: { city: 'New York', zip: '10026', borough: 'MANHATTAN',
               line1: '111 Central Park North', line2: 'Store FRNT B' },
    dbaName: 'Hibernica Central Park',
  };
  const bronx = {
    address: { city: 'Bronx', zip: '10461', borough: 'BRONX', line1: '3220 Westchester Ave' },
    dbaName: 'Hibernica',
  };
  const branches = ['Central Park', 'Bronx'];
  check('the street address names the branch',
    pickStore(branches, placeNamesOf(park), registerTextOf(park)).index, 0);
  check('and the other licence still goes by its city',
    pickStore(branches, placeNamesOf(bronx), registerTextOf(bronx)).index, 1);

  /* The place is the better evidence and is tried first. A chain whose branch
     names carry the chain's own name must not be settled by that. */
  const beleaf = { address: { city: 'Brooklyn', zip: '11238' }, dbaName: 'Beleaf Brooklyn' };
  check('the chain name in every option settles nothing',
    pickStore(['Beleaf Calverton', 'Beleaf Medford'], [], registerTextOf(beleaf)).why, 'no-match');

  /* Read out of the daily run of 23 September. ZenZest's New Hyde Park licence
     trades as "ZenZest Cannabis Dispensary", and its chain's fork offered the
     chain's own name as one of the options. Matched against the trade name,
     that option is always inside it — so it was pressed, and the run landed on
     the chain's Queens store. The address is 272-06 Union Turnpike and says
     nothing of the kind. A trade name names the company, not the branch. */
  const zenzest = {
    address: { line1: '272-06 UNION TURNPIKE', city: 'New Hyde Park', zip: '11040' },
    dbaName: 'ZenZest Cannabis Dispensary',
    legalName: 'HerbHub LLC',
  };
  check('the chain\'s own name is not a branch',
    pickStore(['ZenZest CANNABIS', 'Staten Island'], placeNamesOf(zenzest), registerTextOf(zenzest)).index, -1);
  check('because the trade name is not what the branch is read against',
    registerTextOf(zenzest), '272-06 UNION TURNPIKE');

  // Short enough to be a coincidence: "Shop" and "Menu" are in half the names.
  check('a four-letter option proves nothing',
    pickStore(['Shop', 'Menu'], [], 'Shop Hibernica Menu').index, -1);

  // And the state guard holds on this path too.
  check('nor may the register vouch for another state',
    pickStore(['Brooklyn Park, MN', 'Bronx'], [], 'Hibernica Brooklyn Park, MN').index, -1);

  /* Read out of a real run. FlynnStoned is licensed at 388 West St, New York,
     NY 10014. Its chain's fork offered Bright Elephant's address — a different
     company — the city matched, and the run filed another shop's shelf under
     FlynnStoned's licence. A postcode settles it: an option that states one,
     and states a different one, is not ours whatever else it shares. */
  const flynn = {
    address: { line1: '388 West St', city: 'New York', zip: '10014', borough: 'MANHATTAN' },
    dbaName: 'FLYNNSTONED CANNABIS COMPANY',
  };
  const bright = {
    address: { line1: '206 8th Ave', city: 'New York', zip: '10011', borough: 'MANHATTAN' },
    dbaName: 'Bright Elephant, LLC',
  };
  const addresses = ['206 8th Ave, New York, NY 10011', '820 2nd Ave, New York, NY 10017'];
  check('another branch in our own city is not ours',
    pickStore(addresses, placeNamesOf(flynn), registerTextOf(flynn)).why, 'no-match');
  check('and the licence whose postcode it is takes it',
    pickStore(addresses, placeNamesOf(bright), registerTextOf(bright)).index, 0);

  /* A house number of five digits is not a postcode. Liberty Buds is at 24502
     Horace Harding Expy, Little Neck, NY 11362, and reading 24502 as a
     postcode would refuse the shop its own address. */
  const littleNeck = {
    address: { line1: '24502 Horace Harding Expy', city: 'Little Neck', zip: '11362' },
    dbaName: 'Dispensary Near Me by Liberty Buds',
  };
  check('a house number is not a postcode',
    pickStore(['24502 Horace Harding Expy, Little Neck, NY 11362', 'Bronx'],
      placeNamesOf(littleNeck), registerTextOf(littleNeck)).index, 0);

  /* An option that states no postcode at all says nothing either way, and is
     still judged by the town — which is how DISPO/BK and Beleaf are read. */
  check('no postcode stated, no opinion',
    pickStore(['Brooklyn', 'Minneapolis'], ['11215', 'Brooklyn']).index, 0);

  /* DISPO/BK prints "Choose your store." on the page behind its age wall. Read
     before the wall is answered, the fork is the wall's own two buttons — and
     the run then records a fork problem where there is an age problem. These
     are the exact labels it recorded. */
  check('the wall is not a fork', looksLikeAgeWall(["YES, I'M 21+", "I'M UNDER 21"]), true);
  /* The Travel Agency's, which the fork read as three branches of a chain and
     refused as none of ours — a fork problem recorded where there is an age
     problem, on four licences at once. */
  check('nor is the one that asks two questions at once', looksLikeAgeWall([
    'Yes! Shop store pick-up', 'Yes! Shop quick delivery', "No... Unfortunately I'm not yet 21",
  ]), true);
  check('nor is it one with only the refusal showing', looksLikeAgeWall(['NOT YET']), true);
  check('a fork of towns is a fork', looksLikeAgeWall(['Brooklyn', 'Minneapolis', 'St Paul']), false);
  check('and so is one naming the chain', looksLikeAgeWall(['Beleaf Brooklyn', 'Beleaf Medford']), false);
}

/* Every button here was read off a live shop — QUBE's screenshots and the
   Flowery's own page — not invented. */
{
  const t = (text, expected) => check(`button «${text}»`, wallAction(text), expected);
  t('YES I AM', 'affirm-age');
  t('Yes, I Am', 'affirm-age');
  t('I am 21 or older', 'affirm-age');
  /* GOOD VIBES asks this way, and for a whole run we walked past it: the
     branch after "I am" wanted a number next, and the branch for "over 21"
     wanted those words at the start. The shop was recorded as having no age
     gate at all. */
  t('I am over 21', 'affirm-age');
  t("I'm over 21", 'affirm-age');
  /* DISPO/BK's, and it fell further than Good Vibes' did: the branch after
     "yes" spelled out "i am" with no room for "i'm", so the label dropped
     through to the never-press list, where `yes.*` caught it. A whole shop
     stood behind an age wall this collector is allowed to answer, because of
     an apostrophe. */
  t("YES, I'M 21+", 'affirm-age');
  /* The Travel Agency asks the age question and the collect-or-deliver
     question with the same three buttons. Four licences stood behind it. Only
     the pick-up one is pressed: it says yes as honestly as the other and asks
     nobody for an address. */
  t('Yes! Shop store pick-up', 'affirm-age');
  t('Yes! Shop quick delivery', 'refuse');
  t("Yes, I'm 21", 'affirm-age');
  t('YES, I AM 21+', 'affirm-age');
  /* Ten licences on one storefront builder, all behind this one button, all
     left standing at the wall because "at least" had no place in the
     pattern. Its neighbour on the wall is "Exit the site". */
  t("I'M AT LEAST 21 YEARS OLD", 'affirm-age');
  t('I am at least 21 years of age', 'affirm-age');
  t('Yes, I am at least 21', 'affirm-age');
  t('Exit the site', 'ignore');

  // The answer of someone who is not 21. This collector does not give it.
  t('NOT YET', 'refuse');
  t('No, Not Yet', 'refuse');
  t('No', 'refuse');
  t('I am under 21', 'refuse');
  t("I'm under 21", 'refuse');
  t("I'M UNDER 21", 'refuse');
  /* Three dots and an adverb, which every anchored pattern walks past. The
     decline may be read loosely and the affirmation may not: missing a
     decline means pressing what we should not, missing an affirmation only
     means a shelf goes unread. */
  t("No... Unfortunately I'm not yet 21", 'refuse');
  t('Sorry, I am under 21', 'refuse');
  t('I am too young', 'refuse');

  // A shop's own way out of its newsletter box.
  t('No Thanks', 'decline-offer');
  t('No thanks, let me browse', 'decline-offer');
  t('Not now', 'decline-offer');
  t('Close', 'decline-offer');

  /* Read off live pages. Every Dutchie menu carries these two, sitting over
     the shelf until something closes them; Aroma Farms puts Decline beside
     Accept on its cookie notice. */
  t('Close Login Nudge', 'decline-offer');
  t('Dismiss notification', 'decline-offer');
  t('Decline', 'decline-offer');
  t('Decline all', 'decline-offer');

  /* QUBE closes its prize draw with a sign and no word at all. Whole label
     only: a lone mark is a close control, a word that begins with one is a
     word. */
  t('\u00d7', 'decline-offer');
  t('\u2715', 'decline-offer');
  t('X', 'decline-offer');
  t('X marks the spot', 'ignore');
  t('Xmas Deals', 'ignore');

  /* Agreeing to something on behalf of somebody who is not there. "Continue"
     is the one that submits a name and an email on QUBE's prize draw, and it
     is never a decline; it is only ever pressed as a last-resort age
     affirmation, on a page that is asking about age and nothing else. */
  t('Join Now', 'refuse');
  t('Sign Up', 'refuse');
  t('Continue', 'ignore');
  /* The other half of a cookie notice. Nobody here can agree to it. */
  t('Accept', 'refuse');
  t('Accept all', 'refuse');
  t('Allow all', 'refuse');

  /* The accessibility link every site carries, and the reason the decline
     patterns are anchored whole rather than matched loosely on "skip". */
  t('Skip to main content', 'ignore');
  t('Clear', 'ignore');
  t('Shop Now', 'ignore');
  t('Flower', 'ignore');
}

/* Gap Commerce asks one question per category, and every answer is a page of
   the same length. Ava Flower's pre-rolls were paged and its flower was not,
   because the tie went to whichever came first. The paging now chooses by
   flower, which it can only do if flower is counted inside search hits — the
   envelope these answers arrive in. */
{
  const hits = (category, names) => ({
    took: 3,
    hits: {
      total: { value: 33 },
      hits: names.map((name, i) => ({
        _index: 'products',
        _id: `${category}-${i}`,
        _source: { name, category, price: 35, customSize: '3.5g' },
      })),
    },
  });
  const flower = hits('FLOWER', ['Blue Dream', 'Gelato 41', 'Runtz']);
  const preroll = hits('PREROLL', ['Blue Dream Pre-Roll', 'Gelato Pre-Roll', 'Runtz Pre-Roll']);
  check('flower is counted inside search hits', flowerIn(flower), 3);
  check('and pre-rolls of the same length are not flower', flowerIn(preroll), 0);
  check('an answer with no products counts none', flowerIn({ ok: true }), 0);

  /* Typesense wraps a product in { document, highlight, highlights } — Carrot
     sends Piffords' whole store so. */
  const carrot = {
    results: [
      {
        found: 101,
        out_of: 341,
        page: 1,
        hits: ['Rain Sherbet 11', 'Sour Diesel', 'Colombian Cream'].map((strain, i) => ({
          document: {
            id: String(8914630807 + i),
            name: `Skyrose - ${strain} - HYBRID - Flower - (3.5g jar)`,
            categoryName: 'Flower',
            brand: '',
            option1Price: 23.99,
            unitWeight: 3.5,
            thcPercentage: 27.84,
          },
          highlight: {},
          highlights: [],
        })),
      },
    ],
  };
  check('flower is counted inside Typesense hits', flowerIn(carrot), 3);
  check('a hit envelope is opened only when every key is Typesense\'s own',
    flowerIn({ items: carrot.results[0].hits.map((h) => ({ ...h, owner: 'x' })) }), 0);

  /* The paging judges each answer by the products in it. By shape alone it saw
     none inside these envelopes, so every page after the first looked empty and
     the paging stopped, calling it the end. */
  /* One Carrot product through the mapper. Its name carries the brand, the
     strain, the lineage, the category and the package, each between dashes;
     its THC is under a key no other menu used. */
  const [piff] = flattenSearchHits([
    {
      results: [
        {
          hits: [
            { document: { id: '1', name: 'Bouket - Banana Kush - INDICA DOM - Flower - (3.5g jar)', categoryName: 'Flower', brand: '', option1Price: 35.99, unitWeight: 3.5, thcPercentage: 27.84, cbdPercentage: 0.07 }, highlight: {}, highlights: [] },
            { document: { id: '2', name: 'Bouket - Noir - HYBRID - Flower - (3.5g jar)', categoryName: 'Flower', brand: '', option1Price: 35.99, unitWeight: 3.5, thcPercentage: 22.1 }, highlight: {}, highlights: [] },
          ],
        },
      ],
    },
  ]);
  const carrotRow = toListing(piff, shop, SRC, {});
  check('Carrot: THC read from thcPercentage', carrotRow.thcPercent, 27.84);
  check('Carrot: CBD read from cbdPercentage', carrotRow.cbdPercent, 0.07);
  check('Carrot: the lineage segment is read', carrotRow.lineage, 'INDICA_DOMINANT');
  check('Carrot: and taken out of the name, with the empty package', carrotRow.strainNameRaw, 'Bouket - Banana Kush');
  check('Carrot: the size is kept', carrotRow.availableSizesGrams, [3.5]);
  check('Carrot: an empty brand stays empty — the name is not mined for one', carrotRow.brand, null);
  check('a whole segment is a lineage', ['HYBRID', 'Indica', 'SATIVA DOM', 'HYBRID INDICA DOM', 'Sativa-Dom', 'indica dominant'].map(lineageSegmentOf),
    ['HYBRID', 'INDICA', 'SATIVA_DOMINANT', 'INDICA_DOMINANT', 'SATIVA_DOMINANT', 'INDICA_DOMINANT']);
  check('a misspelling or a strain is not', ['HYRBID', 'Indica Kush', 'Hybrid Haze', 'Blue Dream'].map(lineageSegmentOf), [null, null, null, null]);

  check('a page of search hits has a signature', signatureOf([carrot]) !== null, true);
  check('and so does a page of Elasticsearch hits', signatureOf([hits('FLOWER', ['A', 'B'])]) !== null, true);
}

/* ------------------------------------------------------- Front door --
 * A menu root is a showcase: a row of carousels, ten products apiece. Easy
 * Times gave us 121 products that way, 37 of them flower and two ounces,
 * while its own Flower page holds twenty-three ounces. The Flower link is on
 * the page we already stand on.
 */
{
  const here = 'https://menus.dispenseapp.com/ebc5c94b7fa54813/menu';
  const tile = { href: 'https://menus.dispenseapp.com/ebc5c94b7fa54813/menu/flower', text: 'Flower' };
  check('the flower tile on the menu front page',
    pickFlowerInside([{ href: here, text: 'Menu' }, tile], here, 'Lease From Me'), tile.href);

  /* One address serves every shop the platform hosts; the first path
     segment is the shop. Another venue's Flower is another shop's shelf. */
  check('not another venue on the same platform', pickFlowerInside(
    [{ href: 'https://menus.dispenseapp.com/0000aaaa1111bbbb/menu/flower', text: 'Flower' }],
    here, 'Lease From Me'), null);

  check('not a category we do not collect', pickFlowerInside(
    [{ href: 'https://menus.dispenseapp.com/ebc5c94b7fa54813/menu/pre-rolls', text: 'Pre-Rolls' }],
    here, 'Lease From Me'), null);

  check('nothing to do once already on the flower page', pickFlowerInside(
    [tile], 'https://caldwellsny.com/menu/categories/flower/', 'Caldwell'), null);
}

/* --------------------------------------------------------- TURBO STREAM ---
 * Remix's single-fetch answer: The Travel Agency's "LOAD MORE" brought its
 * second page back as text/x-script, a flattened graph, and nothing read it.
 * Keys and values are indices into one array of values; a promise is settled
 * on a later line whose chunk is appended to that same array. */
check('a flattened object reads back', decodeTurboStream('[{"_1":2},"page",2]'), { page: 2 });
check(
  'nested objects and arrays read back',
  decodeTurboStream('[{"_1":2},"products",[3],{"_4":5,"_6":7},"name","Maui Wowie","thc",22.1]'),
  { products: [{ name: 'Maui Wowie', thc: 22.1 }] },
);
check(
  'null and a date are read as what they stand for',
  decodeTurboStream('[{"_1":-5,"_2":3},"brand","packagedOn",["D","2026-08-14T00:00:00.000Z"]]'),
  { brand: null, packagedOn: '2026-08-14T00:00:00.000Z' },
);
check(
  'a deferred shelf is read from the line that settles it',
  decodeTurboStream('[{"_1":2},"products",["P",0]]\nP0:[[4],{"_5":6},"name","Blue Dream"]'),
  { products: [{ name: 'Blue Dream' }] },
);
check('an unsettled promise is empty, not guessed', decodeTurboStream('[{"_1":2},"products",["P",0]]'), { products: null });
check('something that is not a stream is nothing', decodeTurboStream('<html>'), null);
{
  /* The shape Remix wraps a route's answer in, end to end through the mapper:
     products read out of a decoded stream are ordinary listings. */
  const stream = decodeTurboStream(
    '[{"_1":2},"routes/_layout.flower",{"_3":4},"data",{"_5":6},"products",[7],'
      + '{"_8":9,"_10":11,"_12":13,"_14":15},"Name","Florist Farms - Maui Wowie - 3.5g","type","Flower","Options",[16],"brandName","Florist Farms","1/8oz"]',
  );
  const product = stream?.['routes/_layout.flower']?.data?.products?.[0];
  check('a decoded product maps to a listing', toListing(product, shop, SRC, {})?.availableSizesGrams, [3.5]);
}

/* ------------------------------------------------------------- SCHEMA -----
 * What the collector writes has to be what the register accepts. The source
 * of a Travel Agency listing gained a `branch` — the shop chosen on a site that
 * keeps it out of the address — and the schema, which allows no property it
 * does not name, refused all seventy-three of them in the first live run. Had
 * that been the daily run, every batch holding one would have been discarded.
 * Nothing local had ever put the collector's output through the schema, so
 * nothing local could have said so. */
{
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const listingSchema = JSON.parse(
    readFileSync(new URL('../data/schema/flower-listing.schema.json', import.meta.url), 'utf8'),
  );
  const valid = ajv.compile(listingSchema);
  const errorsOf = (listing) =>
    valid(listing) ? [] : (valid.errors ?? []).map((e) => `${e.instancePath} ${e.message} ${JSON.stringify(e.params)}`);

  const plain = toListing(dutchie, shop, SRC, {});
  check('a collected listing is one the schema accepts', errorsOf(plain), []);

  const chosen = structuredClone(plain);
  chosen.sources[0].branch = 'Union Square 835 Broadway, NY, NY';
  check('and so is one read for a chosen shop', errorsOf(chosen), []);

  const dated = toListing(
    { Name: 'Datey', type: 'Flower', Options: ['3.5g'], packagedOn: '2026-08-14', harvestDate: '2026-06-02', totalCannabinoids: 31.4 },
    shop,
    SRC,
    {},
  );
  check('and one carrying dates and a whole panel', errorsOf(dated), []);
}

/* ------------------------------------------------------------- RSC FLIGHT ---
 * Next.js's app router: rows of "<id>:<payload>", JSON where the row is data.
 * Sofa Club's hundred and eleven products are one such row. */
{
  const product = (name, type) => ({ id: name, name: `Dank | Flower | 3.5g | ${name}`, productCategoryName: 'Flower', weight: 3.5, weightUnit: 'GRAMS', price: 51, cannabisType: type, labs: { thc: 27.2, cbd: 0 } });
  const text = [
    '1:"$Sreact.fragment"',
    '2:I[75637,[],""]',
    ':HL["/_next/static/css/app.css","style"]',
    `5:${JSON.stringify(['$', 'div', null, { products: [product('Jealousy', 'HYBRID'), product('Stank41', 'HYBRID_INDICA')] }])}`,
    '6:T1a,plain text, not a row',
    '7:{"torn":',
  ].join('\n');
  const rows = decodeFlight(text);
  check('only the row that is an object or array is parsed; strings, imports, hints, text and a torn row are left', rows.length, 1);
  check('its products are found', flowerIn(rows[0]), 2);
  check('nothing in an empty flight', decodeFlight(''), []);
  check('nor in an answer that is not one', decodeFlight('<html>not found</html>'), []);
  const [, stank] = rows[0][3].products;
  check('Dispense writes indica-dominant as HYBRID_INDICA', toListing(stank, shop, SRC, {}).lineage, 'INDICA_DOMINANT');
  check('and sativa-dominant as HYBRID_SATIVA', toListing({ ...stank, cannabisType: 'HYBRID_SATIVA' }, shop, SRC, {}).lineage, 'SATIVA_DOMINANT');
}

/* Taken last, after every check. It used to sit halfway down, and every
   check below it — the turbo stream, the schema — could print FAIL and still
   let the run pass. */
if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log('menu parser: all fixture checks passed.');
