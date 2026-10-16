import massachusettsListingsRaw from '../../data/massachusetts/flower-listings.json';
import strainLinesRaw from '../../data/strain-lines.json';
import { reviewListings, type LineBook } from './strain-review';
import { isPromotionalSample, type FlowerListing } from './menu-format';

/**
 * The shelves read outside New York, for the territory pages. Server-side
 * only, like ./menu: a client component importing this ships the whole shelf.
 *
 * Read through the same name review as New York's shelf (./strain-review), so
 * a Boston menu is cleaned the way a Brooklyn one is — but never through New
 * York's strain references. A reference profile is New York's expectation of
 * a name, and a Massachusetts jar under the same name comes from another
 * grower in another state: the name is not evidence (SŌMA's BRAND-TRUST.md).
 * A Boston listing shows what its menu said, and nothing borrowed.
 */
const SHELVES: Record<string, FlowerListing[]> = {
  massachusetts: reviewListings(
    massachusettsListingsRaw as unknown as FlowerListing[],
    strainLinesRaw as unknown as LineBook,
  ),
};

export const hasShelves = (territoryId: string): boolean => (SHELVES[territoryId]?.length ?? 0) > 0;

export const territoryListingsFor = (territoryId: string, licenseNumber: string): FlowerListing[] =>
  (SHELVES[territoryId] ?? [])
    .filter((l) => l.licenseNumber === licenseNumber)
    .sort((a, b) => a.strainNameRaw.localeCompare(b.strainNameRaw));

/** Strains in stock per shop, counted the way New York's cards count them
    (./menu menuCounts): sold-out listings and promotional samples left out. */
export const territoryShelfCounts = (territoryId: string): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const l of SHELVES[territoryId] ?? []) {
    // Every shop with a shelf has a key, even one whose every jar is sold out:
    // its page exists, and its card must still lead there.
    counts[l.licenseNumber] ??= 0;
    if (l.inStock && !isPromotionalSample(l)) counts[l.licenseNumber] += 1;
  }
  return counts;
};

/** When a shop's shelf was read: the latest capture among its listings. */
export const shelfReadAt = (territoryId: string, licenseNumber: string): string | null => {
  const at = territoryListingsFor(territoryId, licenseNumber).map((l) => l.capturedAt).sort();
  return at.length ? at[at.length - 1] : null;
};
