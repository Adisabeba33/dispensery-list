'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { LINEAGE_LABEL, SIZES, isFreshDebut, sizeChips, sizeLabel, type Debut } from '@/lib/menu-format';
import { DebutBadge } from './DebutTag';
import { Chevron, EmptyState, SEARCH_FIELD, SEARCH_ICON, SearchIcon, chipClass } from './PageParts';

export type StrainEntry = {
  key: string;
  /** Its page, /menus/strains/<slug>/ — for a strain on three shelves or more. */
  slug: string | null;
  name: string;
  lineage: string;
  thcPercent: number | null;
  sizes: number[];
  brands: string[];
  /** Every way the shops wrote it: what a search for the jar's label matches. */
  labels: string[];
  hasTerpenes: boolean;
  /** For a strain new to every shelf we read — every grower's jar of it — when
   *  it was first seen and how far it has spread (lib/menu); null for the rest. */
  debut: Debut | null;
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

/* The shops sit behind their own count. Open, every card was a column of
   links — Agent Z alone lists fifty-two — and a brand's page became a long
   scroll through shop names to reach the next strain. The count is the
   button; the list is one tap away. With three strains or fewer on screen
   they start open, because a search for one strain is a search for where
   it is. */
const StrainRow = ({
  s,
  shops,
  size,
  openByDefault,
}: StrainView & { size: number | null; openByDefault: boolean }) => {
  const [open, setOpen] = useState(openByDefault);
  return (
    <li className="card flex min-w-0 flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[1.02rem] font-bold leading-tight tracking-tight text-chalk-50">
            {s.slug ? (
              <Link href={`/menus/strains/${s.slug}/`} className="transition-colors hover:text-moss-400">
                {s.name}
              </Link>
            ) : (
              s.name
            )}
          </h3>
          <p className="mt-0.5 truncate text-xs text-chalk-400">
            {s.brands.length > 0 ? `by ${s.brands.slice(0, 2).join(' · ')}` : 'Brand not stated'}
          </p>
          {s.debut && <DebutBadge debut={s.debut} className="mt-1.5" />}
        </div>
        <div className="shrink-0 text-right">
          {s.thcPercent !== null ? (
            <span className="whitespace-nowrap font-mono text-[0.8125rem] tabular-nums text-moss-400">
              <span className="text-chalk-400">THC</span> {s.thcPercent}%
            </span>
          ) : (
            <span className="font-mono text-xs text-chalk-400">THC —</span>
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
              className={clsx('tag', chip.grams === size && 'border-moss-500/70 bg-moss-600/10 text-moss-300')}
            >
              <span className="font-medium">{chip.label}</span>
              {chip.label !== chip.short && <span className="tabular-nums text-chalk-400">{chip.short}</span>}
            </li>
          ))}
        </ul>
      )}

      {/* At the foot of the card, so the bars of a row of cards line up. */}
      <div className="mt-auto pt-4">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="expander">
          <span>{shelfLine(shops.length, s.shops.length, size)}</span>
          <Chevron />
        </button>
        {open && (
          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 px-1 text-sm">
            {shops.map((shop) => (
              <li key={shop.id}>
                <Link href={`/dispensary/${shop.id}/#menu`} className="link">
                  {shop.name}
                </Link>
                <span className="text-chalk-400"> · {shop.region}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
};

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
  const [debutsOnly, setDebutsOnly] = useState(false);
  const debutCount = useMemo(() => strains.filter((s) => s.debut && isFreshDebut(s.debut)).length, [strains]);
  const [limit, setLimit] = useState(60);
  const [copied, setCopied] = useState(false);

  /* A key for each row that no other row shares. A strain's key is its name
     folded, and two rows can fold to one — a brand's "VelcroZ" and "Velcro Z",
     which the gathering kept apart — so a second one takes a number. Counted
     over every strain, not the filtered few, so a row keeps its key (and
     whether it is open) as the filters change. */
  const rowKeys = useMemo(() => {
    const keys = new Map<StrainEntry, string>();
    const seen = new Map<string, number>();
    for (const s of strains) {
      const n = (seen.get(s.key) ?? 0) + 1;
      seen.set(s.key, n);
      keys.set(s, n === 1 ? s.key : `${s.key}~${n}`);
    }
    return keys;
  }, [strains]);

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
      if (debutsOnly && !(s.debut && isFreshDebut(s.debut))) continue;
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
  }, [strains, query, size, lineage, multiOnly, debutsOnly]);

  const shown = results.slice(0, limit);
  const active = Boolean(query.trim() || size !== null || lineage || multiOnly || debutsOnly);

  return (
    <section id="strains" className="scroll-mt-20">
      <label className="relative block">
        <span className="sr-only">Search strains, brands or shops</span>
        <SearchIcon className={SEARCH_ICON} />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(60);
          }}
          placeholder="Blue Dream, a brand, or a shop name…"
          className={SEARCH_FIELD}
        />
      </label>

      {/* Sizes, lineages and the two toggles each keep a group of their own,
          so a row that wraps on a phone breaks between groups. */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
        <div role="group" aria-label="Size" className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSize(null)}
            aria-pressed={size === null}
            className={chipClass(size === null)}
          >
            Any size
          </button>
          {sizesPresent.map((s) => (
            <button
              key={s.grams}
              type="button"
              onClick={() => setSize(size === s.grams ? null : s.grams)}
              aria-pressed={size === s.grams}
              className={chipClass(size === s.grams)}
            >
              {s.label}
              {s.label !== s.short && <span className="tabular-nums text-chalk-400">{s.short}</span>}
            </button>
          ))}
        </div>

        <div role="group" aria-label="Lineage" className="flex flex-wrap gap-2">
          {LINEAGE_FILTERS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLineage(lineage === l ? null : l)}
              aria-pressed={lineage === l}
              className={chipClass(lineage === l)}
            >
              {LINEAGE_LABEL[l] ?? l}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMultiOnly((v) => !v)}
            aria-pressed={multiOnly}
            className={chipClass(multiOnly)}
          >
            In more than one shop
          </button>
          {debutCount > 0 && (
            <button
              type="button"
              onClick={() => setDebutsOnly((v) => !v)}
              aria-pressed={debutsOnly}
              title="Strains whose every grower here is new to the shelves we read, in their first week"
              className={chipClass(debutsOnly)}
            >
              Debuts this week <span className="tabular-nums text-chalk-400">{debutCount}</span>
            </button>
          )}
        </div>
      </div>

      {/* The count over a rule, as the directory's is on the home page, and
          the names to copy beside it. */}
      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink-700 pb-[0.1875rem] sm:pb-2">
        <p className="text-[0.8125rem] text-chalk-400 sm:text-sm" aria-live="polite">
          <span className="text-[0.9375rem] font-bold tabular-nums text-chalk-50 sm:text-base">{results.length}</span>
          {results.length === 1 ? ' strain' : ' strains'}
          {size !== null && ` by the ${sizeLabel(size).toLowerCase()}`}
          {active && (
            <>
              {' · '}
              <button
                type="button"
                className="link rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-moss-400"
                onClick={() => {
                  setQuery('');
                  setSize(null);
                  setLineage(null);
                  setMultiOnly(false);
                  setDebutsOnly(false);
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
          <p className="text-[0.8125rem] sm:text-sm">
            <button
              type="button"
              className="link rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-moss-400"
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
            <span className="ml-2 text-chalk-400">names only — paste straight into a taste match</span>
          </p>
        )}
      </div>

      {results.length === 0 ? (
        <EmptyState title="Nothing on the collected shelves matches that.">
          {shopsRead} shops have had their menus read so far — a strain missing here is not a strain
          nobody stocks.
        </EmptyState>
      ) : (
        <>
          {/* A row of closed cards stretches to one height, so their bars line
              up; while one is open its neighbours keep their own height, or
              their bars would sink to the foot of the open card. */}
          <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3 has-[[aria-expanded=true]]:items-start">
            {shown.map((v) => (
              <StrainRow
                /* The threshold is part of the key, so narrowing a search to
                   one strain opens it rather than leaving the card as it was. */
                key={`${rowKeys.get(v.s)}:${results.length <= 3 ? 'few' : 'many'}`}
                s={v.s}
                shops={v.shops}
                size={size}
                openByDefault={results.length <= 3}
              />
            ))}
          </ul>
          {shown.length < results.length && (
            <div className="mt-6 flex justify-center">
              <button type="button" onClick={() => setLimit((n) => n + 90)} className="btn">
                Show more ({results.length - shown.length} left)
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};
