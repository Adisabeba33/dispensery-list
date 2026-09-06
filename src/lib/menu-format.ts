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

/**
 * What a shelf reads like as text, for pasting somewhere else.
 *
 * The provenance labels are not decoration. On the page a reference profile is
 * a different colour with a sentence under it; in a paste buffer there is
 * nothing but the words, so each terpene line carries its own. A profile that
 * arrives somewhere else looking like a lab result for that jar would be the
 * one lie this project exists not to tell.
 */
const TERPENE_PROVENANCE: Record<TerpeneSource, string> = {
  LAB_COA: 'lab-tested, this batch',
  MENU_LISTING: 'stated by the shop, no certificate',
  STRAIN_REFERENCE: 'typical for the strain, NOT measured from this batch',
  NONE: '',
};

export const menuAsText = (
  rows: FlowerListing[],
  opts: { shopName: string; sizeGrams: number | null; capturedAt?: string; url?: string },
): string => {
  const { shopName, sizeGrams, capturedAt, url } = opts;
  const heading = sizeGrams === null
    ? `${shopName} — flower`
    : `${shopName} — flower by the ${sizeLabel(sizeGrams).toLowerCase()} (${sizeGrams}g)`;

  const read = capturedAt
    ? ` · read from the shop's own menu on ${new Date(capturedAt).toLocaleDateString('en-US', {
        dateStyle: 'medium',
      })}`
    : '';

  const lines = [heading, `${rows.length} ${rows.length === 1 ? 'strain' : 'strains'}${read}`, ''];

  for (const l of rows) {
    const bits = [l.strainNameRaw];
    if (l.brand) bits.push(l.brand);
    if (l.lineage !== 'UNKNOWN') bits.push(LINEAGE_LABEL[l.lineage] ?? l.lineage);
    if (l.thcPercent !== null) bits.push(`THC ${l.thcPercent}%`);
    const sizes = l.availableSizesGrams ?? [];
    if (sizes.length) bits.push(sizes.map((g) => `${g}g`).join(', '));
    if (!l.inStock) bits.push('sold out');
    lines.push(bits.join(' · '));

    if (l.terpenes.profile.length > 0) {
      const named = l.terpenes.profile
        .map((t) => {
          const name = TERPENE_LABEL[t.name] ?? t.rawName ?? t.name;
          return t.percent === null ? name : `${name} ${t.percent}%`;
        })
        .join(', ');
      lines.push(`    terpenes (${TERPENE_PROVENANCE[l.terpenes.source]}): ${named}`);
    }
  }

  lines.push('');
  lines.push(
    'Shelves move through the day; this is what the shop published when its menu was read.',
  );
  if (url) lines.push(url);
  return lines.join('\n');
};
