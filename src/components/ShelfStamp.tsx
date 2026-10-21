import Link from 'next/link';
import clsx from 'clsx';
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
 *
 * Drawn in the build stamp's mono, in a dim frame, with the lamp lit before
 * it: the same small record of provenance on every page of shelves.
 */
export const ShelfStamp = ({
  linkToShops = false,
  className = 'mt-6',
}: {
  linkToShops?: boolean;
  /** Its margin, where it sits: mt-6 under a paragraph, as it always has. */
  className?: string;
}) => {
  const { latest, oldest, shops, fresh, stale } = shelfFreshness();
  if (!latest) return null;

  return (
    <div
      className={clsx(
        'stamp flex max-w-2xl gap-2.5 rounded-lg border border-ink-700 bg-ink-900/70 px-3.5 py-2.5 sm:w-fit sm:max-w-4xl',
        className,
      )}
    >
      <span
        aria-hidden
        className="mt-[0.4rem] h-1.5 w-1.5 shrink-0 rounded-full bg-moss-400 shadow-[0_0_6px_rgba(var(--glow),0.8)]"
      />
      <p className="min-w-0">
        <span className="block text-chalk-300">
          Shelves last read{' '}
          <strong className="font-medium text-moss-400 [@media(min-width:360px)]:whitespace-nowrap">{prettyDateTime(latest)}</strong>
        </span>
        {stale > 0 && (
          <span className="mt-0.5 block">
            {fresh} of {shops} shops read in the 24 hours before; {stale} still carry an older reading
            {oldest ? `, the oldest from ${prettyDate(oldest)}` : ''}
            {linkToShops ? (
              <>
                {' '}
                (
                <Link
                  href="/menus/shops/"
                  className="link rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-moss-400"
                >
                  per shop
                </Link>
                )
              </>
            ) : null}
          </span>
        )}
      </p>
    </div>
  );
};
