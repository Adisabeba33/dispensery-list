'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { LINEAGE_LABEL, SIZES, sizeChips, sizeLabel } from '@/lib/menu';

export type StrainEntry = {
  key: string;
  name: string;
  lineage: string;
  thcPercent: number | null;
  sizes: number[];
  brands: string[];
  hasTerpenes: boolean;
  shops: { id: string; name: string; region: string }[];
};

const LINEAGE_FILTERS = ['INDICA', 'INDICA_DOMINANT', 'HYBRID', 'SATIVA_DOMINANT', 'SATIVA'];

const StrainRow = ({ s }: { s: StrainEntry }) => (
  <li className="card p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="truncate text-[0.95rem] font-semibold tracking-tight text-chalk-50">{s.name}</h3>
        <p className="mt-0.5 truncate text-xs text-chalk-500">
          {s.brands.length > 0 ? s.brands.slice(0, 2).join(' · ') : 'Brand not stated'}
        </p>
      </div>
      <div className="shrink-0 text-right">
        {s.thcPercent !== null ? (
          <span className="font-mono text-sm tabular-nums text-moss-400">{s.thcPercent}%</span>
        ) : (
          <span className="text-xs text-chalk-500">THC —</span>
        )}
        <span className="mt-0.5 block text-[0.7rem] text-chalk-400">
          {LINEAGE_LABEL[s.lineage] ?? 'Lineage unstated'}
        </span>
      </div>
    </div>

    {s.sizes.length > 0 && (
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {sizeChips(s.sizes).map((size) => (
          <li
            key={size.grams}
            className="rounded-md border border-ink-700 bg-ink-900/70 px-2 py-1 text-[0.7rem] text-chalk-200"
          >
            <span className="font-medium">{size.label}</span>
            {size.label !== size.short && (
              <span className="ml-1.5 tabular-nums text-chalk-500">{size.short}</span>
            )}
          </li>
        ))}
      </ul>
    )}

    <div className="mt-3 border-t border-ink-700/60 pt-3">
      <p className="text-[0.7rem] uppercase tracking-[0.12em] text-chalk-500">
        {s.shops.length === 1 ? 'On the shelf at' : `On the shelf at ${s.shops.length} shops`}
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm">
        {s.shops.map((shop) => (
          <li key={shop.id}>
            <Link href={`/dispensary/${shop.id}/#menu`} className="link">
              {shop.name}
            </Link>
            <span className="text-chalk-500"> · {shop.region}</span>
          </li>
        ))}
      </ul>
    </div>
  </li>
);

export const ShelfIndex = ({ strains }: { strains: StrainEntry[] }) => {
  const [query, setQuery] = useState('');
  const [size, setSize] = useState<number | null>(null);
  const [lineage, setLineage] = useState<string | null>(null);
  const [multiOnly, setMultiOnly] = useState(false);
  const [limit, setLimit] = useState(60);

  const sizesPresent = useMemo(() => {
    const all: number[] = [];
    for (const s of strains) all.push(...s.sizes);
    // Only the counter sizes get a filter chip. The long tail of odd weights
    // would give a row of one-result buttons.
    return sizeChips(all).filter((c) => SIZES.some((s) => s.grams === c.grams));
  }, [strains]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return strains.filter((s) => {
      if (size !== null && !s.sizes.includes(size)) return false;
      if (lineage && s.lineage !== lineage) return false;
      if (multiOnly && s.shops.length < 2) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.brands.some((b) => b.toLowerCase().includes(q)) ||
        s.shops.some((shop) => shop.name.toLowerCase().includes(q))
      );
    });
  }, [strains, query, size, lineage, multiOnly]);

  const shown = results.slice(0, limit);
  const active = Boolean(query.trim() || size !== null || lineage || multiOnly);

  return (
    <section id="strains" className="scroll-mt-20">
      <label className="relative block">
        <span className="sr-only">Search strains, brands or shops</span>
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-chalk-500"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(60);
          }}
          placeholder="Blue Dream, a brand, or a shop name…"
          className="field pl-11"
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setSize(null)} className={clsx('chip', size === null && 'chip-on')}>
          Any size
        </button>
        {sizesPresent.map((s) => (
          <button
            key={s.grams}
            type="button"
            onClick={() => setSize(size === s.grams ? null : s.grams)}
            className={clsx('chip', size === s.grams && 'chip-on')}
          >
            {s.label} <span className="tabular-nums text-chalk-500">{s.short}</span>
          </button>
        ))}

        <span aria-hidden className="mx-1 hidden h-5 w-px bg-ink-700 sm:block" />

        {LINEAGE_FILTERS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLineage(lineage === l ? null : l)}
            className={clsx('chip', lineage === l && 'chip-on')}
          >
            {LINEAGE_LABEL[l] ?? l}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setMultiOnly((v) => !v)}
          aria-pressed={multiOnly}
          className={clsx('chip', multiOnly && 'chip-on')}
        >
          In more than one shop
        </button>
      </div>

      <p className="mt-4 text-sm text-chalk-400" aria-live="polite">
        <span className="font-semibold text-chalk-50">{results.length}</span>
        {results.length === 1 ? ' strain' : ' strains'}
        {size !== null && ` by the ${sizeLabel(size).toLowerCase()}`}
        {active && (
          <>
            {' · '}
            <button
              type="button"
              className="link"
              onClick={() => {
                setQuery('');
                setSize(null);
                setLineage(null);
                setMultiOnly(false);
              }}
            >
              clear filters
            </button>
          </>
        )}
      </p>

      {results.length === 0 ? (
        <p className="mt-8 text-sm text-chalk-400">
          Nothing on the collected shelves matches that. Only thirteen shops have had their menus
          read so far — a strain missing here is not a strain nobody stocks.
        </p>
      ) : (
        <>
          <ul className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((s) => (
              <StrainRow key={s.key} s={s} />
            ))}
          </ul>
          {shown.length < results.length && (
            <div className="mt-6 flex justify-center">
              <button type="button" onClick={() => setLimit((n) => n + 90)} className="chip">
                Show more ({results.length - shown.length} left)
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};
