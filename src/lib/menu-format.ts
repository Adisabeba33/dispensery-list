/**
 * Everything about presenting a shelf, and nothing that reads one.
 *
 * The split is load-bearing: data/flower-listings.json is six megabytes, and a
 * client component that imports one label from the same module as that import
 * ships the whole file to the browser. It cost the home page a quarter of a
 * megabyte before anyone noticed.
 */

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
  /** The cultivator the brand names, folded across the ways shops print it. */
  brandKey?: string | null;
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
  /** THC and four or more compounds as one string: equal keys are one batch. */
  labPanelKey?: string | null;
  packageIds?: string[] | null;
  packagedOn: string | null;
  inStock: boolean;
  availableSizesGrams: number[] | null;
  /* What the record itself knows is unsound about it. SHELF_SHARED_WITH_OTHER_LICENCES
     says this menu serves several licensed shops, so the shelf is the chain's
     rather than this branch's. */
  warnings?: string[];
};

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

/**
 * The five sizes above are what a buyer asks for at the counter, but shops do
 * sell flower in others — dime bags at 0.7g, four-gram packs. Rendering only
 * the canonical five left those listings showing no weight at all, which reads
 * as "we don't know" when in fact we do. Anything off the ladder keeps its
 * gram figure and sorts in among the rest.
 */
export const sizeChips = (grams: number[]): { grams: number; label: string; short: string }[] =>
  [...new Set(grams)]
    .sort((a, b) => a - b)
    .map((g) => SIZES.find((s) => s.grams === g) ?? { grams: g, label: `${g}g`, short: `${g}g` });

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
  CARYOPHYLLENE_OXIDE: 'Caryophyllene oxide',
  TERPINENE: 'Terpinene',
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
  CARYOPHYLLENE_OXIDE: 'dry spice, cedar',
  TERPINENE: 'citrus rind, faintly herbal',
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
export type Provenance = TerpeneSource | 'MENU_WITH_CERTIFICATE';

export const PROVENANCE: Record<Provenance, { label: string; detail: string; tone: string }> = {
  LAB_COA: {
    label: 'Lab-tested',
    detail: 'Measured from this batch’s certificate of analysis.',
    tone: 'lab',
  },
  /* Menus copy the percentages off the batch's certificate — Alley Oop's are the
     same, to the hundredth, on five shops and on the Kaycha certificate — and
     some link the certificate itself, which is what separates these two. */
  MENU_WITH_CERTIFICATE: {
    label: 'Certificate linked',
    detail: 'Percentages from the shop’s menu, which links this batch’s certificate of analysis to check them against.',
    tone: 'lab',
  },
  MENU_LISTING: {
    label: 'Shop-stated',
    detail: 'Percentages from the shop’s menu. Menus copy them from the batch’s certificate, but this one links none, so they rest on the shop’s word.',
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

/** Where this reading comes from, told apart by whether the menu links a certificate. */
export const provenanceOf = (terpenes: FlowerListing['terpenes']): Provenance =>
  terpenes.source === 'MENU_LISTING' && certificateUrl(terpenes) ? 'MENU_WITH_CERTIFICATE' : terpenes.source;

/** The certificate link, when the menu gave a web address and not something else. */
export const certificateUrl = (terpenes: FlowerListing['terpenes']): string | null =>
  terpenes.coaUrl && /^https?:\/\//i.test(terpenes.coaUrl) ? terpenes.coaUrl : null;

/**
 * A panel largest first. Menus list their compounds in a fixed order of their
 * own — The Flowery's always opens α-Pinene, Caryophyllene, Myrcene — and taking
 * the first three put those three on 2,178 of 3,901 cards while hiding, say,
 * Garlic Budder's limonene at 0.79%. A compound one menu names twice with two
 * figures is left out rather than picked between; one with no figure is shown
 * only when no compound has one.
 */
export const rankedTerpenes = (profile: Terpene[]): Terpene[] => {
  const seen = new Map<string, Terpene | null>();
  for (const t of profile) {
    if (t.name === 'OTHER') continue;
    const was = seen.get(t.name);
    if (was === undefined) seen.set(t.name, t);
    else if (was && was.percent !== t.percent) seen.set(t.name, null);
  }
  const named = [...seen.values()].filter((t): t is Terpene => t !== null);
  const measured = named.filter((t) => typeof t.percent === 'number' && t.percent > 0);
  return measured.length
    ? measured.sort((a, b) => (b.percent as number) - (a.percent as number))
    : named;
};

/* A promotional sample: "(Sample) Bouket - mylar - Sunkist", which Blue Forest
   Farms sells for one cent. The collector marks it PROMOTIONAL_SAMPLE; the name
   catches shelves read before it did. The shop's page shows it, marked; it is
   never counted as a strain the shop stocks. */
const SAMPLE = /(^|[^a-z])samples?([^a-z]|$)/i;
export const isPromotionalSample = (l: Pick<FlowerListing, 'strainNameRaw' | 'warnings'>): boolean =>
  (l.warnings ?? []).includes('PROMOTIONAL_SAMPLE') || SAMPLE.test(l.strainNameRaw ?? '');

/**
 * The strains on a shelf, one per line, and nothing else.
 *
 * This is for pasting into something that wants a list of names. A header, the
 * shop, the date, brands, weights, potency and terpenes all belong on the page
 * and all get in the way here — everything the reader can already see is noise
 * in a paste buffer.
 *
 * Names repeat when two brands stock the same strain, and a list of strains has
 * no use for the same name twice.
 */
export const strainsAsText = (rows: FlowerListing[]): string => {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const l of rows) {
    if (isPromotionalSample(l)) continue;
    /* The CANONICAL name, not the shop's own words.
     *
     * This is the list somebody copies out of the register and pastes into
     * SŌMA, and a shop writes "Animal Cookies Flower", "Blue Dream - Premium
     * Flower", "Titan Express Small Buds". Pasted raw, those reach the engine
     * as three cultivars nobody has ever heard of — 12.6% of every listing in
     * the register ends in a grade or a category word.
     *
     * The clean name was computed at collection time and has been sitting in
     * the file all along; this was reading past it. */
    const name = (l.strainNameCanonical ?? l.strainNameRaw).trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names.join('\n');
};
