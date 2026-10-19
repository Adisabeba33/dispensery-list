'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import type { MoveCard } from '@/lib/moves';
import {
  LINEAGE_CHIP,
  MOVE_TITLE,
  dayRange,
  moveDating,
  moveSubtitle,
  shortDay,
  type Rules,
} from '@/lib/moves-copy';
import { DayBars, MoveIcon } from './MovesIcons';

type Type = (typeof LINEAGE_CHIP)[number]['id'];

/* The type a reader picked, in the address, so a list's own page opens on it
   and the back button returns to it. */
export const typeFromUrl = (): Type => {
  const t = new URLSearchParams(window.location.search).get('type');
  return LINEAGE_CHIP.some((c) => c.id === t) ? (t as Type) : 'all';
};

export const TypeChips = ({ type, onChange }: { type: Type; onChange: (t: Type) => void }) => (
  <div className="flex flex-wrap gap-2" role="group" aria-label="Type">
    {LINEAGE_CHIP.map((c) => (
      <button
        key={c.id}
        type="button"
        aria-pressed={type === c.id}
        onClick={() => onChange(c.id)}
        className={clsx('chip', type === c.id && 'chip-on')}
      >
        {c.label}
      </button>
    ))}
  </div>
);

const Chevron = () => (
  <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 shrink-0 text-chalk-500" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const MovesOverview = ({
  cards,
  rules,
  day,
  newFrom,
  leavingFrom,
}: {
  cards: MoveCard[];
  rules: Rules;
  day: string;
  newFrom: string;
  leavingFrom: string;
}) => {
  const [type, setType] = useState<Type>('all');

  useEffect(() => setType(typeFromUrl()), []);

  const choose = (t: Type) => {
    setType(t);
    const url = t === 'all' ? window.location.pathname : `${window.location.pathname}?type=${t}`;
    window.history.replaceState(null, '', url);
  };

  const query = type === 'all' ? '' : `?type=${type}`;
  const year = new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <>
      {/* The day of the read and the two windows the lists are drawn from —
          not a comparison with one earlier day: what is new is counted over
          a week, what is leaving over a fortnight. */}
      <div className="card mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <p className="flex items-center gap-3 text-chalk-50">
          <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 text-chalk-400" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="3.5" y="5" width="17" height="15" rx="2" />
            <path d="M3.5 9.5h17M8 3v4M16 3v4" strokeLinecap="round" />
          </svg>
          <time dateTime={day}>{year}</time>
        </p>
        <p className="text-xs leading-relaxed text-chalk-400 sm:text-right">
          New: {dayRange(newFrom, day)} ({rules.newDays} days)
          <br />
          Leaving: {dayRange(leavingFrom, day)} ({rules.movesDays} days)
        </p>
      </div>

      <div className="mt-5">
        <TypeChips type={type} onChange={choose} />
      </div>

      <ul className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const count = card.count[type];
          const bars = card.bars?.[type];
          const dating = moveDating(card.kind);
          return (
            <li key={card.kind} id={card.kind} className="scroll-mt-28 sm:scroll-mt-20">
              <Link
                href={`/moves/${card.kind}/${query}`}
                className="card card-hover flex h-full gap-4 p-5"
              >
                <MoveIcon kind={card.kind} className="mt-0.5" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-medium text-chalk-50">{MOVE_TITLE[card.kind]}</span>
                    <Chevron />
                  </span>
                  <span className="mt-1 flex items-end justify-between gap-4">
                    <span className="min-w-0">
                      <span className="block text-3xl font-semibold tabular-nums tracking-tight text-chalk-50">
                        {count ?? '—'}
                      </span>
                      <span className="mt-1.5 block text-sm leading-snug text-chalk-400">
                        {count === null
                          ? 'A strain gone from every shelf has no type on any of them.'
                          : moveSubtitle(card.kind, rules)}
                      </span>
                    </span>
                    {bars && dating && count !== null && (
                      <DayBars
                        values={bars}
                        label={`${MOVE_TITLE[card.kind]} ${dating}: ${card.barDays
                          .map((d, i) => `${shortDay(d)} ${bars[i]}`)
                          .join(', ')}`}
                      />
                    )}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
};
