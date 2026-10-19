import type { Metadata } from 'next';
import { MovesOverview } from '@/components/MovesOverview';
import { moveCards, windows } from '@/lib/moves';
import { shortDay } from '@/lib/moves-copy';

export const metadata: Metadata = {
  title: 'New & leaving',
  description:
    'Which strains turned up on the New York City and Westchester shelves we read this week, which came in a new batch, and which are running low or gone.',
};

export default function MovesPage() {
  const w = windows();

  return (
    <div className="shell py-12">
      <p className="label">Shelves</p>
      <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-chalk-50 sm:text-4xl">
        New on the shelves, and leaving them
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-chalk-200">
        What changed on the New York City and Westchester shelves we read, as of the daily read on{' '}
        {shortDay(w.day)}: the strains that turned up this week, the ones that came in a new batch, and
        the ones that are running low or gone.
      </p>

      <MovesOverview cards={moveCards()} rules={w.rules} day={w.day} newFrom={w.newFrom} leavingFrom={w.leavingFrom} />

      <details className="card group mt-6 p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-chalk-50">
          <span className="flex items-center gap-3">
            <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 text-chalk-400" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5M12 7.5v.5" strokeLinecap="round" />
            </svg>
            How this works
          </span>
          <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 text-chalk-500 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <div className="mt-4 max-w-3xl space-y-3 text-sm leading-relaxed text-chalk-400">
          <p>
            Each list dates something different. Debuts, waves and the week&apos;s new arrivals: the
            first day our read saw them on a shelf. New batches: the day the new THC figure first
            appeared. Running low: compared with the most shops it was on in the last{' '}
            {w.rules.movesDays} days. Gone: the last day it was seen. The small bars on each card count
            the list by that day — when things turned up, not a trend.
          </p>
          <p>
            A date is the day our read saw it, not the day it was packed. What looked new because we
            learned to read a menu better, rather than because the shop restocked, is left out, and so
            is a shop whose menu we read only in part. A strain we no longer see may still be on
            shelves we do not read. Our reads began on Sep 6, 2026.
          </p>
        </div>
      </details>
    </div>
  );
}
