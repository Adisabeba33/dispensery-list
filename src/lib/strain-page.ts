import { dispensaries, displayName, regionOf } from './data';
import { brandSummaries, strainGroups } from './shelf';
import { looseKey } from './strain-review';
import {
  provenanceOf,
  rankedTerpenes,
  type Debut,
  type FlowerListing,
  type Provenance,
} from './menu-format';

/**
 * One strain across every shelf we read: its own page.
 *
 * Server-side only, like ./shelf. Everything here is a count or a figure a
 * shop published; nothing is written about the strain that a shelf did not
 * say. That is why the page has no description and no parents: no shelf
 * gives either, and a sentence nobody can check has no place in a register.
 *
 * An index, not a guide to buying (the owner's rule, 18 October 2026): the
 * strain, its growers, how many shelves, and the places — a shop's name and
 * its district. No distance, no "in stock", no link out.
 */
export type StrainPlace = { id: string; name: string; region: string };

/** One grower's jars of the strain: the names it sells it under, its shelves, its THC. */
export type StrainGrower = {
  name: string;
  /** Its brand page, when it has one. */
  key: string | null;
  /** What this grower calls the strain, most-printed first: "GG4", "Gorilla Glue #4". */
  names: string[];
  places: StrainPlace[];
  thcLow: number | null;
  thcHigh: number | null;
};

/** One terpene panel a menu published: a batch, however many shops carry it. */
export type StrainPanel = {
  grower: string | null;
  thcPercent: number | null;
  terpenes: { name: string; rawName: string | null; percent: number | null }[];
  totalPercent: number | null;
  provenance: Provenance;
  shops: number;
};

export type StrainPageData = {
  slug: string;
  name: string;
  /** What most listings call it, and every call made, most first. */
  lineage: string;
  lineages: { lineage: string; listings: number }[];
  debut: Debut | null;
  /** THC as the shops state it: the middle figure and the spread. */
  thc: { median: number; low: number; high: number; listings: number } | null;
  /** Measured, from menus' panels — or, with none, what the strain usually shows. */
  terpenes:
    | { kind: 'MEASURED'; top: string[]; panels: number }
    | { kind: 'REFERENCE'; top: string[]; referenceStrain: string }
    | null;
  growers: StrainGrower[];
  /** Listings no grower is printed for, by place. */
  unattributed: StrainPlace[];
  panels: StrainPanel[];
  /** Every shelf it is on. */
  places: StrainPlace[];
  sizes: number[];
  readAt: string | null;
};

const shopOf = new Map(dispensaries.map((d) => [d.licenseNumber, d]));

const median = (sorted: number[]): number => {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
};

/* A menu's panel, as against the reference profile lib/menu fills in where a
   shop gives none: only the first is a reading of a jar. */
const measured = (l: FlowerListing) =>
  (l.terpenes.source === 'MENU_LISTING' || l.terpenes.source === 'LAB_COA') && l.terpenes.profile.length > 0;

/* One batch at ten shops is one panel, not ten: the menus copy the same
   certificate. A panel with no key is its own listing. */
const batchOf = (l: FlowerListing) => l.labPanelKey ?? l.listingId;

const REGION_ORDER = ['Manhattan', 'Brooklyn', 'Queens', 'The Bronx', 'Staten Island', 'Westchester'];
const regionRank = (r: string) => {
  const at = REGION_ORDER.indexOf(r);
  return at === -1 ? REGION_ORDER.length : at;
};

const build = (slug: string, entry: ReturnType<typeof strainGroups>[number]['entry'], rows: FlowerListing[]): StrainPageData => {
  const brandPages = brandPageKeys();

  const lineageCount = new Map<string, number>();
  for (const l of rows) {
    if (l.lineage && l.lineage !== 'UNKNOWN') lineageCount.set(l.lineage, (lineageCount.get(l.lineage) ?? 0) + 1);
  }
  const lineages = [...lineageCount]
    .map(([lineage, listings]) => ({ lineage, listings }))
    .sort((a, b) => b.listings - a.listings || a.lineage.localeCompare(b.lineage));

  const figures = rows
    .map((l) => l.thcPercent)
    .filter((v): v is number => typeof v === 'number' && v > 0)
    .sort((a, b) => a - b);
  const thc = figures.length
    ? { median: median(figures), low: figures[0], high: figures[figures.length - 1], listings: figures.length }
    : null;

  /* The terpenes that lead most panels, each panel counted once: three shops
     selling one batch do not make its leading terpene three times as typical. */
  const panelRows = new Map<string, FlowerListing[]>();
  for (const l of rows) {
    if (!measured(l)) continue;
    const key = batchOf(l);
    panelRows.set(key, [...(panelRows.get(key) ?? []), l]);
  }
  const leads = new Map<string, { times: number; percents: number[] }>();
  for (const [, batch] of panelRows) {
    for (const t of rankedTerpenes(batch[0].terpenes.profile).slice(0, 3)) {
      const at = leads.get(t.name) ?? { times: 0, percents: [] };
      at.times += 1;
      if (typeof t.percent === 'number') at.percents.push(t.percent);
      leads.set(t.name, at);
    }
  }
  const middle = (p: number[]) => (p.length ? median([...p].sort((a, b) => a - b)) : 0);
  let terpenes: StrainPageData['terpenes'] = null;
  if (leads.size > 0) {
    terpenes = {
      kind: 'MEASURED',
      top: [...leads]
        .sort((a, b) => b[1].times - a[1].times || middle(b[1].percents) - middle(a[1].percents))
        .slice(0, 3)
        .map(([name]) => name),
      panels: panelRows.size,
    };
  } else {
    const ref = rows.find((l) => l.terpenes.source === 'STRAIN_REFERENCE');
    if (ref) {
      terpenes = {
        kind: 'REFERENCE',
        top: rankedTerpenes(ref.terpenes.profile).slice(0, 3).map((t) => t.name),
        referenceStrain: ref.terpenes.referenceStrain ?? entry.name,
      };
    }
  }

  const panels: StrainPanel[] = [...panelRows.values()]
    .map((batch) => {
      const l = batch[0];
      return {
        grower: l.brand,
        thcPercent: l.thcPercent,
        terpenes: rankedTerpenes(l.terpenes.profile).slice(0, 6),
        totalPercent: l.terpenes.totalPercent,
        provenance: provenanceOf(l.terpenes),
        shops: new Set(batch.map((b) => b.licenseNumber)).size,
      };
    })
    .sort((a, b) => b.shops - a.shops || (a.grower ?? '').localeCompare(b.grower ?? ''));

  /* Every shelf, in borough order: the places. */
  const placeOf = (licence: string): StrainPlace => {
    const d = shopOf.get(licence)!;
    return { id: d.id, name: displayName(d), region: regionOf(d) };
  };
  const inOrder = (a: StrainPlace, b: StrainPlace) =>
    regionRank(a.region) - regionRank(b.region) || a.name.localeCompare(b.name);
  const placesOf = (own: FlowerListing[]) =>
    [...new Set(own.map((l) => l.licenseNumber))].map(placeOf).sort(inOrder);

  /* Most-printed first: the name a grower or a strain is known by. */
  const ranked = (values: string[]) => {
    const counted = new Map<string, number>();
    for (const v of values) counted.set(v, (counted.get(v) ?? 0) + 1);
    return [...counted].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([v]) => v);
  };

  /* Growers grouped on the brand key, named as most shops print them, each
     with the names it sells the strain under. */
  const byGrower = new Map<string, FlowerListing[]>();
  for (const l of rows) {
    if (!l.brand) continue;
    const key = l.brandKey ?? l.brand.toLowerCase();
    byGrower.set(key, [...(byGrower.get(key) ?? []), l]);
  }
  const growers: StrainGrower[] = [...byGrower]
    .map(([key, own]) => {
      const thcs = own.map((l) => l.thcPercent).filter((v): v is number => typeof v === 'number' && v > 0);
      /* Its names folded as the index folds them, so "Gorilla Glue #4" and
         "GORILLA GLUE 4" are one name, printed the way it is printed most. */
      const names: string[] = [];
      for (const n of ranked(own.map((l) => l.strainNameCanonical ?? l.strainNameRaw))) {
        if (!names.some((m) => looseKey(m) === looseKey(n))) names.push(n);
      }
      return {
        name: ranked(own.map((l) => l.brand!))[0],
        key: brandPages.has(key) ? key : null,
        names,
        places: placesOf(own),
        thcLow: thcs.length ? Math.min(...thcs) : null,
        thcHigh: thcs.length ? Math.max(...thcs) : null,
      };
    })
    .sort((a, b) => b.places.length - a.places.length || a.name.localeCompare(b.name));

  return {
    slug,
    name: entry.name,
    lineage: lineages[0]?.lineage ?? 'UNKNOWN',
    lineages,
    debut: entry.debut,
    thc,
    terpenes,
    growers,
    unattributed: placesOf(rows.filter((l) => !l.brand)),
    panels,
    places: placesOf(rows),
    sizes: entry.sizes,
    readAt: rows.map((l) => l.capturedAt).sort().at(-1) ?? null,
  };
};

let brandKeys: Set<string> | null = null;
const brandPageKeys = () => (brandKeys ??= new Set(brandSummaries().map((b) => b.key)));

let bySlug: Map<string, ReturnType<typeof strainGroups>[number]> | null = null;
const strainIndex = () => (bySlug ??= new Map(strainGroups().map((g) => [g.slug, g])));

/** Every strain's address, for the pages to build. */
export const strainSlugs = (): string[] => [...strainIndex().keys()];

/** One strain's page, or null for an address no strain has. */
export const strainPage = (slug: string): StrainPageData | null => {
  const g = strainIndex().get(slug);
  return g ? build(slug, g.entry, g.rows) : null;
};
