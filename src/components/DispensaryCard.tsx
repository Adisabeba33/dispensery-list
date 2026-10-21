'use client';

import Link from 'next/link';
import clsx from 'clsx';
import type { Dispensary } from '@/lib/types';
import { displayName, LICENSE_TYPE_LABEL, regionOf } from '@/lib/data';
import { fullAddress } from '@/lib/format';
import { LicenseTag, ShelfPill, VerificationBadge } from './Badges';
import { Barcode } from './Barcode';
import { DispensaryDetail } from './DispensaryDetail';
import { ShopStatus } from './LiveHours';
import { StorefrontArt } from './StorefrontArt';

/* The pills on a card are set a size smaller than on a shop's own page, and
   pulled in a little more on a phone narrower than 390px, where the two would
   otherwise not fit side by side. */
const CARD_PILL = 'h-[1.15rem] gap-1 px-2.5 py-0 text-[0.7rem] [@media(max-width:389px)]:px-2';

type SummaryProps = {
  d: Dispensary;
  expanded: boolean;
  menuCount: number;
};

const CardSummary = ({ d, expanded, menuCount }: SummaryProps) => (
  <>
    <span className="relative m-0.5 mr-0 w-[5.5rem] shrink-0 [@media(max-width:389px)]:w-[4.5rem] self-stretch overflow-hidden rounded-[4px] bg-ink-900">
      {/* Out of the flow: the card's words set its height, and the picture fills it. */}
      <StorefrontArt licenseNumber={d.licenseNumber} line1={d.address.line1} className="absolute inset-0" />
    </span>

    {/* A container, so the bottom line can drop its barcode when the card is
        too narrow for it — the card's width is the grid's, not the screen's. */}
    <span className="min-w-0 flex-1 pb-1.5 pl-2.5 pr-2.5 pt-1.5 [container-type:inline-size]">
      <ShopStatus d={d} className="pr-7 text-[0.72rem] leading-4" />
      <span
        className={clsx(
          'mt-[3px] block truncate pr-7 text-[1.06rem] font-bold leading-[1.375rem] tracking-tight text-chalk-50 transition-colors',
          !expanded && 'group-hover:text-moss-300',
        )}
      >
        {displayName(d)}
      </span>
      <span className="block truncate pr-7 text-[0.75rem] leading-4 text-chalk-200">
        {d.address.neighborhood ? `${d.address.neighborhood} · ` : ''}
        {regionOf(d)}
      </span>
      <span className="mt-1 flex items-start gap-1.5 text-[0.75rem] leading-4 text-chalk-200">
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
        <span className="line-clamp-2 min-w-0">{fullAddress(d)}</span>
      </span>

      <span className="mt-2 flex flex-wrap gap-x-1.5 gap-y-1.5">
        <VerificationBadge status={d.verification.status} className={CARD_PILL} />
        <ShelfPill count={menuCount} className={CARD_PILL} />
      </span>

      <span className="mt-1 flex items-end gap-2 text-[0.68rem] leading-4 text-chalk-400">
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-3">
          <span>{LICENSE_TYPE_LABEL[d.licenseType]}</span>
          <LicenseTag d={d} />
        </span>
        <Barcode
          code={d.licenseNumber}
          className="mb-0.5 ml-auto hidden text-chalk-500/80 [@container(min-width:16.75rem)]:block"
        />
      </span>
    </span>

    {/* Faint columns of marks in the card's top corner, like a terminal's. */}
    <span aria-hidden className="card-rain pointer-events-none absolute right-3 top-1.5 h-20 w-14 opacity-[0.13]" />
    <svg
      viewBox="0 0 24 24"
      className={clsx(
        'absolute right-1 top-[2.1rem] h-5 w-5 text-chalk-300 transition-transform duration-200 motion-reduce:transition-none',
        expanded && 'rotate-90',
        !expanded && 'group-hover:text-moss-300',
      )}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 5 7 7-7 7" />
    </svg>
  </>
);

/* The summary's focus ring is drawn over it, not round it: the picture sits
   at its edge and would hide a ring drawn underneath. */
const SUMMARY =
  'group relative flex w-full flex-1 text-left focus-visible:outline-none ' +
  "focus-visible:after:pointer-events-none focus-visible:after:absolute focus-visible:after:inset-0 focus-visible:after:rounded-[5px] focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-moss-300 focus-visible:after:content-['']";

type Props = {
  d: Dispensary;
  expanded?: boolean;
  onToggle?: () => void;
  /** Counted on the server: the client never holds every shop's shelf. */
  menuCount?: number;
};

/**
 * The summary is the button and the detail is its sibling — never nested inside
 * it. Links and controls inside a <button> are invalid markup, and browsers
 * swallow their clicks, which would break every link in the expanded view.
 */
export const DispensaryCard = ({ d, expanded = false, onToggle, menuCount = 0 }: Props) => {
  // Used outside the directory (the Westchester page) there is nothing to
  // expand into, so the summary links to the standalone page instead.
  const asLink = !onToggle;

  return (
    <div
      className={clsx(
        // Tighter corners than the lit frame elsewhere, as the mockup draws them.
        'card-lit flex h-full flex-col rounded-md transition-[border-color,box-shadow]',
        expanded ? 'border-moss-300' : 'hover:border-moss-300',
      )}
    >
      {asLink ? (
        <Link href={`/dispensary/${d.id}/`} className={SUMMARY}>
          <CardSummary d={d} expanded={expanded} menuCount={menuCount} />
        </Link>
      ) : (
        <button type="button" onClick={onToggle} aria-expanded={expanded} className={SUMMARY}>
          <CardSummary d={d} expanded={expanded} menuCount={menuCount} />
        </button>
      )}

      {expanded && (
        <div className="border-t border-moss-700/50 px-4 pb-5 pt-5 sm:px-6">
          <DispensaryDetail d={d} hasMenu={menuCount > 0} />

          <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-ink-700/70 pt-4">
            <button
              type="button"
              onClick={onToggle}
              className="h-11 rounded-lg border border-moss-700/70 bg-ink-900/80 px-5 text-sm text-chalk-100 transition-colors hover:border-moss-500 hover:text-chalk-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss-300"
            >
              Close
            </button>
            {/* The standalone page still exists, for linking and for search engines. */}
            <Link href={`/dispensary/${d.id}/`} className="link text-sm">
              Open as its own page
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
