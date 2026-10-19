'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { LINEAGE_LABEL, PROVENANCE, TERPENE_LABEL, TERPENE_NOTE, sizeChips } from '@/lib/menu-format';
import type { StrainPageData, StrainPlace } from '@/lib/strain-page';

/* Overview, the lab figures behind it, and the shelves it is on. The mockup
   this page follows had a fourth tab, Genetics; no shelf states a strain's
   parents, so there is nothing to put in it. */
const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'lab', label: 'Lab data' },
  { id: 'shelves', label: 'Shelves' },
] as const;
type Tab = (typeof TABS)[number]['id'];

const tabFromHash = (): Tab => {
  const hash = window.location.hash.slice(1);
  return TABS.some((t) => t.id === hash) ? (hash as Tab) : 'overview';
};

/** 22.43 is 22.4 and 29.03 is 29: one decimal is as fine as a shelf figure deserves. */
const pct = (n: number) => `${Math.round(n * 10) / 10}`;

const PREVIEW = 5;

/* A place: the shop's name and its district, and its page in the register.
   The green dot is the shelf lamp — every place here is a shelf we read. */
const PlaceLine = ({ place }: { place: StrainPlace }) => (
  <li className="flex gap-3 py-3">
    <span aria-hidden className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-moss-400" />
    <div className="min-w-0">
      <Link href={`/dispensary/${place.id}/`} className="font-medium text-chalk-50 transition-colors hover:text-moss-400">
        {place.name}
      </Link>
      <p className="mt-0.5 text-sm text-chalk-400">{place.region}</p>
    </div>
  </li>
);

const shelvesLine = (n: number) => `on ${n} ${n === 1 ? 'shelf' : 'shelves'}`;

export const StrainView = ({ strain }: { strain: StrainPageData }) => {
  const [tab, setTab] = useState<Tab>('overview');
  const [panelLimit, setPanelLimit] = useState(8);
  const [growerLimit, setGrowerLimit] = useState(12);
  const tabsRef = useRef<HTMLDivElement>(null);

  /* The tab in the address, so a link can open the shelves directly. */
  useEffect(() => {
    setTab(tabFromHash());
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const choose = (next: Tab, scroll = false) => {
    setTab(next);
    const url = next === 'overview' ? window.location.pathname : `#${next}`;
    window.history.replaceState(null, '', url);
    if (scroll) tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const shelves = strain.places.length;
  const notes = (strain.terpenes?.top ?? []).map((t) => TERPENE_NOTE[t]).filter(Boolean);

  return (
    <div className="mt-8">
      <div
        ref={tabsRef}
        role="tablist"
        aria-label="About this strain"
        className="no-scrollbar -mx-5 flex scroll-mt-24 gap-6 overflow-x-auto border-b border-ink-700 px-5 sm:mx-0 sm:px-0"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => choose(t.id)}
            className={clsx(
              'relative shrink-0 pb-3 text-[0.95rem] transition-colors',
              tab === t.id ? 'font-medium text-chalk-50' : 'text-chalk-400 hover:text-chalk-200',
            )}
          >
            {t.label}
            {tab === t.id && (
              <span aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-moss-400" />
            )}
          </button>
        ))}
      </div>

      {/* ---- Overview ---------------------------------------------------- */}
      <section id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" hidden={tab !== 'overview'}>
        {/* On a phone: the figures, then the shelves, then who grows it. On a
            wide screen the shelves take the right-hand column beside the rest. */}
        <div className="mt-6 grid gap-4 lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:items-start">
          <div className="space-y-4 lg:col-start-1 lg:row-start-1">
            {/* Stacked on the narrowest phones, where a terpene name would push the
                card wider than the screen. (A plain media variant: Tailwind's
                min-[…] goes away once the em-based `nav` screen is defined.) */}
            <div className="card grid grid-cols-1 divide-y divide-ink-700 [@media(min-width:360px)]:grid-cols-[auto_1fr] [@media(min-width:360px)]:divide-x [@media(min-width:360px)]:divide-y-0">
              <div className="px-5 py-5">
                <p className="text-xs uppercase tracking-[0.12em] text-chalk-400">THC</p>
                {strain.thc ? (
                  <>
                    <p className="mt-2 text-4xl font-semibold tabular-nums tracking-tight text-chalk-50">
                      {pct(strain.thc.median)}%
                    </p>
                    <p className="mt-1.5 text-xs tabular-nums text-chalk-500">
                      {strain.thc.low === strain.thc.high
                        ? `${strain.thc.listings === 1 ? 'one listing' : `${strain.thc.listings} listings`}`
                        : `${pct(strain.thc.low)}–${pct(strain.thc.high)}% · ${strain.thc.listings} listings`}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-chalk-500">Not stated</p>
                )}
              </div>
              <div className="min-w-0 px-5 py-5">
                <p className="text-xs uppercase tracking-[0.12em] text-chalk-400">Top terpenes</p>
                {strain.terpenes ? (
                  <>
                    <p className="mt-2 leading-snug text-chalk-50">
                      {strain.terpenes.top.map((t) => TERPENE_LABEL[t] ?? t).join(', ')}
                    </p>
                    {strain.terpenes.kind === 'MEASURED' ? (
                      <p className="mt-1.5 text-xs text-chalk-500">
                        {strain.terpenes.panels === 1
                          ? 'From the one panel on a shop menu'
                          : `Most often leading ${strain.terpenes.panels} panels on shop menus`}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-xs text-amber-400/90">
                        Typical for {strain.terpenes.referenceStrain}, not measured from a jar here
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-2 text-sm text-chalk-500">No shop publishes them</p>
                )}
              </div>
            </div>

            {notes.length > 0 && <p className="text-sm text-chalk-400">{notes.join(' · ')}</p>}
          </div>

          <div className="card px-5 pb-3 pt-5 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <h2 className="text-lg font-semibold tracking-tight text-chalk-50">
              On the shelf at {shelves} {shelves === 1 ? 'shop' : 'shops'}
            </h2>
            <ul className="mt-1 divide-y divide-ink-700/60">
              {strain.places.slice(0, PREVIEW).map((place) => (
                <PlaceLine key={place.id} place={place} />
              ))}
            </ul>
            <div className="border-t border-ink-700/60 py-3">
              <button
                type="button"
                onClick={() => choose('shelves', true)}
                className="font-medium text-moss-400 transition-colors hover:text-moss-500"
              >
                {shelves > PREVIEW ? `View all ${shelves} shelves →` : 'Shelves by grower →'}
              </button>
            </div>
          </div>

          <div className="space-y-4 lg:col-start-1 lg:row-start-2">
            {/* The call most shelves make is the badge above; when they do not
                agree, every call is said, so the badge is not taken as settled. */}
            {strain.lineages.length > 1 && (
              <p className="text-sm text-chalk-400">
                Shops disagree on what it is:{' '}
                {strain.lineages
                  .slice(0, 3)
                  .map(
                    (l) =>
                      `${LINEAGE_LABEL[l.lineage] ?? l.lineage} on ${l.listings} ${l.listings === 1 ? 'listing' : 'listings'}`,
                  )
                  .join(', ')}
                .
              </p>
            )}

            {strain.growers.length > 0 && (
              <div>
                <h2 className="label">Grown by</h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {strain.growers.slice(0, 8).map((g) => (
                    <li key={g.name}>
                      {g.key ? (
                        <Link href={`/menus/brands/${g.key}/`} className="chip inline-block">
                          {g.name}
                        </Link>
                      ) : (
                        <span className="chip inline-block">{g.name}</span>
                      )}
                    </li>
                  ))}
                  {strain.growers.length > 8 && (
                    <li>
                      <button type="button" className="chip" onClick={() => choose('shelves', true)}>
                        {strain.growers.length - 8} more
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            )}

            {strain.sizes.length > 0 && (
              <div>
                <h2 className="label">Sold by the</h2>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {sizeChips(strain.sizes).map((s) => (
                    <li
                      key={s.grams}
                      className="rounded-md border border-ink-700 bg-ink-900/70 px-2 py-1 text-xs text-chalk-200"
                    >
                      <span className="font-medium">{s.label}</span>
                      {s.label !== s.short && <span className="ml-1.5 tabular-nums text-chalk-500">{s.short}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ---- Lab data ---------------------------------------------------- */}
      <section id="panel-lab" role="tabpanel" aria-labelledby="tab-lab" hidden={tab !== 'lab'}>
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-chalk-400">
          Figures as the shops print them. A menu&apos;s THC can be THCA or total THC, and each batch
          tests differently, so one grower&apos;s jars can sit several points apart.
        </p>

        {strain.growers.length > 0 && (
          <div className="mt-6">
            <h2 className="label">THC by grower</h2>
            <div className="scroll-x mt-3">
              <table className="w-full min-w-[22rem] text-sm">
                <thead>
                  <tr className="border-b border-ink-700 text-left text-xs text-chalk-500">
                    <th className="py-2 pr-4 font-medium">Grower</th>
                    <th className="py-2 pr-4 text-right font-medium">THC</th>
                    <th className="py-2 text-right font-medium">Shelves</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700/60">
                  {strain.growers.slice(0, growerLimit).map((g) => (
                    <tr key={g.name}>
                      <td className="py-2 pr-4">
                        {g.key ? (
                          <Link href={`/menus/brands/${g.key}/`} className="text-chalk-50 hover:text-moss-400">
                            {g.name}
                          </Link>
                        ) : (
                          <span className="text-chalk-200">{g.name}</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-chalk-200">
                        {g.thcLow === null || g.thcHigh === null
                          ? '—'
                          : g.thcLow === g.thcHigh
                            ? `${pct(g.thcLow)}%`
                            : `${pct(g.thcLow)}–${pct(g.thcHigh)}%`}
                      </td>
                      <td className="py-2 text-right tabular-nums text-chalk-400">{g.places.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {strain.growers.length > growerLimit && (
              <button type="button" className="chip mt-3" onClick={() => setGrowerLimit(strain.growers.length)}>
                All {strain.growers.length} growers
              </button>
            )}
          </div>
        )}

        <div className="mt-8">
          <h2 className="label">Terpene panels</h2>
          {strain.panels.length === 0 ? (
            <p className="mt-3 text-sm text-chalk-500">
              {strain.terpenes?.kind === 'REFERENCE'
                ? `No shop publishes a panel for it. The terpenes on the overview are what ${strain.terpenes.referenceStrain} usually shows, not a reading of a jar here.`
                : 'No shop publishes a terpene panel for it.'}
            </p>
          ) : (
            <>
              <ul className="mt-3 grid gap-3 md:grid-cols-2">
                {strain.panels.slice(0, panelLimit).map((p, i) => {
                  const prov = PROVENANCE[p.provenance];
                  return (
                    <li key={i} className="card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-chalk-50">{p.grower ?? 'Grower not stated'}</p>
                          <p className="mt-0.5 text-xs text-chalk-500">
                            {p.shops === 1 ? 'On one shelf' : `Same batch on ${p.shops} shelves`}
                          </p>
                        </div>
                        {p.thcPercent !== null && (
                          <span className="shrink-0 text-sm tabular-nums text-chalk-100">THC {pct(p.thcPercent)}%</span>
                        )}
                      </div>
                      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        {p.terpenes.map((t) => (
                          <li key={t.name} className="flex justify-between gap-2">
                            <span className="text-chalk-300">{TERPENE_LABEL[t.name] ?? t.rawName ?? t.name}</span>
                            {typeof t.percent === 'number' && (
                              <span className="tabular-nums text-chalk-500">{t.percent}%</span>
                            )}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-ink-700/60 pt-3 text-xs text-chalk-500">
                        <span title={prov.detail}>{prov.label}</span>
                        {p.totalPercent ? <span>{p.totalPercent}% terpenes in all</span> : null}
                      </p>
                    </li>
                  );
                })}
              </ul>
              {strain.panels.length > panelLimit && (
                <button type="button" className="chip mt-3" onClick={() => setPanelLimit(strain.panels.length)}>
                  All {strain.panels.length} panels
                </button>
              )}
            </>
          )}
        </div>
      </section>

      {/* ---- Shelves ----------------------------------------------------- */}
      <section id="panel-shelves" role="tabpanel" aria-labelledby="tab-shelves" hidden={tab !== 'shelves'}>
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-chalk-400">
          Each grower&apos;s jars, under the name the grower sells them by, and the shelves they were
          on when we read them.
        </p>

        <div className="mt-6 space-y-4">
          {strain.growers.map((g) => (
            <div key={g.name} className="card px-5 pb-2 pt-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="font-semibold tracking-tight text-chalk-50">
                  {g.key ? (
                    <Link href={`/menus/brands/${g.key}/`} className="transition-colors hover:text-moss-400">
                      {g.name}
                    </Link>
                  ) : (
                    g.name
                  )}
                </h2>
                <span className="text-sm text-chalk-400">{shelvesLine(g.places.length)}</span>
              </div>
              <p className="mt-1 text-sm text-chalk-300">
                {g.names
                  .slice(0, 3)
                  .map((n) => `“${n}”`)
                  .join(', ')}
              </p>
              <ul className="mt-1 divide-y divide-ink-700/60">
                {g.places.map((place) => (
                  <PlaceLine key={place.id} place={place} />
                ))}
              </ul>
            </div>
          ))}

          {strain.unattributed.length > 0 && (
            <div className="card px-5 pb-2 pt-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="font-semibold tracking-tight text-chalk-200">Grower not stated</h2>
                <span className="text-sm text-chalk-400">{shelvesLine(strain.unattributed.length)}</span>
              </div>
              <ul className="mt-1 divide-y divide-ink-700/60">
                {strain.unattributed.map((place) => (
                  <PlaceLine key={place.id} place={place} />
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
