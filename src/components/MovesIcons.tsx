import clsx from 'clsx';
import type { MoveKind } from '@/lib/moves';

/* One outline icon per list, in chalk: green on this site is for links and the
   lamp, and red for a shop we have no data on — not for a strain leaving. */
const PATHS: Record<MoveKind, React.ReactNode> = {
  // A sprout: something new from a grower.
  debuts: (
    <>
      <path d="M12 21v-9" />
      <path d="M12 12c0-4 2.5-6.5 7-6.5 0 4.5-2.5 6.5-7 6.5Z" />
      <path d="M12 14c0-3.5-2-5.5-6.5-5.5 0 4 2 5.5 6.5 5.5Z" />
    </>
  ),
  // Rings going out: a delivery going round.
  waves: (
    <>
      <circle cx="12" cy="12" r="2" />
      <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 16.2a6 6 0 0 0 0-8.4" />
      <path d="M4.9 4.9a10 10 0 0 0 0 14.2M19.1 19.1a10 10 0 0 0 0-14.2" />
    </>
  ),
  // A box: a batch.
  batches: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </>
  ),
  // A plus in a ring: newly on a shelf.
  new: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  // Down, in a ring: on fewer shops.
  low: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v9M8 12.5l4 4 4-4" />
    </>
  ),
  // An eye shut: no longer seen.
  gone: (
    <>
      <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M4 20 20 4" />
    </>
  ),
};

export const MoveIcon = ({ kind, className }: { kind: MoveKind; className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={clsx('h-7 w-7 shrink-0 text-chalk-400', className)}
  >
    {PATHS[kind]}
  </svg>
);

/**
 * How many of a list's items fall on each day it dates them by — when they
 * turned up, not a trend. Grey, like the icons; a day with none keeps a stub
 * so the days stay where they are.
 */
export const DayBars = ({ values, label }: { values: number[]; label: string }) => {
  const max = Math.max(1, ...values);
  const w = 6;
  const gap = 4;
  const h = 32;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${values.length * (w + gap) - gap} ${h}`}
      className="h-8 w-auto shrink-0"
    >
      {values.map((v, i) => {
        const bar = v === 0 ? 1.5 : Math.max(3, (v / max) * h);
        return (
          <rect
            key={i}
            x={i * (w + gap)}
            y={h - bar}
            width={w}
            height={bar}
            rx={1}
            className={v === 0 ? 'fill-ink-600' : 'fill-chalk-500'}
          />
        );
      })}
    </svg>
  );
};

/**
 * A wave's shelves by each day we read: a line that rises as it reaches more
 * of them, the last point today's figure.
 */
export const ShelfLine = ({ values, label }: { values: number[]; label: string }) => {
  if (values.length < 2) return null;
  const w = 240;
  const h = 56;
  const pad = 5;
  const max = Math.max(1, ...values);
  const x = (i: number) => pad + (i * (w - 2 * pad)) / (values.length - 1);
  const y = (v: number) => h - pad - (v / max) * (h - 2 * pad);
  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${w} ${h}`} className="h-14 w-full max-w-xs">
      <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} className="stroke-ink-600" strokeDasharray="2 3" />
      <polyline points={points} fill="none" className="stroke-chalk-400" strokeWidth="1.5" strokeLinejoin="round" />
      {values.map((v, i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(v)}
          r={i === values.length - 1 ? 3.5 : 2.2}
          className={i === values.length - 1 ? 'fill-chalk-50' : 'fill-chalk-500'}
        />
      ))}
    </svg>
  );
};
