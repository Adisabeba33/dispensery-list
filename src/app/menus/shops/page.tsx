import type { Metadata } from 'next';
import Link from 'next/link';
import { ShelfStamp } from '@/components/ShelfStamp';
import { dispensaries, displayName, regionOf } from '@/lib/data';
import { prettyDate } from '@/lib/format';
import { shelvesRead } from '@/lib/shelf';
import { dayLabel, stillShelf } from '@/lib/signals';

export const metadata: Metadata = {
  title: 'Shops with a menu',
  description:
    'Which licensed New York dispensaries have had their flower menu read, how many strains each has on the shelf, and in which sizes.',
};

export default function MenuShopsPage() {
  const shelves = shelvesRead();
  const strains = shelves.reduce((n, s) => n + s.count, 0);

  return (
    <div className="shell py-12">
      <p className="label">Shelves</p>
      <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-chalk-50 sm:text-4xl">
        Shops with a menu
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-chalk-200">
        {shelves.length} of {dispensaries.length} licensed dispensaries in the register have had
        their shelf read — {strains} listings in all. The rest are in the{' '}
        <Link href="/" className="link">
          directory
        </Link>
        : their menus are simply not reachable yet.
      </p>
      <p className="mt-4 max-w-2xl text-sm text-chalk-400">
        Looking for a particular strain rather than a particular shop?{' '}
        <Link href="/menus/" className="link">
          Search every shelf at once
        </Link>
        .
      </p>

      <ShelfStamp />

      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shelves.map(({ shop, count, sizes, readAt }) => (
          <li key={shop!.id}>
            <Link href={`/dispensary/${shop!.id}/#menu`} className="card card-hover block p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="block truncate font-semibold tracking-tight text-chalk-50">
                    {displayName(shop!)}
                  </span>
                  <span className="mt-0.5 block text-xs text-chalk-500">{regionOf(shop!)}</span>
                </div>
                <span className="pill shrink-0 border-moss-600/45 bg-moss-600/10 text-moss-400">
                  {count} strains
                </span>
              </div>
              <p className="mt-3 text-xs text-chalk-400">{sizes.map((s) => s.short).join(' · ')}</p>
              {/* Per shop, because per page would be a promise the file does
                  not keep: a shop the collector could not reach keeps the
                  shelf it last gave us. */}
              {readAt && (
                <p className="mt-1 text-[0.7rem] text-chalk-500">read {prettyDate(readAt)}</p>
              )}
              {/* A shelf read day after day that nothing new reaches, or
                  that never changes at all. The fact, not a verdict: a shop
                  not trading and a menu nobody updates look the same from
                  here. */}
              {(() => {
                const still = stillShelf(shop!.licenseNumber);
                return still ? (
                  <p className="mt-1 text-[0.7rem] text-amber-400">
                    {still.frozen
                      ? `Menu unchanged since ${dayLabel(still.since)} · ${still.quietDays} days`
                      : `Nothing new since ${dayLabel(still.lastDelivery)} · ${still.dryDays} days`}
                  </p>
                ) : null;
              })()}
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-12 max-w-2xl text-xs leading-relaxed text-chalk-500">
        Shelves change hourly and this page does not. Treat it as what a shop published when its
        menu was read, not as what is in the jar today.
      </p>
    </div>
  );
}
