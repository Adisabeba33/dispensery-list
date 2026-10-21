'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { LINEAGE_LABEL, PROVENANCE, TERPENE_LABEL, TERPENE_NOTE, sizeChips } from '@/lib/menu-format';
import type { StrainGrower, StrainPageData, StrainPlace } from '@/lib/strain-page';
import { Chevron, chipClass } from './PageParts';

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

/* A place: the shop's name and its district, and its page in the register —
   the whole row is the link, as a row that leads somewhere is everywhere on
   the site. The green dot is the shelf lamp: every place here is a shelf we
   read. */
const PlaceLine = ({ place }: { place: StrainPlace }) => (
  <li className="row-link group p-0">
    <Link
      href={`/dispensary/${place.id}/`}
      className="flex min-w-0 flex-1 items-center gap-3 rounded-md py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-moss-400"
    >
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full bg-moss-400 shadow-[0_0_6px_rgba(var(--glow),0.6)]"
      />
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-chalk-50 transition-colors group-hover:text-moss-400">
          {place.name}
        </span>
        <span className="mt-0.5 block text-sm text-chalk-400">{place.region}</span>
      </span>
      <Chevron className="text-chalk-400" />
    </Link>
  </li>
);

const shelvesLine = (n: number) => `on ${n} ${n === 1 ? 'shelf' : 'shelves'}`;

/* Two growers can print one name — Breyer's Cannabis is two brands on the
   shelves, with a page each — so a grower is keyed by its brand page and its
   name, and a pair that still meets is told apart by a number. */
const growerKeys = (growers: StrainGrower[]): string[] => {
  const seen = new Map<string, number>();
  return growers.map((g) => {
    const base = `${g.key ?? ''}:${g.name}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}~${n}`;
  });
};

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
  const keys = growerKeys(strain.growers);

  return (
    <div className="mt-8">
      {/* The kit's segmented strip; on the narrowest phone it scrolls inside
          itself rather than push the page sideways. */}
      <div className="no-scrollbar -mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <div ref={tabsRef} role="tablist" aria-label="About this strain" className="tabs scroll-mt-24">
          {TABS.map((t) => (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => choose(t.id)}
              className={clsx('tab shrink-0 whitespace-nowrap', tab === t.id && 'tab-on font-medium')}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Overview ---------------------------------------------------- */}
      <section id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" hidden={tab !== 'overview'}>
        {/* On a phone: the figures, then the shelves, then who grows it. On a
            wide screen the shelves take the right-hand column beside the rest. */}
        <div className="mt-6 grid gap-4 lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:items-start">
          <div className="lg:col-start-1 lg:row-start-1">
            {/* The figures and what the leading terpenes smell of, in one frame:
                two even columns, so the THC range's stamp cannot take the room
                a terpene's tag needs (a tag does not wrap). Stacked on the
                narrowest phones, where even half the card is too narrow for
                "Caryophyllene". (A plain media variant: Tailwind's min-[…] goes
                away once the em-based `nav` screen is defined.) */}
            <div className="card overflow-hidden">
              <div className="grid grid-cols-1 divide-y divide-ink-700 [@media(min-width:360px)]:grid-cols-2 [@media(min-width:360px)]:divide-x [@media(min-width:360px)]:divide-y-0">
                <div className="px-5 py-5">
                  <p className="label">THC</p>
                  {strain.thc ? (
                    <>
                      <p className="mt-2 bg-gradient-to-b from-moss-300 to-moss-400 bg-clip-text text-4xl font-semibold tabular-nums tracking-tight text-transparent">
                        {pct(strain.thc.median)}%
                      </p>
                      <p className="stamp mt-1.5 tabular-nums">
                        {strain.thc.low === strain.thc.high
                          ? `${strain.thc.listings === 1 ? 'one listing' : `${strain.thc.listings} listings`}`
                          : `${pct(strain.thc.low)}–${pct(strain.thc.high)}% · ${strain.thc.listings} listings`}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-chalk-400">Not stated</p>
                  )}
                </div>
                <div className="min-w-0 px-5 py-5">
                  <p className="label">Top terpenes</p>
                  {strain.terpenes ? (
                    <>
                      <ul className="mt-2.5 flex flex-wrap gap-1.5">
                        {strain.terpenes.top.map((t) => (
                          <li key={t} className="tag text-[0.8125rem] text-chalk-50">
                            {TERPENE_LABEL[t] ?? t}
                          </li>
                        ))}
                      </ul>
                      {strain.terpenes.kind === 'MEASURED' ? (
                        <p className="mt-2 text-xs text-chalk-400">
                          {strain.terpenes.panels === 1
                            ? 'From the one panel on a shop menu'
                            : `Most often leading ${strain.terpenes.panels} panels on shop menus`}
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-amber-400/90">
                          Typical for {strain.terpenes.referenceStrain}, not measured from a jar here
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-chalk-400">No shop publishes them</p>
                  )}
                </div>
              </div>

              {notes.length > 0 && (
                <p className="border-t border-ink-700 px-5 py-3 text-sm text-chalk-300">{notes.join(' · ')}</p>
              )}
            </div>
          </div>

          <div className="card px-5 pb-4 pt-5 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <h2 className="section-title">
              On the shelf at {shelves} {shelves === 1 ? 'shop' : 'shops'}
            </h2>
            <ul className="mt-2">
              {strain.places.slice(0, PREVIEW).map((place) => (
                <PlaceLine key={place.id} place={place} />
              ))}
            </ul>
            <div className="mt-1 border-t border-ink-700/70 pt-4">
              <button type="button" onClick={() => choose('shelves', true)} className="btn w-full">
                {shelves > PREVIEW ? `View all ${shelves} shelves` : 'Shelves by grower'}
                <Chevron />
              </button>
            </div>
          </div>

          <div className="space-y-5 lg:col-start-1 lg:row-start-2">
            {/* The call most shelves make is the badge above; when they do not
                agree, every call is said, so the badge is not taken as settled. */}
            {strain.lineages.length > 1 && (
              <p className="note">
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
                  {strain.growers.slice(0, 8).map((g, i) => (
                    <li key={keys[i]}>
                      {g.key ? (
                        <Link href={`/menus/brands/${g.key}/`} className={chipClass(false)}>
                          {g.name}
                        </Link>
                      ) : (
                        <span className={chipClass(false)}>{g.name}</span>
                      )}
                    </li>
                  ))}
                  {strain.growers.length > 8 && (
                    <li>
                      <button type="button" className={chipClass(false)} onClick={() => choose('shelves', true)}>
                        {strain.growers.length - 8} more
                        <Chevron className="-mr-1 h-3.5 w-3.5 text-chalk-400" />
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
                    <li key={s.grams} className="tag">
                      <span className="font-medium">{s.label}</span>
                      {s.label !== s.short && <span className="tabular-nums text-chalk-400">{s.short}</span>}
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
        <p className="note mt-6 max-w-3xl">
          Figures as the shops print them. A menu&apos;s THC can be THCA or total THC, and each batch
          tests differently, so one grower&apos;s jars can sit several points apart.
        </p>

        {strain.growers.length > 0 && (
          <div className="mt-8">
            <h2 className="section-title">THC by grower</h2>
            <div className="card scroll-x mt-4 px-4 sm:px-5 lg:max-w-3xl">
              <table className="w-full min-w-[17.5rem] text-sm">
                <thead>
                  <tr className="label border-b border-ink-700 text-left">
                    <th className="py-3 pr-4 font-medium">Grower</th>
                    <th className="py-3 pr-4 text-right font-medium">THC</th>
                    <th className="py-3 text-right font-medium">Shelves</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700/70">
                  {strain.growers.slice(0, growerLimit).map((g, i) => (
                    <tr key={keys[i]}>
                      <td className="py-2.5 pr-4">
                        {g.key ? (
                          <Link
                            href={`/menus/brands/${g.key}/`}
                            className="text-chalk-50 transition-colors hover:text-moss-400"
                          >
                            {g.name}
                          </Link>
                        ) : (
                          <span className="text-chalk-200">{g.name}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-4 text-right font-mono tabular-nums text-moss-400">
                        {g.thcLow === null || g.thcHigh === null
                          ? '—'
                          : g.thcLow === g.thcHigh
                            ? `${pct(g.thcLow)}%`
                            : `${pct(g.thcLow)}–${pct(g.thcHigh)}%`}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-chalk-300">{g.places.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {strain.growers.length > growerLimit && (
              <button type="button" className="btn mt-4" onClick={() => setGrowerLimit(strain.growers.length)}>
                All {strain.growers.length} growers
              </button>
            )}
          </div>
        )}

        <div className="mt-10">
          <h2 className="section-title">Terpene panels</h2>
          {strain.panels.length === 0 ? (
            <p className={clsx('note mt-4 max-w-3xl', strain.terpenes?.kind === 'REFERENCE' && 'note-caution')}>
              {strain.terpenes?.kind === 'REFERENCE'
                ? `No shop publishes a panel for it. The terpenes on the overview are what ${strain.terpenes.referenceStrain} usually shows, not a reading of a jar here.`
                : 'No shop publishes a terpene panel for it.'}
            </p>
          ) : (
            <>
              <ul className="mt-4 grid gap-3 md:grid-cols-2">
                {strain.panels.slice(0, panelLimit).map((p, i) => {
                  const prov = PROVENANCE[p.provenance];
                  return (
                    <li key={i} className="card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-chalk-50">{p.grower ?? 'Grower not stated'}</p>
                          <p className="mt-0.5 text-xs text-chalk-400">
                            {p.shops === 1 ? 'On one shelf' : `Same batch on ${p.shops} shelves`}
                          </p>
                        </div>
                        {p.thcPercent !== null && (
                          <span className="shrink-0 font-mono text-sm tabular-nums text-moss-400">
                            THC {pct(p.thcPercent)}%
                          </span>
                        )}
                      </div>
                      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        {p.terpenes.map((t) => (
                          <li key={t.name} className="flex justify-between gap-2">
                            <span className="text-chalk-300">{TERPENE_LABEL[t.name] ?? t.rawName ?? t.name}</span>
                            {typeof t.percent === 'number' && (
                              <span className="font-mono tabular-nums text-chalk-400">{t.percent}%</span>
                            )}
                          </li>
                        ))}
                      </ul>
                      <p className="stamp mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-ink-700/70 pt-3">
                        <span title={prov.detail}>{prov.label}</span>
                        {p.totalPercent ? <span>{p.totalPercent}% terpenes in all</span> : null}
                      </p>
                    </li>
                  );
                })}
              </ul>
              {strain.panels.length > panelLimit && (
                <button type="button" className="btn mt-4" onClick={() => setPanelLimit(strain.panels.length)}>
                  All {strain.panels.length} panels
                </button>
              )}
            </>
          )}
        </div>
      </section>

      {/* ---- Shelves ----------------------------------------------------- */}
      <section id="panel-shelves" role="tabpanel" aria-labelledby="tab-shelves" hidden={tab !== 'shelves'}>
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-chalk-300">
          Each grower&apos;s jars, under the name the grower sells them by, and the shelves they were
          on when we read them.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-2 lg:items-start">
          {strain.growers.map((g, i) => (
            <div key={keys[i]} className="card px-5 pb-1 pt-4">
              <div className="flex items-start justify-between gap-x-4 gap-y-1">
                <h2 className="min-w-0 font-semibold tracking-tight text-chalk-50">
                  {g.key ? (
                    <Link href={`/menus/brands/${g.key}/`} className="transition-colors hover:text-moss-400">
                      {g.name}
                    </Link>
                  ) : (
                    g.name
                  )}
                </h2>
                <span className="tag shrink-0 tabular-nums">{shelvesLine(g.places.length)}</span>
              </div>
              <p className="mt-1 text-sm text-chalk-300">
                {g.names
                  .slice(0, 3)
                  .map((n) => `“${n}”`)
                  .join(', ')}
              </p>
              <ul className="mt-1">
                {g.places.map((place) => (
                  <PlaceLine key={place.id} place={place} />
                ))}
              </ul>
            </div>
          ))}

          {strain.unattributed.length > 0 && (
            <div className="card px-5 pb-1 pt-4">
              <div className="flex items-start justify-between gap-x-4 gap-y-1">
                <h2 className="min-w-0 font-semibold tracking-tight text-chalk-200">Grower not stated</h2>
                <span className="tag shrink-0 tabular-nums">{shelvesLine(strain.unattributed.length)}</span>
              </div>
              <ul className="mt-1">
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
