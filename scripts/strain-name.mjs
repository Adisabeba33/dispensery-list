/**
 * What a shelf calls a strain, and what the strain is called.
 *
 * A menu writes "Lead farmer - Flower Bag Pink Zugar" or "#337 - Black Maple
 * Flower" or "BANANA KUSH - THC 28.8%". The strain in each is one or two
 * words; the rest is the grower, the packaging, the shop's own stock number
 * and a lab figure. Counted raw, New York's shelves hold 5771 "strains",
 * which is not a number about cannabis at all.
 *
 * The raw name is never discarded — it is what the shop published, and the
 * shop is the source. This produces the name alongside it, the one two
 * listings can be compared by.
 *
 * The vocabulary below is drawn from the register's own data, not invented:
 * the brands come from the brand field every listing already carries, and the
 * grade and packaging words are the segments that recur across shops.
 */

/* Words that describe how flower is graded, packed or grown. None of them
   name a cultivar; all of them appear alongside one. "Whole" is here because
   "Whole Flower" is a grade — but "Whole Lotta Love" is a strain, which is
   why these are matched as whole segments or as trailing runs, never as a
   substring anywhere in a name. */
const GRADE = [
  'flower', 'flowers', 'bud', 'buds', 'whole bud', 'whole buds', 'whole flower',
  'small bud', 'small buds', 'smalls', 'premium smalls', 'large bud', 'large buds',
  'mixed bud', 'mixed buds', 'mixed light flower', 'popcorn', 'shake',
  'premium', 'premium flower', 'premium cannabis', 'exotic', 'exotic flower',
  'exotics', 'reserve', 'craft', 'top shelf', 'house', 'value',
  'indoor', 'indoor flower', 'outdoor', 'greenhouse', 'sungrown', 'sun grown',
  'sun powered flower', 'mixed light', 'micro grower', 'craft indoor',
  'jar', 'jars', 'flower jar', 'jar flower', 'bag', 'bags', 'flower bag',
  'bag flower', 'dime', 'dime bag', 'pouch', 'packaged', 'ground', 'ground flower',
  'limited edition', 'limited edition premium flower', 'new', 'sale',
  'cannabis', 'weed', 'strain', 'strains', 'smokeable', 'smokable',
  'item', 'sku', 'spray can', 'large', 'small', 'mixed',
];

/* Lineage is carried in its own field; in a name it is a label, not a name. */
const LINEAGE = [
  'indica', 'sativa', 'hybrid', 'indica hybrid', 'sativa hybrid',
  'indica dominant', 'sativa dominant', 'indica-dominant', 'sativa-dominant',
  'ih', 'sh', 'i', 's', 'h',
];

const norm = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
/* Compared with punctuation and spacing folded away, so "Sunset Sherbert",
   "sunset-sherbert" and "SUNSET  SHERBERT" are one key. */
export const strainKey = (s) => norm(s).replace(/[^a-z0-9]/g, '');

/* Grade words that no cultivar has ever begun with. Everything else in GRADE
   is ambiguous at the start of a name and needs company before it is taken
   for packaging. */
const NEVER_A_NAME = new Set([
  'premium', 'exotic', 'exotics', 'indoor', 'outdoor', 'greenhouse', 'sungrown',
  'sun grown', 'packaged', 'reserve', 'craft', 'cannabis', 'limited edition',
].map(norm));

const GRADE_SET = new Set(GRADE.map(norm));
const LINEAGE_SET = new Set(LINEAGE.map(norm));

/** A segment that is only a weight, a percentage, or a stock number. */
const isMeasure = (seg) =>
  /^[\d.\s/]*(g|gr|gram|grams|oz|ounce|eighth|quarter|half|zip)?$/i.test(seg) ||
  /^#?\s*\d{1,5}\s*[a-z]{0,3}$/i.test(seg) ||
  /^(thc|cbd)\b/i.test(seg) ||
  /^\d{1,2}(\.\d+)?\s*%/.test(seg);

/** Noise that clings inside a segment rather than forming one. */
const stripInline = (seg) =>
  seg
    .replace(/\bthc[:\s]*\d{1,2}(\.\d+)?\s*%?/gi, ' ')
    .replace(/\b\d{1,2}(\.\d+)?\s*%\s*(thc|cbd)?/gi, ' ')
    .replace(/\b[\d.]+\s*(g|gr|grams?)\b/gi, ' ')
    .replace(/(?:\d\s*\/\s*\d\s*)?(?<![a-z])(?:oz|ounce)\b/gi, ' ')
    .replace(/\((\s*|ih|sh|i|s|h|indica|sativa|hybrid)\)/gi, ' ')
    .replace(/\(\s*[\d.\s/]*\s*\)/g, ' ')
    .replace(/^#?\s*\d{2,5}\s*[a-z]{0,3}\s+(?=[a-z])/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

/**
 * The strain a listing is about.
 *
 * `brands` is every brand name the register holds, so a grower's name is
 * recognised wherever a shop puts it. A brand segment is only dropped while
 * something else survives: Runtz and Dank are brands AND cultivars, and a
 * listing called nothing but "Runtz" is about the cultivar.
 */
export const canonicalStrain = (raw, brand = null, brands = new Set()) => {
  const text = stripInline(String(raw ?? ''));
  if (!text) return null;

  const brandKeys = new Set([...brands].map(strainKey).filter((k) => k.length >= 3));
  if (brand) brandKeys.add(strainKey(brand));

  const segments = text
    .split(/\s+[-–—|]\s+|\s*\|\s*|\s*·\s*/)
    .map((s) => stripInline(s.replace(/^[\s\-–—|.,]+|[\s\-–—|.,]+$/g, '')))
    .filter(Boolean);

  const isNoiseWord = (w) => GRADE_SET.has(w) || LINEAGE_SET.has(w) || isMeasure(w);

  const classify = (seg) => {
    const n = norm(seg);
    if (!n) return 'empty';
    if (GRADE_SET.has(n)) return 'grade';
    if (LINEAGE_SET.has(n)) return 'lineage';
    if (isMeasure(n)) return 'measure';
    if (brandKeys.has(strainKey(n))) return 'brand';
    /* "Flower #284ZZ" is a grade word and a stock number and nothing else. A
       segment made entirely of such words names no cultivar. */
    const words = n.split(' ');
    if (words.length > 1 && words.every(isNoiseWord)) return 'grade';
    return 'name';
  };

  /* Grade words that OPEN a segment: "Flower Bag Pink Zugar", "Indoor Kosher
     Kush", "Premium Indoor Cannabis Flower Sherb Cake".

     Two kinds, and the difference matters. "Indoor" and "Premium" describe
     how flower was grown or sold and are never the first word of a cultivar,
     so one is enough to strip. "Flower", "Whole" and "Small" are packaging
     words that also open real names — Flower Power, Whole Lotta Love — so
     they are only stripped where two or more run together. */
  const stripLeadingNoise = (seg) => {
    const words = seg.split(/\s+/);
    let i = 0;
    while (i < words.length - 1 && isNoiseWord(norm(words[i]))) i += 1;
    if (i === 0) return seg;
    if (i >= 2) return words.slice(i).join(' ');
    return NEVER_A_NAME.has(norm(words[0])) ? words.slice(1).join(' ') : seg;
  };

  /* A grower's name is not always fenced off by a dash: "Dank Agent Orange
     Flower", "GRASSROOTS GIGGIN GRAPES #7". Stripped only where two or more
     words survive it, because "Runtz Cake" is a cultivar and losing "Runtz"
     from it would leave "Cake". */
  const stripLeadingBrand = (seg) => {
    const words = seg.split(/\s+/);
    for (let n = Math.min(4, words.length - 2); n >= 1; n -= 1) {
      if (brandKeys.has(strainKey(words.slice(0, n).join(' ')))) {
        return words.slice(n).join(' ');
      }
    }
    return seg;
  };

  const kinds = segments.map(classify);
  let kept = segments
    .filter((_, i) => kinds[i] === 'name')
    .map((s) => stripLeadingNoise(stripLeadingBrand(s)));

  /* Nothing but grower and packaging: the shop told us no cultivar, so take
     what it did say rather than invent one. */
  if (kept.length === 0) {
    kept = segments.filter((_, i) => kinds[i] === 'brand');
    if (kept.length === 0) return null;
  }

  /* Grade words trailing inside the surviving segment — "Black Maple Flower",
     "Snow Day Small Bud" — go too, longest phrase first, and only from the
     end, so "Flower Power" keeps its head. */
  const TRAIL = [...GRADE, ...LINEAGE].sort((a, b) => b.length - a.length);
  let name = kept.join(' - ');
  let changed = true;
  while (changed) {
    changed = false;
    for (const word of TRAIL) {
      const re = new RegExp(`[\\s\\-–—(,]+${word.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s*\\)?$`, 'i');
      if (re.test(name) && norm(name.replace(re, '')).length >= 3) {
        name = name.replace(re, '').trim();
        changed = true;
      }
    }
  }

  name = name.replace(/^[\s\-–—|.,]+|[\s\-–—|.,]+$/g, '').replace(/\s{2,}/g, ' ').trim();
  return name || null;
};
