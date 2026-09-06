import listingsRaw from '../../data/flower-listings.json';
import type { FlowerListing } from './menu-format';

/**
 * Reading the shelves. Server-side only — importing this from a client
 * component ships six megabytes of menu to the browser. Presentation helpers
 * and types live in ./menu-format, which carries no data.
 */
export const listings = listingsRaw as unknown as FlowerListing[];

export const listingsFor = (licenseNumber: string): FlowerListing[] =>
  listings
    .filter((l) => l.licenseNumber === licenseNumber)
    .sort((a, b) => a.strainNameRaw.localeCompare(b.strainNameRaw));

/** How many strains each shop has on a collected shelf, for the whole register. */
export const menuCounts = (): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const l of listings) counts[l.licenseNumber] = (counts[l.licenseNumber] ?? 0) + 1;
  return counts;
};

export * from './menu-format';
