'use client';

import { useSyncExternalStore } from 'react';
import clsx from 'clsx';
import type { Dispensary, Hours } from '@/lib/types';
import { hoursState, nyMoment, shopHoursState, type HoursState, type NyMoment } from '@/lib/hours';
import { StatusLine } from './Badges';

/* One clock for the whole page, ticking on the minute: 472 cards read it, and
   none keeps a timer of its own. A tab coming back from the background asks
   again, since a hidden tab's timers are slowed. */
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
const currentMinute = () => Math.floor(Date.now() / 60_000);

const tick = () => {
  listeners.forEach((l) => l());
  timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
};
const onVisible = () => {
  if (document.visibilityState === 'visible') listeners.forEach((l) => l());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (listeners.size === 1) {
    timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    document.addEventListener('visibilitychange', onVisible);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    }
  };
};

/**
 * New York's day and minute now, or null on the server and in the page as
 * built: the page is built once and read for days, so the time is only ever
 * the reader's browser's.
 */
export const useNyMoment = (): NyMoment | null => {
  const minute = useSyncExternalStore(subscribe, currentMinute, () => null);
  // A new object only when the minute turns, so what is worked out from it
  // is not worked out again on every render.
  return minute === null ? null : momentOf(minute);
};

let cached: { minute: number; moment: NyMoment } | undefined;
const momentOf = (minute: number): NyMoment => {
  if (cached?.minute !== minute) cached = { minute, moment: nyMoment(new Date(minute * 60_000)) };
  return cached.moment;
};

const TONE: Record<HoursState, { dot: string; text: string; label: string }> = {
  open: { dot: 'bg-moss-400', text: 'text-moss-400', label: 'Open' },
  closed: { dot: 'bg-rust-400', text: 'text-rust-400', label: 'Closed' },
  unknown: { dot: 'bg-amber-400', text: 'text-amber-400', label: 'Hours unknown' },
};

/**
 * The line above a shop's name. A shop the registry lists as trading shows
 * whether it is open now by its hours; any other shows the registry's word.
 * Until the browser has the time, the line holds its place with a dim dot.
 */
export const ShopStatus = ({
  d,
  className,
}: {
  d: Pick<Dispensary, 'operationalStatus' | 'hours'>;
  className?: string;
}) => {
  const now = useNyMoment();
  if (d.operationalStatus !== 'OPEN') return <StatusLine status={d.operationalStatus} className={className} />;

  const tone = now ? TONE[shopHoursState(d, now) ?? 'unknown'] : null;
  return (
    <span className={clsx('flex items-center gap-2', tone?.text, className)}>
      <span className={clsx('h-[7px] w-[7px] shrink-0 rounded-full', tone?.dot ?? 'bg-ink-600')} aria-hidden />
      <span className="truncate">{tone?.label ?? ' '}</span>
    </span>
  );
};

/** How many of the given hours are open now; a dash until the browser has the time. */
export const OpenNowCount = ({ hours }: { hours: (Hours | null)[] }) => {
  const now = useNyMoment();
  if (!now) return <>–</>;
  return <>{hours.filter((h) => hoursState(h, now) === 'open').length}</>;
};
