import type { FlowerListing } from './menu-format';

/**
 * A second look at the collector's strain names, with every shop in view.
 *
 * The collector cleans each name as it reads it (scripts/strain-name.mjs), one
 * listing at a time. What it leaves behind is what one listing cannot show:
 * that "Classic Cuts" is Claybourne's product line because it comes before a
 * dozen different cultivars, that "ACAPULCO GOLD" is a menu shouting because
 * other shops write "Acapulco Gold", that "Lofty" in "Lofty - Zombie Kush" is
 * the grower printed on the listing. This reads the whole shelf at once and
 * finishes the job before a page is built.
 *
 * It takes words away and changes their case, and it settles one grower's
 * names against each other — "Crusty Crustacean - Big Flower Pack" is the
 * Crusty Crustacean Find. sells at thirty other shops, "Nothern Lights" the
 * Northern Lights Doobie Labs' other 45 print. It never makes a name up: what
 * a listing ends up called is its own words, or a name the same grower is
 * sold under at another shop. A listing it would leave with no name keeps the
 * one it had. The shop's own wording stays in strainNameRaw.
 *
 * A grower's product lines are not guessed here: they are listed, per brand,
 * in data/strain-lines.json, confirmed by a person. `lineCandidates` finds new
 * ones for that list (scripts/strain-review.ts prints them).
 */

export type LineBook = {
  /** Per brandKey, product lines and grades confirmed as not being cultivars. */
  lines: Record<string, string[]>;
  /** Per brandKey, pieces that look like lines and were checked: they are cultivars. */
  notLines?: Record<string, string[]>;
};

export type Reason =
  | 'capitals'
  | 'packaging'
  | 'product line'
  | 'grower in name'
  | 'stray characters'
  | 'beside the cultivar'
  | 'same strain, other spelling';

export type Reviewed = { name: string; why: Reason[] };

const fold = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
const wordsOf = (s: string) => fold(s).match(/[a-z0-9]+/g) ?? [];
export const nameKey = (s: string) => fold(s).replace(/[^a-z0-9]/g, '');

/* Words that say how flower was grown, graded, packed or weighed, or which way
   it leans. None of them names a cultivar, so a piece of a name made of
   nothing else is packaging. A piece with one other word in it is not: "Flower
   Power", "Whole Lotta Love", "Big Bud" and "Pack Mule" are cultivars. */
const PACKAGING = new Set([
  'flower', 'flowers', 'bud', 'buds', 'smalls', 'small', 'large', 'popcorn', 'shake',
  'premium', 'ultra', 'exotic', 'exotics', 'craft', 'indoor', 'outdoor', 'greenhouse', 'sungrown',
  'grown', 'mixed', 'hydro', 'hydroponic', 'hydroponics', 'assisted', 'living', 'soil',
  'jar', 'jars', 'bag', 'bags', 'bagged', 'pouch', 'packaged', 'prepack', 'prepacked',
  'prepackaged', 'pack', 'packs', 'whole', 'cannabis', 'weed', 'strain', 'item', 'sku',
  'batch', 'mylar', 'tin', 'micro', 'limited', 'edition', 'collection', 'thc', 'cbd', 'tac',
  'eighth', 'quarter', 'half', 'oz', 'ounce', 'g', 'gram', 'grams', 'indica', 'sativa',
  'dime', 'dimes', 'dimebag', 'papers',
  'hybrid', 'dominant', 'dom', 'leaning', 'lean', 'ind', 'hyb', 'sat', 'indhyb', 'sathyb',
  'ih', 'sh', 'idh', 'sdh', 'i', 's', 'h', 'sample', 'samples',
]);
const isMeasure = (w: string) => /^\d+(\.\d+)?(g|gm|gr|th|oz|pk|ct|pc|pcs)?$/.test(w);
/* Packaging written as a phrase whose words are not packaging alone. "Pre",
   "light" and "sun" are not packaging by themselves: Pre-98 Bubba Kush, Bud
   Light Haze and Sun Dog are cultivars. */
const PACKAGING_PHRASE =
  /\bw\/\s*built[- ]in grinder\b|\bx\s*\d+\s*(ct|pk|pack)\b|\bsold in pre[- ]?pack\b|\b\d+\s*x\s*mylar\b|\bpre[- ]?(pack(ed|aged)?|ground|rolls?)\b|\bmixed[- ]light\b|\bsun[- ]?(grown|powered)\b|\b(sun)?light[- ]assist(ed)?\b|\bf[;:]ower\b|\b(big|xl|large|small)\s+flower\s+pack\b/gi;
/* Words no cultivar begins with, so one of them opening a name is enough:
   "Indoor Kosher Kush", "Collection Moonbeam Gelato". */
const NEVER_FIRST = new Set([
  'premium', 'exotic', 'indoor', 'outdoor', 'greenhouse', 'sungrown', 'packaged', 'craft',
  'collection', 'jar', 'bag', 'pouch', 'mylar', 'tin', 'batch', 'prepack', 'prepackaged',
  'sample', 'samples',
]);

export const isPackaging = (piece: string) => {
  if (wordsOf(piece).length === 0) return false;
  return wordsOf(piece.replace(PACKAGING_PHRASE, ' ')).every((x) => PACKAGING.has(x) || isMeasure(x));
};

/** A line compared as a line: its packaging words gone, a plural folded. */
export const lineKey = (s: string) =>
  wordsOf(s).filter((w) => !PACKAGING.has(w)).join('').replace(/s$/, '');

/* A lean or a way of growing trailing the cultivar inside one piece:
   "Ice Cream Cake Indica-Leaning", "Lemon Skunk Indoor". Narrower than
   PACKAGING on purpose: Hawaiian God Bud ends in "Bud". */
const TRAILING = new Set([
  'indica', 'sativa', 'hybrid', 'dominant', 'leaning', 'indoor', 'outdoor',
  'greenhouse', 'sungrown', 'hydroponics',
]);

/* How a menu fences one piece of a name off from the next. A slash only when a
   name is built of them ("FLOWER/ JEALOUSY/ INDICA/ / THC"): one slash is
   "w/" or a cross. */
const fenceOf = (name: string) =>
  name.split('/').length > 2
    ? /\s+[-–—]\s*|\s*[-–—]\s+|\s*[|│¦]\s*|\s*\/\s*/
    : /\s+[-–—]\s*|\s*[-–—]\s+|\s*[|│¦]\s*/;

/* Not asterisks inside a word: "Cr*nch B*rries" and "Cherry Thunder F*ck"
   are how some menus print a name, and the stars are part of it. Only one
   opening a piece goes ("*COCONUT CREAM"). */
const tidy = (s: string) =>
  s
    .replace(/[™®©│¦{}]/g, ' ')
    .replace(/^\s*\*+(?=[A-Za-z])/, '')
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s\-–—|/.,:;]+|[\s\-–—|/,:;]+$|\s+#$/g, '')
    .trim();

export const piecesOf = (name: string) =>
  name.split(fenceOf(name)).map(tidy).filter(Boolean);

/* A grower's name as the register folds it, the company words left out. */
const COMPANY = /\b(cannabis|co|company|farms?|labs?|brands?|nyc?|llc|inc|and|the|of|supply|gardens?|grown|micro|genetics?)\b/g;
const growerCore = (s: string) =>
  fold(s).replace(/[^a-z0-9 ]/g, ' ').replace(COMPANY, ' ').replace(/[^a-z0-9]/g, '');
const initialsOf = (brand: string) => {
  const w = wordsOf(brand).filter((x) => !['cannabis', 'co', 'company', 'llc', 'inc', 'micro'].includes(x));
  return w.length >= 2 ? w.map((x) => x[0]).join('') : '';
};
const isGrower = (piece: string, brand: string | null) => {
  if (!brand) return false;
  const core = growerCore(brand).replace(/s$/, '');
  if (core.length >= 3 && growerCore(piece).replace(/s$/, '') === core) return true;
  // "TTM" for To The Moon, "HOT" for House of Trees — but never an OG or a GG.
  const initials = initialsOf(brand);
  return initials.length >= 2 && !ACRONYM.has(initials) && nameKey(piece) === initials;
};
/* "Hashtag Honey Snowballz": the grower's name run straight into a line. */
const afterGrower = (piece: string, brand: string | null) => {
  if (!brand) return piece;
  const core = growerCore(brand);
  const w = piece.split(/\s+/);
  for (let n = Math.min(5, w.length - 1); n >= 1; n -= 1) {
    if (core.length >= 3 && growerCore(w.slice(0, n).join(' ')) === core) return w.slice(n).join(' ');
  }
  return piece;
};

const linesFor = (book: LineBook, brandKey: string | null | undefined) =>
  new Set((brandKey ? book.lines[brandKey] ?? [] : []).map(lineKey).filter(Boolean));

/** The name one listing should carry, before capitals are settled across shops. */
export const reviewName = (
  written: string,
  brand: string | null,
  brandKey: string | null | undefined,
  book: LineBook,
): Reviewed => {
  const why = new Set<Reason>();
  const lines = linesFor(book, brandKey);
  const isLine = (s: string) => lines.has(lineKey(s)) || lines.has(lineKey(afterGrower(s, brand)));

  /* One shop writes "F(Whole Flower)-Find.-Banana Papaya": its hyphens are
     fences, but only between letters — AK-47 keeps its own. */
  if (/^F\([^)]*\)-/i.test(written)) {
    written = written.replace(/^F\(([^)]*)\)-/i, '$1 - ').replace(/(?<=[A-Za-z.)])-(?=[A-Za-z])/g, ' - ');
  }
  const pieces = piecesOf(written);

  let kept: string[] = [];
  for (const piece of pieces) {
    if (pieces.length > 1) {
      // A lone "X" is a shop's mark, not a cultivar: "X| 5 Boro - BLUE HAWAIIAN |."
      if (nameKey(piece) === 'x' || isPackaging(piece)) { why.add('packaging'); continue; }
      if (isLine(piece)) { why.add('product line'); continue; }
      // The grower, or the grower twice, or the grower and its initials:
      // "Claybourne Claybourne - Purple Chem".
      if (isGrower(piece, brand) || isGrower(afterGrower(piece, brand), brand)) {
        why.add('grower in name');
        continue;
      }
    }
    kept.push(piece);
  }
  // Nothing but lines, growers and packaging: the shop named no cultivar, so
  // keep what it wrote rather than leave the jar without a name.
  if (kept.length === 0) {
    kept = pieces.length ? pieces : [written.trim()];
    why.delete('packaging'); why.delete('product line'); why.delete('grower in name');
  }

  kept = kept.map((piece) => {
    let s = piece;
    // A bracket holding only packaging or a line: "OG (Indoor)", "GMO (Quiet Times)".
    for (;;) {
      const m = s.match(/^(.*\S)\s*\(([^()]*)\)$/);
      if (!m) break;
      if (isPackaging(m[2])) why.add('packaging');
      else if (isLine(m[2])) why.add('product line');
      else break;
      s = m[1].trim();
    }
    // Or opening it: "(Fast Times) Kilimanjaro".
    const opening = s.match(/^\(([^()]*)\)\s*(\S.*)$/);
    if (opening && (isPackaging(opening[1]) || isLine(opening[1]))) {
      why.add(isPackaging(opening[1]) ? 'packaging' : 'product line');
      s = opening[2].trim();
    }
    /* A line of two words or more run onto the cultivar, before it or after:
       "Space Essentials Sunset Sherbert", "Cobra Kush Gold Cuts". Not a line
       of one word: Knack's line is "Black", and Black Cherry Punch is a
       cultivar. */
    const isLongLine = (words: string[]) => {
      const k = lineKey(words.join(' '));
      return k.length >= 4 && lines.has(k);
    };
    const w = s.split(/\s+/);
    for (let n = Math.min(4, w.length - 2); n >= 2; n -= 1) {
      if (isLongLine(w.slice(0, n))) { s = w.slice(n).join(' '); why.add('product line'); break; }
      if (isLongLine(w.slice(-n))) { s = w.slice(0, -n).join(' '); why.add('product line'); break; }
    }
    // Packaging opening the name: "Mixed Light Flower Atomic Breath", "Indoor Kosher Kush".
    // Two words of it, or one no cultivar begins with. Words only, never a
    // number: "Pre-98 Bubba Kush" and "303 Kush" open with theirs.
    const lead = s.split(/\s+/);
    let i = 0;
    for (;;) {
      if (i >= lead.length - 1) break;
      const pair = lead.slice(i, i + 2).join(' ');
      if (i + 2 < lead.length && pair.replace(PACKAGING_PHRASE, '').trim() === '') { i += 2; continue; }
      if (PACKAGING.has(fold(lead[i]).replace(/[^a-z]/g, '')) && /^[A-Za-z-]+$/.test(lead[i])) { i += 1; continue; }
      break;
    }
    const opener = i === 1 && NEVER_FIRST.has(fold(lead[0]).replace(/[^a-z]/g, ''));
    if ((i >= 2 || opener) && !isPackaging(lead.slice(i).join(' '))) {
      s = lead.slice(i).join(' ');
      why.add('packaging');
    }
    /* A shop's shelf code at the end, and the grade word it kept the collector
       from seeing: "Walkabout Flower 6-2", "Lemon Cherry Gleato 1-2 [5]". */
    const coded = s.replace(/(\s+(\[?\d-\d\]?|\[\d{1,2}\]))+\s*$/, '');
    if (coded !== s && coded.trim()) {
      s = coded.replace(/\s+(flower|jar)$/i, '').trim();
      why.add('packaging');
    }
    // A lean, a grow or a weight trailing it: "Ice Cream Cake Indica-Leaning",
    // "Lemon Cherry Gelato Hybrid 1/8". A weight has a unit or a fraction —
    // Gelato 33 and Cookies 95 end in numbers that are theirs.
    const tail = s.split(/(?=[\s-])/);
    const trails = (t: string) =>
      TRAILING.has(fold(t).replace(/[^a-z]/g, '')) ||
      /^\s*(\d\/\d{1,2}(th)?|\d+(\.\d+)?\s?(g|oz)|eighth)\s*$/i.test(t);
    let j = tail.length;
    while (j > 1 && trails(tail[j - 1])) j -= 1;
    if (j < tail.length) { s = tail.slice(0, j).join('').trim(); why.add('packaging'); }
    // What is left wholly in brackets: "Mixed Light Flower (Rancid Fruit/ )".
    const wrapped = s.match(/^\((.+)\)$/);
    if (wrapped) s = tidy(wrapped[1]);
    return s;
  }).filter(Boolean);
  if (kept.length === 0) kept = pieces.length ? pieces : [written.trim()];

  /* Taking a bracket or a grade off a piece can leave a grower, a line or a
     grade standing alone beside the cultivar: "Sour Tangie - (Flower)
     Electraleaf", "Limited Edition World Cup - Dark Rainbow". One more pass,
     keeping at least one piece. */
  if (kept.length > 1) {
    const rest = kept.filter((p) => !(isPackaging(p) || isLine(p) || isGrower(p, brand)));
    if (rest.length > 0 && rest.length < kept.length) {
      for (const p of kept) {
        if (rest.includes(p)) continue;
        why.add(isGrower(p, brand) ? 'grower in name' : isLine(p) ? 'product line' : 'packaging');
      }
      kept = rest;
    }
  }

  const name = kept.join(' - ');
  // What changed with no word taken away: "Animal Face│", "*COCONUT CREAM".
  if (why.size === 0 && name !== written.replace(/\s+/g, ' ').trim()) why.add('stray characters');
  return { name, why: [...why] };
};

/* ---- Capitals ------------------------------------------------------------- */

const shouts = (s: string) => (s.match(/[A-Za-z]/g) ?? []).length >= 3 && s === s.toUpperCase();
const ACRONYM = new Set([
  'og', 'gmo', 'gsc', 'bx', 'gg', 'ak', 'rs', 'la', 'ny', 'nyc', 'sfv', 'uk', 'usa', 'dj',
  'xl', 'xxl', 'ii', 'iii', 'iv', 'vi', 'lcg', 'gdp', 'mac', 'pb', 'ogkb', 'ssh', 'tk',
]);
const calmWord = (t: string) => {
  const low = t.toLowerCase();
  if (low === 'x') return 'x'; // a cross: "Alien Cookies x Honeymoon"
  if (/^\d+(st|nd|rd|th)$/.test(low)) return low;
  if (/\d/.test(t) || ACRONYM.has(low) || (!/[aeiouy]/.test(low) && low.length <= 4)) return t.toUpperCase();
  return t[0].toUpperCase() + t.slice(1).toLowerCase();
};
/** "LAMB'S BREAD" → "Lamb's Bread", "ALIEN OG" → "Alien OG", "8TH AVE" → "8th Ave". */
export const titleCase = (s: string) => s.replace(/[A-Za-z0-9]+(?:'[A-Za-z]+)?/g, calmWord);
const fixAcronyms = (s: string) => s.replace(/\b(Og|Gmo|Gsc|Bx|Lcg|Gdp)\b/g, (w) => w.toUpperCase());

const spellingKey = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * A shouted name, spoken normally: the way other shops write it if any do,
 * else each word capitalised. A short shouted token is left alone — GMO,
 * OGKB and MAC are written that way on purpose.
 */
const calm = (name: string, spellings: Map<string, Map<string, number>>) => {
  if (!shouts(name)) return fixAcronyms(name);
  if (!/\s/.test(name) && (name.match(/[A-Za-z]/g) ?? []).length <= 4) return name;
  const quiet = [...(spellings.get(spellingKey(name)) ?? new Map<string, number>())]
    .filter(([s]) => !shouts(s))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return quiet.length > 0 ? fixAcronyms(quiet[0][0]) : titleCase(name);
};

/* ---- Brands --------------------------------------------------------------- */

const MICRO = /\s*\((micro|microbusiness|micro business)\)\s*$/i;
/** How the grower is printed on the register's own pages: its licence type left off. */
export const brandLabel = (brand: string | null) => (brand ? brand.replace(MICRO, '').trim() || brand : null);

/**
 * One spelling per grower: the one most listings use, shouting losing a tie —
 * the rule the brand pages already follow — so a grower is not "Find." on one
 * card and "FIND" on the next.
 */
const brandSpellings = (rows: FlowerListing[]) => {
  const counted = new Map<string, Map<string, number>>();
  for (const l of rows) {
    const label = brandLabel(l.brand);
    if (!l.brandKey || !label) continue;
    const own = counted.get(l.brandKey) ?? new Map<string, number>();
    own.set(label, (own.get(label) ?? 0) + 1);
    counted.set(l.brandKey, own);
  }
  const chosen = new Map<string, string>();
  for (const [key, own] of counted) {
    const best = [...own].sort(
      (a, b) => b[1] - a[1] || Number(shouts(a[0])) - Number(shouts(b[0])) || a[0].localeCompare(b[0]),
    )[0];
    if (best) chosen.set(key, best[0]);
  }
  return chosen;
};

/* ---- The whole shelf ------------------------------------------------------ */

export type ReviewedListing = { listing: FlowerListing; before: string; after: string; why: Reason[] };

/** Every listing's reviewed name, with what changed and why. */
/* ---- One grower's names, side by side ------------------------------------- */

/* Compared with "&", "and" and "N" read as one word: "Grapes N Cream",
   "Grapes & Cream" and "Grapes and Cream" are one jar three shops typed. */
const sameKey = (s: string) =>
  fold(s).replace(/&/g, ' and ').replace(/\bn\b/g, ' and ').replace(/[^a-z0-9]/g, '');
const wordsKey = (s: string) =>
  fold(s).replace(/&/g, ' and ').replace(/\bn\b/g, ' and ').split(/[^a-z0-9]+/).filter(Boolean).sort().join(' ');
/* A name with its plural, its apostrophes and its doubled letters folded away:
   "Melted Strawberry's" and "Melted Strawberries", "Bottomless Mintz" and
   "Bottomless Mints", "Biscoti" and "Biscotti" read the same. */
export const looseKey = (s: string) =>
  fold(s)
    .replace(/&/g, ' and ')
    .replace(/\bn\b/g, ' and ')
    .replace(/'/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => {
      // Cookies, Cookie; Strawberries, Strawberry, Strawberry's; Candyz, Candy.
      if (w.length > 4 && w.endsWith('ies')) w = `${w.slice(0, -3)}i`;
      else if (w.length > 3 && /[sz]$/.test(w)) w = w.slice(0, -1);
      if (w.length > 3 && w.endsWith('ie')) w = w.slice(0, -1);
      else if (w.length > 3 && w.endsWith('y')) w = `${w.slice(0, -1)}i`;
      return w.replace(/(.)\1+/g, '$1');
    })
    .join('');
/* Where each word of a name begins, counted in its sameKey. */
const wordStarts = (s: string) => {
  const at = new Set<number>();
  let n = 0;
  for (const w of fold(s).replace(/&/g, ' and ').replace(/\bn\b/g, ' and ').split(/[^a-z0-9]+/).filter(Boolean)) {
    at.add(n);
    n += w.length;
  }
  return at;
};
const editDistance = (a: string, b: string) => {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const next = [i];
    for (let j = 1; j <= b.length; j += 1) {
      next[j] = Math.min(prev[j] + 1, next[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = next;
  }
  return prev[b.length];
};

/* A piece that is plainly not a cultivar: packaging, a stray letter or a
   number with a unit, or the grower's own name however it was typed. */
const isNoise = (piece: string, brands: string[]) => {
  if (isPackaging(piece) || /^[a-z]$/i.test(piece.trim()) || /^\d+(\.\d+)?\s?[a-z]{0,3}$/i.test(piece.trim())) return true;
  if (/^(dimes?|dimebag|dime bag|jarred flower|flower\/dime)$/i.test(piece.trim())) return true;
  const pc = growerCore(piece);
  // Every way the grower is printed: "Harney Brothers" and "Harney Brothers Cannabis".
  return brands.some((raw) => {
    const brand = raw.replace(/[™®©]/g, ' ');
    const bc = growerCore(brand);
    if (bc.length >= 4 && pc.length >= 4) {
      if (pc === bc || editDistance(pc, bc) <= 2) return true;
      if (pc.length >= 5 && (bc.includes(pc) || pc.includes(bc))) return true;
    }
    const all = wordsOf(brand).filter((w) => !['co', 'llc', 'inc', 'micro'].includes(w));
    return all.length >= 2 && nameKey(piece) === all.map((w) => w[0]).join('');
  });
};

/**
 * One cultivar a grower sells, written several ways by different shops, is
 * one strain. "Crusty Crustacean - Big Flower Pack" at one shop and "Crusty
 * Crustacean" at thirty-one were two rows of the strain index, as were Doobie
 * Labs' "Northern Lights" at 45 shops and "Nothern Lights" at one. Three rules,
 * each settled by the grower's own names on the shelves, never by a guess:
 *
 *  1. A name in pieces whose one piece is a name the grower sells on its own,
 *     at two shops or more, and whose other pieces it never sells on their
 *     own, is that cultivar: the rest is a pack, an edition or its parents
 *     ("Twin - Zoap X Lazer Gun", "Alien Dawg - Bills NFL Edition"). When two
 *     pieces are both names it sells — Trap to Table's "Purple Sunset - Grape
 *     Gas" — nothing can say which, and the name stays.
 *  2. The same words in another order, or "&" for "and": the order more shops
 *     use ("Paradise Pomelo" over "Pomelo Paradise").
 *  3. A misspelling: the same name once plurals, apostrophes and doubled
 *     letters are set aside, or one letter apart and not the first letter of
 *     a word; the same numbers; the other spelling at twice as many shops or
 *     more — and the misspelling sold by no other grower. That last test is
 *     what keeps 1937's Chemdawg from becoming its ClemDawg: Chemdawg is a
 *     cultivar half the shelf sells.
 */
const settleWithinGrower = (rows: FlowerListing[], first: Reviewed[]) => {
  const byGrower = new Map<string, number[]>();
  rows.forEach((l, i) => {
    if (!l.brandKey) return;
    byGrower.set(l.brandKey, [...(byGrower.get(l.brandKey) ?? []), i]);
  });
  // Who sells each name, across the whole shelf.
  const growersOf = new Map<string, Set<string>>();
  rows.forEach((l, i) => {
    if (!l.brandKey) return;
    const k = sameKey(first[i].name);
    growersOf.set(k, (growersOf.get(k) ?? new Set<string>()).add(l.brandKey));
  });

  const rename = (at: number[], to: string, why: Reason) => {
    for (const i of at) {
      if (first[i].name === to) continue;
      first[i] = { name: to, why: [...new Set([...first[i].why, why])] };
    }
  };

  for (const idx of byGrower.values()) {
    const shopsOf = () => {
      const named = new Map<string, { name: string; shops: Set<string>; at: number[] }>();
      for (const i of idx) {
        const k = sameKey(first[i].name);
        const e = named.get(k) ?? { name: first[i].name, shops: new Set<string>(), at: [] };
        e.shops.add(rows[i].licenseNumber);
        e.at.push(i);
        named.set(k, e);
      }
      return named;
    };

    // 1. A cultivar with something beside it.
    let named = shopsOf();
    for (const e of named.values()) {
      const pieces = e.name.split(/\s+-\s+/);
      if (pieces.length < 2) continue;
      // "Alien Cookies - x Blue Moon - x Honeymoon - Flight Variety Pack" is
      // three cultivars in one pack, not Alien Cookies with a note.
      if (pieces.some((p) => /^(x|\+)\s/i.test(p))) continue;
      const alone = pieces.map((p) => named.get(sameKey(p)));
      let bases = pieces.filter((_, j) => (alone[j]?.shops.size ?? 0) >= 2);
      /* On one shelf only, the cultivar is still the cultivar when what is
         beside it is plainly not one: the grower's own name misspelt ("The
         Botanis", "Stay Me70"), its initials ("HBC"), a pack ("flower/dime"),
         a stray letter. */
      if (bases.length === 0) {
        const once = pieces.filter((_, j) => alone[j]);
        const brands = [...new Set(idx.map((i) => rows[i].brand).filter((b): b is string => Boolean(b)))];
        if (once.length === 1 && pieces.every((p) => p === once[0] || isNoise(p, brands))) bases = once;
      }
      const othersAlone = pieces.filter((p, j) => alone[j] && !bases.includes(p));
      if (bases.length === 1 && othersAlone.length === 0) rename(e.at, named.get(sameKey(bases[0]))!.name, 'beside the cultivar');
    }

    // 2. The same words, another order.
    named = shopsOf();
    const byWords = new Map<string, { name: string; shops: Set<string>; at: number[] }[]>();
    for (const e of named.values()) byWords.set(wordsKey(e.name), [...(byWords.get(wordsKey(e.name)) ?? []), e]);
    for (const group of byWords.values()) {
      if (group.length < 2) continue;
      const sorted = [...group].sort((a, b) => b.shops.size - a.shops.size);
      if (sorted[0].shops.size === sorted[1].shops.size) continue;
      for (const e of sorted.slice(1)) rename(e.at, sorted[0].name, 'same strain, other spelling');
    }

    // 3. A misspelling.
    named = shopsOf();
    const names = [...named.entries()].sort((a, b) => b[1].shops.size - a[1].shops.size);
    for (let m = names.length - 1; m >= 0; m -= 1) {
      const [mk, minor] = names[m];
      if (mk.length < 6) continue;
      for (const [jk, major] of names) {
        if (jk === mk || major.shops.size <= minor.shops.size) continue;
        if (jk.replace(/\D/g, '') !== mk.replace(/\D/g, '')) continue;
        /* "Blue Nerds" and "Blue Nerdz", "Kush Mints" and "Kush Mintz": one name
           with its ending spelled two ways. The grower's majority decides. */
        if (looseKey(major.name) !== looseKey(minor.name)) {
          if (major.shops.size < 2 || major.shops.size < 2 * minor.shops.size) continue;
          if ((growersOf.get(mk)?.size ?? 0) > 1) continue;
          // One letter, and not the first of a word: The Botanist's Billionaire
          // is one letter from its Millionaire, and may well be its own plant.
          if (Math.abs(jk.length - mk.length) > 1 || editDistance(jk, mk) !== 1) continue;
          if (jk.length === mk.length) {
            let i = 0;
            while (jk[i] === mk[i]) i += 1;
            if (wordStarts(major.name).has(i) || wordStarts(minor.name).has(i)) continue;
          }
        }
        rename(minor.at, major.name, 'same strain, other spelling');
        break;
      }
    }
  }
};

/**
 * Packaging or the grower's name run onto a cultivar with no fence:
 * "Flower Gelato 41", "Animal Face Pack", "Binski Flower Jungle Pie". "Flower"
 * opens real names too — Flower Power — so the words go only when what is
 * left is a name the shelves carry at two shops or more. Gelato 41 is; Power
 * is not.
 */
const trimAgainstShelf = (rows: FlowerListing[], first: Reviewed[], book: LineBook) => {
  const shops = new Map<string, Set<string>>();
  rows.forEach((l, i) => {
    const k = sameKey(first[i].name);
    shops.set(k, (shops.get(k) ?? new Set<string>()).add(l.licenseNumber));
  });
  const known = (name: string) => (shops.get(sameKey(name))?.size ?? 0) >= 2;
  rows.forEach((l, i) => {
    const brands = l.brand ? [l.brand] : [];
    const lines = linesFor(book, l.brandKey);
    // Packaging, the grower's name misspelt, or one of its confirmed lines: "Flower BSides Chrome".
    const noiseWord = (w: string) =>
      PACKAGING.has(fold(w).replace(/[^a-z]/g, '')) || (/[a-z]/i.test(w) && isNoise(w, brands)) || lines.has(lineKey(w));
    let changed = false;
    const pieces = first[i].name.split(/\s+-\s+/).map((piece) => {
      const w = piece.split(/\s+/);
      if (w.length < 2) return piece;
      let a = 0;
      while (a < w.length - 1 && noiseWord(w[a])) a += 1;
      let b = w.length;
      while (b > a + 1 && noiseWord(w[b - 1])) b -= 1;
      for (const [x, y] of [[a, b], [a, w.length], [0, b]]) {
        if (x === 0 && y === w.length) continue;
        const rest = w.slice(x, y).join(' ');
        /* Packaging has to be among what goes. The grower's name alone is not
           enough: Runtz Gelato and Lemon Cherry Runtz are cultivars that carry
           their grower's name. */
        const gone = [...w.slice(0, x), ...w.slice(y)];
        if (!gone.some((g) => PACKAGING.has(fold(g).replace(/[^a-z]/g, '')))) continue;
        if (known(rest) && !isPackaging(rest)) {
          changed = true;
          return rest;
        }
      }
      return piece;
    });
    if (changed) first[i] = { name: pieces.join(' - '), why: [...new Set([...first[i].why, 'packaging' as const])] };
  });
};

export const reviewShelf = (rows: FlowerListing[], book: LineBook): ReviewedListing[] => {
  const first = rows.map((l) =>
    reviewName(l.strainNameCanonical ?? l.strainNameRaw, l.brand, l.brandKey, book),
  );
  trimAgainstShelf(rows, first, book);
  settleWithinGrower(rows, first);
  const spellings = new Map<string, Map<string, number>>();
  for (const r of first) {
    const k = spellingKey(r.name);
    const own = spellings.get(k) ?? new Map<string, number>();
    own.set(r.name, (own.get(r.name) ?? 0) + 1);
    spellings.set(k, own);
  }
  return rows.map((l, i) => {
    const after = calm(first[i].name, spellings);
    const why = after !== first[i].name ? [...first[i].why, 'capitals' as const] : first[i].why;
    return { listing: l, before: l.strainNameCanonical ?? l.strainNameRaw, after, why };
  });
};

/**
 * The listings as the site shows them: the reviewed strain in
 * strainNameCanonical, one spelling of the grower in brand. strainNameRaw is
 * left as the shop wrote it.
 */
export const reviewListings = (rows: FlowerListing[], book: LineBook): FlowerListing[] => {
  const brands = brandSpellings(rows);
  return reviewShelf(rows, book).map(({ listing: l, after }) => ({
    ...l,
    strainNameCanonical: after,
    brand: (l.brandKey && brands.get(l.brandKey)) || brandLabel(l.brand),
  }));
};

/* ---- New lines, for a person to confirm --------------------------------- */

export type LineCandidate = { brandKey: string; brand: string; line: string; cultivars: number; examples: string[] };

/**
 * Pieces that behave like a product line: within one grower, a piece written
 * beside at least three different others, and seen with at least twice as many
 * partners as the piece it is paired with. "Gold Cuts" comes with Cobra Kush,
 * Lemon Drop Top and Paradise Pomelo; Cobra Kush comes only with Gold Cuts.
 *
 * This is how lines are found, not how they are removed: the first run of it
 * also named Alien Dawg (a cultivar Mini Mart sells in NFL editions) and
 * Permanent Marker. Only what a person has put in data/strain-lines.json is
 * taken off a name.
 */
export const lineCandidates = (rows: FlowerListing[], book: LineBook): LineCandidate[] => {
  const partners = new Map<string, Map<string, Set<string>>>();
  const groups = new Map<string, string[][]>();
  const shown = new Map<string, Map<string, string>>();
  const examples = new Map<string, string[]>();
  const brands = brandSpellings(rows);
  for (const l of rows) {
    if (!l.brandKey) continue;
    const written = l.strainNameCanonical ?? l.strainNameRaw;
    const pieces = piecesOf(written).filter((p) => !isPackaging(p) && nameKey(p) !== 'x');
    const keys = [...new Set(pieces.map(lineKey).filter(Boolean))];
    if (keys.length < 2) continue;
    const own = partners.get(l.brandKey) ?? new Map<string, Set<string>>();
    const names = shown.get(l.brandKey) ?? new Map<string, string>();
    for (const p of pieces) if (!names.has(lineKey(p))) names.set(lineKey(p), p);
    for (const a of keys) {
      const set = own.get(a) ?? new Set<string>();
      for (const c of keys) if (c !== a) set.add(c);
      own.set(a, set);
      const ex = examples.get(`${l.brandKey}|${a}`) ?? [];
      if (ex.length < 4 && !ex.includes(written)) ex.push(written);
      examples.set(`${l.brandKey}|${a}`, ex);
    }
    partners.set(l.brandKey, own);
    shown.set(l.brandKey, names);
    groups.set(l.brandKey, [...(groups.get(l.brandKey) ?? []), keys]);
  }

  const out: LineCandidate[] = [];
  for (const [brandKey, rowsOfKeys] of groups) {
    const own = partners.get(brandKey)!;
    const decided = new Set(
      [...(book.lines[brandKey] ?? []), ...(book.notLines?.[brandKey] ?? [])].map(lineKey),
    );
    const asLine = new Map<string, number>();
    const asName = new Map<string, number>();
    for (const keys of rowsOfKeys) {
      for (const a of keys) {
        for (const c of keys) {
          if (a === c) continue;
          const pa = own.get(a)?.size ?? 0;
          const pc = own.get(c)?.size ?? 0;
          if (pa >= 3 && pa >= 2 * pc) {
            asLine.set(a, (asLine.get(a) ?? 0) + 1);
            asName.set(c, (asName.get(c) ?? 0) + 1);
          }
        }
      }
    }
    for (const [a, n] of asLine) {
      if (n <= (asName.get(a) ?? 0) || decided.has(a)) continue;
      out.push({
        brandKey,
        brand: brands.get(brandKey) ?? brandKey,
        line: shown.get(brandKey)?.get(a) ?? a,
        cultivars: own.get(a)?.size ?? 0,
        examples: examples.get(`${brandKey}|${a}`) ?? [],
      });
    }
  }
  return out.sort((a, b) => b.cultivars - a.cultivars || a.brand.localeCompare(b.brand));
};
