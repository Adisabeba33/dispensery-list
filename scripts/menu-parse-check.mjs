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
import { classify, cleanStrainName, sizeFromText, toListing } from './menu-render.mjs';

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
check('infused', classify({ Name: 'Infused Pouch 14g', type: 'Flower' }), 'title-not-flower');
check('vape', classify({ Name: 'Blue Dream Cartridge', type: 'Vaporizers' }), 'title-not-flower');
check('edible', classify({ Name: 'Peach Gummies 10mg', type: 'Edibles' }), 'title-not-flower');
check('no category', classify({ Name: 'Mystery Item' }), 'no-category');
check('unrelated type field', classify({ name: 'Grape Cake', type: 'variant', categoryName: 'Flower' }), 'flower');

// Flower with no weight anywhere is dropped: the shelf view is entirely about
// which strains come by the eighth, quarter, half or ounce.
check('flower without a size', toListing({ Name: 'Nameless Bud', type: 'Flower' }, shop, SRC, {}), null);

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

/* ---------------------------------------------------------- name cleaning */
check('strip sku and marker', cleanStrainName('ILLUMINATI (H) 3.5g - F42', null), 'ILLUMINATI');
check('strip brand', cleanStrainName('LEAL - Grape Cake - Flower - 28 Grams', 'Leal'), 'Grape Cake');
check('strip grade word', cleanStrainName('Flower - Whole - Bubblegum Gushers', null), 'Bubblegum Gushers');
check('keep strain that starts with a grade word', cleanStrainName('Whole Lotta Love', null), 'Whole Lotta Love');

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log('menu parser: all fixture checks passed.');
