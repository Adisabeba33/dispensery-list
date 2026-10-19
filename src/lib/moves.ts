import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { historyKeyOf, listings, listingsAsRead } from './menu';
import { brandSummaries, strainGroups } from './shelf';
import { shelfSignals, type Shop } from './signals';
import strainLinesRaw from '../../data/strain-lines.json';
import { reviewListings, titleCase, type LineBook } from './strain-review';
import type { Debut, FlowerListing } from './menu-format';

/**
 * New & leaving, as pages: an overview of six lists and a page for each.
 *
 * Server-side only. The lists are scripts/shelf-history.py's, as written
 * into data/shelf-signals.json by the daily run; nothing here recounts them.
 * What is added is what the site already knows: which type the shops call a
 * strain (from today's shelves), its strain and brand pages, and, for a wave,
 * how many shelves it had reached on each day we read (from the history the
 * same run writes). The daily run itself is not touched.
 */
export const MOVE_KINDS = ['debuts', 'waves', 'batches', 'new', 'low', 'gone'] as const;
export type MoveKind = (typeof MOVE_KINDS)[number];

export type Lineage = 'indica' | 'sativa' | 'hybrid';
export const LINEAGES: Lineage[] = ['indica', 'sativa', 'hybrid'];

export type MoveItem = {
  id: string;
  strain: string;
  brand: string | null;
  /** The grower's brand page, when it has one. */
  brandKey: string | null;
  /** The strain's page, when it has one (three shelves or more). */
  slug: string | null;
  /** What most shops call it today; null when no shelf says, or it is on none. */
  lineage: Lineage | null;
  /** The day this list dates it by: first seen, the new figure, the peak, the last day. */
  day: string;
  shops: Shop[];
  debut: Debut | null;
  /** Waves and new arrivals: shelves reached this week, shops it is on now, confirmed today. */
  shelves?: number;
  now?: number;
  today?: number;
  /** Waves: shelves reached by each day we read this week. */
  series?: number[];
  /** Debuts: shops that have had it since its first day. */
  seenAt?: number;
  /** New batches: the new figure and the ones before it. */
  thc?: number;
  before?: number[];
  /** Running low and gone: the most shops it was on in the window. */
  peak?: number;
};

export type MoveCard = {
  kind: MoveKind;
  /** Items per type; null where the type cannot be known (a strain gone from every shelf). */
  count: Record<'all' | Lineage, number | null>;
  /** Items per day the list dates them by, per type; null for a list with no such day. */
  bars: Record<'all' | Lineage, number[]> | null;
  barDays: string[];
};

const raw = shelfSignals();

const iso = (d: Date) => d.toISOString().slice(0, 10);
const back = (day: string, days: number) => iso(new Date(Date.parse(`${day}T12:00:00Z`) - days * 86_400_000));

/* The windows scripts/shelf-history.py moves() uses: the last newDays days for
   what arrived, the last movesDays for what is leaving. */
export const windows = () => ({
  day: raw.day,
  newFrom: back(raw.day, raw.rules.newDays - 1),
  leavingFrom: back(raw.day, raw.rules.movesDays - 1),
  rules: raw.rules,
});

/* The history file is read once, at build, and only for its read days and
   arrivals: seven megabytes the browser never sees. */
type History = {
  sweeps: string[];
  arrivals: { key: string; licence: string; seen: string; shelf: string }[];
};
let history: History | null = null;
const historyFile = (): History =>
  (history ??= JSON.parse(readFileSync(join(process.cwd(), 'data/shelf-history.json'), 'utf8')) as History);

const bucket = (lineage: string): Lineage | null =>
  lineage === 'INDICA' || lineage === 'INDICA_DOMINANT'
    ? 'indica'
    : lineage === 'SATIVA' || lineage === 'SATIVA_DOMINANT'
      ? 'sativa'
      : lineage === 'HYBRID'
        ? 'hybrid'
        : null;

const mostOf = <T extends string>(values: T[]): T | null => {
  const counted = new Map<T, number>();
  for (const v of values) counted.set(v, (counted.get(v) ?? 0) + 1);
  return [...counted].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
};

const fold = (s: string | null | undefined) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/* Today's shelves, by the history's key: the type the shops give, the name the
   review settled on, the strain's page. Built once. */
type Known = { lineage: Lineage | null; name: string | null; slug: string | null };
let known: {
  byKey: Map<string, Known>;
  keyByName: Map<string, string>;
  brandKeyByName: Map<string, string>;
} | null = null;
const shelvesByKey = () => {
  if (known) return known;
  const reviewed = new Map(listings.map((l) => [l.listingId, l]));
  const slugOf = new Map<string, string>();
  for (const g of strainGroups()) for (const r of g.rows) slugOf.set(r.listingId, g.slug);

  const rows = new Map<string, FlowerListing[]>();
  const namesToKey = new Map<string, string[]>();
  /* A grower as the signals print it, to its brand key: a strain gone from
     every shelf still has a grower whose other strains are on one. */
  const brandKeys = new Map<string, string[]>();
  for (const l of listingsAsRead) {
    if (l.brand && l.brandKey) brandKeys.set(fold(l.brand), [...(brandKeys.get(fold(l.brand)) ?? []), l.brandKey]);
    const key = historyKeyOf(l);
    rows.set(key, [...(rows.get(key) ?? []), l]);
    /* The signals print a strain as "brand, name" in the shop's own words;
       the lists that carry no key are found by those words. */
    const named = `${fold(l.brand)}|${fold(l.strainNameCanonical ?? l.strainNameRaw)}`;
    namesToKey.set(named, [...(namesToKey.get(named) ?? []), key]);
  }
  const byKey = new Map<string, Known>();
  for (const [key, own] of rows) {
    byKey.set(key, {
      lineage: mostOf(own.map((l) => bucket(l.lineage)).filter((b): b is Lineage => b !== null)),
      name: mostOf(
        own
          .map((l) => reviewed.get(l.listingId))
          .map((r) => (r ? (r.strainNameCanonical ?? r.strainNameRaw) : null))
          .filter((n): n is string => Boolean(n)),
      ),
      slug: mostOf(own.map((l) => slugOf.get(l.listingId)).filter((s): s is string => Boolean(s))),
    });
  }
  const keyByName = new Map([...namesToKey].map(([n, keys]) => [n, mostOf(keys)!]));
  const brandKeyByName = new Map([...brandKeys].map(([n, keys]) => [n, mostOf(keys)!]));
  known = { byKey, keyByName, brandKeyByName };
  return known;
};

let brandNames: Map<string, string> | null = null;
const brandPages = () => (brandNames ??= new Map(brandSummaries().map((b) => [b.key, b.name])));

const shouted = (s: string) => s === s.toUpperCase() && /[A-Z]/.test(s);

/* A strain on no shelf today — gone, or renamed since — still gets the
   review its listings got: the grower's product lines off ("Fast Times
   JACK'S SHADOW" is Miss Grass's Jack's Shadow), shouting calmed. */
const reviewed = new Map<string, string>();
const reviewName = (brand: string | null, brandKey: string | null, strain: string): string => {
  const id = `${brandKey}|${brand}|${strain}`;
  let name = reviewed.get(id);
  if (name === undefined) {
    const row = {
      listingId: id,
      licenseNumber: '',
      strainNameRaw: strain,
      strainNameCanonical: strain,
      brand,
      brandKey,
    } as unknown as FlowerListing;
    name = reviewListings([row], strainLinesRaw as unknown as LineBook)[0]?.strainNameCanonical || strain;
    reviewed.set(id, name);
  }
  return name;
};

/* One record of the signals, with what the site knows about it. A record that
   carries its history key is joined on it; the rest on the brand and name the
   signals print. */
const enrich = (r: { brand: string | null; strain: string; key?: string; keys?: string[] }) => {
  const { byKey, keyByName, brandKeyByName } = shelvesByKey();
  const keys = [r.key, ...(r.keys ?? []), keyByName.get(`${fold(r.brand)}|${fold(r.strain)}`)].filter(
    (k): k is string => Boolean(k),
  );
  const hit = keys.map((k) => byKey.get(k)).find(Boolean) ?? null;
  const grower = keys[0]?.split('|', 1)[0] || brandKeyByName.get(fold(r.brand)) || null;
  const brandKey =
    [...keys.map((k) => k.split('|', 1)[0]), brandKeyByName.get(fold(r.brand))].find(
      (b): b is string => Boolean(b) && brandPages().has(b!),
    ) ?? null;
  const name = hit?.name ?? reviewName(r.brand, grower, r.strain);
  return {
    strain: shouted(name) ? titleCase(name) : name,
    brand: (brandKey && brandPages().get(brandKey)) || r.brand,
    brandKey,
    slug: hit?.slug ?? null,
    lineage: hit?.lineage ?? null,
  };
};

/* A wave's shelves by each day we read this week: the same arrivals the read
   counted (its key, at the shops the signals name), each shelf counted from
   the day it turned up. It ends where the card's figure does. */
const seriesOf = (key: string | undefined, licences: string[], from: string, to: string) => {
  if (!key) return undefined;
  const h = historyFile();
  const at = new Set(licences);
  const firstDay = new Map<string, string>();
  for (const a of h.arrivals) {
    if (a.key !== key || !at.has(a.licence) || a.seen < from || a.seen > to) continue;
    const was = firstDay.get(a.shelf);
    if (!was || a.seen < was) firstDay.set(a.shelf, a.seen);
  }
  const days = h.sweeps.filter((d) => d >= from && d <= to);
  return days.map((d) => [...firstDay.values()].filter((f) => f <= d).length);
};

let built: Record<MoveKind, MoveItem[]> | null = null;

/** Every list, every item. */
export const moveLists = (): Record<MoveKind, MoveItem[]> => {
  if (built) return built;
  const w = windows();

  const arrival = (a: (typeof raw.waves)[number]): MoveItem => ({
    id: a.key ?? `${a.brand}|${a.strain}`,
    ...enrich(a),
    day: a.first,
    shops: a.shops,
    debut: a.debut,
    shelves: a.shelves,
    now: a.now,
    today: a.today,
  });

  built = {
    debuts: raw.debuts.map((d) => ({
      id: d.key,
      ...enrich(d),
      day: d.first,
      shops: d.shops,
      debut: d.debut,
      seenAt: d.seenAt,
    })),
    waves: raw.waves.map((a) => ({
      ...arrival(a),
      series: seriesOf(a.key, a.licences, w.newFrom, w.day),
    })),
    batches: raw.batches.map((b) => ({
      id: `${b.brand}|${b.strain}|${b.thc}`,
      ...enrich(b),
      day: b.first,
      shops: b.shops,
      debut: null,
      thc: b.thc,
      before: b.before,
    })),
    new: raw.arrivals.map(arrival),
    low: raw.runningLow.map((m) => ({
      id: `${m.brand}|${m.strain}`,
      ...enrich(m),
      day: m.peakDay,
      shops: m.now,
      debut: null,
      peak: m.peak,
    })),
    gone: raw.gone.map((m) => ({
      id: `${m.brand}|${m.strain}`,
      ...enrich(m),
      /* Gone from every shelf, so no shelf says its type today. */
      lineage: null,
      day: m.lastSeen,
      shops: m.lastShops,
      debut: null,
      peak: m.peak,
    })),
  };
  return built;
};

/* Which day each list's bars count by, and over which days. Running low has
   no such day: its date is the edge of its window more often than not. */
const BAR_WINDOW: Record<MoveKind, 'new' | 'leaving' | null> = {
  debuts: 'new',
  waves: 'new',
  batches: 'new',
  new: 'new',
  low: null,
  gone: 'leaving',
};

/** The six cards of the overview: counts and bars, for every type. */
export const moveCards = (): MoveCard[] => {
  const lists = moveLists();
  const w = windows();
  const { sweeps } = historyFile();
  return MOVE_KINDS.map((kind) => {
    const items = lists[kind];
    const typeKnown = kind !== 'gone';
    const count = {
      all: items.length,
      indica: typeKnown ? items.filter((i) => i.lineage === 'indica').length : null,
      sativa: typeKnown ? items.filter((i) => i.lineage === 'sativa').length : null,
      hybrid: typeKnown ? items.filter((i) => i.lineage === 'hybrid').length : null,
    };
    const window = BAR_WINDOW[kind];
    if (!window) return { kind, count, bars: null, barDays: [] };
    const from = window === 'new' ? w.newFrom : w.leavingFrom;
    let barDays = sweeps.filter((d) => d >= from && d <= w.day);
    /* Nothing is dated the day of the read itself — an arrival is confirmed
       at the next one — so an empty last bar would only look like a lull. */
    if (barDays.at(-1) === w.day && !items.some((i) => i.day === w.day)) barDays = barDays.slice(0, -1);
    const perDay = (subset: MoveItem[]) => barDays.map((d) => subset.filter((i) => i.day === d).length);
    return {
      kind,
      count,
      bars: {
        all: perDay(items),
        indica: perDay(items.filter((i) => i.lineage === 'indica')),
        sativa: perDay(items.filter((i) => i.lineage === 'sativa')),
        hybrid: perDay(items.filter((i) => i.lineage === 'hybrid')),
      },
      barDays,
    };
  });
};
