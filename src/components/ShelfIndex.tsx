'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { LINEAGE_LABEL, SIZES, sizeChips, sizeLabel } from '@/lib/menu-format';

export type StrainEntry = {
  key: string;
  name: string;
  lineage: string;
  thcPercent: number | null;
  sizes: number[];
  brands: string[];
  /** Every way the shops wrote it: what a search for the jar's label matches. */
  labels: string[];
  hasTerpenes: boolean;
  /** The weights each shop sells it in, which are not the strain's sizes: one
   *  shop can have only halves of a strain another sells by the ounce. */
  shops: { id: string; name: string; region: string; sizes: number[] }[];
};

/** A strain as the filters leave it: the shops that still answer, of all it has. */
type StrainView = { s: StrainEntry; shops: StrainEntry['shops'] };

/** "On the shelf at 14 shops", or with a size chosen, how many of them sell that. */
const shelfLine = (shown: number, total: number, size: number | null): string => {
  if (size === null) return shown === 1 ? 'On the shelf at' : `On the shelf at ${shown} shops`;
  const by = `By the ${sizeLabel(size).toLowerCase()} at`;
  if (shown === total) return shown === 1 ? by : `${by} ${shown} shops`;
  return `${by} ${shown} of its ${total} shops`;
};

const LINEAGE_FILTERS = ['INDICA', 'INDICA_DOMINANT', 'HYBRID', 'SATIVA_DOMINANT', 'SATIVA'];

const StrainRow = ({ s, shops, size }: StrainView & { size: number | null }) => (
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
        {sizeChips(s.sizes).map((chip) => (
          <li
            key={chip.grams}
            className={clsx(
              'rounded-md border px-2 py-1 text-[0.7rem]',
              chip.grams === size
                ? 'border-moss-600 bg-moss-600/15 text-moss-400'
                : 'border-ink-700 bg-ink-900/70 text-chalk-200',
            )}
          >
            <span className="font-medium">{chip.label}</span>
            {chip.label !== chip.short && (
              <span className="ml-1.5 tabular-nums text-chalk-500">{chip.short}</span>
            )}
          </li>
        ))}
      </ul>
    )}

    <div className="mt-3 border-t border-ink-700/60 pt-3">
      <p className="text-[0.7rem] uppercase tracking-[0.12em] text-chalk-500">
        {shelfLine(shops.length, s.shops.length, size)}
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm">
        {shops.map((shop) => (
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

export const ShelfIndex = ({
  strains,
  shopsRead,
}: {
  strains: StrainEntry[];
  shopsRead: number;
}) => {
  const [query, setQuery] = useState('');
  const [size, setSize] = useState<number | null>(null);
  const [lineage, setLineage] = useState<string | null>(null);
  const [multiOnly, setMultiOnly] = useState(false);
  const [limit, setLimit] = useState(60);
  const [copied, setCopied] = useState(false);

  const sizesPresent = useMemo(() => {
    const all: number[] = [];
    for (const s of strains) all.push(...s.sizes);
    // Only the counter sizes get a filter chip. The long tail of odd weights
    // would give a row of one-result buttons.
    return sizeChips(all).filter((c) => SIZES.some((s) => s.grams === c.grams));
  }, [strains]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const views: StrainView[] = [];
    for (const s of strains) {
      /* A size narrows the shops as well as the strains. Asking for an ounce
         and being sent to a shop that has only halves is the trip this page
         exists to save, so every count below — one shop or more than one, a
         shop's name in the search — is of the shops that sell that size. */
      const shops = size === null ? s.shops : s.shops.filter((shop) => shop.sizes.includes(size));
      if (shops.length === 0) continue;
      if (lineage && s.lineage !== lineage) continue;
      if (multiOnly && shops.length < 2) continue;
      if (
        q &&
        !(
          s.key.includes(q) ||
          s.name.toLowerCase().includes(q) ||
          // The name shown is the strain; what a shop printed on the jar can be
          // "Premium Cannabis Flower Jar Sour Diesel", and that is what someone
          // reading a menu has in hand.
          s.labels.some((label) => label.toLowerCase().includes(q)) ||
          s.brands.some((b) => b.toLowerCase().includes(q)) ||
          shops.some((shop) => shop.name.toLowerCase().includes(q))
        )
      )
        continue;
      views.push({ s, shops });
    }
    // Most shops first, as the page arrives — counting the ones that sell the size.
    if (size !== null) {
      views.sort((a, b) => b.shops.length - a.shops.length || a.s.name.localeCompare(b.s.name));
    }
    return views;
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

      {/* The names, and nothing else.
       *
       * Somebody filtering to "sativa, by the ounce" is building a shopping
       * list to take to SŌMA, and they were retyping it. A brand or a shop
       * name in that list is not wrong, it is just noise the taste engine has
       * to parse back out — so this copies the cultivar names alone, one per
       * line, in the order the page shows them. */}
      {results.length > 0 && (
        <p className="mt-2 text-sm">
          <button
            type="button"
            className="link"
            onClick={async () => {
              const text = results.map((v) => v.s.name).join('\n');
              try {
                await navigator.clipboard.writeText(text);
              } catch {
                /* Clipboard refused — an insecure origin, or a browser that
                   asks. Fall back to a selection the reader can copy by hand
                   rather than failing in silence. */
                const box = document.createElement('textarea');
                box.value = text;
                box.style.position = 'fixed';
                box.style.opacity = '0';
                document.body.appendChild(box);
                box.select();
                try {
                  document.execCommand('copy');
                } catch {
                  /* Nothing left to try; the message below stays honest. */
                }
                box.remove();
              }
              setCopied(true);
              setTimeout(() => setCopied(false), 2500);
            }}
          >
            {copied
              ? `${results.length} names copied`
              : `Copy ${results.length === 1 ? 'this name' : `all ${results.length} names`}`}
          </button>
          <span className="ml-2 text-chalk-500">
            names only — paste straight into a taste match
          </span>
        </p>
      )}

      {results.length === 0 ? (
        <p className="mt-8 text-sm text-chalk-400">
          Nothing on the collected shelves matches that. {shopsRead} shops have had their menus
          read so far — a strain missing here is not a strain nobody stocks.
        </p>
      ) : (
        <>
          <ul className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((v) => (
              <StrainRow key={v.s.key} s={v.s} shops={v.shops} size={size} />
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
