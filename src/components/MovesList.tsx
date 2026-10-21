'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import type { MoveItem, MoveKind } from '@/lib/moves';
import { LINEAGE_CHIP, MOVE_SORTS, shortDay } from '@/lib/moves-copy';
import type { Shop } from '@/lib/signals';
import { DebutTag } from './DebutTag';
import { ShelfLine } from './MovesIcons';
import { TypeChips, typeFromUrl } from './MovesOverview';
import { Chevron, EmptyState, SortSelect } from './PageParts';

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
    <p className="mt-1.5 text-sm leading-relaxed text-chalk-400">
      {lead && <span>{lead} </span>}
      {shown.map((s, i) => (
        <span key={s.id}>
          {i > 0 && <span className="text-chalk-400"> · </span>}
          <Link
            href={`/dispensary/${s.id}/`}
            className="link rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-moss-400"
          >
            {label(s)}
          </Link>
          {all && <span className="text-chalk-400"> ({s.region})</span>}
        </span>
      ))}
      {shops.length > NAMED && (
        <>
          <span className="text-chalk-400"> · </span>
          {/* It opens the rest of the list, so it carries the chevron every
              disclosure on the site does. */}
          <button
            type="button"
            aria-expanded={all}
            onClick={() => setAll((v) => !v)}
            className="-my-1 inline-flex items-center gap-0.5 whitespace-nowrap rounded-sm py-1 align-baseline text-chalk-300 transition-colors hover:text-moss-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-moss-400"
          >
            {all ? 'fewer' : `+${shops.length - NAMED} more`}
            <span className="sr-only"> shops</span>
            <Chevron className="h-3.5 w-3.5 self-center" />
          </button>
        </>
      )}
    </p>
  );
};

const Grower = ({ item }: { item: MoveItem }) => (
  <p className="mt-0.5 text-sm text-chalk-400">
    {item.brand ? (
      <>
        by{' '}
        {item.brandKey ? (
          <Link
            href={`/menus/brands/${item.brandKey}/`}
            className="rounded-sm text-chalk-200 transition-colors hover:text-moss-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-moss-400"
          >
            {item.brand}
          </Link>
        ) : (
          <span className="text-chalk-200">{item.brand}</span>
        )}
      </>
    ) : (
      'Grower not stated'
    )}
  </p>
);

const Name = ({ item }: { item: MoveItem }) =>
  item.slug ? (
    <Link
      href={`/menus/strains/${item.slug}/`}
      className="rounded-sm font-semibold tracking-tight text-chalk-50 transition-colors hover:text-moss-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-moss-400"
    >
      {item.strain}
    </Link>
  ) : (
    <span className="font-semibold tracking-tight text-chalk-50">{item.strain}</span>
  );

/* The way to the strain's page, at the row's end: the chevron every row that
   leads somewhere ends in, with a finger's room round it. */
const StrainLink = ({ item }: { item: MoveItem }) =>
  item.slug ? (
    <Link
      href={`/menus/strains/${item.slug}/`}
      aria-label={`${item.strain}: every shelf it is on`}
      className="-mr-2 grid h-10 w-9 shrink-0 place-items-center self-center rounded-md text-chalk-400 transition-colors hover:text-moss-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-moss-400"
    >
      <Chevron className="h-5 w-5" />
    </Link>
  ) : null;

/* A figure beside the name — a THC reading, today's shelves — in a tag. */
const Figure = ({ children }: { children: React.ReactNode }) => (
  <span className="tag shrink-0 whitespace-nowrap border-moss-600/60 bg-moss-600/10 tabular-nums text-moss-300">
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

/* A row that leads to its strain's page is a .row-link, chevron and all; one
   without a page keeps the rule between rows and nothing more. */
const Row = ({ kind, item }: { kind: MoveKind; item: MoveItem }) => (
  <li
    className={clsx(
      'px-4 sm:px-5',
      item.slug ? 'row-link items-start gap-2 sm:gap-3' : 'flex border-b border-ink-700/70 py-3.5 last:border-b-0',
    )}
  >
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Name item={item} />
        {item.debut && <DebutTag debut={item.debut} />}
        {kind === 'batches' && item.thc !== undefined && <Figure>THC {item.thc}%</Figure>}
      </div>
      <Grower item={item} />
      <p className="mt-1.5 text-pretty text-sm text-chalk-200">
        <Facts kind={kind} item={item} />
      </p>
      {kind === 'batches' && item.before && item.before.length > 0 && (
        <p className="stamp mt-0.5">
          Earlier figures: {item.before.slice(0, 5).join('%, ')}%{item.before.length > 5 ? ' …' : ''}
        </p>
      )}
      <Places
        shops={item.shops}
        lead={kind === 'gone' ? 'Last seen at' : kind === 'new' ? 'Turned up at' : undefined}
      />
    </div>
    <StrainLink item={item} />
  </li>
);

const WaveCard = ({ item }: { item: MoveItem }) => (
  <li className="card flex gap-3 p-4 sm:p-5">
    <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Name item={item} />
          <Grower item={item} />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {(item.today ?? 0) > 0 && <Figure>+{item.today} today</Figure>}
          {item.debut && <DebutTag debut={item.debut} />}
        </div>
      </div>
      <p className="mt-2 text-pretty text-sm text-chalk-200">
        {plural(item.shelves ?? 0, 'shelf', 'shelves')} since {shortDay(item.day)} · on{' '}
        {plural(item.now ?? 0, 'shop', 'shops')} now
      </p>
      {item.series && (
        <div className="mt-3 border-t border-ink-700/70 pt-3">
          <ShelfLine
            values={item.series}
            label={`Shelves we had found it on by each day we read: ${item.series.join(', ')}`}
          />
        </div>
      )}
      <Places shops={item.shops} lead="Turned up at" />
    </div>
    <StrainLink item={item} />
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
      {/* The type at the left, the order at the right, over a rule — as the
          home page's list is headed; a filtered list's count beneath them. */}
      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-ink-700/70 pb-3 sm:mt-8">
        {typed ? (
          <TypeChips type={type} onChange={chooseType} />
        ) : (
          <p className="text-sm text-chalk-400">
            Not by type: a strain gone from every shelf has no type on any of them.
          </p>
        )}
        {/* The home page's Sort, held at the right. */}
        <SortSelect
          value={sort}
          options={sorts}
          onChange={(next) => {
            setSort(next);
            setLimit(PAGE);
            remember({ sort: next });
          }}
          className="ml-auto"
        />
        {/* Mounted for as long as the filter is, so a change is announced. */}
        {typed && (
          <p className="stamp basis-full empty:hidden" aria-live="polite">
            {type === 'all'
              ? ''
              : `${shown.length} of ${items.length}, where most shops call it ${TYPE_WORDS[type]}`}
          </p>
        )}
      </div>

      {shown.length === 0 ? (
        <EmptyState title="Nothing on this list is of that type today." className="mt-4" />
      ) : kind === 'waves' ? (
        <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.slice(0, limit).map((item) => (
            <WaveCard key={item.id} item={item} />
          ))}
        </ul>
      ) : (
        <ul className="card mt-4 overflow-hidden">
          {shown.slice(0, limit).map((item) => (
            <Row key={item.id} kind={kind} item={item} />
          ))}
        </ul>
      )}

      {shown.length > limit && (
        <div className="mt-6 flex justify-center">
          <button type="button" onClick={() => setLimit((n) => n + PAGE * 2)} className="btn">
            Show more ({shown.length - limit} left)
          </button>
        </div>
      )}
    </>
  );
};
