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
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const UA =
  'Mozilla/5.0 (compatible; dispensary-list-menu/1.0; +https://github.com/Adisabeba33/dispensery-list)';

const limit = Number(process.argv[process.argv.indexOf('--limit') + 1]) || 12;
const NOW = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

const dispensaries = JSON.parse(readFileSync(resolve(ROOT, 'data/dispensaries.json'), 'utf8'));

// Menus hosted on Leafly or Weedmaps belong to those companies, not the shop.
const OWN_SITE = new Set(['DUTCHIE', 'BLAZE', 'TREEZ', 'IHEARTJANE', 'MEADOW', 'PROPRIETARY', 'OTHER']);

const candidates = dispensaries.filter(
  (d) =>
    d.operationalStatus === 'OPEN' &&
    OWN_SITE.has(d.menu?.provider) &&
    d.contact?.website,
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

const FLOWER_LINK = /(flower|\/bud\b|category=flower|categories\/flower)/i;
const MENU_LINK = /\b(menu|shop|order|browse|products?)\b/i;

/** Walks captured JSON looking for something shaped like a product list. */
const findProductArrays = (value, depth = 0, out = []) => {
  if (depth > 6 || out.length > 40) return out;
  if (Array.isArray(value)) {
    const objects = value.filter((v) => v && typeof v === 'object' && !Array.isArray(v));
    if (objects.length >= 2) {
      const keys = Object.keys(objects[0]);
      const looksLikeProduct =
        keys.some((k) => /^(name|productName|title)$/i.test(k)) &&
        keys.some((k) => /(categor|type|brand|strain|thc|price|variant)/i.test(k));
      if (looksLikeProduct) out.push(objects);
    }
    for (const item of value.slice(0, 20)) findProductArrays(item, depth + 1, out);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) findProductArrays(v, depth + 1, out);
  }
  return out;
};

const flatten = (v) => {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const k of ['value', 'name', 'amount', 'percent', 'label', 'title']) if (k in v) return v[k];
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
const pick = (obj, names) => {
  for (const n of names) if (n in obj) return obj[n];
  return null;
};
const slug = (...parts) =>
  parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);


/**
 * Menus name a product "Brand - Strain - Flower - 3.5g": the size is in the
 * title, not in a variants array, and the same strain appears once per size.
 * Splitting that apart is what turns rows into a shelf a person can read.
 */
const SIZE_RULES = [
  [/\b(\d+(?:\.\d+)?)\s*(?:g|gr|gram|grams)\b/i, (m) => parseFloat(m[1])],
  [/\b1\s*\/\s*8\b|\beighth\b/i, () => 3.5],
  [/\b1\s*\/\s*4\b|\bquarter\b/i, () => 7],
  [/\b1\s*\/\s*2\b|\bhalf\b/i, () => 14],
  [/\b(?:oz|ounce|zip)\b/i, () => 28],
];

const sizeFromText = (text) => {
  for (const [re, take] of SIZE_RULES) {
    const m = text.match(re);
    if (m) {
      const g = take(m);
      if (g > 0 && g <= 30) return g;
    }
  }
  return null;
};

/** Strips the brand, the category word and the size, leaving the strain. */
const cleanStrainName = (raw, brand) => {
  let parts = String(raw).split(/\s+[-–—|]\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 1) parts = [String(raw).trim()];

  const brandLower = String(brand ?? '').toLowerCase().trim();
  parts = parts.filter((part) => {
    const p = part.toLowerCase();
    if (brandLower && p === brandLower) return false;
    if (/^(flower|bud|buds)$/.test(p)) return false;
    if (sizeFromText(part) !== null && /^[\d\s./]*(g|gr|gram|grams|oz|ounce|eighth|quarter|half|zip)?$/i.test(p)) return false;
    return true;
  });

  const name = (parts.join(' - ') || String(raw)).replace(/\s{2,}/g, ' ').trim();
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
};

const isFlower = (p) => {
  const text = [
    flatten(pick(p, ['category', 'productCategory', 'type', 'kind', 'categoryName'])),
    flatten(pick(p, ['subcategory', 'subCategory', 'productSubcategory'])),
  ]
    .map((v) => String(v ?? ''))
    .join(' ')
    .toLowerCase();
  if (!text.trim()) return false;
  if (/pre[\s-]?roll|infused|blunt|joint/.test(text)) return false;
  return /flower|bud/.test(text);
};

const toListing = (p, shop, sourceUrl, rawTerpNames) => {
  const rawName = flatten(pick(p, ['name', 'productName', 'title', 'displayName']));
  if (!rawName) return null;
  const brand = flatten(pick(p, ['brandName', 'brand', 'producer', 'vendor', 'cultivator']));
  const name = cleanStrainName(rawName, brand);
  const lineageRaw = String(
    flatten(pick(p, ['strainType', 'lineage', 'cannabisType', 'classification'])) ?? '',
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
        percent: num(t && typeof t === 'object' ? t.value ?? t.percent : null),
      });
    }
  }

  const sizes = [];
  const variants = pick(p, ['variants', 'weights', 'options', 'sizes', 'priceOptions']);
  if (Array.isArray(variants)) {
    for (const v of variants) {
      const g = num(v?.gramAmount ?? v?.weight ?? v?.size ?? v);
      if (g && g > 0 && g <= 30) sizes.push(g);
    }
  }

  if (!sizes.length) {
    const fromTitle = sizeFromText(String(rawName));
    if (fromTitle) sizes.push(fromTitle);
  }

  const stock = flatten(pick(p, ['inStock', 'available', 'isAvailable', 'quantity']));

  return {
    listingId: slug(String(brand ?? ''), String(name)),
    licenseNumber: shop.licenseNumber,
    capturedAt: NOW,
    strainNameRaw: String(name).slice(0, 200),

    strainNameCanonical: String(name).toLowerCase().replace(/#/g, '').replace(/\s+/g, ' ').trim() || null,
    brand: brand ? String(brand).slice(0, 120) : null,
    lineage: LINEAGE[lineageRaw] ?? 'UNKNOWN',
    thcPercent: num(pick(p, ['thcContent', 'potencyThc', 'thc', 'thcPercent'])),
    cbdPercent: num(pick(p, ['cbdContent', 'potencyCbd', 'cbd', 'cbdPercent'])),
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
  const browser = await chromium.launch();
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

    // Capture what the page asks for; that is the menu the shop publishes.
    page.on('response', async (res) => {
      try {
        const ct = res.headers()['content-type'] ?? '';
        if (!ct.includes('json')) return;
        if (res.request().resourceType() === 'document') return;
        const body = await res.json();
        payloads.push(body);
      } catch {
        /* non-JSON or aborted; nothing to capture */
      }
    });

    const entry = { shop: shop.dbaName ?? shop.legalName, licence: shop.licenseNumber, status: null };
    try {
      await page.goto(site, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500);

      // Prefer a flower category link; fall back to any menu link.
      const href = await page.evaluate(
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

      if (href && (await robotsAllows(href))) {
        await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(4000);
        await page.mouse.wheel(0, 4000);
        await page.waitForTimeout(2500);
      }

      const arrays = payloads.flatMap((p) => findProductArrays(p));
      entry.productArrays = arrays.length;
      entry.productsSeen = arrays.reduce((n, a) => n + a.length, 0);

      if (arrays.length) {
        capturedShapes[shop.menu.provider] ??= Object.keys(arrays[0][0]).slice(0, 40);
      }

      const seen = new Set();
      for (const arr of arrays) {
        for (const product of arr) {
          if (!isFlower(product)) continue;
          const listing = toListing(product, shop, page.url(), rawTerpNames);
          if (listing?.listingId && !seen.has(listing.listingId)) {
            seen.add(listing.listingId);
            listings.push(listing);
          }
        }
      }
      entry.flower = seen.size;
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

  const merged = mergeBySize(listings);
  merged.sort((a, b) =>
    a.licenseNumber === b.licenseNumber
      ? a.strainNameRaw.localeCompare(b.strainNameRaw)
      : a.licenseNumber.localeCompare(b.licenseNumber),
  );

  const summary = {
    shopsVisited: report.filter((r) => r.status !== 'robots-disallowed').length,
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
  writeFileSync(resolve(ROOT, 'data/flower-listings.json'), JSON.stringify(merged, null, 2) + '\n');
  console.log(`\nWrote ${merged.length} listings`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
