import type { StrainEntry } from '@/components/ShelfIndex';
import { dispensaries, displayName, regionOf } from './data';
import { listings, sizeChips } from './menu';

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
export const strainEntries = (): StrainEntry[] => {
  const byStrain = new Map<string, StrainEntry>();
  const spellings = new Map<string, Map<string, number>>();

  for (const l of listings) {
    const written = l.strainNameCanonical ?? l.strainNameRaw;
    const key = written.toLowerCase();
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
    if (!entry.shops.some((s) => s.id === shop.id)) {
      entry.shops.push({ id: shop.id, name: displayName(shop), region: regionOf(shop) });
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
