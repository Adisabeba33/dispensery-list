'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { SIZES, sizeChips } from '@/lib/menu-format';
import type { BrandSummary } from '@/lib/shelf';
import {
  Chevron,
  chipClass,
  EmptyState,
  FOCUS_RING,
  SEARCH_FIELD,
  SEARCH_ICON,
  SearchIcon,
  SlidersIcon,
  SortSelect,
} from './PageParts';

/**
 * Every brand on the collected shelves, searchable by name.
 *
 * The counter sizes a brand comes in are shown against it, because the
 * question this page answers is "who sells what, and by what weight" — a
 * brand that only ever reaches a shelf in two-and-a-half-ounce packs is a
 * different answer from one sold by the eighth. So the one filter behind the
 * sliders is the weight.
 */

type Show = 'all' | 'shelves';
type SortKey = 'shops' | 'name' | 'strains';

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'shops', label: 'Most shops' },
  { id: 'name', label: 'A → Z' },
  { id: 'strains', label: 'Most strains' },
];

const fold = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/* The home page's chip, its drawing and words drawn tighter on a phone so
   that the four hold one row from 390px, where they stretch to fill it; on a
   narrower phone they stand two by two. */
const rowChip = (on: boolean) =>
  clsx(
    'chip h-[1.875rem] justify-center gap-1 py-0 pl-[0.3125rem] pr-1.5 text-[0.6875rem] sm:h-8 sm:gap-2 sm:pl-3 sm:pr-3.5 sm:text-[0.8125rem]',
    FOCUS_RING,
    on ? 'chip-on' : 'text-chalk-50',
  );

/* The chips' drawings, in outline at the height of a line of chip text, in
   the chip's own colour: chalk, lit with it when pressed. */
const ChipIcon = ({ children }: { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 16 16"
    aria-hidden
    focusable="false"
    className="h-[0.9375rem] w-[0.9375rem] shrink-0"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

/* Every brand: the four squares of a grid. */
const GridIcon = () => (
  <ChipIcon>
    <rect x="2" y="2" width="5" height="5" rx="1" />
    <rect x="9" y="2" width="5" height="5" rx="1" />
    <rect x="2" y="9" width="5" height="5" rx="1" />
    <rect x="9" y="9" width="5" height="5" rx="1" />
  </ChipIcon>
);

/* The most shops first: bars rising. */
const BarsIcon = () => (
  <ChipIcon>
    <path d="M3 13.5v-4M6.5 13.5v-7M10 13.5V3.5M13.5 13.5v-6" strokeWidth="1.8" />
  </ChipIcon>
);

export const BrandIndex = ({
  brands,
  minShelves,
}: {
  /** Most shops first, as brandSummaries() orders them. */
  brands: BrandSummary[];
  /** How many shelves a brand is on before "On shelves" shows it. */
  minShelves: number;
}) => {
  const [query, setQuery] = useState('');
  const [show, setShow] = useState<Show>('all');
  // One counter size, from behind the sliders.
  const [weight, setWeight] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>('shops');
  const [limit, setLimit] = useState(80);

  // Only the counter sizes some brand comes in, each with how many do.
  const weights = useMemo(
    () =>
      SIZES.map((s) => ({ ...s, count: brands.filter((b) => b.sizes.includes(s.grams)).length })).filter(
        (s) => s.count > 0,
      ),
    [brands],
  );
  const onShelves = useMemo(() => brands.filter((b) => b.shops >= minShelves).length, [brands, minShelves]);

  const shown = useMemo(() => {
    const q = fold(query.trim());
    const filtered = brands.filter(
      (b) =>
        (show === 'all' || b.shops >= minShelves) &&
        (weight === null || b.sizes.includes(weight)) &&
        (!q || b.key.includes(q) || fold(b.name).includes(q)),
    );
    if (sort === 'name')
      return [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base', numeric: true }));
    if (sort === 'strains')
      return [...filtered].sort((a, b) => b.strains - a.strains || b.shops - a.shops || a.name.localeCompare(b.name));
    return filtered;
  }, [brands, query, show, weight, sort, minShelves]);

  const filtered = show !== 'all' || weight !== null || query.trim() !== '';
  const reset = () => setLimit(80);

  const clearAll = () => {
    setQuery('');
    setShow('all');
    setWeight(null);
    reset();
  };

  return (
    <div>
      <div className="flex gap-2">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">Search brands</span>
          <SearchIcon className={SEARCH_ICON} />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              reset();
            }}
            placeholder="Find a brand (e.g. Alien Labs, Grassroots…)"
            className={SEARCH_FIELD}
          />
        </label>

        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          aria-controls="brand-filters"
          className={clsx(
            'relative grid h-[2.5625rem] w-[2.5625rem] shrink-0 place-items-center rounded-[7px] border bg-ink-900/80 text-chalk-50 transition-colors hover:border-moss-500 sm:h-11 sm:w-11',
            FOCUS_RING,
            filtersOpen ? 'chip-on' : 'border-chalk-500/50',
          )}
        >
          <span className="sr-only">
            Weight{weight !== null ? `: ${SIZES.find((s) => s.grams === weight)?.short} only` : ''}
          </span>
          <SlidersIcon />
          {/* A filter is on that the closed panel does not show. */}
          {weight !== null && (
            <span
              aria-hidden
              className="absolute right-[0.3125rem] top-[0.3125rem] h-1.5 w-1.5 rounded-full bg-moss-400 shadow-[0_0_6px_rgba(var(--glow),0.9)]"
            />
          )}
        </button>
      </div>

      <div
        id="brand-filters"
        hidden={!filtersOpen}
        className="mt-2.5 rounded-[7px] border border-moss-700/50 bg-ink-900/80 p-3 sm:p-4"
      >
        <div className="sm:flex sm:items-center sm:gap-5">
          <p id="brand-weight" className="label shrink-0 text-chalk-400">
            Weight
          </p>
          <div
            role="group"
            aria-labelledby="brand-weight"
            className="mt-2.5 flex flex-wrap gap-x-[0.4375rem] gap-y-2 sm:mt-0 sm:gap-2"
          >
            <button
              type="button"
              onClick={() => {
                setWeight(null);
                reset();
              }}
              aria-pressed={weight === null}
              className={chipClass(weight === null)}
            >
              Any weight
            </button>
            {weights.map((s) => (
              <button
                key={s.grams}
                type="button"
                onClick={() => {
                  setWeight(weight === s.grams ? null : s.grams);
                  reset();
                }}
                aria-pressed={weight === s.grams}
                className={chipClass(weight === s.grams)}
              >
                <span className="tabular-nums">{s.short}</span>
                <span className="tabular-nums text-chalk-400">{s.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Which brands, then in what order. (Plain media variants: Tailwind's
          min-[…] goes away beside the em-based `nav` screen.) */}
      <div className="mt-2.5 grid grid-cols-2 gap-1.5 [@media(min-width:390px)]:flex [@media(min-width:390px)]:flex-wrap [@media(min-width:390px)]:[&>*]:flex-auto sm:mt-3 sm:gap-2 sm:[&>*]:flex-none">
        <button
          type="button"
          onClick={() => {
            setShow('all');
            reset();
          }}
          aria-pressed={show === 'all'}
          className={rowChip(show === 'all')}
        >
          <GridIcon />
          All brands
        </button>
        {/* On as many shelves as a strain needs for a page of its own: the
            brands that reach shelves, not a jar at one or two shops. */}
        <button
          type="button"
          onClick={() => {
            setShow(show === 'shelves' ? 'all' : 'shelves');
            reset();
          }}
          aria-pressed={show === 'shelves'}
          title={`On ${minShelves} shelves or more: ${onShelves} brands`}
          className={rowChip(show === 'shelves')}
        >
          <span aria-hidden className="grid w-[0.9375rem] place-items-center">
            <span className="h-2 w-2 rounded-full bg-moss-400 shadow-[0_0_6px_rgba(var(--glow),0.6)]" />
          </span>
          On shelves
          <span className="sr-only">: {minShelves} or more</span>
        </button>
        <button
          type="button"
          onClick={() => setSort('shops')}
          aria-pressed={sort === 'shops'}
          className={rowChip(sort === 'shops')}
        >
          <BarsIcon />
          Most shops
        </button>
        <button
          type="button"
          onClick={() => setSort('name')}
          aria-pressed={sort === 'name'}
          className={rowChip(sort === 'name')}
        >
          <SlidersIcon className="h-[0.9375rem] w-[0.9375rem]" />A → Z
        </button>
      </div>

      {/* The count over a rule, and the order beside it, as the directory's
          are on the home page. */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-ink-700 pb-[0.1875rem] sm:mt-6 sm:pb-2">
        <p className="text-[0.8125rem] text-chalk-300 sm:text-sm" aria-live="polite">
          {!filtered ? (
            <>
              <span className="text-[0.9375rem] font-bold tabular-nums text-chalk-50 sm:text-base">{brands.length}</span>{' '}
              brands on the collected shelves
            </>
          ) : (
            <>
              <span className="text-[0.9375rem] font-bold tabular-nums text-chalk-50 sm:text-base">{shown.length}</span> of{' '}
              {brands.length} brands
              {show === 'shelves' && `, each on ${minShelves} shelves or more`} ·{' '}
              <button type="button" onClick={clearAll} className={clsx('link rounded-sm', FOCUS_RING)}>
                clear filters
              </button>
            </>
          )}
        </p>
        <SortSelect value={sort} options={SORTS} onChange={setSort} className="ml-auto" />
      </div>

      {shown.length === 0 ? (
        <EmptyState title="No brand on the collected shelves matches that." />
      ) : (
        <ul className="mt-3.5 grid grid-cols-1 gap-[0.4375rem] sm:mt-5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
          {shown.slice(0, limit).map((b) => (
            <li key={b.key}>
              <Link
                href={`/menus/brands/${b.key}/`}
                className={clsx(
                  'card group relative flex h-full items-start gap-3 rounded-lg pb-2 pl-[1.5625rem] pr-4 pt-2.5 sm:pb-3 sm:pt-3.5',
                  // Lit under the finger, as the mockup draws the brand being
                  // picked: the frame in the accent with its glow, the name
                  // and the chevron with it.
                  'hover:border-moss-400/85 hover:bg-ink-850/90 hover:shadow-[0_0_14px_-4px_rgba(var(--glow),0.6),inset_0_0_22px_-14px_rgba(var(--glow),0.4)]',
                  'active:border-moss-400/85 active:shadow-[0_0_14px_-4px_rgba(var(--glow),0.6)]',
                  FOCUS_RING,
                )}
              >
                {/* A lit tick at the card's edge, level with the name. */}
                <span
                  aria-hidden
                  className="absolute left-1.5 top-[0.9375rem] h-[1.125rem] w-0.5 rounded-full bg-moss-500/90 shadow-[0_0_6px_rgba(var(--glow),0.55)] sm:top-[1.1875rem]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-bold leading-snug tracking-tight text-chalk-50 transition-colors group-hover:text-moss-300 group-active:text-moss-300">
                    {b.name}
                  </span>
                  <span className="block text-[0.8125rem] text-chalk-300 sm:mt-0.5 sm:text-sm">
                    {b.strains} {b.strains === 1 ? 'strain' : 'strains'} · {b.shops}{' '}
                    {b.shops === 1 ? 'shop' : 'shops'}
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1.5 sm:mt-2">
                    {sizeChips(b.sizes)
                      .filter((c) => SIZES.some((s) => s.grams === c.grams))
                      .map((c) => (
                        <span
                          key={c.grams}
                          className="tag rounded-[5px] border-ink-600 px-[0.4375rem] py-[0.1875rem] text-[0.6875rem] tabular-nums sm:text-xs"
                        >
                          {c.short}
                        </span>
                      ))}
                  </span>
                </span>
                <Chevron className="mt-2.5 h-5 w-5 text-chalk-200 transition-colors group-hover:text-moss-300 group-active:text-moss-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {shown.length > limit && (
        <div className="mt-6 flex justify-center">
          <button type="button" onClick={() => setLimit((n) => n + 120)} className="btn">
            Show more ({shown.length - limit} left)
          </button>
        </div>
      )}
    </div>
  );
};
