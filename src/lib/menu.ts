import listingsRaw from '../../data/flower-listings.json';
import { isPromotionalSample, type Debut, type FlowerListing } from './menu-format';

/**
 * Reading the shelves. Server-side only — importing this from a client
 * component ships six megabytes of menu to the browser. Presentation helpers
 * and types live in ./menu-format, which carries no data.
 */
import strainReferenceRaw from '../../data/strain-reference.json';
import strainLinesRaw from '../../data/strain-lines.json';
import menuPausedRaw from '../../data/menu-paused.json';
import { reviewListings, type LineBook } from './strain-review';
import shelfSignalsRaw from '../../data/shelf-signals.json';

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

/* Debuts still on a shelf (scripts/shelf-history.py), by every key the history
   keeps the strain under — the collector's brand key and its name as read,
   before the review below renames it. One debut can be written several ways
   ("Orange Elixir", "*Orange Elixir", "X - Orange Elixir"); each is tagged. */
type RawDebut = { key: string; keys?: string[]; first: string; days: number; seenAt: number };
const debuts = new Map<string, Debut>(
  ((shelfSignalsRaw as { debuts?: RawDebut[] }).debuts ?? []).flatMap((d) => {
    const debut: Debut = { day: d.first, days: d.days, seenAt: d.seenAt };
    return (d.keys ?? [d.key]).map((key) => [key, debut] as const);
  }),
);
const historyKey = (l: FlowerListing): string =>
  `${l.brandKey ?? ''}|${(l.strainNameCanonical || l.strainNameRaw || '').trim().toLowerCase().replace(/\s+/g, ' ')}`;
const withDebut = (l: FlowerListing): FlowerListing => {
  const debut = l.brandKey ? debuts.get(historyKey(l)) : undefined;
  return debut ? { ...l, debut } : l;
};

/** The shelves as the collector wrote them, before the review renames
    anything: what the shelf history keys its records on (historyKey). */
export const listingsAsRead = listingsRaw as unknown as FlowerListing[];

/** The shelf history's key for a listing (scripts/shelf-history.py key_of). */
export const historyKeyOf = historyKey;

/* Every page reads the shelves through here, so every page gets the second
   look at their names (./strain-review): shouting calmed, product lines and
   the grower's own name taken off, one spelling per grower. It runs before the
   reference lookup, which then finds "Lemon Cherry Gelato" where the menu said
   "Classic Cuts Indoor Flower - Lemon Cherry Gelato". */
export const listings = reviewListings(
  listingsAsRead.map(withDebut),
  strainLinesRaw as unknown as LineBook,
).map(withReference);

/** Shops the daily run does not read (data/menu-paused.json): their menu is
    not available to us, and no shelf is shown for them rather than an old one. */
const pausedMenus = new Set(
  (menuPausedRaw as { shops: { licenseNumber: string }[] }).shops.map((s) => s.licenseNumber),
);
export const menuPaused = (licenseNumber: string): boolean => pausedMenus.has(licenseNumber);

export const listingsFor = (licenseNumber: string): FlowerListing[] =>
  listings
    .filter((l) => l.licenseNumber === licenseNumber)
    .sort((a, b) => a.strainNameRaw.localeCompare(b.strainNameRaw));

/**
 * How many strains each shop has on its collected shelf, for the whole
 * register. Everything the menu lists counts, sold out or not: the register
 * is an index of what is on the shelves, not of what can be bought today
 * (the owner's rule, 18 October 2026). A shop with no count has no shelf we
 * read — the red lamp.
 */
export const menuCounts = (): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const l of listings) {
    if (!isPromotionalSample(l)) counts[l.licenseNumber] = (counts[l.licenseNumber] ?? 0) + 1;
  }
  return counts;
};

export * from './menu-format';
