import Link from 'next/link';
import type { Dispensary } from '@/lib/types';
import { displayName, LICENSE_TYPE_LABEL, regionOf } from '@/lib/data';
import { fullAddress, SERVICE_LABELS } from '@/lib/format';
import { LicenseTag, StatusBadge, VerificationBadge } from './Badges';

export const DispensaryCard = ({ d }: { d: Dispensary }) => {
  // Only services confirmed true are shown. An unchecked service is absent, not
  // denied — claiming "no delivery" because nobody looked would be a lie.
  const confirmed = SERVICE_LABELS.filter(({ key }) => d.services?.[key] === true).slice(0, 4);

  return (
    <Link href={`/dispensary/${d.id}/`} className="card card-hover group block p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[1.05rem] font-semibold tracking-tight text-chalk-50 group-hover:text-moss-400">
            {displayName(d)}
          </h3>
          <p className="mt-1 text-sm text-chalk-400">
            {d.address.neighborhood ? `${d.address.neighborhood} · ` : ''}
            {regionOf(d)}
          </p>
        </div>
        <StatusBadge status={d.operationalStatus} />
      </div>

      <p className="mt-3 text-sm text-chalk-200">{fullAddress(d)}</p>

      {confirmed.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {confirmed.map(({ key, label }) => (
            <li key={key} className="rounded-md bg-ink-800 px-2 py-1 text-[0.7rem] text-chalk-200">
              {label}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-ink-700/70 pt-3">
        <VerificationBadge status={d.verification.status} />
        <div className="flex items-center gap-3">
          <span className="text-[0.7rem] text-chalk-500">{LICENSE_TYPE_LABEL[d.licenseType]}</span>
          <LicenseTag d={d} />
        </div>
      </div>
    </Link>
  );
};
