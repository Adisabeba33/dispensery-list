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
 * It only takes words away and changes their case. It never adds a word, and
 * a listing it would leave with no name keeps the one it had. The shop's own
 * wording stays in strainNameRaw.
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

export type Reason = 'capitals' | 'packaging' | 'product line' | 'grower in name' | 'stray characters';

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
  'hybrid', 'dominant', 'dom', 'leaning', 'lean', 'ind', 'hyb', 'sat', 'indhyb', 'sathyb',
  'ih', 'sh', 'idh', 'sdh', 'i', 's', 'h',
]);
const isMeasure = (w: string) => /^\d+(\.\d+)?(g|gm|gr|th|oz|pk|ct|pc|pcs)?$/.test(w);
/* Packaging written as a phrase whose words are not packaging alone. "Pre",
   "light" and "sun" are not packaging by themselves: Pre-98 Bubba Kush, Bud
   Light Haze and Sun Dog are cultivars. */
const PACKAGING_PHRASE =
  /\bw\/\s*built[- ]in grinder\b|\bx\s*\d+\s*(ct|pk|pack)\b|\bsold in pre[- ]?pack\b|\b\d+\s*x\s*mylar\b|\bpre[- ]?(pack(ed|aged)?|ground|rolls?)\b|\bmixed[- ]light\b|\bsun[- ]?(grown|powered)\b|\b(sun)?light[- ]assist(ed)?\b|\bf[;:]ower\b/gi;
/* Words no cultivar begins with, so one of them opening a name is enough:
   "Indoor Kosher Kush", "Collection Moonbeam Gelato". */
const NEVER_FIRST = new Set([
  'premium', 'exotic', 'indoor', 'outdoor', 'greenhouse', 'sungrown', 'packaged', 'craft',
  'collection', 'jar', 'bag', 'pouch', 'mylar', 'tin', 'batch', 'prepack', 'prepackaged',
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
export const reviewShelf = (rows: FlowerListing[], book: LineBook): ReviewedListing[] => {
  const first = rows.map((l) =>
    reviewName(l.strainNameCanonical ?? l.strainNameRaw, l.brand, l.brandKey, book),
  );
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
