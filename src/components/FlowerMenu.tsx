'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  LINEAGE_LABEL,
  PROVENANCE,
  SIZES,
  TERPENE_LABEL,
  TERPENE_NOTE,
  type FlowerListing,
} from '@/lib/menu';

const PROVENANCE_CLASS: Record<string, string> = {
  lab: 'border-moss-600/55 bg-moss-600/12 text-moss-400',
  listed: 'border-ink-600 bg-ink-800 text-chalk-200',
  reference: 'border-amber-400/45 bg-amber-400/10 text-amber-400',
  none: 'border-ink-700 bg-ink-850 text-chalk-500',
};

/**
 * A dot that says how much the terpene reading is worth: filled for a lab
 * measurement, hollow for a shop's own claim, dashed for a strain-typical
 * expectation. The shape carries the meaning, not only the colour.
 */
const ProvenanceDot = ({ tone }: { tone: string }) => (
  <span
    aria-hidden
    className={clsx(
      'h-2 w-2 shrink-0 rounded-full border',
      tone === 'lab' && 'border-moss-400 bg-moss-400',
      tone === 'listed' && 'border-chalk-400 bg-transparent',
      tone === 'reference' && 'border-dashed border-amber-400 bg-transparent',
      tone === 'none' && 'border-ink-600 bg-transparent',
    )}
  />
);

const StrainRow = ({ listing }: { listing: FlowerListing }) => {
  const prov = PROVENANCE[listing.terpenes.source];
  const sizes = listing.availableSizesGrams ?? [];
  const top = listing.terpenes.profile.slice(0, 3);

  return (
    <li
      className={clsx(
        'card p-4 transition-colors',
        listing.inStock ? 'card-hover' : 'opacity-55',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h4 className="text-[1.02rem] font-semibold leading-tight tracking-tight text-chalk-50">
            {listing.strainNameRaw}
          </h4>
          <p className="mt-1 text-sm text-chalk-400">
            {listing.brand ?? 'Grower not stated'}
            <span className="mx-2 text-ink-600">·</span>
            {LINEAGE_LABEL[listing.lineage] ?? 'Unstated'}
          </p>
        </div>

        <div className="flex items-center gap-3 text-right">
          {listing.thcPercent !== null && (
            <span className="tabular-nums text-sm text-chalk-100">
              THC {listing.thcPercent}%
            </span>
          )}
          {!listing.inStock && (
            <span className="pill border-ink-600 bg-ink-800 text-chalk-500">Sold out</span>
          )}
        </div>
      </div>

      {/* Sizes: what a buyer actually asks for at the counter. */}
      {sizes.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {SIZES.filter((s) => sizes.includes(s.grams)).map((s) => (
            <li
              key={s.grams}
              className="rounded-md border border-ink-700 bg-ink-900/70 px-2 py-1 text-[0.72rem] text-chalk-200"
            >
              <span className="font-medium">{s.label}</span>
              <span className="ml-1.5 tabular-nums text-chalk-500">{s.short}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 border-t border-ink-700/60 pt-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className={clsx('pill', PROVENANCE_CLASS[prov.tone])}>
            <ProvenanceDot tone={prov.tone} />
            {prov.label}
          </span>

          {top.map((t) => (
            <span
              key={t.name}
              title={TERPENE_NOTE[t.name] || undefined}
              className="rounded-md bg-ink-800 px-2 py-1 text-[0.72rem] text-chalk-200"
            >
              {TERPENE_LABEL[t.name] ?? t.rawName ?? t.name}
              {Boolean(t.percent) && (
                <span className="ml-1.5 tabular-nums text-chalk-500">{t.percent}%</span>
              )}
            </span>
          ))}

          {listing.terpenes.source === 'NONE' && (
            <span className="text-[0.72rem] text-chalk-500">No terpene data published</span>
          )}
        </div>

        {top.length > 0 && (
          <p className="mt-2 text-[0.72rem] leading-relaxed text-chalk-500">
            {top
              .map((t) => TERPENE_NOTE[t.name])
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}

        {listing.terpenes.source === 'STRAIN_REFERENCE' && (
          <p className="mt-2 text-[0.72rem] leading-relaxed text-amber-400/85">
            Typical profile for {listing.terpenes.referenceStrain} — not measured from this batch.
          </p>
        )}
      </div>
    </li>
  );
};

export const FlowerMenu = ({ listings }: { listings: FlowerListing[] }) => {
  const [size, setSize] = useState<number | null>(null);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [labOnly, setLabOnly] = useState(false);

  const sizesPresent = useMemo(() => {
    const present = new Set<number>();
    for (const l of listings) for (const g of l.availableSizesGrams ?? []) present.add(g);
    return SIZES.filter((s) => present.has(s.grams));
  }, [listings]);

  const results = useMemo(
    () =>
      listings.filter((l) => {
        if (size !== null && !(l.availableSizesGrams ?? []).includes(size)) return false;
        if (inStockOnly && !l.inStock) return false;
        if (labOnly && l.terpenes.source !== 'LAB_COA') return false;
        return true;
      }),
    [listings, size, inStockOnly, labOnly],
  );

  const capturedAt = listings[0]?.capturedAt;

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight text-chalk-50">Flower on the shelf</h2>
        {capturedAt && (
          <span className="text-xs text-chalk-500">
            as read {new Date(capturedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
          </span>
        )}
      </div>

      <p className="mt-2 text-xs leading-relaxed text-chalk-500">
        Read from the shop&apos;s own menu. Shelves move through the day, so confirm before
        travelling for a specific strain.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSize(null)}
          className={clsx('chip', size === null && 'chip-on')}
        >
          Any size
        </button>
        {sizesPresent.map((s) => (
          <button
            key={s.grams}
            type="button"
            onClick={() => setSize(size === s.grams ? null : s.grams)}
            className={clsx('chip', size === s.grams && 'chip-on')}
          >
            {s.label}
            <span className="ml-1.5 tabular-nums text-chalk-500">{s.short}</span>
          </button>
        ))}

        <span aria-hidden className="mx-1 hidden h-5 w-px bg-ink-700 sm:block" />

        <button
          type="button"
          onClick={() => setInStockOnly((v) => !v)}
          className={clsx('chip', inStockOnly && 'chip-on')}
        >
          In stock
        </button>
        <button
          type="button"
          onClick={() => setLabOnly((v) => !v)}
          className={clsx('chip', labOnly && 'chip-on')}
        >
          Lab-tested terpenes
        </button>
      </div>

      <p className="mt-4 text-sm text-chalk-400">
        <span className="font-semibold text-chalk-50">{results.length}</span>
        {results.length === 1 ? ' strain' : ' strains'}
        {size !== null && ` available by the ${SIZES.find((s) => s.grams === size)?.label.toLowerCase()}`}
      </p>

      {results.length === 0 ? (
        <p className="mt-6 text-sm text-chalk-400">Nothing on the shelf matches those filters.</p>
      ) : (
        <ul className="mt-4 grid gap-3 lg:grid-cols-2">
          {results.map((l) => (
            <StrainRow key={l.listingId} listing={l} />
          ))}
        </ul>
      )}

      <div className="mt-6 border-t border-ink-700/60 pt-4">
        <p className="label">Where a terpene reading comes from</p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-3">
          {(['LAB_COA', 'MENU_LISTING', 'STRAIN_REFERENCE'] as const).map((key) => (
            <li key={key} className="flex items-start gap-2 text-[0.72rem] leading-relaxed text-chalk-400">
              <span className="mt-1">
                <ProvenanceDot tone={PROVENANCE[key].tone} />
              </span>
              <span>
                <span className="text-chalk-200">{PROVENANCE[key].label}</span> — {PROVENANCE[key].detail}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
