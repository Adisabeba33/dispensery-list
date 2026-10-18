'use client';

import Link from 'next/link';
import clsx from 'clsx';
import type { Dispensary } from '@/lib/types';
import { displayName, LICENSE_TYPE_LABEL, regionOf } from '@/lib/data';
import { fullAddress } from '@/lib/format';
import { LicenseTag, ShelfLamp, StatusBadge, VerificationBadge } from './Badges';
import { DispensaryDetail } from './DispensaryDetail';


type SummaryProps = {
  d: Dispensary;
  expanded: boolean;
  menuCount: number;
};

const CardSummary = ({ d, expanded, menuCount }: SummaryProps) => (
  <>
        <span className="flex w-full items-start justify-between gap-3">
          <span className="flex min-w-0 items-start gap-2.5">
            <ShelfLamp read={menuCount > 0} className="mt-[0.45rem]" />
            <span className="min-w-0">
              <span
                className={clsx(
                  'block truncate text-[1.05rem] font-semibold tracking-tight text-chalk-50',
                  !expanded && 'group-hover:text-moss-400',
                )}
              >
                {displayName(d)}
              </span>
              <span className="mt-1 block text-sm text-chalk-400">
                {d.address.neighborhood ? `${d.address.neighborhood} · ` : ''}
                {regionOf(d)}
              </span>
            </span>
          </span>
          <StatusBadge status={d.operationalStatus} />
        </span>

        <span className="mt-3 block text-sm text-chalk-200">{fullAddress(d)}</span>

        <span className="mt-4 flex w-full flex-wrap items-center justify-between gap-2 border-t border-ink-700/70 pt-3">
          <span className="flex flex-wrap items-center gap-2">
            <VerificationBadge status={d.verification.status} />
            {menuCount > 0 ? (
              <span className="pill border-moss-600/45 bg-moss-600/10 text-moss-400">
                {menuCount} strains
              </span>
            ) : (
              <span className="pill border-rust-400/40 bg-rust-400/10 text-rust-400">No data yet</span>
            )}
          </span>
          <span className="flex items-center gap-3">
            <span className="text-[0.7rem] text-chalk-500">{LICENSE_TYPE_LABEL[d.licenseType]}</span>
            <LicenseTag d={d} />
          </span>
        </span>
  </>
);

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
        'card h-full p-5 transition-colors',
        expanded ? 'border-moss-600/55 bg-ink-800/90' : 'card-hover',
      )}
    >
      {asLink ? (
        <Link href={`/dispensary/${d.id}/`} className="group flex w-full flex-1 flex-col text-left">
          <CardSummary d={d} expanded={expanded} menuCount={menuCount} />
        </Link>
      ) : (
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="group flex w-full flex-1 flex-col text-left"
      >
        <CardSummary d={d} expanded={expanded} menuCount={menuCount} />
      </button>
      )}

      {expanded && (
        <div className="mt-5 border-t border-ink-700 pt-5">
          <DispensaryDetail d={d} hasMenu={menuCount > 0} />

          <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-ink-700/70 pt-4">
            <button
              type="button"
              onClick={onToggle}
              className="rounded-lg border border-ink-700 bg-ink-800 px-4 py-2 text-sm text-chalk-300 transition-colors hover:border-chalk-500 hover:text-chalk-100"
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
