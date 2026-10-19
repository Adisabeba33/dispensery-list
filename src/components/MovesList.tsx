'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { MoveItem, MoveKind } from '@/lib/moves';
import { LINEAGE_CHIP, MOVE_SORTS, shortDay } from '@/lib/moves-copy';
import type { Shop } from '@/lib/signals';
import { DebutTag } from './DebutTag';
import { ShelfLine } from './MovesIcons';
import { TypeChips, typeFromUrl } from './MovesOverview';

type Type = (typeof LINEAGE_CHIP)[number]['id'];

/* What "most shops call it" means for each type: a leaning counts. */
const TYPE_WORDS: Record<Exclude<Type, 'all'>, string> = {
  indica: 'indica or indica-leaning',
  sativa: 'sativa or sativa-leaning',
  hybrid: 'hybrid',
};

/* How many stand in the open before "Show more". */
const PAGE = 60;
/* How many places a row names before "+N more". */
const NAMED = 2;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/* The shops it is on now, as the read counted them. */
const nowAt = (i: MoveItem) => i.count ?? i.shops.length;

const byName = (a: MoveItem, b: MoveItem) => a.strain.localeCompare(b.strain) || (a.brand ?? '').localeCompare(b.brand ?? '');

/* Each order, as a comparator; the read's own order is kept by a stable sort
   on a comparator that says nothing. */
const ORDER: Record<string, (a: MoveItem, b: MoveItem) => number> = {
  strongest: () => 0,
  drop: () => 0,
  shops: (a, b) => (b.seenAt ?? nowAt(b)) - (a.seenAt ?? nowAt(a)) || nowAt(b) - nowAt(a),
  now: (a, b) => (b.now ?? 0) - (a.now ?? 0) || (b.shelves ?? 0) - (a.shelves ?? 0) || byName(a, b),
  newest: (a, b) => b.day.localeCompare(a.day) || (b.shelves ?? b.shops.length) - (a.shelves ?? a.shops.length),
  today: (a, b) => (b.today ?? 0) - (a.today ?? 0) || (b.shelves ?? 0) - (a.shelves ?? 0),
  fewest: (a, b) => nowAt(a) - nowAt(b) || (b.peak ?? 0) - (a.peak ?? 0),
  recent: (a, b) => b.day.localeCompare(a.day) || (b.peak ?? 0) - (a.peak ?? 0),
  widest: (a, b) => (b.peak ?? 0) - (a.peak ?? 0) || b.day.localeCompare(a.day),
  name: byName,
};

/* The places a row names: the first two, and the rest a tap away. Two shops
   of one name — Terp Bros on Ditmars and on Crossbay — carry their street. */
const Places = ({ shops, lead }: { shops: Shop[]; lead?: string }) => {
  const [all, setAll] = useState(false);
  if (shops.length === 0) return null;
  const twice = new Set(shops.map((s) => s.name).filter((n, i, names) => names.indexOf(n) !== i));
  const label = (s: Shop) => (twice.has(s.name) ? `${s.name}, ${s.street}` : s.name);
  const shown = all ? shops : shops.slice(0, NAMED);
  return (
    <p className="mt-1.5 text-sm text-chalk-400">
      {lead && <span className="text-chalk-500">{lead} </span>}
      {shown.map((s, i) => (
        <span key={s.id}>
          {i > 0 && <span className="text-chalk-500"> · </span>}
          <Link href={`/dispensary/${s.id}/`} className="link">
            {label(s)}
          </Link>
          {all && <span className="text-chalk-500"> ({s.region})</span>}
        </span>
      ))}
      {shops.length > NAMED && (
        <>
          <span className="text-chalk-500"> · </span>
          <button
            type="button"
            aria-expanded={all}
            onClick={() => setAll((v) => !v)}
            className="whitespace-nowrap text-chalk-500 hover:text-chalk-200"
          >
            {all ? 'fewer' : `+${shops.length - NAMED} more`}
            <span className="sr-only"> shops</span>
          </button>
        </>
      )}
    </p>
  );
};

const Grower = ({ item }: { item: MoveItem }) => (
  <p className="mt-0.5 text-sm text-chalk-500">
    {item.brand ? (
      <>
        by{' '}
        {item.brandKey ? (
          <Link href={`/menus/brands/${item.brandKey}/`} className="text-chalk-300 hover:text-moss-400">
            {item.brand}
          </Link>
        ) : (
          <span className="text-chalk-300">{item.brand}</span>
        )}
      </>
    ) : (
      'Grower not stated'
    )}
  </p>
);

const Name = ({ item }: { item: MoveItem }) =>
  item.slug ? (
    <Link href={`/menus/strains/${item.slug}/`} className="font-medium text-chalk-50 hover:text-moss-400">
      {item.strain}
    </Link>
  ) : (
    <span className="font-medium text-chalk-50">{item.strain}</span>
  );

const Chevron = ({ item }: { item: MoveItem }) =>
  item.slug ? (
    <Link
      href={`/menus/strains/${item.slug}/`}
      aria-label={`${item.strain}: every shelf it is on`}
      className="-mr-1 shrink-0 self-center p-1 text-chalk-500 hover:text-chalk-50"
    >
      <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  ) : null;

const Pill = ({ children }: { children: React.ReactNode }) => (
  <span className="shrink-0 whitespace-nowrap rounded-md border border-moss-600 bg-moss-600/15 px-2 py-0.5 text-[0.7rem] text-moss-400">
    {children}
  </span>
);

/* What each list says about an item, in a line. */
const Facts = ({ kind, item }: { kind: MoveKind; item: MoveItem }) => {
  const now = nowAt(item);
  switch (kind) {
    case 'debuts':
      return (
        <>
          First seen {shortDay(item.day)}
          {now > 0 ? ` · at ${plural(now, 'shop', 'shops')} now` : ' · on none of the shelves we read now'}
        </>
      );
    case 'new':
      return (
        <>
          New on {plural(item.shelves ?? 0, 'shelf', 'shelves')} since {shortDay(item.day)} · on{' '}
          {plural(item.now ?? 0, 'shop', 'shops')} now
        </>
      );
    case 'batches':
      return (
        <>
          First seen {shortDay(item.day)}
          {now > 0 ? ` · now at ${plural(now, 'shop', 'shops')}` : ' · on none of the shelves we read now'}
        </>
      );
    case 'low':
      return (
        <>
          On {plural(now, 'shop', 'shops')} now, down from {item.peak} on {shortDay(item.day)}
        </>
      );
    case 'gone':
      return (
        <>
          Last seen {shortDay(item.day)}, on {item.peak} shops at most
        </>
      );
    default:
      return null;
  }
};

const Row = ({ kind, item }: { kind: MoveKind; item: MoveItem }) => (
  <li className="flex gap-3 py-4">
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Name item={item} />
        {item.debut && <DebutTag debut={item.debut} />}
        {kind === 'batches' && item.thc !== undefined && <Pill>THC {item.thc}%</Pill>}
      </div>
      <Grower item={item} />
      <p className="mt-1.5 text-sm text-chalk-300">
        <Facts kind={kind} item={item} />
      </p>
      {kind === 'batches' && item.before && item.before.length > 0 && (
        <p className="mt-0.5 text-xs text-chalk-500">
          Earlier figures: {item.before.slice(0, 5).join('%, ')}%{item.before.length > 5 ? ' …' : ''}
        </p>
      )}
      <Places
        shops={item.shops}
        lead={kind === 'gone' ? 'Last seen at' : kind === 'new' ? 'Turned up at' : undefined}
      />
    </div>
    <Chevron item={item} />
  </li>
);

const WaveCard = ({ item }: { item: MoveItem }) => (
  <li className="card flex gap-3 p-4">
    <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Name item={item} />
          <Grower item={item} />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {(item.today ?? 0) > 0 && <Pill>+{item.today} today</Pill>}
          {item.debut && <DebutTag debut={item.debut} />}
        </div>
      </div>
      <p className="mt-2 text-sm text-chalk-300">
        {plural(item.shelves ?? 0, 'shelf', 'shelves')} since {shortDay(item.day)} · on{' '}
        {plural(item.now ?? 0, 'shop', 'shops')} now
      </p>
      {item.series && (
        <div className="mt-2">
          <ShelfLine
            values={item.series}
            label={`Shelves we had found it on by each day we read: ${item.series.join(', ')}`}
          />
        </div>
      )}
      <Places shops={item.shops} lead="Turned up at" />
    </div>
    <Chevron item={item} />
  </li>
);

export const MovesList = ({ kind, items }: { kind: MoveKind; items: MoveItem[] }) => {
  const sorts = MOVE_SORTS[kind];
  const [type, setType] = useState<Type>('all');
  const [sort, setSort] = useState(sorts[0].id);
  const [limit, setLimit] = useState(PAGE);
  const typed = kind !== 'gone';

  /* The type and the order in the address, so a reader who opens a strain and
     comes back finds the list as they left it. */
  useEffect(() => {
    if (typed) setType(typeFromUrl());
    const asked = new URLSearchParams(window.location.search).get('sort');
    if (asked && sorts.some((s) => s.id === asked)) setSort(asked);
  }, [typed, sorts]);

  const remember = (next: { type?: Type; sort?: string }) => {
    const params = new URLSearchParams(window.location.search);
    const t = next.type ?? type;
    const o = next.sort ?? sort;
    if (t === 'all') params.delete('type');
    else params.set('type', t);
    if (o === sorts[0].id) params.delete('sort');
    else params.set('sort', o);
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  };

  const chooseType = (t: Type) => {
    setType(t);
    setLimit(PAGE);
    remember({ type: t });
  };

  const shown = useMemo(() => {
    const kept = type === 'all' ? items : items.filter((i) => i.lineage === type);
    return [...kept].sort(ORDER[sort] ?? (() => 0));
  }, [items, type, sort]);

  return (
    <>
      <div className="mt-6 flex flex-col gap-4">
        {typed ? (
          <TypeChips type={type} onChange={chooseType} />
        ) : (
          <p className="text-sm text-chalk-500">
            Not by type: a strain gone from every shelf has no type on any of them.
          </p>
        )}
        <label className="card relative flex items-center gap-2 px-4 py-3 text-sm text-chalk-400 focus-within:border-moss-600 focus-within:ring-2 focus-within:ring-moss-600/25">
          <span>Sort:</span>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setLimit(PAGE);
              remember({ sort: e.target.value });
            }}
            className="w-full cursor-pointer appearance-none bg-transparent pr-8 text-chalk-50 focus:outline-none"
          >
            {sorts.map((s) => (
              <option key={s.id} value={s.id} className="bg-ink-900">
                {s.label}
              </option>
            ))}
          </select>
          <svg viewBox="0 0 24 24" aria-hidden className="pointer-events-none absolute right-4 h-4 w-4 text-chalk-400" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </label>
        {/* Mounted for as long as the filter is, so a change is announced. */}
        {typed && (
          <p className="text-sm text-chalk-400 empty:hidden" aria-live="polite">
            {type === 'all'
              ? ''
              : `${shown.length} of ${items.length}, where most shops call it ${TYPE_WORDS[type]}`}
          </p>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="mt-8 text-sm text-chalk-500">Nothing on this list is of that type today.</p>
      ) : kind === 'waves' ? (
        <ul className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.slice(0, limit).map((item) => (
            <WaveCard key={item.id} item={item} />
          ))}
        </ul>
      ) : (
        <ul className="mt-3 divide-y divide-ink-700/60 border-b border-ink-700/60">
          {shown.slice(0, limit).map((item) => (
            <Row key={item.id} kind={kind} item={item} />
          ))}
        </ul>
      )}

      {shown.length > limit && (
        <div className="mt-6 flex justify-center">
          <button type="button" onClick={() => setLimit((n) => n + PAGE * 2)} className="chip">
            Show more ({shown.length - limit} left)
          </button>
        </div>
      )}
    </>
  );
};
