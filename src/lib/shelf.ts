import type { StrainEntry } from '@/components/ShelfIndex';
import { dispensaries, displayName, regionOf } from './data';
import { listings, sizeChips } from './menu';
import type { FlowerListing } from './menu-format';

/**
 * The two readings of the same shelves: by strain and by shop.
 *
 * They were one page, and the search — the thing people come for — sat below a
 * grid of 175 shops, half a screen of scrolling from the top. Splitting the
 * page in two leaves both halves needing the same two derivations, so they
 * live here rather than in whichever page was written first.
 *
 * Server-side only: `listings` carries the whole menu.
 */
const shopOf = new Map(dispensaries.map((d) => [d.licenseNumber, d]));

/**
 * One entry per strain, gathering every shop that has it.
 *
 * Keyed with the case folded. Shops SHOUT their menus and the strain read out
 * of a shouted line is shouted too, so BLUE DREAM, Blue Dream and Blue dream
 * were three rows holding three different subsets of the shops that stock one
 * plant — 4, 81 and 1 — and whichever a visitor found was short.
 */
export const strainEntries = (): StrainEntry[] => strainEntriesOf(listings);

/* The same gathering over any set of listings — one brand's, for its page. */
export const strainEntriesOf = (rows: FlowerListing[]): StrainEntry[] => {
  const byStrain = new Map<string, StrainEntry>();
  const spellings = new Map<string, Map<string, number>>();

  for (const l of rows) {
    const written = l.strainNameCanonical ?? l.strainNameRaw;
    /* Case, spaces and punctuation folded away, as the register's own strain
       key does: "B.A.M" and "BAM", "Paw Paw" and "PawPaw" are one strain two
       shops typed differently, and on a brand's page they were two rows. */
    const key = written.toLowerCase().replace(/[^a-z0-9]/g, '') || written.toLowerCase();
    const shop = shopOf.get(l.licenseNumber);
    if (!shop) continue;

    /* Which spelling to print, decided by counting rather than by taking
       whichever listing was read first. */
    const seen = spellings.get(key) ?? new Map<string, number>();
    seen.set(written, (seen.get(written) ?? 0) + 1);
    spellings.set(key, seen);

    let entry = byStrain.get(key);
    if (!entry) {
      entry = {
        key,
        name: written,
        lineage: l.lineage,
        thcPercent: l.thcPercent,
        sizes: [],
        brands: [],
        labels: [],
        hasTerpenes: false,
        shops: [],
      };
      byStrain.set(key, entry);
    }

    entry.sizes = [...new Set([...entry.sizes, ...(l.availableSizesGrams ?? [])])].sort((a, b) => a - b);
    // Shops write the same brand differently — "mini mart" and "Mini MART" —
    // and listing both makes one brand look like two.
    if (l.brand && !entry.brands.some((b) => b.toLowerCase() === l.brand!.toLowerCase())) {
      entry.brands.push(l.brand);
    }
    /* Every way a shop wrote it, so a search for the label on the jar finds
       the strain even when the strain is printed under its plain name. */
    if (!entry.labels.includes(l.strainNameRaw)) entry.labels.push(l.strainNameRaw);
    if (entry.lineage === 'UNKNOWN') entry.lineage = l.lineage;
    // Shops disagree on potency for the same strain; the figure shown is the
    // highest any of them states, and the shop's own page carries its own.
    if (l.thcPercent !== null) entry.thcPercent = Math.max(entry.thcPercent ?? 0, l.thcPercent);
    if (l.terpenes.profile.length > 0) entry.hasTerpenes = true;
    /* Each shop keeps the weights it sells this strain in. The strain's own
       sizes are every shop's together, and a filter to the ounce that reads
       only those lists a shop that has nothing but halves: Crusty Crustacean
       comes in an ounce at eight of its fourteen shops, and the other six
       were listed as if they had it too. */
    const sizes = l.availableSizesGrams ?? [];
    const at = entry.shops.find((s) => s.id === shop.id);
    if (at) {
      at.sizes = [...new Set([...at.sizes, ...sizes])].sort((a, b) => a - b);
    } else {
      entry.shops.push({
        id: shop.id,
        name: displayName(shop),
        region: regionOf(shop),
        sizes: [...new Set(sizes)].sort((a, b) => a - b),
      });
    }
  }

  /* The most-used spelling wins, and SHOUTING loses a tie: with 'Blue Dream'
     and 'BLUE DREAM' equally common, the first is the strain and the second is
     a menu's house style. */
  for (const entry of byStrain.values()) {
    const counted = [...(spellings.get(entry.key) ?? new Map<string, number>())];
    counted.sort((a, b) => {
      const shout = (w: string) => (w === w.toUpperCase() && /[A-Z]/.test(w) ? 1 : 0);
      return b[1] - a[1] || shout(a[0]) - shout(b[0]) || a[0].localeCompare(b[0]);
    });
    if (counted.length > 0) entry.name = counted[0][0];
  }

  return [...byStrain.values()].sort(
    (a, b) => b.shops.length - a.shops.length || a.name.localeCompare(b.name),
  );
};

/** Every shop whose shelf has been read, biggest first. */
export const shelvesRead = () =>
  [...new Set(listings.map((l) => l.licenseNumber))]
    .map((licence) => {
      const shop = shopOf.get(licence);
      const own = listings.filter((l) => l.licenseNumber === licence);
      return {
        shop,
        count: own.length,
        sizes: sizeChips(own.flatMap((l) => l.availableSizesGrams ?? [])),
        /* This shop's own reading, which is not the same as the newest one in
           the file: a shop whose site was down keeps the shelf it last gave
           us, and that shelf can be a week old. */
        readAt: own.map((l) => l.capturedAt).sort().at(-1) ?? null,
      };
    })
    .filter((s) => s.shop)
    .sort((a, b) => b.count - a.count);

/** When the most recent shelf was read. */
export const lastCapturedAt = (): string | undefined =>
  listings
    .map((l) => l.capturedAt)
    .sort()
    .at(-1);

/**
 * How fresh the shelves are, taken together.
 *
 * One date over the whole page would be a promise the data does not make.
 * 146 of 175 shops were read on the newest sweep; the rest carry a reading
 * from a day the collector could not reach them — one of them nine days old.
 * Saying only the newest date would present all 175 as read that afternoon.
 */
/* A shelf counts as read on the newest sweep if it was read within a day of
   the newest reading — not on the same calendar day. A sweep that reads only
   one platform (the slow Dutchie run of 25.09 read 44 shops in the morning)
   used to make the other two hundred, read the afternoon before, all "carry an
   earlier reading", when none of them was a day old. */
const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

export const shelfFreshness = () => {
  const shelves = shelvesRead();
  const latest = lastCapturedAt() ?? null;
  const since = latest ? Date.parse(latest) - FRESH_WINDOW_MS : null;
  const fresh = shelves.filter((s) => since !== null && s.readAt && Date.parse(s.readAt) >= since).length;
  const oldest = shelves
    .map((s) => s.readAt)
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(0) ?? null;
  return { latest, oldest, shops: shelves.length, fresh, stale: shelves.length - fresh };
};

/**
 * Every brand on the collected shelves, and what it has out there today.
 *
 * Grouped on brandKey, which the collector writes beside the brand a shop
 * printed: "Find.", "FIND" and "Find" are one cultivator printed three ways,
 * and a page per spelling would show each a third of what the brand sells.
 * The name shown is the spelling most shops use, SHOUTING losing a tie, as
 * with strains.
 *
 * A listing a shop printed no brand for belongs to no brand here, rather than
 * to one called "unknown".
 */
export type BrandSummary = {
  key: string;
  name: string;
  strains: number;
  shops: number;
  sizes: number[];
};

const shouts = (w: string) => (w === w.toUpperCase() && /[A-Z]/.test(w) ? 1 : 0);

const listingsByBrand = (() => {
  let cache: Map<string, FlowerListing[]> | null = null;
  return () => {
    if (cache) return cache;
    cache = new Map();
    for (const l of listings) {
      const key = l.brandKey;
      if (!key || !shopOf.has(l.licenseNumber)) continue;
      const own = cache.get(key) ?? [];
      own.push(l);
      cache.set(key, own);
    }
    return cache;
  };
})();

const brandName = (rows: FlowerListing[]): string => {
  const counted = new Map<string, number>();
  for (const l of rows) if (l.brand) counted.set(l.brand, (counted.get(l.brand) ?? 0) + 1);
  return (
    [...counted].sort(
      (a, b) => b[1] - a[1] || shouts(a[0]) - shouts(b[0]) || a[0].localeCompare(b[0]),
    )[0]?.[0] ?? ''
  );
};

export const brandSummaries = (): BrandSummary[] =>
  [...listingsByBrand()]
    .map(([key, rows]) => ({
      key,
      name: brandName(rows),
      strains: strainEntriesOf(rows).length,
      shops: new Set(rows.map((l) => l.licenseNumber)).size,
      sizes: [...new Set(rows.flatMap((l) => l.availableSizesGrams ?? []))].sort((a, b) => a - b),
    }))
    .filter((b) => b.name)
    .sort((a, b) => b.shops - a.shops || b.strains - a.strains || a.name.localeCompare(b.name));

/** One brand: its name and every strain of it on a collected shelf. */
export const brandShelf = (key: string) => {
  const rows = listingsByBrand().get(key);
  if (!rows) return null;
  return {
    key,
    name: brandName(rows),
    strains: strainEntriesOf(rows),
    shops: new Set(rows.map((l) => l.licenseNumber)).size,
    readAt: rows.map((l) => l.capturedAt).sort().at(-1) ?? null,
  };
};
