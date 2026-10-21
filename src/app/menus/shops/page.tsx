import type { Metadata } from 'next';
import Link from 'next/link';
import { ShelfPill } from '@/components/Badges';
import { Chevron, PageHead } from '@/components/PageParts';
import { ShelfStamp } from '@/components/ShelfStamp';
import { dispensaries, displayName, regionOf } from '@/lib/data';
import { prettyDate } from '@/lib/format';
import { shelvesRead } from '@/lib/shelf';
import { dayLabel, shelfNote } from '@/lib/signals';

export const metadata: Metadata = {
  title: 'Shops with a menu',
  description:
    'Which licensed New York dispensaries have had their flower menu read, how many strains each has on the shelf, and in which sizes.',
};

export default function MenuShopsPage() {
  const shelves = shelvesRead();
  const strains = shelves.reduce((n, s) => n + s.count, 0);

  return (
    <div className="shell pb-16">
      <PageHead kicker="Shelves" title="Shops with a menu">
        <p>
          {shelves.length} of {dispensaries.length} licensed dispensaries in the register have had
          their shelf read — {strains} listings in all. The rest are in the{' '}
          <Link href="/" className="link">
            directory
          </Link>
          : their menus are simply not reachable yet.
        </p>
        <p className="text-sm text-chalk-300 sm:text-[0.9375rem]">
          Looking for a particular strain rather than a particular shop?{' '}
          <Link href="/menus/" className="link">
            Search every shelf at once
          </Link>
          .
        </p>
      </PageHead>

      <ShelfStamp />

      {/* The home page's cards, plainer: no picture and no status, since
          every shop here is one whose shelf we read — the green pill says so. */}
      <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shelves.map(({ shop, count, sizes, readAt }) => (
          <li key={shop!.id}>
            <Link
              href={`/dispensary/${shop!.id}/#menu`}
              className="card card-hover group flex h-full flex-col p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-400"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="block truncate text-[1.06rem] font-bold leading-snug tracking-tight text-chalk-50 transition-colors group-hover:text-moss-300">
                    {displayName(shop!)}
                  </span>
                  <span className="block truncate text-xs text-chalk-200">{regionOf(shop!)}</span>
                </div>
                <Chevron className="mt-1 h-5 w-5 text-chalk-300 transition-colors group-hover:text-moss-300" />
              </div>
              <div className="mt-2.5">
                <ShelfPill count={count} />
              </div>
              <ul className="mb-3 mt-3 flex flex-wrap gap-1">
                {sizes.map((s) => (
                  <li key={s.grams} className="tag px-1.5 py-0.5 text-[0.7rem] tabular-nums">
                    {s.short}
                  </li>
                ))}
              </ul>
              {/* At the card's foot, level across the row however the sizes
                  wrap. Per shop, because per page would be a promise the file
                  does not keep: a shop the collector could not reach keeps
                  the shelf it last gave us. */}
              <div className="mt-auto border-t border-ink-700/70 pt-2.5">
                {readAt && <p className="stamp">read {prettyDate(readAt)}</p>}
                {/* A shelf read day after day that nothing new reaches, or
                    that never changes at all. The fact, not a verdict: a shop
                    not trading and a menu nobody updates look the same from
                    here. */}
                {(() => {
                  const note = shelfNote(shop!.licenseNumber);
                  if (!note) return null;
                  /* Ours, not the shop's: said plainly, and not in the colour
                     of a warning about the shop. */
                  if (note.state === 'partial')
                    return <p className="stamp">We read only part of this menu</p>;
                  return (
                    <p className="stamp text-amber-400">
                      {note.frozen
                        ? `Menu unchanged since ${dayLabel(note.since)} · ${note.quietDays} days`
                        : `Nothing new since ${dayLabel(note.lastDelivery)} · ${note.dryDays} days`}
                    </p>
                  );
                })()}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <p className="note mt-12 max-w-2xl text-xs">
        Shelves change hourly and this page does not. Treat it as what a shop published when its
        menu was read, not as what is in the jar today.
      </p>
    </div>
  );
}
