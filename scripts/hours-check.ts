/**
 * Checks for whether a shop is open now by its hours (src/lib/hours.ts): the
 * hours that run past midnight, the day off, the day nobody recorded, and New
 * York's clock read from anywhere.
 *
 *   npx tsx scripts/hours-check.ts
 */
import type { Hours, Weekday } from '../src/lib/types';
import { hoursState, nyMoment, type HoursState } from '../src/lib/hours';

let failures = 0;
const expect = (what: string, got: unknown, want: unknown) => {
  if (got !== want) {
    failures++;
    console.error(`✗ ${what}: got ${String(got)}, want ${String(want)}`);
  }
};

const week = (days: Partial<Record<Weekday, Hours['week'][Weekday]>>, rest: Hours['week'][Weekday] = null): Hours => ({
  timezone: 'America/New_York',
  week: { mon: rest, tue: rest, wed: rest, thu: rest, fri: rest, sat: rest, sun: rest, ...days },
});
const slot = (open: string, close: string) => [{ open, close }];
const at = (day: number, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return { day, minute: h * 60 + m };
};
const check = (what: string, hours: Hours | null, day: number, hhmm: string, want: HoursState) =>
  expect(what, hoursState(hours, at(day, hhmm)), want);

const plain = week({}, slot('09:00', '21:00'));
check('before opening', plain, 2, '08:59', 'closed');
check('at opening', plain, 2, '09:00', 'open');
check('just before closing', plain, 2, '20:59', 'open');
check('at closing', plain, 2, '21:00', 'closed');

const late = week({ fri: slot('09:00', '01:00'), sat: slot('10:00', '22:00') }, slot('09:00', '22:00'));
check('Friday late', late, 4, '23:30', 'open');
check('past midnight into Saturday', late, 5, '00:30', 'open');
check('after the late close', late, 5, '01:00', 'closed');
check('Saturday before opening', late, 5, '09:00', 'closed');

const midnight = week({}, slot('08:00', '00:00'));
check('closing at midnight, late evening', midnight, 0, '23:59', 'open');
check('closing at midnight, after it', midnight, 1, '00:00', 'closed');

check('all day', week({}, slot('00:00', '00:00')), 3, '03:00', 'open');

const sundayOff = week({ sun: 'CLOSED' }, slot('10:00', '20:00'));
check('day off', sundayOff, 6, '12:00', 'closed');

const gaps = week({ sat: null }, slot('10:00', '22:00'));
check('a day nobody recorded', gaps, 5, '12:00', 'unknown');
check('a recorded day beside it', gaps, 4, '12:00', 'open');
check('no hours at all', null, 2, '12:00', 'unknown');

// Monday 19 October 2026, 02:30 UTC is Sunday 10:30pm in New York (EDT).
const ny = nyMoment(new Date('2026-10-19T02:30:00Z'));
expect('New York day across UTC midnight', ny.day, 6);
expect('New York minute across UTC midnight', ny.minute, 22 * 60 + 30);
// After the clocks go back: Monday 2 November 2026, 14:05 UTC is 9:05am EST.
const winter = nyMoment(new Date('2026-11-02T14:05:00Z'));
expect('New York day in winter', winter.day, 0);
expect('New York minute in winter', winter.minute, 9 * 60 + 5);

if (failures) {
  console.error(`hours-check: ${failures} failed`);
  process.exit(1);
}
console.log('hours-check: ok');
