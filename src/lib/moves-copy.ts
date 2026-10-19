/**
 * What New & leaving says about each list. Kept apart from ./moves, which
 * reads the shelves, so the client components can import it.
 *
 * Every sentence states the rule scripts/shelf-history.py applies, with its
 * numbers: a list called "Fewer shops than last week" that in fact compares
 * with a fortnight's peak would be the register saying something untrue.
 */
import type { MoveKind } from './moves';

export type Rules = {
  newDays: number;
  waveShelves: number;
  movesDays: number;
  lowBelow: number;
  lowPeak: number;
  gonePeak: number;
};

export const MOVE_TITLE: Record<MoveKind, string> = {
  debuts: 'Debuts',
  waves: 'Waves',
  batches: 'New batches',
  new: 'New this week',
  low: 'Running low',
  gone: 'Gone',
};

/** One line under the count on the overview's card. */
export const moveSubtitle = (kind: MoveKind, r: Rules): string =>
  ({
    debuts: `A grower's strain new to every shelf we read, in its first ${r.newDays} days.`,
    waves: `One grower's strain on ${r.waveShelves}+ shelves within ${r.newDays} days — a delivery going round.`,
    batches: "A THC figure this grower's strain had not shown before.",
    new: `A grower's strain new on one or two shelves in the last ${r.newDays} days.`,
    low: `On ${r.lowPeak}+ shops in the last ${r.movesDays} days, on fewer than ${r.lowBelow} now.`,
    gone: `On ${r.gonePeak}+ shops in the last ${r.movesDays} days, on none we read now.`,
  })[kind];

/** The rule in full, at the top of the list's own page. */
export const moveDescription = (kind: MoveKind, r: Rules): string =>
  ({
    debuts: `A grower's strain that no New York City or Westchester shelf we read had carried from that grower before — under any spelling of its name — in its first ${r.newDays} days. Debut (3) is how many shops have had it since its first day. Our reads began on Sep 6, 2026; a strain can be older on shelves we do not read.`,
    waves: `One grower's strain turning up on ${r.waveShelves} or more shelves within ${r.newDays} days — a delivery going round. Shops that share one menu count as one shelf. The line is how many shelves it had reached by each day we read.`,
    batches:
      "A THC figure this grower's strain had not shown at any shop before. Menus copy the figure off the batch's lab certificate, so a new one is a new batch — even of a strain that never left the shelf.",
    new: `A grower's strain that turned up on one or two shelves in the last ${r.newDays} days and was still there at the next read. On ${r.waveShelves} or more it is a wave.`,
    low: `On ${r.lowPeak} or more shops at some point in the last ${r.movesDays} days, and on fewer than ${r.lowBelow} now. The shops named are the ones it is on now.`,
    gone: `On ${r.gonePeak} or more shops at some point in the last ${r.movesDays} days, and on none of the shelves we read now. It may still be on shelves we do not read.`,
  })[kind];

/** What each list's dates, and so its bars, count by. */
export const moveDating = (kind: MoveKind): string | null =>
  ({
    debuts: 'by the day first seen',
    waves: 'by the day it started turning up',
    batches: 'by the day the new figure appeared',
    new: 'by the day first seen',
    low: null,
    gone: 'by the day last seen',
  })[kind];

/** How a list can be ordered; the first is the order the read writes. */
export const MOVE_SORTS: Record<MoveKind, { id: string; label: string }[]> = {
  debuts: [
    { id: 'shops', label: 'Most shops first' },
    { id: 'newest', label: 'Newest first' },
    { id: 'name', label: 'Name' },
  ],
  waves: [
    { id: 'strongest', label: 'Strongest waves' },
    { id: 'newest', label: 'Newest first' },
    { id: 'today', label: 'Most today' },
  ],
  batches: [
    { id: 'newest', label: 'Newest first' },
    { id: 'shops', label: 'Most shops now' },
    { id: 'name', label: 'Name' },
  ],
  new: [
    { id: 'newest', label: 'Newest first' },
    { id: 'shops', label: 'Most shops now' },
    { id: 'name', label: 'Name' },
  ],
  low: [
    { id: 'drop', label: 'Biggest drop' },
    { id: 'fewest', label: 'Fewest shops now' },
    { id: 'name', label: 'Name' },
  ],
  gone: [
    { id: 'recent', label: 'Most recently gone' },
    { id: 'widest', label: 'Widest before' },
    { id: 'name', label: 'Name' },
  ],
};

export const LINEAGE_CHIP: { id: 'all' | 'indica' | 'sativa' | 'hybrid'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'indica', label: 'Indica' },
  { id: 'sativa', label: 'Sativa' },
  { id: 'hybrid', label: 'Hybrid' },
];

/** "Oct 18" — pinned to UTC, the calendar the daily read is kept in. */
export const shortDay = (day: string): string =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** "Oct 12–18", or "Sep 30 – Oct 6" across a month. */
export const dayRange = (from: string, to: string): string =>
  from.slice(0, 7) === to.slice(0, 7)
    ? `${shortDay(from)}–${Number(to.slice(8, 10))}`
    : `${shortDay(from)} – ${shortDay(to)}`;
