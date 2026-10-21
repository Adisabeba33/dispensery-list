'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { SIZES, sizeChips } from '@/lib/menu-format';
import type { BrandSummary } from '@/lib/shelf';
import { Chevron, EmptyState, FOCUS_RING, SEARCH_FIELD, SEARCH_ICON, SearchIcon } from './PageParts';

/**
 * Every brand on the collected shelves, searchable by name.
 *
 * The counter sizes a brand comes in are shown against it, because the
 * question this page answers is "who sells what, and by what weight" — a
 * brand that only ever reaches a shelf in two-and-a-half-ounce packs is a
 * different answer from one sold by the eighth.
 */
export const BrandIndex = ({ brands }: { brands: BrandSummary[] }) => {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(80);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    return q
      ? brands.filter((b) => b.key.includes(q) || b.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(q))
      : brands;
  }, [brands, query]);

  return (
    <div>
      <label className="relative block">
        <span className="sr-only">Search brands</span>
        <SearchIcon className={SEARCH_ICON} />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(80);
          }}
          placeholder="Find, Alien Labs, Grassroots…"
          className={SEARCH_FIELD}
        />
      </label>

      {/* The count over a rule, as the directory's is on the home page. */}
      <p
        className="mt-5 border-b border-ink-700 pb-[0.1875rem] text-[0.8125rem] text-chalk-400 sm:pb-2 sm:text-sm"
        aria-live="polite"
      >
        {shown.length === brands.length ? (
          <>
            <span className="text-[0.9375rem] font-bold tabular-nums text-chalk-50 sm:text-base">{brands.length}</span> brands on the
            collected shelves
          </>
        ) : (
          <>
            <span className="text-[0.9375rem] font-bold tabular-nums text-chalk-50 sm:text-base">{shown.length}</span> of{' '}
            {brands.length} brands
          </>
        )}
      </p>

      {shown.length === 0 ? (
        <EmptyState title="No brand on the collected shelves matches that." />
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.slice(0, limit).map((b) => (
            <li key={b.key}>
              <Link
                href={`/menus/brands/${b.key}/`}
                className={`card card-hover group flex h-full items-start gap-3 p-4 ${FOCUS_RING}`}
              >
                {/* Drawn as the home page's card and the shops' are: the name in
                    bold, the chevron at its right. */}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[1.06rem] font-bold leading-snug tracking-tight text-chalk-50 transition-colors group-hover:text-moss-300">
                    {b.name}
                  </span>
                  <span className="mt-1 block text-sm text-chalk-300">
                    {b.strains} {b.strains === 1 ? 'strain' : 'strains'} · {b.shops}{' '}
                    {b.shops === 1 ? 'shop' : 'shops'}
                  </span>
                  <span className="mt-2.5 flex flex-wrap gap-1.5">
                    {sizeChips(b.sizes)
                      .filter((c) => SIZES.some((s) => s.grams === c.grams))
                      .map((c) => (
                        <span key={c.grams} className="tag tabular-nums">
                          {c.short}
                        </span>
                      ))}
                  </span>
                </span>
                <Chevron className="mt-0.5 h-5 w-5 text-chalk-300 transition-colors group-hover:text-moss-300" />
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
