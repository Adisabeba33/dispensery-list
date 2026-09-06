import listingsRaw from '../../data/flower-listings.json';
import type { FlowerListing } from './menu-format';

/**
 * Reading the shelves. Server-side only — importing this from a client
 * component ships six megabytes of menu to the browser. Presentation helpers
 * and types live in ./menu-format, which carries no data.
 */
import strainReferenceRaw from '../../data/strain-reference.json';

type StrainReference = {
  canonicalName: string;
  aliases: string[];
  profile: { name: string; medianPercent: number | null }[];
  basis: { kind: string; sampleCount: number | null };
  confidence: string;
};

const references = strainReferenceRaw as unknown as StrainReference[];

/** Every name a reference answers to, canonical and alias alike. */
const referenceByName = new Map<string, StrainReference>();
for (const ref of references) {
  for (const name of [ref.canonicalName, ...(ref.aliases ?? [])]) {
    const key = name.toLowerCase().replace(/#/g, '').replace(/\s+/g, ' ').trim();
    if (key && !referenceByName.has(key)) referenceByName.set(key, ref);
  }
}

/**
 * Where a shop publishes no terpenes, what the strain usually shows.
 *
 * This is the fallback agreed at the outset: measured figures where a shop
 * gives them, a reference profile where it does not, and the two never
 * confused. A reference is an expectation about a strain, not a measurement of
 * the jar on the shelf, so it arrives labelled STRAIN_REFERENCE — which the
 * menu already draws differently and explains in as many words.
 *
 * It never overwrites anything: a listing that carries its own numbers keeps
 * them, whatever the reference says.
 */
const withReference = (l: FlowerListing): FlowerListing => {
  if (l.terpenes.profile.length > 0) return l;
  const key = (l.strainNameCanonical ?? l.strainNameRaw).toLowerCase().replace(/#/g, '').replace(/\s+/g, ' ').trim();
  const ref = referenceByName.get(key);
  if (!ref) return l;

  const profile = ref.profile
    .filter((t) => t.medianPercent !== null)
    .map((t) => ({ name: t.name, rawName: null, percent: t.medianPercent }));
  if (profile.length === 0) return l;

  return {
    ...l,
    terpenes: {
      ...l.terpenes,
      source: 'STRAIN_REFERENCE',
      profile,
      referenceStrain: ref.canonicalName,
    },
  };
};

export const listings = (listingsRaw as unknown as FlowerListing[]).map(withReference);

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
