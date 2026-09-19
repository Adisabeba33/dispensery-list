import clsx from 'clsx';
import type { TerritoryShop } from '@/lib/territory-data';
import { displayName } from '@/lib/territory-data';
import { LICENSE_TYPE_LABEL } from '@/lib/data';
import { mapsUrl, prettyDate } from '@/lib/format';

/**
 * A shop in a territory that has nothing but its registry record.
 *
 * Separate from DispensaryCard rather than a variant of it. That card shows a
 * borough, a status badge, service pills, a strain count and a link to a
 * generated detail page — and for these records every one of those is either
 * wrong (the borough is null, so it would read "Westchester") or empty. A card
 * of blanks tells a reader we did a bad job; this one tells them what we have.
 */
export const TerritoryCard = ({ d }: { d: TerritoryShop }) => {
  const opened = prettyDate(d.dates?.openedOn ?? null);
  const expires = d.dates?.licenseExpiration ?? null;
  const expired = expires != null && expires < d.lastUpdated.slice(0, 10);

  return (
    <div className="card h-full p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[1.05rem] font-semibold tracking-tight text-chalk-50">
            {displayName(d)}
          </p>
          <p className="mt-1 text-sm text-chalk-400">{d.address.county} County</p>
        </div>
        <span
          className={clsx(
            'pill shrink-0',
            opened
              ? 'border-moss-600/50 bg-moss-600/10 text-moss-400'
              : 'border-ink-600 bg-ink-800 text-chalk-400',
          )}
        >
          {opened ? 'Opened to the public' : 'No opening date on file'}
        </span>
      </div>

      <p className="mt-3 text-sm text-chalk-200">
        {[d.address.line1, d.address.line2, `${d.address.city}, NY ${d.address.zip}`]
          .filter(Boolean)
          .join(', ')}
      </p>

      <dl className="mt-4 space-y-1 text-sm">
        {opened && (
          <div className="flex gap-2">
            <dt className="text-chalk-500">Registry records it opened</dt>
            <dd className="text-chalk-200">{opened}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="text-chalk-500">Licence</dt>
          <dd className="text-chalk-200">{LICENSE_TYPE_LABEL[d.licenseType] ?? d.licenseType}</dd>
        </div>
        {expired && (
          <div className="flex gap-2">
            {/* Stated, not corrected. The registry lists it as active with a
                past expiry; which of the two is stale is not ours to decide. */}
            <dt className="text-amber-400">Registry expiry</dt>
            <dd className="text-amber-400">{prettyDate(expires)} — listed active anyway</dd>
          </div>
        )}
      </dl>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-ink-700/70 pt-3">
        <a
          href={mapsUrl(d)}
          target="_blank"
          rel="noreferrer noopener"
          className="link text-sm"
        >
          Find the address
        </a>
        <span className="font-mono text-[0.7rem] tracking-tight text-chalk-500">
          {d.licenseNumber}
        </span>
      </div>
    </div>
  );
};
