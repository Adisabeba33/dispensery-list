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

/* The status says it in words alone. The lamp beside a shop's name is the
   shelf's (ShelfLamp), and two lit dots on one card would read as one. */
export const StatusBadge = ({ status }: { status: OperationalStatus }) => (
  <span className={clsx('pill', OPERATIONAL_STYLE[status])}>{OPERATIONAL_LABEL[status]}</span>
);

/**
 * Whether we read this shop's shelf: green when we do, red when we do not.
 * A shop with a red lamp has no data here yet — it is licensed, and its
 * shelf is simply not one we read.
 */
export const ShelfLamp = ({ read, className }: { read: boolean; className?: string }) => (
  <span
    role="img"
    aria-label={read ? 'Shelf read' : 'No data yet'}
    title={read ? 'Shelf read' : 'No data yet'}
    className={clsx(
      'inline-block h-2.5 w-2.5 shrink-0 rounded-full',
      read ? 'bg-moss-400 shadow-[0_0_8px_rgba(99,221,151,0.55)]' : 'bg-rust-400',
      className,
    )}
  />
);

export const LicenseTag = ({ d }: { d: Dispensary }) => (
  <span className="font-mono text-[0.7rem] tracking-tight text-chalk-500">{d.licenseNumber}</span>
);
