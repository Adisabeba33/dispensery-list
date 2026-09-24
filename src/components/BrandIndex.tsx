'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { SIZES, sizeChips } from '@/lib/menu-format';
import type { BrandSummary } from '@/lib/shelf';

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
      <label className="block">
        <span className="sr-only">Search brands</span>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(80);
          }}
          placeholder="Find, Alien Labs, Grassroots…"
          className="w-full rounded-lg border border-ink-700 bg-ink-900/70 px-4 py-3 text-base text-chalk-50 placeholder:text-chalk-500 focus:border-moss-600 focus:outline-none"
        />
      </label>

      <p className="mt-3 text-sm text-chalk-400">
        {shown.length === brands.length
          ? `${brands.length} brands on the collected shelves`
          : `${shown.length} of ${brands.length} brands`}
      </p>

      {shown.length === 0 ? (
        <p className="mt-6 text-chalk-300">No brand on the collected shelves matches that.</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.slice(0, limit).map((b) => (
            <li key={b.key}>
              <Link href={`/menus/brands/${b.key}/`} className="card block p-4 transition hover:border-moss-600">
                <span className="block truncate text-[0.95rem] font-semibold tracking-tight text-chalk-50">
                  {b.name}
                </span>
                <span className="mt-1 block text-sm text-chalk-300">
                  {b.strains} {b.strains === 1 ? 'strain' : 'strains'} · {b.shops}{' '}
                  {b.shops === 1 ? 'shop' : 'shops'}
                </span>
                <span className="mt-2 flex flex-wrap gap-1.5">
                  {sizeChips(b.sizes)
                    .filter((c) => SIZES.some((s) => s.grams === c.grams))
                    .map((c) => (
                      <span
                        key={c.grams}
                        className="rounded-md border border-ink-700 bg-ink-900/70 px-2 py-0.5 text-[0.7rem] text-chalk-200"
                      >
                        {c.short}
                      </span>
                    ))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {shown.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + 120)}
          className="mt-6 rounded-lg border border-ink-700 px-4 py-2 text-sm text-chalk-200 hover:border-moss-600"
        >
          Show more ({shown.length - limit} left)
        </button>
      )}
    </div>
  );
};
