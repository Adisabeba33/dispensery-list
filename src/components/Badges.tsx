import clsx from 'clsx';
import type { Dispensary, OperationalStatus, VerificationStatus } from '@/lib/types';
import { OPERATIONAL_LABEL } from '@/lib/data';

/**
 * The verification badge is the product. It must never overstate: only a record
 * matched against the state registry gets the confident treatment.
 */
const VERIFICATION_STYLE: Record<VerificationStatus, { className: string; label: string }> = {
  VERIFIED_OFFICIAL: {
    className: 'border-moss-600/60 bg-moss-600/12 text-moss-400',
    label: 'Registry-verified',
  },
  VERIFIED_SECONDARY: {
    className: 'border-amber-400/45 bg-amber-400/10 text-amber-400',
    label: 'Secondary sources',
  },
  UNVERIFIED: {
    className: 'border-rust-400/45 bg-rust-400/10 text-rust-400',
    label: 'Unverified',
  },
};

export const VerificationBadge = ({ status }: { status: VerificationStatus }) => {
  const style = VERIFICATION_STYLE[status];
  return (
    <span className={clsx('pill', style.className)}>
      {status === 'VERIFIED_OFFICIAL' && (
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
          <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {style.label}
    </span>
  );
};

const OPERATIONAL_STYLE: Record<OperationalStatus, string> = {
  OPEN: 'border-moss-600/50 bg-moss-600/10 text-moss-400',
  APPROVED_NOT_OPEN: 'border-ink-600 bg-ink-800 text-chalk-400',
  TEMPORARILY_CLOSED: 'border-amber-400/40 bg-amber-400/10 text-amber-400',
  PERMANENTLY_CLOSED: 'border-rust-400/40 bg-rust-400/10 text-rust-400',
  UNKNOWN: 'border-ink-600 bg-ink-800 text-chalk-400',
};

export const StatusBadge = ({ status }: { status: OperationalStatus }) => (
  <span className={clsx('pill', OPERATIONAL_STYLE[status])}>
    <span
      aria-hidden
      className={clsx('h-1.5 w-1.5 rounded-full bg-current', status === 'OPEN' && 'animate-pulse')}
    />
    {OPERATIONAL_LABEL[status]}
  </span>
);

export const LicenseTag = ({ d }: { d: Dispensary }) => (
  <span className="font-mono text-[0.7rem] tracking-tight text-chalk-500">{d.licenseNumber}</span>
);
