import upstateRaw from '../../data/upstate/dispensaries.json';
import longIslandRaw from '../../data/long-island/dispensaries.json';
import massachusettsRaw from '../../data/massachusetts/dispensaries.json';
import type { Dispensary } from './types';
import { withoutEntityForm } from './format';
import { optOutIsKnown, territory, type SiteTerritory } from './territories';

/**
 * Upstate, Long Island and Massachusetts — the territories collected after the
 * original six counties, and deliberately kept apart from them.
 *
 * Separate on purpose, all the way down: separate files, separate pages, and
 * this separate module rather than a branch inside lib/data.ts. Coverage,
 * opt-out rules and menu-platform mix all differ by region, and NYC's data
 * layer is entitled to keep assuming things that are true only of NYC —
 * boroughs, ZIP scope, a collected shelf. Nothing here touches it.
 *
 * What these two territories have is a registry import and nothing else: no
 * geocodes, no hours, no services, no phone numbers, no menus. The pages are
 * built around that fact instead of around empty versions of NYC's controls,
 * because a filter that can only ever return nothing is worse than no filter.
 */

/**
 * The register's `County` union is the six original counties. Fifty-two more
 * exist upstate, and widening the shared union would let an upstate county
 * through every NYC-only code path that currently cannot receive one.
 */
export type TerritoryShop = Omit<Dispensary, 'address'> & {
  address: Omit<Dispensary['address'], 'county' | 'borough'> & {
    county: string;
    borough: null;
    /** NY or MA. The shared type says NY; Massachusetts is a second state. */
    state: string;
  };
};

const DATA: Record<string, TerritoryShop[]> = {
  upstate: upstateRaw as unknown as TerritoryShop[],
  'long-island': longIslandRaw as unknown as TerritoryShop[],
  massachusetts: massachusettsRaw as unknown as TerritoryShop[],
};

export const shopsIn = (id: string): TerritoryShop[] => DATA[id] ?? [];

export const displayName = (d: TerritoryShop): string => withoutEntityForm(d.dbaName ?? d.legalName);

/** Outside NYC there are no boroughs, so the county IS the region. */
export const regionOf = (d: TerritoryShop): string => d.address.county;

/** Counties present in this territory's data, largest first. */
export const countiesIn = (shops: TerritoryShop[]): { name: string; count: number }[] => {
  const counts = new Map<string, number>();
  for (const d of shops) counts.set(d.address.county, (counts.get(d.address.county) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

export type TerritoryStats = {
  total: number;
  registryVerified: number;
  openedOnFile: number;
  counties: number;
  lastUpdated: string | null;
};

export const statsFor = (shops: TerritoryShop[]): TerritoryStats => {
  const dates = shops.map((d) => d.lastUpdated).filter(Boolean).sort();
  return {
    total: shops.length,
    registryVerified: shops.filter((d) => d.verification.status === 'VERIFIED_OFFICIAL').length,
    // The registry's own retail_date_opened_to_public. It says the doors opened
    // once — not that they are open today, which nobody has checked here.
    openedOnFile: shops.filter((d) => d.dates?.openedOn != null).length,
    counties: new Set(shops.map((d) => d.address.county)).size,
    lastUpdated: dates.length > 0 ? dates[dates.length - 1] : null,
  };
};

export type Gap = { label: string; detail: string };

/**
 * The sentences that depend on which state's law and which state's registry a
 * territory is built from. New York's are the ones these pages always carried;
 * Massachusetts gets its own rather than a borrowed MRTA.
 */
const GAP_COPY: Record<string, { trading: string; contact: string; menus: string; optOut: string }> = {
  NY: {
    trading:
      'A licence is not a shop. Confirming one is open means checking it against the state verification tool, which has not been done for this territory.',
    contact: 'The registry publishes neither for these licences, and no enrichment pass has run.',
    menus:
      'The shelf-reading pass has only been run on New York City and Westchester. Nothing on these shops feeds the strain index yet.',
    optOut:
      'Under the MRTA every city, town and village could ban retail, and roughly a third of them did. We have not established which, so this page does not say. Not checked is not the same as no ban.',
  },
  MA: {
    trading:
      'A licence is not a shop. The Commission’s register records the day operations commenced, not whether the doors are open today, and nobody has checked that here.',
    contact:
      'The Commission’s register publishes neither. Its own store locator gives a phone or website for some shops, matched here by street address; the rest wait for a research pass.',
    menus:
      'The shelf-reading pass has not been run in Massachusetts yet. Nothing on these shops feeds the strain index.',
    optOut:
      'Massachusetts lets every city and town prohibit or limit retail by bylaw or ordinance, and many have. The Commission keeps a zoning tracker for all 351 of them; this register has not read it, so this page does not say. Not checked is not the same as no ban.',
  },
};

/**
 * What this territory does NOT know, counted rather than described.
 *
 * Every line is derived from the records themselves, so the page cannot drift
 * away from the data: enrich the territory and the gap disappears from the
 * page without anybody editing the prose. Saying "some details are missing" is
 * not checkable; saying "0 of 517 have coordinates" is.
 */
export const gapsFor = (
  shops: TerritoryShop[],
  t: SiteTerritory,
  /** Shelves read for this territory, when its page has counted them. */
  shelf: { shops: number; listings: number } | null = null,
): Gap[] => {
  const n = shops.length;
  const gaps: Gap[] = [];
  const copy = GAP_COPY[t.state] ?? GAP_COPY.NY;
  const count = (pred: (d: TerritoryShop) => boolean) => shops.filter(pred).length;

  const trading = count((d) => d.operationalStatus !== 'UNKNOWN');
  if (trading < n) {
    gaps.push({
      label: `Whether a shop is trading today — ${n - trading} of ${n} unconfirmed`,
      detail: copy.trading,
    });
  }

  const geo = count((d) => d.geo != null);
  if (geo < n) {
    gaps.push({
      label: `Coordinates — ${n - geo} of ${n} not geocoded`,
      detail: 'So there is no map here. The addresses are the registry’s own.',
    });
  }

  const hours = count((d) => d.hours != null);
  if (hours < n) {
    gaps.push({
      label: `Opening hours — ${n - hours} of ${n} not collected`,
      detail: 'Phone the shop. Nothing on this page should be read as “they are open now”.',
    });
  }

  const contact = count((d) => d.contact?.phone != null || d.contact?.website != null);
  if (contact < n) {
    gaps.push({
      label: `Phone or website — ${n - contact} of ${n} not collected`,
      detail: copy.contact,
    });
  }

  /* A territory says what it has read. Only one with no shelf file at all
     keeps the sentence that nothing has been. */
  if (shelf && shelf.shops > 0) {
    const opened = count((d) => d.dates?.openedOn != null);
    gaps.push({
      label: `Flower menus — read at ${shelf.shops} of ${opened} opened shops`,
      detail:
        t.state === 'MA'
          ? `${shelf.listings.toLocaleString('en-US')} flower listings, read once, in the city of Boston only — the first stage of this trial. Press “Shelf read” below to see those shops, and open one to see its shelf. They are kept out of the strain index and are not passed to SŌMA, both of which read New York’s shelves alone.`
          : `${shelf.listings.toLocaleString('en-US')} flower listings, read by hand rather than every day: each shop’s page says the day its shelf was read. Press “Shelf read” below to see those shops, and open one to see its shelf. They are kept out of the strain index and are not passed to SŌMA, both of which read the daily shelves of New York City and Westchester alone.`,
    });
  } else {
    gaps.push({
      label: 'Flower menus — none collected',
      detail: copy.menus,
    });
  }

  if (!optOutIsKnown(t)) {
    gaps.push({
      label: 'Municipal opt-out — not checked',
      detail: copy.optOut,
    });
  }

  return gaps;
};

export const territoryPage = (id: string, shelf: { shops: number; listings: number } | null = null) => {
  const t = territory(id);
  const shops = shopsIn(id);
  return { t, shops, stats: statsFor(shops), counties: countiesIn(shops), gaps: gapsFor(shops, t, shelf) };
};
