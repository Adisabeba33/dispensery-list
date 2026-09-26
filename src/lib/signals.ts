import signalsRaw from '../../data/shelf-signals.json';
import { dispensaries, displayName, regionOf } from './data';

/**
 * What changed on the shelves: what came in this week, what is running low,
 * what has gone. Computed after each daily read by scripts/shelf-history.py,
 * which holds every rule about telling a delivery from our own reading; this
 * only puts names and links on what it wrote.
 *
 * Server-side only.
 */
export type Shop = { id: string; name: string; region: string };

type Raw = {
  day: string;
  rules: { newDays: number; waveShelves: number; movesDays: number; lowBelow: number; lowPeak: number; gonePeak: number };
  arrivals: { brand: string | null; strain: string; first: string; today: number; shelves: number; shops: string[]; now: number }[];
  batches: { brand: string | null; strain: string; thc: number; before: number[]; first: string; shops: string[] }[];
  runningLow: { brand: string | null; strain: string; now: string[]; peak: number; peakDay: string }[];
  gone: { brand: string | null; strain: string; lastSeen: string; peak: number; lastShops: string[] }[];
  shops?: Record<
    string,
    {
      state: 'stale' | 'quiet' | 'asleep' | 'dead' | 'partial';
      frozen: boolean;
      size: number;
      since: string;
      quietDays: number;
      quietReads: number;
      lastDelivery: string;
      dryDays: number;
    }
  >;
};

const raw = signalsRaw as unknown as Raw;
const byLicence = new Map(dispensaries.map((d) => [d.licenseNumber, d]));

/* A licence outside this register — a territory's shop — has no page here to
   link, so it is left out rather than printed as a number. */
const shopsOf = (licences: string[]): Shop[] =>
  licences.flatMap((licence) => {
    const d = byLicence.get(licence);
    return d ? [{ id: d.id, name: displayName(d), region: regionOf(d) }] : [];
  });

export const shelfSignals = () => {
  const arrivals = raw.arrivals.map((a) => ({ ...a, shops: shopsOf(a.shops) }));
  return {
    day: raw.day,
    rules: raw.rules,
    waves: arrivals.filter((a) => a.shelves >= raw.rules.waveShelves),
    arrivals: arrivals.filter((a) => a.shelves < raw.rules.waveShelves),
    batches: raw.batches.map((b) => ({ ...b, shops: shopsOf(b.shops) })),
    runningLow: raw.runningLow.map((m) => ({ ...m, now: shopsOf(m.now) })),
    gone: raw.gone.map((m) => ({ ...m, lastShops: shopsOf(m.lastShops) })),
  };
};

/**
 * What there is to say about a shop's shelf, when there is anything.
 *
 * Shops whose shelf we keep reading and which has stopped being restocked:
 * nothing new arrives, whether or not what is there still sells down — or
 * nothing changes at all. From outside that is a shop not trading, one that
 * has closed, or one that stopped updating its menu — they cannot be told
 * apart from here, so a visitor is told the fact, not a verdict.
 *
 * `frozen` is the stronger of the two facts: read several times running, over
 * a week and more, without a single strain coming or going.
 *
 * `partial` is about us, not the shop: we read a window onto a bigger menu —
 * its size holds while the strains in it keep changing — so what we list is
 * on sale, but not all that is.
 */
export const shelfNote = (licence: string) => raw.shops?.[licence] ?? null;

/** A day of the daily read, "Sep 22" — pinned to UTC, the calendar the read is kept in. */
export const dayLabel = (day: string): string =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
