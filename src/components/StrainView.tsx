'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { buildZipCentroids, distanceKm, prettyDistance, zipInScope } from '@/lib/geo';
import { savedOrigin, saveOrigin, type Origin } from '@/lib/origin';
import {
  LINEAGE_LABEL,
  PROVENANCE,
  TERPENE_LABEL,
  TERPENE_NOTE,
  sizeChips,
} from '@/lib/menu-format';
import type { StrainPageData, StrainShop } from '@/lib/strain-page';

/* Overview, the lab figures behind it, and where it is. The mockup this page
   follows had a fourth tab, Genetics; no shelf states a strain's parents, so
   there is nothing to put in it. */
const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'lab', label: 'Lab data' },
  { id: 'where', label: 'Availability' },
] as const;
type Tab = (typeof TABS)[number]['id'];

const tabFromHash = (): Tab => {
  const hash = window.location.hash.slice(1);
  return TABS.some((t) => t.id === hash) ? (hash as Tab) : 'overview';
};

/** 22.43 is 22.4 and 29.03 is 29: one decimal is as fine as a shelf figure deserves. */
const pct = (n: number) => `${Math.round(n * 10) / 10}`;

const PREVIEW = 5;

type Placed = StrainShop & { km: number | null };

const Dot = ({ on }: { on: boolean }) => (
  <span
    aria-hidden
    className={clsx(
      'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border',
      on ? 'border-moss-400 bg-moss-400' : 'border-chalk-500 bg-transparent',
    )}
  />
);

const ShopLine = ({ shop, detailed }: { shop: Placed; detailed: boolean }) => (
  <li className={clsx('flex gap-3 py-3', !shop.inStock && 'opacity-60')}>
    <Dot on={shop.inStock} />
    <div className="min-w-0 flex-1">
      <Link
        href={`/dispensary/${shop.id}/#menu`}
        className="font-medium text-chalk-50 transition-colors hover:text-moss-400"
      >
        {shop.name}
      </Link>
      <p className="mt-0.5 text-sm text-chalk-400">
        {shop.region}
        {shop.km !== null && (
          <>
            <span className="mx-1.5 text-ink-600">·</span>
            <span className="tabular-nums">{prettyDistance(shop.km)}</span>
          </>
        )}
        {!shop.inStock && (
          <>
            <span className="mx-1.5 text-ink-600">·</span>
            Sold out
          </>
        )}
      </p>
      {detailed && (shop.sizes.length > 0 || shop.growers.length > 0) && (
        <p className="mt-1 text-xs text-chalk-500">
          {sizeChips(shop.sizes)
            .map((s) => s.label)
            .join(', ')}
          {shop.sizes.length > 0 && shop.growers.length > 0 && <span className="mx-1.5 text-ink-600">·</span>}
          {shop.growers.length > 0 && `by ${shop.growers.slice(0, 3).join(', ')}`}
        </p>
      )}
    </div>
  </li>
);

export const StrainView = ({ strain }: { strain: StrainPageData }) => {
  const [tab, setTab] = useState<Tab>('overview');
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [zip, setZip] = useState('');
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [panelLimit, setPanelLimit] = useState(8);
  const [growerLimit, setGrowerLimit] = useState(12);
  const tabsRef = useRef<HTMLDivElement>(null);

  /* The tab in the address, so a link can open "where to find it" directly,
     and the point the reader shared on any page of the register. */
  useEffect(() => {
    setTab(tabFromHash());
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    const saved = savedOrigin();
    setOrigin(saved.origin);
    setZip(saved.zip);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const choose = (next: Tab, scroll = false) => {
    setTab(next);
    const url = next === 'overview' ? window.location.pathname : `#${next}`;
    window.history.replaceState(null, '', url);
    if (scroll) tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const place = (next: Origin | null, nextZip: string) => {
    setOrigin(next);
    setZip(nextZip);
    saveOrigin(next, nextZip);
  };

  const centroids = useMemo(
    () => buildZipCentroids(strain.shops.map((s) => ({ address: { zip: s.zip }, geo: s.geo }))),
    [strain.shops],
  );

  const locateMe = () => {
    if (!('geolocation' in navigator)) {
      setLocateError('This browser cannot share a location.');
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        place({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'your location' }, '');
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setLocateError(
          err.code === err.PERMISSION_DENIED
            ? 'Location was not shared. Type a ZIP code instead.'
            : 'Your location could not be read. Type a ZIP code instead.',
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  const takeZip = (value: string) => {
    setZip(value);
    setLocateError(null);
    const code = value.trim();
    const point = centroids[code];
    if (!point) {
      if (/^\d{5}$/.test(code)) {
        setLocateError(
          zipInScope(code)
            ? `ZIP ${code} is in the area, but we have no point for it. Use “Shops near me”.`
            : `ZIP ${code} is outside New York City and Westchester, which is all these shelves cover.`,
        );
      }
      return;
    }
    place({ lat: point[0], lng: point[1], label: `ZIP ${code}` }, code);
  };

  /* Nearest first once the reader has said where they are; until then the
     order the server gave — in stock first, then by borough. A shop with no
     point on the map goes last rather than being placed anywhere. */
  const placed: Placed[] = useMemo(() => {
    const rows = strain.shops.map((s) => ({
      ...s,
      km: origin && s.geo ? distanceKm(origin, s.geo) : null,
    }));
    if (!origin) return rows;
    return [...rows].sort(
      (a, b) =>
        Number(b.inStock) - Number(a.inStock) ||
        (a.km ?? Number.POSITIVE_INFINITY) - (b.km ?? Number.POSITIVE_INFINITY),
    );
  }, [strain.shops, origin]);

  const inStock = strain.shops.filter((s) => s.inStock).length;
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
        {/* On a phone: the figures, then where it is, then who grows it. On a
            wide screen the shops take the right-hand column beside the rest. */}
        <div className="mt-6 grid gap-4 lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:items-start">
          <div className="space-y-4 lg:col-start-1 lg:row-start-1">
            <div className="card grid grid-cols-[auto_1fr] divide-x divide-ink-700">
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

            {notes.length > 0 && (
              <p className="text-sm text-chalk-400">{notes.join(' · ')}</p>
            )}
          </div>

          <div className="card px-5 pb-3 pt-5 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <h2 className="text-lg font-semibold tracking-tight text-chalk-50">
              {inStock === strain.shops.length
                ? `Available at ${strain.shops.length} ${strain.shops.length === 1 ? 'dispensary' : 'dispensaries'}`
                : `In stock at ${inStock} of ${strain.shops.length} dispensaries`}
            </h2>
            {origin && (
              <p className="mt-1 text-xs text-chalk-500">Nearest first, in a straight line from {origin.label}</p>
            )}
            <ul className="mt-1 divide-y divide-ink-700/60">
              {placed.slice(0, PREVIEW).map((shop) => (
                <ShopLine key={shop.id} shop={shop} detailed={false} />
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink-700/60 py-3">
              <button
                type="button"
                onClick={() => choose('where', true)}
                className="font-medium text-moss-400 transition-colors hover:text-moss-500"
              >
                {strain.shops.length > PREVIEW ? `View all ${strain.shops.length} locations →` : 'Sizes and growers by shop →'}
              </button>
              {!origin && (
                <button type="button" onClick={locateMe} disabled={locating} className="text-sm text-chalk-400 hover:text-chalk-50">
                  {locating ? 'Locating…' : 'Nearest to me'}
                </button>
              )}
            </div>
            {locateError && tab === 'overview' && <p className="pb-3 text-xs text-amber-400">{locateError}</p>}
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
                      <button type="button" className="chip" onClick={() => choose('lab', true)}>
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
                    <th className="py-2 text-right font-medium">Shops</th>
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
                      <td className="py-2 text-right tabular-nums text-chalk-400">{g.shops}</td>
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
                            {p.shops === 1 ? 'At one shop' : `Same batch at ${p.shops} shops`}
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
                        {p.certificate && (
                          <a href={p.certificate} target="_blank" rel="noopener noreferrer" className="link">
                            Certificate of analysis
                          </a>
                        )}
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

      {/* ---- Availability ------------------------------------------------ */}
      <section id="panel-where" role="tabpanel" aria-labelledby="tab-where" hidden={tab !== 'where'}>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={locateMe}
            disabled={locating}
            className={clsx('chip', origin?.label === 'your location' && 'chip-on')}
          >
            {locating ? 'Locating…' : 'Shops near me'}
          </button>
          <label className="flex items-center gap-2 text-sm text-chalk-400">
            <span>or ZIP</span>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={5}
              value={zip}
              onChange={(e) => takeZip(e.target.value)}
              placeholder="10003"
              className="field w-24 px-3 py-1.5"
            />
          </label>
          {origin && (
            <button type="button" className="link text-sm" onClick={() => place(null, '')}>
              clear
            </button>
          )}
        </div>
        {locateError && <p className="mt-2 text-sm text-amber-400">{locateError}</p>}
        <p className="mt-3 text-sm text-chalk-400">
          {origin
            ? `Nearest first, in a straight line from ${origin.label} — not a route.`
            : 'In stock first, then by borough. Share a location or a ZIP to see the nearest.'}
        </p>

        <ul className="mt-2 divide-y divide-ink-700/60">
          {placed.map((shop) => (
            <ShopLine key={shop.id} shop={shop} detailed />
          ))}
        </ul>
      </section>
    </div>
  );
};
