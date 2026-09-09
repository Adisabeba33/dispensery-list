// Brand identity for the register.
//
// The listing schema has carried `strainNameRaw` + `strainNameCanonical` since
// the start, because a menu spells a cultivar six ways and a reader needs one
// answer. `brand` never got the same treatment, and it has the same problem
// worse: across 6,998 listings the same company appears as "Electraleaf",
// "ElectraLeaf", "ELECTRALEAF" and "Electra Leaf"; "Boukét" and "Bouket" split
// one catalogue into two.
//
// This script derives the canonical form and writes data/brands.json. Two
// tiers, deliberately:
//
//   AUTO   — folded mechanically: case, diacritics, punctuation, spacing. A
//            machine can prove these are the same string, so it does.
//   REVIEW — one edit apart but NOT the same string: "Dolla Treez" vs "Dollar
//            Treez", "Claybourne Co." vs "Clayborne Co.". These are reported
//            and left SEPARATE. Folding them is a judgement about who a company
//            is, and this repo's first rule is that an empty field beats a
//            plausible guess. A human confirms them into `manualAliases`.
//
// Run: npx tsx scripts/build-brands.ts [--write]

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const LISTINGS = resolve(ROOT, 'data/flower-listings.json');
const OUT = resolve(ROOT, 'data/brands.json');

// Fold case, diacritics, punctuation and spacing — and nothing else.
export const brandKey = (raw: string): string =>
  raw
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

// Resolve a raw brand string to its canonical id, honouring any merges a human
// has confirmed. This is the function every consumer should use — brandKey
// alone cannot know that "Dolla Treez" and "Dollar Treez" are one company,
// because that is a fact about the world and not about the string.
export const resolveBrand = (
  raw: string,
  manualAliases: Record<string, string> = {},
): string => {
  const key = brandKey(raw);
  return manualAliases[key] ?? key;
};

// Levenshtein, bailing out early — only used to FLAG near misses, never to fold.
const editDistance = (a: string, b: string): number => {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev.splice(0, prev.length, ...curr);
  }
  return prev[b.length];
};

// The display name for a group: the spelling that reads as a name rather than
// as a shout. Prefer mixed case over ALL CAPS or all-lower, then the longest
// (so "Electra Leaf" beats "Electraleaf" only if it is genuinely more common —
// hence the count tiebreak), then alphabetical so the output is stable.
const pickDisplay = (spellings: Map<string, number>): string => {
  const score = (s: string) => {
    const hasLower = /[a-z]/.test(s);
    const hasUpper = /[A-Z]/.test(s);
    return hasLower && hasUpper ? 2 : hasLower ? 1 : 0;
  };
  return [...spellings.entries()].sort(
    (a, b) =>
      score(b[0]) - score(a[0]) ||
      b[1] - a[1] ||
      a[0].localeCompare(b[0]),
  )[0][0];
};

interface Brand {
  brandId: string;
  displayName: string;
  spellings: string[];
  listings: number;
  licences: number;
  strains: number;
}

interface BrandsFile {
  note: string;
  // Merges a human has confirmed: alias brandId -> canonical brandId. Written
  // BY HAND and preserved across regeneration — the script must never decide
  // one of these for itself, and must never drop one.
  manualAliases: Record<string, string>;
  brands: Brand[];
  reviewNeeded: Array<{ a: string; b: string; decided: boolean }>;
}

const readExisting = (): BrandsFile | null => {
  try {
    return JSON.parse(readFileSync(OUT, 'utf8')) as BrandsFile;
  } catch {
    return null;
  }
};

const main = () => {
  const existing = readExisting();
  const manualAliases = existing?.manualAliases ?? {};
  const listings = JSON.parse(readFileSync(LISTINGS, 'utf8')) as Array<{
    brand: string | null;
    licenseNumber: string;
    strainNameRaw: string;
  }>;

  const groups = new Map<
    string,
    { spellings: Map<string, number>; licences: Set<string>; strains: Set<string>; listings: number }
  >();
  let withoutBrand = 0;

  for (const l of listings) {
    if (!l.brand || !l.brand.trim()) {
      withoutBrand++;
      continue;
    }
    const key = resolveBrand(l.brand, manualAliases);
    if (!key) {
      withoutBrand++;
      continue;
    }
    if (!groups.has(key)) {
      groups.set(key, { spellings: new Map(), licences: new Set(), strains: new Set(), listings: 0 });
    }
    const g = groups.get(key)!;
    const spelling = l.brand.trim();
    g.spellings.set(spelling, (g.spellings.get(spelling) ?? 0) + 1);
    g.licences.add(l.licenseNumber);
    g.listings++;
    const strain = (l.strainNameRaw ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (strain) g.strains.add(strain);
  }

  const brands: Brand[] = [...groups.entries()]
    .map(([key, g]) => ({
      brandId: key,
      displayName: pickDisplay(g.spellings),
      spellings: [...g.spellings.keys()].sort(),
      listings: g.listings,
      licences: g.licences.size,
      strains: g.strains.size,
    }))
    .sort((a, b) => b.strains - a.strains || a.brandId.localeCompare(b.brandId));

  // Near misses — reported, never folded.
  const keys = brands.map((b) => b.brandId);
  const review: Array<[string, string]> = [];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      if (keys[i].length < 5 || keys[j].length < 5) continue;
      if (editDistance(keys[i], keys[j]) <= 1) {
        review.push([
          brands.find((b) => b.brandId === keys[i])!.displayName,
          brands.find((b) => b.brandId === keys[j])!.displayName,
        ]);
      }
    }
  }

  // A manual alias that no longer matches anything is worse than useless — it
  // silently stops merging what someone decided should merge.
  const liveKeys = new Set(brands.map((b) => b.brandId));
  for (const [alias, canonical] of Object.entries(manualAliases)) {
    if (!liveKeys.has(canonical)) {
      console.log(`WARN manualAliases: "${alias}" points at "${canonical}", which is not a brand in the data`);
    }
  }

  const spellingCount = new Set(
    listings.map((l) => l.brand?.trim()).filter((b): b is string => !!b),
  ).size;

  console.log(`listings                 ${listings.length}`);
  console.log(`  without a brand        ${withoutBrand}`);
  console.log(`distinct spellings       ${spellingCount}`);
  console.log(`canonical brands         ${brands.length}`);
  console.log(`  folded by this pass    ${spellingCount - brands.length}`);
  console.log(`near misses for review   ${review.length}`);
  for (const [a, b] of review) console.log(`    ${a}  ~  ${b}`);

  if (process.argv.includes('--write')) {
    writeFileSync(
      OUT,
      `${JSON.stringify(
        {
          note:
            'Generated by scripts/build-brands.ts. Spellings are folded on case, diacritics, punctuation and spacing only. Near misses that are genuinely different strings are listed in reviewNeeded and are NOT merged — folding them is a judgement about who a company is, and an empty field beats a plausible guess. Confirm a merge by adding it to manualAliases by hand; regeneration preserves it.',
          manualAliases,
          brands,
          reviewNeeded: review.map(([a, b]) => ({
            a,
            b,
            decided:
              !!manualAliases[brandKey(a)] || !!manualAliases[brandKey(b)],
          })),
        },
        null,
        2,
      )}\n`,
    );
    console.log(`\nwrote ${OUT}`);
  } else {
    console.log('\n(dry run — pass --write to update data/brands.json)');
  }
};

// Only run when invoked directly — validate-data.ts imports brandKey from here
// and must not trigger a rebuild as a side effect of that import.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
