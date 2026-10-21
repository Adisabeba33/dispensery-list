import type { Metadata } from 'next';
import Link from 'next/link';
import { MovesOverview } from '@/components/MovesOverview';
import { Chevron, PageHead } from '@/components/PageParts';
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
    <div className="shell pb-16">
      <PageHead kicker="Shelves" title="New on the shelves, and leaving them">
        <p>
          What changed on the New York City and Westchester shelves we read, as of the daily read on{' '}
          {shortDay(w.day)}: the strains that turned up this week, the ones that came in a new batch,
          and the ones that are running low or gone.
        </p>
      </PageHead>

      <MovesOverview cards={moveCards()} rules={w.rules} day={w.day} newFrom={w.newFrom} leavingFrom={w.leavingFrom} />

      {/* How the lists are dated: a frame that opens the way every other
          disclosure on the site does, the chevron turning down. */}
      <details className="card mt-6 open:border-moss-700/60">
        <summary className="group flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-lg px-4 py-3.5 text-chalk-50 transition-colors hover:text-moss-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-moss-400 sm:px-5">
          <span className="flex items-center gap-3 font-medium">
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className="h-5 w-5 shrink-0 text-chalk-400 transition-colors group-hover:text-moss-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5M12 7.5v.5" strokeLinecap="round" />
            </svg>
            How this works
          </span>
          <Chevron className="text-chalk-400 group-hover:text-moss-400" />
        </summary>
        <div className="border-t border-ink-700/70 px-4 pb-5 pt-4 sm:px-5">
          <div className="max-w-3xl space-y-3 text-sm leading-relaxed text-chalk-300">
            <p>
              Each list dates something different. Debuts: the first day our read saw the grower&apos;s
              strain on any shelf. Waves and the week&apos;s new arrivals: the first day since{' '}
              {shortDay(w.newFrom)} it turned up on a shelf it was not on — many were on other shelves
              before. New batches: the day the new THC figure first appeared. Running low: compared with
              the most shops it was on in the last {w.rules.movesDays} days. Gone: the last day it was
              seen. The small bars on each card count the list by that date — a count, not a trend.
            </p>
            <p>
              A date is the day our read saw it, not the day it was packed. What looked new because we
              learned to read a menu better, rather than because the shop restocked, is left out, and so
              is a shop whose menu we read only in part — except for new batches, where a new THC figure
              on such a menu still counts. A strain we no longer see may still be on shelves we do not
              read. Our reads began on Sep 6, 2026; more on how shelves are read under{' '}
              <Link href="/about/" className="link">
                Method
              </Link>
              .
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}
