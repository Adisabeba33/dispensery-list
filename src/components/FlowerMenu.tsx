'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { prettyDateTime } from '@/lib/format';
import {
  LINEAGE_LABEL,
  PROVENANCE,
  TERPENE_LABEL,
  TERPENE_NOTE,
  certificateUrl,
  provenanceOf,
  rankedTerpenes,
  strainsAsText,
  sizeChips,
  sizeLabel,
  type FlowerListing,
  isPromotionalSample,
} from '@/lib/menu-format';
import { DebutBadge, DebutTag } from './DebutTag';
import { Chevron, EmptyState, chipClass } from './PageParts';

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
  const prov = PROVENANCE[provenanceOf(listing.terpenes)];
  const sizes = listing.availableSizesGrams ?? [];
  const ranked = rankedTerpenes(listing.terpenes.profile);
  const top = ranked.slice(0, 3);
  const total = listing.terpenes.totalPercent;

  return (
    <li className="card p-4">
      <div className="flex items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          {/* The cultivar, and under it whose. The shop's own wording is kept
              on the listing and shown on hover: the name is the one the
              register settled on (lib/strain-review), the label is evidence. */}
          <h3
            className="break-words text-[1.02rem] font-bold leading-tight tracking-tight text-chalk-50"
            title={
              listing.strainNameRaw !== (listing.strainNameCanonical ?? listing.strainNameRaw)
                ? `On the menu as “${listing.strainNameRaw}”`
                : undefined
            }
          >
            {listing.strainNameCanonical ?? listing.strainNameRaw}
          </h3>
          <p className="mt-1 text-xs text-chalk-400">
            {listing.brand ? `by ${listing.brand}` : 'Grower not stated'}
            <span className="mx-1.5 text-ink-600">·</span>
            {LINEAGE_LABEL[listing.lineage] ?? 'Unstated'}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
          {listing.thcPercent !== null && (
            <span className="whitespace-nowrap font-mono text-[0.8125rem] tabular-nums text-moss-400">
              <span className="text-chalk-400">THC</span> {listing.thcPercent}%
            </span>
          )}
          {isPromotionalSample(listing) && (
            <span
              className="pill border-amber-400/40 bg-amber-400/10 text-amber-400"
              title="A promotional sample on the shop's menu, not a jar it stocks"
            >
              Promo sample
            </span>
          )}
        </div>
      </div>

      {/* A row of its own under the name, so the date beside the tag never
          pushes THC off the corner. */}
      {listing.debut && <DebutBadge debut={listing.debut} className="mt-2" />}

      {/* Sizes: what a buyer actually asks for at the counter. */}
      {sizes.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {sizeChips(sizes).map((s) => (
            <li key={s.grams} className="tag">
              <span className="font-medium text-chalk-100">{s.label}</span>
              {s.label !== s.short && <span className="tabular-nums text-chalk-400">{s.short}</span>}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 border-t border-ink-700/70 pt-3">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
          <span className={clsx('pill', PROVENANCE_CLASS[prov.tone])} title={prov.detail}>
            <ProvenanceDot tone={prov.tone} />
            {prov.label}
          </span>

          {top.map((t) => (
            <span key={t.name} title={TERPENE_NOTE[t.name] || undefined} className="tag">
              {TERPENE_LABEL[t.name] ?? t.rawName ?? t.name}
              {Boolean(t.percent) && <span className="tabular-nums text-chalk-400">{t.percent}%</span>}
            </span>
          ))}

          {listing.terpenes.source === 'NONE' && (
            <span className="ml-0.5 text-[0.72rem] text-chalk-400">No terpene data published</span>
          )}
        </div>

        {top.length > 0 && (
          <p className="mt-2 text-[0.72rem] leading-relaxed text-chalk-400">
            {top
              .map((t) => TERPENE_NOTE[t.name])
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}

        {listing.terpenes.source === 'STRAIN_REFERENCE' && (
          <p className="note note-caution mt-2.5 px-3 py-2 text-[0.72rem] text-chalk-300">
            Typical profile for {listing.terpenes.referenceStrain} — not measured from this batch.
          </p>
        )}

        {/* The rest of the panel, for whoever wants more than the three that lead. */}
        {(ranked.length > top.length || total) && (
          <details className="mt-2.5">
            <summary className="expander py-1.5">
              <span>
                {ranked.length > top.length ? `All ${ranked.length} terpenes` : 'Panel'}
                {total ? ` · ${total}% in all` : ''}
              </span>
              <Chevron className="h-3.5 w-3.5" />
            </summary>
            {ranked.length > top.length && (
              <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 px-1 text-[0.72rem] sm:grid-cols-3">
                {ranked.map((t) => (
                  <li key={t.name} className="flex justify-between gap-2">
                    <span className="text-chalk-300">{TERPENE_LABEL[t.name] ?? t.rawName ?? t.name}</span>
                    {typeof t.percent === 'number' && (
                      <span className="tabular-nums text-chalk-400">{t.percent}%</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </details>
        )}
      </div>
    </li>
  );
};

export const FlowerMenu = ({
  listings,
  partialShelf = false,
  title = 'Flower on the shelf',
}: {
  listings: FlowerListing[];
  partialShelf?: boolean;
  /** The shelf's heading: a page that has always named it its own way keeps that. */
  title?: string;
}) => {
  const sharedShelf = listings.some((l) => l.warnings?.includes('SHELF_SHARED_WITH_OTHER_LICENCES'));
  const [size, setSize] = useState<number | null>(null);
  const [labOnly, setLabOnly] = useState(false);
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');

  const sizesPresent = useMemo(() => {
    const present: number[] = [];
    for (const l of listings) for (const g of l.availableSizesGrams ?? []) present.push(g);
    return sizeChips(present);
  }, [listings]);

  const results = useMemo(
    () =>
      listings.filter((l) => {
        if (size !== null && !(l.availableSizesGrams ?? []).includes(size)) return false;
        if (labOnly && l.terpenes.source !== 'LAB_COA' && !certificateUrl(l.terpenes)) return false;
        return true;
      }),
    [listings, size, labOnly],
  );

  const capturedAt = listings[0]?.capturedAt;

  /* Copies what is on screen, not the whole shelf: filtering to the ounce and
     pressing copy should give the strains that come by the ounce. */
  const copyStrains = async () => {
    const text = strainsAsText(results);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Older browsers, and any context where the async clipboard is refused.
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(area);
        if (!ok) throw new Error('copy refused');
      }
      setCopied('done');
    } catch {
      setCopied('failed');
    }
    window.setTimeout(() => setCopied('idle'), 2500);
  };

  return (
    <section id="menu" className="scroll-mt-20">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="section-title">{title}</h2>
        <button
          type="button"
          onClick={copyStrains}
          className={clsx('btn', copied === 'done' && 'btn-lit')}
          aria-live="polite"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 shrink-0"
          >
            {copied === 'done' ? (
              <path d="M20 6 9 17l-5-5" />
            ) : (
              <>
                <rect x="9" y="9" width="11" height="11" rx="2" />
                <path d="M5 15V6a2 2 0 0 1 2-2h8" />
              </>
            )}
          </svg>
          {copied === 'done'
            ? `Copied ${results.length}`
            : copied === 'failed'
              ? 'Copy blocked'
              : 'Copy strains'}
        </button>
      </div>

      {capturedAt && <p className="stamp mt-1">as read {prettyDateTime(capturedAt)}</p>}

      <p className="mt-3 text-sm leading-relaxed text-chalk-400">
        Read from the shop&apos;s own menu: what was on its shelf when we read it.
      </p>

      {/* A chain that publishes one menu for several licences gives us one
          shelf and no way to tell which branch stocks it. Saying so is the
          difference between an uncertain answer and a wrong one. */}
      {sharedShelf && (
        <p className="note note-caution mt-3">
          This chain publishes one menu across several licensed shops, so this shelf is the
          chain&apos;s, not this branch&apos;s. Which of its shops holds each strain is not
          established.
        </p>
      )}

      {/* Our reading, not the shop: the menu's size holds from day to day
          while the strains in it keep changing, which is a window onto a
          bigger menu. */}
      {partialShelf && (
        <p className="note note-caution mt-3">
          We read only part of this shop&apos;s menu. The strains below are on it, but it carries
          more than we list, and a strain missing here may still be on the shelf.
        </p>
      )}

      {/* The sizes keep a group of their own, so a row that wraps breaks
          before the certificate's chip and never leaves the rule between
          them hanging at a row's end. */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
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
              {s.label !== s.short && (
                <span className={clsx('tabular-nums', size === s.grams ? 'text-moss-400/75' : 'text-chalk-400')}>
                  {s.short}
                </span>
              )}
            </button>
          ))}
        </div>

        <span aria-hidden className="mx-1 hidden h-5 w-px bg-ink-700 lg:block" />

        <button
          type="button"
          onClick={() => setLabOnly((v) => !v)}
          aria-pressed={labOnly}
          className={chipClass(labOnly)}
        >
          Lab certificate
        </button>
      </div>

      {/* The count over the list, on a rule, as the directory's is. */}
      <p className="mt-5 border-b border-ink-700 pb-[0.1875rem] text-[0.8125rem] text-chalk-400 sm:pb-2 sm:text-sm">
        <span className="text-[0.9375rem] font-bold tabular-nums text-chalk-50 sm:text-base">{results.length}</span>
        {results.length === 1 ? ' strain' : ' strains'}
        {size !== null && ` by the ${sizeLabel(size).toLowerCase()}`}
      </p>

      {results.length === 0 ? (
        <EmptyState title="Nothing on the shelf matches those filters." className="mt-4" />
      ) : (
        <ul className="mt-4 grid gap-3 lg:grid-cols-2">
          {results.map((l) => (
            <StrainRow key={l.listingId} listing={l} />
          ))}
        </ul>
      )}

      <div className="card mt-6 p-4 sm:p-5">
        <p className="label">Where a terpene reading comes from</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 sm:gap-x-6">
          {(['LAB_COA', 'MENU_WITH_CERTIFICATE', 'MENU_LISTING', 'STRAIN_REFERENCE'] as const).map((key) => (
            <li key={key} className="flex items-start gap-2 text-[0.72rem] leading-relaxed text-chalk-400">
              <span className="mt-1 flex">
                <ProvenanceDot tone={PROVENANCE[key].tone} />
              </span>
              <span>
                <span className="text-chalk-200">{PROVENANCE[key].label}</span> — {PROVENANCE[key].detail}
              </span>
            </li>
          ))}
        </ul>
        {listings.some((l) => l.debut) && (
          <div className="mt-4 border-t border-ink-700/70 pt-4">
            <p className="label">New on New York shelves</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 sm:gap-x-6">
              <li className="flex items-start gap-2 text-[0.72rem] leading-relaxed text-chalk-400">
                <DebutTag debut={{ day: '2026-10-08', days: 0, seenAt: 3 }} sample />
                <span>
                  A grower&apos;s strain no shelf we read had carried from that grower before, in its
                  first week. The number is how many shops have had it so far.
                </span>
              </li>
              <li className="flex items-start gap-2 text-[0.72rem] leading-relaxed text-chalk-400">
                <DebutTag debut={{ day: '2026-10-08', days: 14, seenAt: 3 }} sample />
                <span>After its first week: how long ago it first turned up.</span>
              </li>
            </ul>
            <p className="mt-3 text-[0.72rem] leading-relaxed text-chalk-400">
              New York City and Westchester shelves we read, since our reads began on Sep 6, 2026 —
              a strain can be older on shelves we do not read.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
