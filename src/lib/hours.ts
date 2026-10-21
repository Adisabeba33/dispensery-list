import type { Dispensary, Hours, Weekday } from './types';

/**
 * Whether a shop is open at a given moment by its own hours, not by the
 * registry's word (owner's rule, 21 October 2026): green "Open" inside its
 * hours, red "Closed" outside them, amber "Hours unknown" when we hold no
 * hours for that day. Only for a shop the registry lists as trading — one not
 * open yet, closed for good or unconfirmed keeps the registry's word.
 */
export type HoursState = 'open' | 'closed' | 'unknown';

/* Monday first, as the record's week is written. */
const DAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_OF: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/** A moment as New York reads it: the day of its week and the minute of its day. */
export type NyMoment = { day: number; minute: number };

const NY = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/* The shop's clock, wherever the reader is: a reader in London at 3am sees
   New York's evening. */
export const nyMoment = (at: Date): NyMoment => {
  const parts = NY.formatToParts(at);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { day: DAY_OF[part('weekday')] ?? 0, minute: Number(part('hour')) * 60 + Number(part('minute')) };
};

const toMinute = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/* A slot as minutes from the start of its own day. One that closes at or
   before it opens runs past midnight: "09:00–01:00" ends at 25:00, and
   "08:00–00:00" at midnight. */
const span = (slot: { open: string; close: string }): [number, number] => {
  const open = toMinute(slot.open);
  let close = toMinute(slot.close);
  if (close <= open) close += 24 * 60;
  return [open, close];
};

export const hoursState = (hours: Hours | null, at: NyMoment): HoursState => {
  if (!hours) return 'unknown';
  const today = hours.week[DAYS[at.day]];
  const yesterday = hours.week[DAYS[(at.day + 6) % 7]];

  // Last night's hours may still be running: Friday's 9am–1am is open at
  // half past midnight on Saturday.
  if (Array.isArray(yesterday) && yesterday.some((s) => at.minute + 24 * 60 < span(s)[1])) return 'open';
  if (today === null) return 'unknown';
  if (today === 'CLOSED') return 'closed';
  return today.some((s) => {
    const [open, close] = span(s);
    return at.minute >= open && at.minute < close;
  })
    ? 'open'
    : 'closed';
};

/** The shop's state now, or null when its status is the registry's to give. */
export const shopHoursState = (d: Pick<Dispensary, 'operationalStatus' | 'hours'>, at: NyMoment): HoursState | null =>
  d.operationalStatus === 'OPEN' ? hoursState(d.hours, at) : null;
