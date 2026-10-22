import clsx from 'clsx';
import type { Dispensary, OperationalStatus, VerificationStatus } from '@/lib/types';
import { OPERATIONAL_LABEL } from '@/lib/data';
import { leafPath } from './StorefrontArt';

/**
 * The verification badge is the product. It must never overstate: only a record
 * matched against the state registry gets the confident treatment.
 */
const VERIFICATION_STYLE: Record<VerificationStatus, { className: string; label: string }> = {
  // Grey, as the address beside it is, with only the tick in green: one
  // green mark a card, not a green block (owner, 22 October 2026).
  VERIFIED_OFFICIAL: {
    className: 'border-ink-600 bg-ink-800/70 text-chalk-200',
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

export const VerificationBadge = ({
  status,
  className,
}: {
  status: VerificationStatus;
  /** Size only: the card sets its pills a little smaller than a page does. */
  className?: string;
}) => {
  const style = VERIFICATION_STYLE[status];
  return (
    <span className={clsx('pill', style.className, className)}>
      {status === 'VERIFIED_OFFICIAL' && (
        <svg viewBox="0 0 24 24" className="h-3 w-3 text-moss-400" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
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

/* The colour of the status in a line of text. Grey for "not open yet" is
   chalk-400, not 500: the word must stay readable on the card at this size. */
const STATUS_TONE: Record<OperationalStatus, { dot: string; text: string }> = {
  OPEN: { dot: 'bg-moss-400', text: 'text-moss-400' },
  APPROVED_NOT_OPEN: { dot: 'bg-chalk-400', text: 'text-chalk-400' },
  TEMPORARILY_CLOSED: { dot: 'bg-amber-400', text: 'text-amber-400' },
  PERMANENTLY_CLOSED: { dot: 'bg-rust-400', text: 'text-rust-400' },
  UNKNOWN: { dot: 'bg-amber-400', text: 'text-amber-400' },
};

/**
 * The status as a line above a shop's name: a plain dot and the word, in the
 * status's colour. The dot never glows — the lit lamp on a card is the
 * shelf's (ShelfPill), and two lamps would read as one.
 */
export const StatusLine = ({ status, className }: { status: OperationalStatus; className?: string }) => (
  <span className={clsx('flex items-center gap-2', STATUS_TONE[status].text, className)}>
    <span className={clsx('h-[7px] w-[7px] shrink-0 rounded-full', STATUS_TONE[status].dot)} aria-hidden />
    <span className="truncate">{OPERATIONAL_LABEL[status]}</span>
  </span>
);

const LEAF = leafPath(12, 15.6, 12);

/**
 * The shelf's lamp, made a pill: green with a leaf and the count when we read
 * the shop's shelf, red with a red lamp and "No data yet" when we do not. The
 * green is a dull sage, not the accent: green enough to read as the lamp, quiet
 * enough beside the grey of the card (owner, 22 October 2026).
 */
export const ShelfPill = ({ count, className }: { count: number; className?: string }) =>
  count > 0 ? (
    <span className={clsx('pill border-moss-700/40 bg-moss-700/10 text-[#8cc4a6]', className)}>
      <svg viewBox="0 0 24 24" role="img" aria-label="Shelf read" className="h-3.5 w-3.5 shrink-0 fill-current">
        <path d={LEAF} />
      </svg>
      {count} {count === 1 ? 'strain' : 'strains'}
    </span>
  ) : (
    <span className={clsx('pill border-rust-400/45 bg-rust-400/10 text-rust-400', className)}>
      {/* The words say it; the lamp beside them is for the eye. */}
      <span aria-hidden className="flex">
        <ShelfLamp read={false} className="!h-2 !w-2" />
      </span>
      No data yet
    </span>
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
      read ? 'bg-moss-400 shadow-[0_0_8px_rgba(var(--glow),0.6)]' : 'bg-rust-400',
      className,
    )}
  />
);

/* chalk-400, not 500: a licence number is read, and at this size the dimmer
   grey falls short of a readable contrast on the dark cards. */
export const LicenseTag = ({ d }: { d: Dispensary }) => (
  <span className="font-mono text-[0.7rem] tracking-tight text-chalk-400">{d.licenseNumber}</span>
);
