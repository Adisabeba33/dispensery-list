import Link from 'next/link';
import { prettyDate, prettyDateTime } from '@/lib/format';
import { shelfFreshness } from '@/lib/shelf';

/**
 * When the shelves were last read, said out loud at the top of the page.
 *
 * A menu page with no date on it reads as current, and these shelves are not:
 * they are what the shops published when the collector last reached them. The
 * stamp carries the minute, because a menu read this morning and a menu read
 * last night are different menus.
 *
 * It also carries what a single date would hide — that not every shop was
 * reached on the last sweep. A shelf we could not re-read is kept rather than
 * emptied, which is right, but it means the newest date describes most of the
 * page and not all of it.
 */
export const ShelfStamp = ({ linkToShops = false }: { linkToShops?: boolean }) => {
  const { latest, oldest, shops, fresh, stale } = shelfFreshness();
  if (!latest) return null;

  return (
    <p className="mt-6 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-ink-700 bg-ink-900/70 px-3 py-2 text-sm text-chalk-300">
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-moss-400"
      />
      <span>
        Shelves last read <strong className="font-medium text-chalk-50">{prettyDateTime(latest)}</strong>
      </span>
      {stale > 0 && (
        <span className="text-chalk-500">
          · {fresh} of {shops} shops read in the 24 hours before; {stale} still carry an older reading
          {oldest ? `, the oldest from ${prettyDate(oldest)}` : ''}
          {linkToShops ? (
            <>
              {' '}
              (
              <Link href="/menus/shops/" className="link">
                per shop
              </Link>
              )
            </>
          ) : null}
        </span>
      )}
    </p>
  );
};
