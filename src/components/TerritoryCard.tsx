import clsx from 'clsx';
import Link from 'next/link';
import type { TerritoryShop } from '@/lib/territory-data';
import { displayName } from '@/lib/territory-data';
import { LICENSE_TYPE_LABEL } from '@/lib/data';
import { prettyDate } from '@/lib/format';
import { ShelfPill } from './Badges';
import { Chevron } from './PageParts';

/**
 * A shop in a territory that has nothing but its registry record.
 *
 * Separate from DispensaryCard rather than a variant of it. That card shows a
 * borough, a status badge, service pills, a strain count and a link to a
 * generated detail page — and for these records every one of those is either
 * wrong (the borough is null, so it would read "Westchester") or empty. A card
 * of blanks tells a reader we did a bad job; this one tells them what we have.
 *
 * It reads like the city's card — the line above the name, the name, the
 * county, the address, the shelf's pill, the licence — but in the dim frame,
 * with no storefront drawn and no glow: a registry import, not a record the
 * register has checked, and it should not look as finished as one.
 */
export const TerritoryCard = ({
  d,
  shelf,
  shelfHref,
}: {
  d: TerritoryShop;
  /** Strains on the shelf read for this shop, where one was. */
  shelf?: number;
  /** Its shelf page, when the territory has them. */
  shelfHref?: string;
}) => {
  const opened = prettyDate(d.dates?.openedOn ?? null);
  const expires = d.dates?.licenseExpiration ?? null;
  const expired = expires != null && expires < d.lastUpdated.slice(0, 10);

  return (
    <div
      className={clsx(
        // A step tighter than the other frames, as the city's shop cards are.
        'card group relative flex h-full flex-col rounded-md px-3.5 pb-3 pt-2.5 sm:px-4',
        shelfHref && 'card-hover',
      )}
    >
      {/* The registry's own field, in the place the city's card gives its
          status: a plain dot, never lit — the lamp on this card is the
          shelf's, and two would read as one. */}
      <span
        className={clsx(
          'flex items-center gap-2 pr-7 text-[0.72rem] leading-4',
          opened ? 'text-moss-400' : 'text-chalk-400',
        )}
      >
        <span
          aria-hidden
          className={clsx('h-[7px] w-[7px] shrink-0 rounded-full', opened ? 'bg-moss-400' : 'bg-chalk-400')}
        />
        <span className="truncate">{opened ? 'Opened to the public' : 'No opening date on file'}</span>
      </span>

      <p className="mt-[3px] truncate pr-7 text-[1.06rem] font-bold leading-[1.375rem] tracking-tight text-chalk-50">
        {shelfHref ? (
          // The name is the link, and its box is stretched over the card, so
          // the whole frame can be pressed while the link reads as the name.
          <Link
            href={shelfHref}
            className="transition-colors after:absolute after:inset-0 after:rounded-md after:content-[''] group-hover:text-moss-300 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-moss-300"
          >
            {displayName(d)}
          </Link>
        ) : (
          displayName(d)
        )}
      </p>
      <p className="truncate pr-7 text-[0.75rem] leading-4 text-chalk-200">{d.address.county} County</p>

      <p className="mt-1 flex items-start gap-1.5 text-[0.75rem] leading-4 text-chalk-200">
        <svg
          viewBox="0 0 24 24"
          className="mt-px h-3.5 w-3.5 shrink-0 text-chalk-100"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 21.5s-7-6.2-7-11.6a7 7 0 0 1 14 0c0 5.4-7 11.6-7 11.6Z" />
          <circle cx="12" cy="9.8" r="2.5" />
        </svg>
        <span className="min-w-0">
          {[d.address.line1, d.address.line2, `${d.address.city}, ${d.address.state} ${d.address.zip}`]
            .filter(Boolean)
            .join(', ')}
        </span>
      </p>

      {/* The shelf's lamp: green with the count where we read the shelf, red
          and "No data yet" where we do not. */}
      <span className="mt-2 flex flex-wrap gap-1.5">
        {shelf !== undefined && shelf === 0 ? (
          <span className="pill h-[1.15rem] border-moss-600/60 bg-moss-600/10 px-2.5 py-0 text-[0.7rem] text-moss-400">
            0 strains
          </span>
        ) : (
          <ShelfPill count={shelf ?? 0} className="h-[1.15rem] gap-1 px-2.5 py-0 text-[0.7rem]" />
        )}
      </span>

      <dl className="mt-2.5 space-y-0.5 text-[0.75rem] leading-[1.125rem]">
        {opened && (
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-chalk-400">Registry records it opened</dt>
            <dd className="text-chalk-100">{opened}</dd>
          </div>
        )}
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-chalk-400">Licence</dt>
          <dd className="text-chalk-100">{LICENSE_TYPE_LABEL[d.licenseType] ?? d.licenseType}</dd>
        </div>
        {expired && (
          <div className="flex flex-wrap gap-x-2">
            {/* Stated, not corrected. The registry lists it as active with a
                past expiry; which of the two is stale is not ours to decide. */}
            <dt className="text-amber-400">Registry expiry</dt>
            <dd className="text-amber-400">{prettyDate(expires)} — listed active anyway</dd>
          </div>
        )}
      </dl>

      <p className="mt-auto pt-2.5">
        <span className="block border-t border-ink-700/70 pt-2 font-mono text-[0.7rem] leading-4 tracking-tight text-chalk-400">
          {d.licenseNumber}
        </span>
      </p>

      {shelfHref && (
        <Chevron className="pointer-events-none absolute right-2 top-[1.6rem] h-5 w-5 text-chalk-300 transition-colors group-hover:text-moss-300" />
      )}
    </div>
  );
};
