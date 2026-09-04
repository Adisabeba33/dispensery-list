import listingsRaw from '../../data/flower-listings.demo.json';

/** Mirrors data/schema/flower-listing.schema.json. */
export type TerpeneSource = 'LAB_COA' | 'MENU_LISTING' | 'STRAIN_REFERENCE' | 'NONE';

export type Terpene = { name: string; rawName: string | null; percent: number | null };

export type FlowerListing = {
  listingId: string;
  licenseNumber: string;
  capturedAt: string;
  strainNameRaw: string;
  strainNameCanonical: string | null;
  brand: string | null;
  lineage: string;
  thcPercent: number | null;
  cbdPercent: number | null;
  terpenes: {
    source: TerpeneSource;
    profile: Terpene[];
    totalPercent: number | null;
    labName: string | null;
    testedOn: string | null;
    coaUrl: string | null;
    referenceStrain: string | null;
  };
  packagedOn: string | null;
  inStock: boolean;
  availableSizesGrams: number[] | null;
};

/**
 * Sample data. No shelf has been read yet — phase 3 collects that — so these
 * menus are illustrative. Strain names are real public genetics; the growers
 * are invented, because attributing stock to a real cultivator would be a
 * claim about a business we have not verified.
 */
export const listings = listingsRaw as unknown as FlowerListing[];
export const menuIsSample = true;

export const listingsFor = (licenseNumber: string): FlowerListing[] =>
  listings
    .filter((l) => l.licenseNumber === licenseNumber)
    .sort((a, b) => a.strainNameRaw.localeCompare(b.strainNameRaw));

/**
 * The flower weights a New York shelf is sold in. Buyers ask for these by name,
 * not by gram count, so both are carried.
 */
export const SIZES: { grams: number; label: string; short: string }[] = [
  { grams: 1, label: 'Gram', short: '1g' },
  { grams: 3.5, label: 'Eighth', short: '3.5g' },
  { grams: 7, label: 'Quarter', short: '7g' },
  { grams: 14, label: 'Half', short: '14g' },
  { grams: 28, label: 'Ounce', short: '28g' },
];

export const sizeLabel = (grams: number): string =>
  SIZES.find((s) => s.grams === grams)?.label ?? `${grams}g`;

export const TERPENE_LABEL: Record<string, string> = {
  MYRCENE: 'Myrcene',
  LIMONENE: 'Limonene',
  CARYOPHYLLENE: 'Caryophyllene',
  PINENE_ALPHA: 'α-Pinene',
  PINENE_BETA: 'β-Pinene',
  LINALOOL: 'Linalool',
  TERPINOLENE: 'Terpinolene',
  HUMULENE: 'Humulene',
  OCIMENE: 'Ocimene',
  BISABOLOL: 'Bisabolol',
  NEROLIDOL: 'Nerolidol',
  VALENCENE: 'Valencene',
  CAMPHENE: 'Camphene',
  EUCALYPTOL: 'Eucalyptol',
  GUAIOL: 'Guaiol',
  FARNESENE: 'Farnesene',
  GERANIOL: 'Geraniol',
  BORNEOL: 'Borneol',
  TERPINEOL: 'Terpineol',
  PHELLANDRENE: 'Phellandrene',
  CARENE: 'Carene',
  SABINENE: 'Sabinene',
  FENCHOL: 'Fenchol',
  OTHER: 'Other',
};

/** What each terpene tends to smell of — the vocabulary a sommelier reads in. */
export const TERPENE_NOTE: Record<string, string> = {
  MYRCENE: 'earth, ripe mango, clove',
  LIMONENE: 'citrus peel, bright',
  CARYOPHYLLENE: 'black pepper, warm spice',
  PINENE_ALPHA: 'pine, forest air',
  PINENE_BETA: 'pine, dill',
  LINALOOL: 'lavender, floral',
  TERPINOLENE: 'apple, fresh herbs',
  HUMULENE: 'hops, dry wood',
  OCIMENE: 'sweet herbs, basil',
  BISABOLOL: 'chamomile, soft',
  NEROLIDOL: 'apple bark, tea tree',
  VALENCENE: 'sweet orange',
  CAMPHENE: 'damp earth, fir',
  EUCALYPTOL: 'eucalyptus, cool',
  GUAIOL: 'pine, rose',
  FARNESENE: 'green apple',
  GERANIOL: 'rose, peach',
  BORNEOL: 'camphor, mint',
  TERPINEOL: 'lilac, clay',
  PHELLANDRENE: 'mint, citrus',
  CARENE: 'cypress, lemon',
  SABINENE: 'pepper, pine',
  FENCHOL: 'basil, lime',
  OTHER: '',
};

export const LINEAGE_LABEL: Record<string, string> = {
  INDICA: 'Indica',
  SATIVA: 'Sativa',
  HYBRID: 'Hybrid',
  INDICA_DOMINANT: 'Indica-leaning',
  SATIVA_DOMINANT: 'Sativa-leaning',
  CBD: 'CBD',
  UNKNOWN: 'Unstated',
};

/**
 * How a terpene profile was arrived at. This is the distinction the whole
 * design turns on: a certificate measures this jar, a reference profile only
 * says what the strain usually does.
 */
export const PROVENANCE: Record<TerpeneSource, { label: string; detail: string; tone: string }> = {
  LAB_COA: {
    label: 'Lab-tested',
    detail: 'Measured from this batch’s certificate of analysis.',
    tone: 'lab',
  },
  MENU_LISTING: {
    label: 'Shop-stated',
    detail: 'Percentages the shop publishes, with no certificate attached.',
    tone: 'listed',
  },
  STRAIN_REFERENCE: {
    label: 'Typical for the strain',
    detail:
      'No lab data for this batch. This is what the strain usually shows — an expectation, not a measurement of what is in the jar.',
    tone: 'reference',
  },
  NONE: { label: 'Not published', detail: 'The shop publishes no terpene data.', tone: 'none' },
};
