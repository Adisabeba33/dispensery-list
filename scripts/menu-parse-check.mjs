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
  categoryFromProductUrl, classify, cleanStrainName, flattenJsonApiProducts, isProductPage,
  mergeBySize, pickMenuLink, rankMenuLink, sameEstate, sizeFromText, toListing,
} from './menu-render.mjs';
import { canonicalStrain, strainKey } from './strain-name.mjs';

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
  const brands = new Set(['Dank', 'GRASSROOTS', "Papa's Herb", 'Runtz', 'TTM', 'Bouket', 'Matter']);
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

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log('menu parser: all fixture checks passed.');
