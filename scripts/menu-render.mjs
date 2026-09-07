/**
 * Pilot: reads flower off a handful of real menus with a real browser.
 *
 * Fetching HTML got us nothing — these storefronts ship `products: {data: [],
 * params: {...}}`, the shell of a query the page runs after it loads. So the
 * shelf only exists once the page's own JavaScript has fetched it.
 *
 * Rather than scrape the rendered DOM, this captures the JSON the page itself
 * requests. That is the same data the shop chose to publish to every visitor,
 * in its original structure, which makes the mapping honest and stable.
 *
 * Deliberately a pilot: a dozen shops, one at a time, so we learn what the
 * payloads look like before deciding whether this is worth doing at scale.
 *
 *   node scripts/menu-render.mjs --limit 12
 *
 * --dataset <path> points it at a different register, and CHROMIUM_PATH at a
 * browser already on the machine; both exist for scripts/menu-e2e-check.mjs.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const UA =
  'Mozilla/5.0 (compatible; dispensary-list-menu/1.0; +https://github.com/Adisabeba33/dispensery-list)';

const limit = Number(process.argv[process.argv.indexOf('--limit') + 1]) || 12;
const NOW = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

// --dataset points the collector at a different register: used by the local
// end-to-end check, which runs it against a fixture storefront on localhost.
const datasetArg = process.argv.indexOf('--dataset');
const datasetPath = datasetArg > -1 ? process.argv[datasetArg + 1] : 'data/dispensaries.json';
const dispensaries = JSON.parse(readFileSync(resolve(ROOT, datasetPath), 'utf8'));

// Menus hosted on Leafly or Weedmaps belong to those companies, not the shop.
const OWN_SITE = new Set(['DUTCHIE', 'BLAZE', 'TREEZ', 'IHEARTJANE', 'MEADOW', 'PROPRIETARY', 'OTHER']);

/**
 * --skip-collected leaves out shops whose shelf we already hold, so a sweep
 * spends its time on the ones never tried rather than re-reading the thirteen
 * that worked. Their listings survive the run untouched: a shop this run does
 * not read keeps the shelf already collected.
 */
const skipCollected = process.argv.includes('--skip-collected');
/* --only-endpoints visits exactly the shops someone has researched a menu
   address for. Those are the ones a sweep already failed on, so re-running the
   whole register to reach them wastes an hour to test twenty-six. */
const onlyEndpoints = process.argv.includes('--only-endpoints');

/* --only <licence> visits one shop, and --dump-products writes the raw product
   objects it saw into the report. Between them they answer "why did this shop
   come out wrong" with the payload rather than a theory about it — which is
   how the last three parser faults were actually found. */
const onlyArg = process.argv.indexOf('--only');
const onlyLicence = onlyArg > -1 ? process.argv[onlyArg + 1] : null;
const dumpArg = process.argv.indexOf('--dump-products');
const dumpProducts = dumpArg > -1 ? Number(process.argv[dumpArg + 1]) || 5 : 0;
const alreadyCollected = new Set();
if (skipCollected) {
  try {
    for (const l of JSON.parse(readFileSync(resolve(ROOT, 'data/flower-listings.json'), 'utf8'))) {
      alreadyCollected.add(l.licenseNumber);
    }
  } catch {
    /* nothing collected yet */
  }
}

/**
 * Menu addresses found by hand, keyed by licence number.
 *
 * Twenty-five of forty shops returned no products at all, because the
 * collector could not find the way in: the menu is behind a control that is
 * not a link, or lives on a host the shop's own pages never name. A person
 * finds those in seconds and a crawler does not, so where one has been written
 * down the collector goes straight there instead of hunting.
 *
 * The file is optional and hand-maintained; see docs/AGENT_MENU_ENDPOINTS_BRIEF.md.
 */
let ENDPOINTS = {};
try {
  const raw = JSON.parse(readFileSync(resolve(ROOT, 'data/menu-endpoints.json'), 'utf8'));
  for (const e of raw) {
    if (e?.licenseNumber && e?.menuUrl) ENDPOINTS[e.licenseNumber] = e.menuUrl;
  }
} catch {
  /* not delivered yet; the collector hunts for the link as before */
}

const candidates = dispensaries.filter(
  (d) =>
    d.operationalStatus === 'OPEN' &&
    OWN_SITE.has(d.menu?.provider) &&
    d.contact?.website &&
    !alreadyCollected.has(d.licenseNumber) &&
    (!onlyEndpoints || ENDPOINTS[d.licenseNumber]) &&
    (!onlyLicence || d.licenseNumber === onlyLicence),
);

/** robots.txt still applies: a browser does not change who is welcome. */
const robotsCache = new Map();
const robotsAllows = async (url) => {
  const { origin, pathname } = new URL(url);
  if (!robotsCache.has(origin)) {
    try {
      const res = await fetch(`${origin}/robots.txt`, { headers: { 'User-Agent': UA } });
      robotsCache.set(origin, res.ok ? await res.text() : '');
    } catch {
      robotsCache.set(origin, '');
    }
  }
  const txt = robotsCache.get(origin);
  if (!txt) return true;

  // Read the record that applies to everyone; we do not claim a friendlier one.
  const lines = txt.split('\n').map((l) => l.split('#')[0].trim());
  let inStar = false;
  const disallows = [];
  for (const line of lines) {
    const [rawKey, ...rest] = line.split(':');
    const key = (rawKey || '').toLowerCase().trim();
    const value = rest.join(':').trim();
    if (key === 'user-agent') inStar = value === '*';
    else if (inStar && key === 'disallow' && value) disallows.push(value);
  }
  return !disallows.some((rule) => rule === '/' || pathname.startsWith(rule));
};

/**
 * Almost every dispensary site opens with "are you 21 or over?" and loads no
 * menu until it is answered. Answering it is what any adult visitor does — it
 * is a notice, not a login, and nothing is being circumvented — but it is an
 * assertion, so it is made deliberately and narrowly: only on a page that is
 * actually asking about age, only on a control whose own words affirm it, and
 * it is recorded per shop in the report.
 */
const AGE_AFFIRM =
  /^(yes|yes[,.!]?\s*i\s*am\s*21.*|i\s*am\s*21.*|i'?m\s*21.*|21\s*\+?|21\s*(or|and)\s*(over|older)|over\s*21|enter(\s*site)?|confirm|continue)$/i;

const affirmAge = async (page) => {
  try {
    const asking = await page.evaluate(() => {
      const t = document.body?.innerText ?? '';
      return /\b21\b/.test(t) && /(age|older|over|verify|confirm)/i.test(t);
    });
    if (!asking) return false;

    const clicked = await page.evaluate(
      (src) => {
        const affirm = new RegExp(src, 'i');
        const controls = [
          ...document.querySelectorAll('button, a, input[type="button"], input[type="submit"], [role="button"]'),
        ];
        const target = controls.find((el) => {
          const text = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim();
          if (!text || text.length > 40) return false;
          if (!affirm.test(text)) return false;
          const box = el.getBoundingClientRect();
          return box.width > 0 && box.height > 0;
        });
        if (!target) return false;
        target.click();
        return true;
      },
      AGE_AFFIRM.source,
    );
    if (clicked) await page.waitForTimeout(2500);
    return clicked;
  } catch {
    return false;
  }
};

const FLOWER_LINK = /(flower|\/bud\b|category=flower|categories\/flower)/i;
const MENU_LINK = /\b(menu|shop|order|browse|products?)\b/i;

/** Walks captured JSON looking for something shaped like a product list. */
const findProductArrays = (value, depth = 0, out = []) => {
  if (depth > 6 || out.length > 40) return out;
  if (Array.isArray(value)) {
    const objects = value.filter((v) => v && typeof v === 'object' && !Array.isArray(v));
    if (objects.length >= 2) {
      const keys = Object.keys(objects[0]);
      // The first pilot matched a Dutchie tax table: it has `name` and `type`
      // like a product does. Demand something only a shelf item carries.
      const looksLikeProduct =
        keys.some((k) => /^(name|productName|title)$/i.test(k)) &&
        keys.some((k) =>
          /^(category|productCategory|productCategoryName|subcategory|brand|brandName|strainType|cannabisType|variants|weightInGrams|potencyThc|thcContent)$/i.test(k),
        ) &&
        !keys.some((k) => /^(taxBasis|deliveryPolicy|applyTo|stages)$/i.test(k));
      if (looksLikeProduct) out.push(objects);
    }
    for (const item of value.slice(0, 20)) findProductArrays(item, depth + 1, out);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) findProductArrays(v, depth + 1, out);
  }
  return out;
};

/**
 * Key names are matched with case and separators ignored. Every one of the
 * four shops that worked in the pilot was on the one platform that writes its
 * keys in lower camel case; Dutchie — 105 of the 242 candidate shops — writes
 * `Name`, `Options` and `CBDContent`, and an exact `in` test walked straight
 * past all of them.
 */
const normaliseKey = (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '');

const keyIndex = new WeakMap();
const indexOf = (obj) => {
  let index = keyIndex.get(obj);
  if (!index) {
    index = new Map();
    // First key wins on collision, so `name` beats a later `Name`.
    for (const k of Object.keys(obj)) {
      const n = normaliseKey(k);
      if (!index.has(n)) index.set(n, k);
    }
    keyIndex.set(obj, index);
  }
  return index;
};

const pick = (obj, names) => {
  if (!obj || typeof obj !== 'object') return null;
  const index = indexOf(obj);
  for (const n of names) {
    const key = index.get(normaliseKey(n));
    if (key !== undefined && obj[key] !== null && obj[key] !== undefined) return obj[key];
  }
  return null;
};

/**
 * Every value under any of these names, not just the first one present. One
 * platform puts an opaque id in `productCategory` and the readable word in
 * `productCategoryName`; first-match-wins read the id and concluded the shop
 * sells no flower.
 */
const pickAll = (obj, names) => {
  if (!obj || typeof obj !== 'object') return [];
  const index = indexOf(obj);
  const out = [];
  for (const n of names) {
    const key = index.get(normaliseKey(n));
    if (key !== undefined && obj[key] !== null && obj[key] !== undefined) out.push(obj[key]);
  }
  return out;
};
const flatten = (v) => {
  if (Array.isArray(v)) {
    // A potency range [24.1, 24.1] states a figure; take the low end.
    if (v.length && typeof v[0] === 'number') return v[0];
    return v.map((x) => flatten(x)).filter((x) => x !== null && x !== undefined).join(' ');
  }
  if (v && typeof v === 'object') {
    for (const k of ['value', 'name', 'amount', 'percent', 'label', 'title', 'formatted', 'display', 'text']) {
      const hit = pick(v, [k]);
      if (hit !== null && hit !== undefined && typeof hit !== 'object') return hit;
    }
    // Dutchie states potency as { range: [24.1, 24.1], unit: 'PERCENTAGE' }.
    const range = pick(v, ['range']);
    if (Array.isArray(range) && typeof range[0] === 'number') return range[0];
    return null;
  }
  return v;
};
const num = (v) => {
  const f = flatten(v);
  if (typeof f === 'number') return Math.round(f * 100) / 100;
  if (typeof f === 'string') {
    const m = f.match(/(\d+(?:\.\d+)?)/);
    if (m) return Math.round(parseFloat(m[1]) * 100) / 100;
  }
  return null;
};
const slug = (...parts) =>
  parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 80)
    // Trim after the cut, not before: truncating an 80-character slug can
    // land on a separator and leave a trailing dash the schema rejects.
    .replace(/^-+|-+$/g, '');


/**
 * Menus name a product "Brand - Strain - Flower - 3.5g": the size is in the
 * title, not in a variants array, and the same strain appears once per size.
 * Splitting that apart is what turns rows into a shelf a person can read.
 */
/* The boundaries are asymmetric on purpose. A size written "1/8oz" or "1oz"
   has no word boundary between the digit and the unit, so `\b` before `oz`
   or after the `8` never matches — which is how a whole platform's sizes came
   back as one gram. A letter before the unit is still refused, so a strain
   name is not read as an ounce. */
const SIZE_RULES = [
  [/\b(\d+(?:\.\d+)?)\s*(?:g|gr|gram|grams)\b/i, (m) => parseFloat(m[1])],
  [/\b1\s*\/\s*8(?!\d)|\beighth\b/i, () => 3.5],
  [/\b1\s*\/\s*4(?!\d)|\bquarter\b/i, () => 7],
  [/\b1\s*\/\s*2(?!\d)|\bhalf\b/i, () => 14],
  [/(?<![a-z])(?:oz|ounce|zip)\b/i, () => 28],
];

/* Nobody sells flower by the hundredth of a gram. A figure below this came
   from some other field — a discount, a rating, a tax rate — and reading it as
   a weight puts a size on the shelf that a buyer cannot ask for. */
const MIN_PLAUSIBLE_GRAMS = 0.5;
const plausibleSize = (g) => (typeof g === 'number' && g >= MIN_PLAUSIBLE_GRAMS && g <= 30 ? g : null);

const sizeFromText = (text) => {
  for (const [re, take] of SIZE_RULES) {
    const m = text.match(re);
    if (m) {
      const g = plausibleSize(take(m));
      if (g) return g;
    }
  }
  return null;
};

/** Shops mark lineage in the title as (H), (S) or (I) — 197 of 330 did. */
const LINEAGE_MARK = { h: 'HYBRID', s: 'SATIVA', i: 'INDICA', hybrid: 'HYBRID', sativa: 'SATIVA', indica: 'INDICA' };
const lineageFromTitle = (raw) => {
  const m = String(raw).match(/\((h|s|i|hybrid|sativa|indica)\)/i);
  return m ? LINEAGE_MARK[m[1].toLowerCase()] : null;
};

/**
 * Infused products, diamonds and pouches are built from flower but are not
 * flower. Their category often still says "flower", so the title has to be
 * read too.
 */
/* The first group are stems on purpose — "infus" catches Infused, "cart"
   Cartridge, "gumm" Gummies. The second are whole words, so a Trimmed or
   Shakedown strain is not thrown away with the shake. */
const NOT_FLOWER_TITLE =
  /\b(infus|diamond|moon\s?rock|pre[\s-]?roll|blunt|joint|vape|cart|gumm|edible)|\b(shake|trim)\b|ground\s+flower|ready\s+to\s+roll|flower\s+flight/i;

/** Strips the brand, the category word and the size, leaving the strain. */
const cleanStrainName = (raw, brand) => {
  let text = String(raw)
    .replace(/\s*[-–—]\s*F\d+\s*$/i, '')          // trailing shop SKU: "- F140"
    .replace(/\((h|s|i|hybrid|sativa|indica)\)/gi, ' ')  // lineage marker, kept separately
    // The weight is kept in availableSizesGrams, so it is noise in the name
    // wherever it appears: "ILLUMINATI 3.5g" reads as a strain called ILLUMINATI.
    .replace(/\b[\d.]+\s*(?:g|gr|grams?)\b/gi, ' ')
    .replace(/(?:\d\s*\/\s*\d\s*)?(?<![a-z])(?:oz|ounce)\b/gi, ' ')
    .replace(/\b(eighth|quarter|half)\b/gi, ' ')
    // Removing the weight leaves the separator that preceded it dangling, and
    // a trailing "- " glued to the category word hid it from the filter below.
    .replace(/[\s\-–—|]+$/, '')
    .replace(/\s*[-–—|]\s*(flower\s*jar|flower|jar|bag|jars|bags|pouch)\s*$/gi, '')
    .replace(/\s*[-–—|]\s*(?=[-–—|])/g, ' ')                 // collapsed separators
    .replace(/\s*[-–—|]?\s*\b(sativa|indica|hybrid)\b\s*$/i, '') // lineage word left at the end
    .replace(/\s+[\d.]+\s*$/, '')                             // bare trailing weight
    .trim();

  let parts = text.split(/\s+[-–—|]\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 1) parts = [text];

  const brandLower = String(brand ?? '').toLowerCase().trim();
  parts = parts.filter((part) => {
    const p = part.toLowerCase();
    if (brandLower && p === brandLower) return false;
    // Grade words a menu files a strain under, never a strain itself. Matched
    // whole, so a strain called "Whole Lotta Love" survives.
    if (/^(flower|bud|buds|whole|whole flower|indoor flower)$/.test(p)) return false;
    if (sizeFromText(part) !== null && /^[\d\s./]*(g|gr|gram|grams|oz|ounce|eighth|quarter|half|zip)?$/i.test(p)) return false;
    return true;
  });

  const name = (parts.join(' - ') || text).replace(/\s{2,}/g, ' ').replace(/^[\s\-–—|]+|[\s\-–—|]+$/g, '').trim();
  return name || String(raw).trim();
};

/**
 * One shelf item per strain, with every size it comes in. Without prices there
 * is nothing to distinguish two rows of the same strain except the weight, so
 * carrying them as separate listings would just make the menu look padded.
 */
const mergeBySize = (rows) => {
  const byKey = new Map();
  for (const row of rows) {
    const key = `${row.licenseNumber}::${(row.brand ?? '').toLowerCase()}::${row.strainNameCanonical}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }
    const sizes = new Set([...(existing.availableSizesGrams ?? []), ...(row.availableSizesGrams ?? [])]);
    existing.availableSizesGrams = sizes.size ? [...sizes].sort((a, b) => a - b) : null;
    // Anything in stock in any size means the strain is on the shelf.
    existing.inStock = existing.inStock || row.inStock;
    existing.thcPercent ??= row.thcPercent;
    existing.cbdPercent ??= row.cbdPercent;
    existing.lineage = existing.lineage === 'UNKNOWN' ? row.lineage : existing.lineage;
    if (existing.terpenes.source === 'NONE' && row.terpenes.source !== 'NONE') {
      existing.terpenes = row.terpenes;
    }
  }
  return [...byKey.values()];
};

const LINEAGE = {
  indica: 'INDICA', sativa: 'SATIVA', hybrid: 'HYBRID',
  indicadominant: 'INDICA_DOMINANT', indicahybrid: 'INDICA_DOMINANT',
  sativadominant: 'SATIVA_DOMINANT', sativahybrid: 'SATIVA_DOMINANT', cbd: 'CBD',
};
const TERPENES = {
  myrcene: 'MYRCENE', limonene: 'LIMONENE', caryophyllene: 'CARYOPHYLLENE',
  betacaryophyllene: 'CARYOPHYLLENE', bcaryophyllene: 'CARYOPHYLLENE',
  pinene: 'PINENE_ALPHA', alphapinene: 'PINENE_ALPHA', betapinene: 'PINENE_BETA',
  linalool: 'LINALOOL', terpinolene: 'TERPINOLENE', humulene: 'HUMULENE',
  ocimene: 'OCIMENE', bisabolol: 'BISABOLOL', alphabisabolol: 'BISABOLOL',
  nerolidol: 'NEROLIDOL', valencene: 'VALENCENE', camphene: 'CAMPHENE',
  eucalyptol: 'EUCALYPTOL', guaiol: 'GUAIOL', farnesene: 'FARNESENE',
  geraniol: 'GERANIOL', borneol: 'BORNEOL', terpineol: 'TERPINEOL',
  phellandrene: 'PHELLANDRENE', carene: 'CARENE', sabinene: 'SABINENE', fenchol: 'FENCHOL',
  // Spellings seen in the pilot payloads.
  betamyrcene: 'MYRCENE', bmyrcene: 'MYRCENE', alphahumulene: 'HUMULENE',
  betaocimene: 'OCIMENE', alphaterpineol: 'TERPINEOL', alphacedrene: 'OTHER',
};

const NAME_KEYS = ['name', 'productName', 'title', 'displayName'];

/**
 * Every name a menu might file its category under. They are read together and
 * joined, not tried in order: one platform stores an opaque id in
 * `productCategory` and the readable word in `productCategoryName`, and another
 * uses `type` for something that is not a category at all.
 */
const CATEGORY_KEYS = [
  'category', 'categoryName', 'categories',
  'productCategory', 'productCategoryName', 'productType', 'productGroup',
  'subcategory', 'productSubcategory', 'subType', 'rootSubtype', 'subtype',
  'menuCategory', 'department', 'classification', 'class', 'kind', 'type',
];

const categoryText = (p) =>
  pickAll(p, CATEGORY_KEYS)
    .map((v) => String(flatten(v) ?? ''))
    .join(' ')
    .toLowerCase()
    .trim();

/**
 * Says why a product is or is not flower, rather than just whether. A filter
 * that rejects thousands of products should be able to report what it was
 * rejecting them for.
 */
const classify = (p) => {
  const title = String(flatten(pick(p, NAME_KEYS)) ?? '');
  if (!title.trim()) return 'no-title';
  if (NOT_FLOWER_TITLE.test(title)) return 'title-not-flower';
  const text = categoryText(p);
  if (!text) return 'no-category';
  if (/pre[\s-]?roll|infused|blunt|joint/.test(text)) return 'category-not-flower';
  return /flower|bud/.test(text) ? 'flower' : 'category-not-flower';
};

const inRange = (v, max) => (v === null || v === undefined || v < 0 || v > max ? null : v);

const toListing = (p, shop, sourceUrl, rawTerpNames) => {
  const rawName = flatten(pick(p, ['name', 'productName', 'title', 'displayName']));
  if (!rawName) return null;
  const brand = flatten(pick(p, ['brandName', 'brand', 'producer', 'vendor', 'cultivator']));
  const name = cleanStrainName(rawName, brand);
  const lineageRaw = String(
    flatten(pick(p, ['strainType', 'lineage', 'cannabisType', 'cannabisStrain', 'classification'])) ?? '',
  )
    .toLowerCase()
    .replace(/[^a-z]/g, '');

  const profile = [];
  const terps = pick(p, ['terpenes', 'terpeneProfile', 'terps']);
  if (Array.isArray(terps)) {
    for (const t of terps) {
      const raw = t && typeof t === 'object' ? t.name ?? t.terpene : t;
      if (!raw) continue;
      rawTerpNames[String(raw)] = (rawTerpNames[String(raw)] ?? 0) + 1;
      const mapped = TERPENES[String(raw).toLowerCase().replace(/[^a-z]/g, '')];
      profile.push({
        name: mapped ?? 'OTHER',
        rawName: mapped ? null : String(raw).slice(0, 60),
        // A menu that prints 0% is stating nothing, not stating zero.
        percent: (() => {
          const v = inRange(num(t && typeof t === 'object' ? t.value ?? t.percent : null), 20);
          return v === 0 ? null : v;
        })(),
      });
    }
  }

  /* A bare number is not a weight. Reading `value` and `size` as grams put
     shelves at eleven, twenty-six and twenty-seven grams into the register —
     quantities and prices wearing a weight's clothes. A figure counts only
     from a key that means weight, or from text that states its unit. */
  const WEIGHT_KEYS = ['gramAmount', 'weightInGrams', 'netWeight'];
  const UNIT_TEXT_KEYS = ['weightFormatted', 'label', 'name', 'title', 'weight', 'size', 'option'];

  const sizeOf = (v) => {
    if (typeof v === 'string') return sizeFromText(v);
    if (typeof v === 'number') return null; // no unit stated, so no weight read
    if (!v || typeof v !== 'object') return null;

    const stated = num(pick(v, WEIGHT_KEYS));
    if (stated) return stated;

    for (const text of pickAll(v, UNIT_TEXT_KEYS)) {
      if (typeof text === 'string') {
        const g = sizeFromText(text);
        if (g) return g;
      }
    }
    return null;
  };

  const sizes = [];
  const variants = pick(p, ['variants', 'weights', 'options', 'sizes', 'priceOptions', 'measurements']);
  if (Array.isArray(variants)) {
    for (const v of variants) {
      const g = plausibleSize(sizeOf(v));
      if (g) sizes.push(g);
    }
  }

  // Same rule at the top level: weightInGrams says grams in its name, `size`
  // does not.
  const statedGrams = plausibleSize(num(pick(p, ['weightInGrams', 'flowerEquivalentInGrams'])));
  if (statedGrams) sizes.push(statedGrams);
  if (!sizes.length) {
    for (const text of pickAll(p, ['weightFormatted', 'weight', 'size'])) {
      const g = typeof text === 'string' ? plausibleSize(sizeFromText(text)) : null;
      if (g) sizes.push(g);
    }
  }

  if (!sizes.length) {
    const fromTitle = sizeFromText(String(rawName));
    if (fromTitle) sizes.push(fromTitle);
  }

  // A flower listing without a weight is not useful to anyone: the whole point
  // of the shelf view is which strains come by the eighth, quarter, half or
  // ounce. If neither the payload nor the title states one, the listing is
  // dropped rather than published as a strain nobody can ask for.
  if (!sizes.length) return null;

  const stock = flatten(pick(p, ['inStock', 'available', 'isAvailable', 'quantity']));

  const listingId = slug(String(brand ?? ''), String(name));
  if (!listingId) return null;

  return {
    listingId,
    licenseNumber: shop.licenseNumber,
    capturedAt: NOW,
    strainNameRaw: String(name).slice(0, 200),

    strainNameCanonical: String(name).toLowerCase().replace(/#/g, '').replace(/\s+/g, ' ').trim() || null,
    brand: brand ? String(brand).slice(0, 120) : null,
    lineage: LINEAGE[lineageRaw] ?? lineageFromTitle(rawName) ?? 'UNKNOWN',
    thcPercent: inRange(num(pick(p, ['thcContent', 'potencyThc', 'thc', 'thcPercent'])), 100),
    cbdPercent: inRange(num(pick(p, ['cbdContent', 'potencyCbd', 'cbd', 'cbdPercent'])), 100),
    totalCannabinoidsPercent: null,
    terpenes: {
      // Numbers a menu prints without a certificate behind them are a claim,
      // not a measurement, and the schema keeps that distinction.
      source: profile.length ? 'MENU_LISTING' : 'NONE',
      profile,
      totalPercent: null,
      labName: null,
      testedOn: null,
      coaUrl: null,
      referenceStrain: null,
    },
    harvestedOn: null,
    packagedOn: null,
    inStock: stock === null || stock === undefined ? true : typeof stock === 'number' ? stock > 0 : Boolean(stock),
    availableSizesGrams: sizes.length ? [...new Set(sizes)].sort((a, b) => a - b) : null,
    productUrl: null,
    sources: [{ url: sourceUrl, label: 'Shop menu', type: 'MENU_PLATFORM', retrievedAt: NOW }],
    warnings: [],
  };
};

const main = async () => {
  // Imported here rather than at the top so the parsing helpers below can be
  // exercised against fixtures without a browser installed.
  const { chromium } = await import('playwright');
  // CHROMIUM_PATH lets the local end-to-end check use a browser that is already
  // on the machine; CI installs its own and leaves this unset.
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  );
  const listings = [];
  const report = [];
  const rawTerpNames = {};
  const capturedShapes = {};
  let done = 0;

  for (const shop of candidates) {
    if (done >= limit) break;
    const site = shop.contact.website;

    let allowed = false;
    try {
      allowed = await robotsAllows(site);
    } catch {
      allowed = true;
    }
    if (!allowed) {
      report.push({ shop: shop.dbaName ?? shop.legalName, status: 'robots-disallowed' });
      continue;
    }
    done += 1;

    const context = await browser.newContext({ userAgent: UA });
    const page = await context.newPage();
    const payloads = [];

    // When the last payload landed. A menu that is still fetching has not
    // finished, and a fixed wait either cuts it off or wastes time on a shop
    // that answered at once.
    let lastPayloadAt = Date.now();

    // Capture what the page asks for; that is the menu the shop publishes.
    page.on('response', async (res) => {
      try {
        const ct = res.headers()['content-type'] ?? '';
        if (!ct.includes('json')) return;
        if (res.request().resourceType() === 'document') return;
        const body = await res.json();
        payloads.push(body);
        lastPayloadAt = Date.now();
      } catch {
        /* non-JSON or aborted; nothing to capture */
      }
    });

    const entry = { shop: shop.dbaName ?? shop.legalName, licence: shop.licenseNumber, status: null };
    try {
      /* Wait for the fetching to stop rather than for a fixed number of
         seconds. The same shop returned forty products one day and none the
         next from the same address: we were reading whatever had arrived by
         the time the clock ran out. Returns false if the cap was reached with
         payloads still coming, which the report records. */
      const settle = async (quietMs, capMs) => {
        const start = Date.now();
        lastPayloadAt = Date.now();
        while (Date.now() - start < capMs) {
          if (Date.now() - lastPayloadAt > quietMs) return true;
          await page.waitForTimeout(400);
        }
        return false;
      };

      await page.goto(site, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await settle(1500, 8000);
      entry.ageGate = await affirmAge(page);

      // A menu address written down by hand beats anything found by guessing.
      const known = ENDPOINTS[shop.licenseNumber] ?? null;
      entry.usedKnownEndpoint = Boolean(known);

      // Prefer a flower category link; fall back to any menu link.
      const found = await page.evaluate(
        ({ flowerSrc, menuSrc }) => {
          const flower = new RegExp(flowerSrc, 'i');
          const menu = new RegExp(menuSrc, 'i');
          const links = [...document.querySelectorAll('a[href]')];
          const match = links.find((a) => flower.test(a.href) || flower.test(a.textContent || ''));
          const fallback = links.find((a) => menu.test(a.href) || menu.test(a.textContent || ''));
          return (match ?? fallback)?.href ?? null;
        },
        { flowerSrc: FLOWER_LINK.source, menuSrc: MENU_LINK.source },
      );
      const href = known ?? found;
      // Said plainly, so "no products" stops covering "not allowed there".
      entry.menuLink = href ? 'found' : 'none';
      if (href && !(await robotsAllows(href))) entry.menuLink = 'robots-disallowed';

      if (href && entry.menuLink !== 'robots-disallowed') {
        await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await settle(1500, 10000);
        entry.ageGate = (await affirmAge(page)) || entry.ageGate;
        entry.settled = await settle(3000, 25000);

        /* Then scroll until nothing new arrives. Menus that page in as you go
           gave us their first screen and no more. */
        let previous = -1;
        for (let round = 0; round < 8; round += 1) {
          if (payloads.length === previous) break;
          previous = payloads.length;
          await page.mouse.wheel(0, 6000);
          await settle(2000, 12000);
          entry.scrollRounds = round + 1;
        }
      }
      entry.payloads = payloads.length;

      const arrays = payloads.flatMap((p) => findProductArrays(p));
      entry.productArrays = arrays.length;
      entry.productsSeen = arrays.reduce((n, a) => n + a.length, 0);

      if (arrays.length) {
        capturedShapes[shop.menu.provider] ??= Object.keys(arrays[0][0]).sort().slice(0, 60);
      }

      if (dumpProducts > 0) {
        // Whole objects, not key names: the fault is usually in a value.
        entry.sample = arrays
          .flat()
          .filter((product) => classify(product) === 'flower')
          .slice(0, dumpProducts)
          .map((product) => JSON.stringify(product).slice(0, 2400));
      }

      // Why products were dropped, not merely how many. A run that collects
      // nothing has to say which step refused, or the next fix is guesswork.
      const why = {};
      const categoriesSeen = new Map();
      const seen = new Set();
      for (const arr of arrays) {
        for (const product of arr) {
          const verdict = classify(product);
          const cat = categoryText(product).slice(0, 40);
          if (cat) categoriesSeen.set(cat, (categoriesSeen.get(cat) ?? 0) + 1);
          if (verdict !== 'flower') {
            why[verdict] = (why[verdict] ?? 0) + 1;
            continue;
          }
          const listing = toListing(product, shop, page.url(), rawTerpNames);
          if (!listing) {
            why['flower-no-size'] = (why['flower-no-size'] ?? 0) + 1;
            continue;
          }
          /* Every row is kept; mergeBySize folds them together afterwards.
             Dropping a repeated listingId here threw away the ounce: on
             platforms that publish one product per weight, "FRESH POWDER |
             FLOWER | 3.5G" and the same strain at 28G clean to the same strain
             name, and the second was discarded before its size was ever read.
             That is why a shop with twenty ounce products showed four. */
          if (seen.has(listing.listingId)) why['sameStrainAnotherSize'] = (why['sameStrainAnotherSize'] ?? 0) + 1;
          seen.add(listing.listingId);
          listings.push(listing);
        }
      }
      entry.flower = seen.size;
      entry.rejected = why;
      entry.categories = [...categoriesSeen.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, n]) => `${name} (${n})`);
      entry.status = seen.size ? 'ok' : entry.productsSeen ? 'no-flower' : 'no-products';
    } catch (e) {
      entry.status = `error: ${e.message.slice(0, 120)}`;
    }

    report.push(entry);
    console.log(`${done}/${limit} ${entry.shop}: ${entry.status}`);
    await context.close();
    await new Promise((r) => setTimeout(r, 1500)); // be a considerate visitor
  }

  await browser.close();

  /**
   * A shop whose site was slow, redesigned or down today must not lose the
   * shelf we already read. Its own listings are replaced outright when this run
   * reads it successfully; otherwise the previous ones are carried forward
   * unchanged, still carrying the date they were captured — until they are a
   * month old, at which point a stale shelf is worse than no shelf.
   */
  const CARRY_FORWARD_DAYS = 30;
  const listingsPath = resolve(ROOT, 'data/flower-listings.json');
  let previous = [];
  try {
    previous = JSON.parse(readFileSync(listingsPath, 'utf8'));
  } catch {
    /* first run, or the file was removed on purpose */
  }
  const refreshed = new Set(report.filter((r) => r.flower > 0).map((r) => r.licence));

  /* A capture that comes back much smaller than the last one is more often a
     page that had not finished than a shop that stopped stocking. We still take
     what we saw — inventing the difference would be worse — but the run says so
     rather than letting the shelf quietly shrink. */
  const previousCounts = {};
  for (const l of previous) previousCounts[l.licenseNumber] = (previousCounts[l.licenseNumber] ?? 0) + 1;
  const shrank = report
    .filter((r) => r.flower > 0 && previousCounts[r.licence] > 0 && r.flower * 2 < previousCounts[r.licence])
    .map((r) => `${r.shop}: ${previousCounts[r.licence]} → ${r.flower}`);
  const cutoff = Date.now() - CARRY_FORWARD_DAYS * 24 * 60 * 60 * 1000;
  const carried = previous.filter(
    (l) => !refreshed.has(l.licenseNumber) && Date.parse(l.capturedAt) >= cutoff,
  );
  const dropped = previous.length - carried.length - previous.filter((l) => refreshed.has(l.licenseNumber)).length;

  const merged = mergeBySize([...listings, ...carried]);
  merged.sort((a, b) =>
    a.licenseNumber === b.licenseNumber
      ? a.strainNameRaw.localeCompare(b.strainNameRaw)
      : a.licenseNumber.localeCompare(b.licenseNumber),
  );

  const summary = {
    shopsVisited: report.filter((r) => r.status !== 'robots-disallowed').length,
    ageGatesAnswered: report.filter((r) => r.ageGate).length,
    // Why a shop yielded nothing, which "no-products" used to hide.
    menuLinkCounts: report.reduce((acc, r) => {
      if (!r.menuLink) return acc;
      acc[r.menuLink] = (acc[r.menuLink] ?? 0) + 1;
      return acc;
    }, {}),
    usedKnownEndpoint: report.filter((r) => r.usedKnownEndpoint).length,
    shelvesThatShrankByHalf: shrank,
    hitTheSettleCap: report.filter((r) => r.settled === false).length,
    shelvesCarriedForward: new Set(carried.map((l) => l.licenseNumber)).size,
    listingsCarriedForward: carried.length,
    listingsDroppedAsStale: dropped,
    robotsDisallowed: report.filter((r) => r.status === 'robots-disallowed').length,
    shopsWithFlower: report.filter((r) => r.flower > 0).length,
    listingsBeforeMerge: listings.length,
    listings: merged.length,
    statusCounts: report.reduce((acc, r) => {
      const key = String(r.status).split(':')[0];
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
    capturedProductKeys: capturedShapes,
    rawTerpeneNames: rawTerpNames,
    perShop: report,
  };

  mkdirSync(resolve(ROOT, 'enrichment-output'), { recursive: true });
  writeFileSync(resolve(ROOT, 'enrichment-output/menu-summary.json'), JSON.stringify(summary, null, 2) + '\n');
  writeFileSync(listingsPath, JSON.stringify(merged, null, 2) + '\n');
  console.log(`\nWrote ${merged.length} listings`);
};

/** Exported for scripts/menu-parse-check.mjs, which tests them against fixtures. */
export { classify, categoryText, cleanStrainName, mergeBySize, sizeFromText, toListing };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
