import territoriesRaw from '../../data/territories.json';

/**
 * The three territories, as the site sees them.
 *
 * This mirrors scripts/ingest/territory.ts, which is the ingest's copy. They
 * read the SAME data/territories.json, so the two cannot disagree about which
 * counties belong where or what is known about opt-outs — only about types.
 * The scripts run under tsx with node resolution; the site is bundled by Next.
 * Sharing a module across that boundary buys less than it costs.
 */
export type OptOutStatus = 'HAND_CHECKED' | 'MAP_INGESTED' | 'NOT_ESTABLISHED';

export type SiteTerritory = {
  id: string;
  label: string;
  dataDir: string;
  route: string;
  counties?: string[];
  excludeCounties?: string[];
  municipalOptOut?: { status: OptOutStatus; file: string | null; note?: string };
  note?: string;
};

export const TERRITORIES = (territoriesRaw as { territories: SiteTerritory[] }).territories;

export const territory = (id: string): SiteTerritory => {
  const found = TERRITORIES.find((t) => t.id === id);
  if (!found) throw new Error(`Unknown territory "${id}"`);
  return found;
};

/**
 * Has anybody established this territory's municipal opt-out status?
 *
 * The one question a page must ask before drawing that field. False means
 * render "not checked" — never "no ban", and never nothing at all. A reader
 * who sees no mention assumes there is nothing to mention, which is the same
 * false claim as printing "no". See docs/FROZEN-municipal-opt-out.md.
 */
export const optOutIsKnown = (t: SiteTerritory): boolean =>
  t.municipalOptOut?.status === 'HAND_CHECKED' || t.municipalOptOut?.status === 'MAP_INGESTED';
