import Link from 'next/link';
import clsx from 'clsx';
import { prettyDate, prettyDateTime, shortDate } from '@/lib/format';
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
  lit = false,
  className = 'mt-6',
}: {
  linkToShops?: boolean;
  /** The panel the brands page draws: a lit frame with a signal at its
      start, the words in the page's sans and the readings in the mono. */
  lit?: boolean;
  /** Its margin, where it sits: mt-6 under a paragraph, as it always has. */
  className?: string;
}) => {
  const { latest, oldest, shops, fresh, stale } = shelfFreshness();
  if (!latest) return null;

  const perShop = linkToShops ? (
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
  ) : null;

  if (lit)
    return (
      <div
        className={clsx(
          'relative flex max-w-2xl gap-3 rounded-xl border border-moss-500/45 bg-ink-900/80 py-3 pl-3 pr-4 shadow-[0_0_18px_-6px_rgba(var(--glow),0.55),inset_0_0_26px_-14px_rgba(var(--glow),0.45)] sm:w-fit sm:max-w-4xl sm:gap-3.5 sm:px-5 sm:py-4',
          className,
        )}
      >
        {/* An instrument's marks on the frame: a lit stretch of its top edge
            near the corner, another down its right side, and two points of
            light inside that corner. */}
        <span aria-hidden className="pointer-events-none absolute -top-px left-3 h-px w-7 bg-moss-300 shadow-[0_0_6px_rgba(var(--glow),0.9)]" />
        <span aria-hidden className="pointer-events-none absolute -right-px top-[30%] h-[22%] w-px bg-moss-400 shadow-[0_0_6px_rgba(var(--glow),0.9)]" />
        <span aria-hidden className="pointer-events-none absolute right-3 top-4 flex flex-col gap-[1.125rem]">
          <span className="h-[3px] w-[3px] rounded-full bg-moss-400/70" />
          <span className="h-[3px] w-[3px] rounded-full bg-moss-400/50" />
        </span>

        {/* A signal, read. */}
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          focusable="false"
          className="mt-px h-6 w-6 shrink-0 text-moss-400 drop-shadow-[0_0_4px_rgba(var(--glow),0.7)]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M3 10v4M7.5 7v10M12 4v16M16.5 8v8M21 10.5v3" />
        </svg>

        <p className="min-w-0 pr-2">
          <span className="block text-[0.8125rem] leading-snug text-chalk-100 sm:text-[0.9375rem]">Shelves last read</span>
          <strong className="mt-1 block font-mono text-[0.75rem] font-medium leading-snug text-moss-400 sm:text-[0.84rem]">
            {prettyDateTime(latest)}
          </strong>
          {stale > 0 && (
            <span className="stamp mt-1 block text-chalk-300">
              {fresh} of {shops} shops read in the 24 hours before; {stale} still carry an older reading
              {oldest ? `, the oldest from ${shortDate(oldest)}` : ''}
              {perShop}
            </span>
          )}
        </p>
      </div>
    );

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
            {perShop}
          </span>
        )}
      </p>
    </div>
  );
};
