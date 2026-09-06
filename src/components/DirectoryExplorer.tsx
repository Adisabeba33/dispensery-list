'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import type { Dispensary } from '@/lib/types';
import { displayName, regionOf } from '@/lib/data';
import { buildZipCentroids, distanceKm, prettyDistance } from '@/lib/geo';
import { DispensaryCard } from './DispensaryCard';
import { DispensaryDetail } from './DispensaryDetail';

const REGION_ORDER = ['Manhattan', 'Brooklyn', 'Queens', 'The Bronx', 'Staten Island', 'Westchester'];

type SortKey = 'name' | 'region' | 'status' | 'distance';

/** Where the reader is, and how we came to know it. */
type Origin = { lat: number; lng: number; label: string } | null;

export const DirectoryExplorer = ({
  dispensaries,
  menuCounts,
}: {
  dispensaries: Dispensary[];
  /** Licence number → strains on its collected shelf. Built on the server. */
  menuCounts: Record<string, number>;
}) => {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(false);
  const [deliveryOnly, setDeliveryOnly] = useState(false);
  // Thirteen shops of four hundred and fifty-six have a shelf we have read.
  // Without this they are needles in the list, and the menus may as well not
  // have been collected.
  const [menuOnly, setMenuOnly] = useState(false);
  const [origin, setOrigin] = useState<Origin>(null);
  const [zip, setZip] = useState('');
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  // Open shops first by default: sorting by name leads with registry entity
  // names that carry no shop sign, and buries the shops someone can walk into.
  const [sort, setSort] = useState<SortKey>('status');
  // Which shop is open in place. Nothing navigates: opening a card must not
  // cost the reader the search they typed and the place they had reached.
  const [openLicence, setOpenLicence] = useState<string | null>(null);
  const restoredScroll = useRef(false);

  /* Following a shop's own website and coming back reloads the page. Without
     this the reader lands on an empty search, having lost their filters, their
     position and the card they were reading. */
  const STORAGE_KEY = 'ny-dispensary-register:view';

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
      if (!saved) return;
      setQuery(saved.query ?? '');
      setRegion(saved.region ?? null);
      setOpenOnly(Boolean(saved.openOnly));
      setDeliveryOnly(Boolean(saved.deliveryOnly));
      setMenuOnly(Boolean(saved.menuOnly));
      setSort((saved.sort as SortKey) ?? 'status');
      // The point is remembered, not the permission: coming back should not
      // re-prompt for location, and should not silently re-read it either.
      if (saved.origin?.lat != null) setOrigin(saved.origin as Origin);
      setZip(saved.zip ?? '');
      setOpenLicence(saved.openLicence ?? null);
      if (typeof saved.scrollY === 'number' && saved.scrollY > 0) {
        // After the restored list has laid out, not before.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => window.scrollTo(0, saved.scrollY));
        });
      }
    } catch {
      // Storage blocked or corrupt: start clean rather than fail to render.
    } finally {
      restoredScroll.current = true;
    }
  }, []);

  useEffect(() => {
    if (!restoredScroll.current) return;   // don't overwrite before restoring
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          query, region, openOnly, deliveryOnly, menuOnly, sort, openLicence,
          origin, zip, scrollY: window.scrollY,
        }),
      );
    } catch {
      // Not remembering is a small loss; blocking the page is not.
    }
  }, [query, region, openOnly, deliveryOnly, menuOnly, sort, openLicence, origin, zip]);

  const centroids = useMemo(() => buildZipCentroids(dispensaries), [dispensaries]);

  const locateMe = () => {
    if (!('geolocation' in navigator)) {
      setLocateError('This browser cannot share a location.');
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'your location' });
        setZip('');
        setSort('distance');
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        // Refusing is a choice, not a fault; say what happened and leave the
        // ZIP box as the way through.
        setLocateError(
          err.code === err.PERMISSION_DENIED
            ? 'Location was not shared. Type a ZIP code instead.'
            : 'Your location could not be read. Type a ZIP code instead.',
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  const useZip = (value: string) => {
    setZip(value);
    setLocateError(null);
    const point = centroids[value.trim()];
    if (!point) {
      setOrigin(null);
      if (/^\d{5}$/.test(value.trim())) {
        setLocateError(`We have no fix for ZIP ${value.trim()} — it is outside the area covered.`);
      }
      return;
    }
    setOrigin({ lat: point[0], lng: point[1], label: `ZIP ${value.trim()}` });
    setSort('distance');
  };

  const clearOrigin = () => {
    setOrigin(null);
    setZip('');
    setLocateError(null);
    if (sort === 'distance') setSort('status');
  };

  const regions = useMemo(() => {
    const present = new Set(dispensaries.map(regionOf));
    return REGION_ORDER.filter((r) => present.has(r));
  }, [dispensaries]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = dispensaries.filter((d) => {
      if (region && regionOf(d) !== region) return false;
      if (openOnly && d.operationalStatus !== 'OPEN') return false;
      if (deliveryOnly && d.services?.delivery !== true) return false;
      if (menuOnly && !menuCounts[d.licenseNumber]) return false;
      if (!q) return true;

      // Searching by licence number matters: it is how someone checks the shop
      // in front of them against this list.
      return [
        displayName(d),
        d.legalName,
        d.licenseNumber,
        d.address.line1,
        d.address.city,
        d.address.zip,
        d.address.neighborhood ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });

    const openFirst = (d: Dispensary) => (d.operationalStatus === 'OPEN' ? 0 : 1);

    /* Distance is measured once per shop rather than inside the comparator,
       which would recompute it on every comparison. */
    const km = new Map<string, number>();
    if (origin) {
      for (const d of filtered) {
        if (d.geo) km.set(d.licenseNumber, distanceKm(origin, { lat: d.geo.lat, lng: d.geo.lng }));
      }
    }

    const sorted = [...filtered].sort((a, b) => {
      if (sort === 'distance' && origin) {
        const da = km.get(a.licenseNumber);
        const db = km.get(b.licenseNumber);
        // Sixteen records have no coordinates. They keep their place in the
        // list rather than being dropped, but they cannot claim to be near.
        if (da === undefined && db === undefined) return displayName(a).localeCompare(displayName(b));
        if (da === undefined) return 1;
        if (db === undefined) return -1;
        return da - db;
      }
      if (sort === 'status') return openFirst(a) - openFirst(b) || displayName(a).localeCompare(displayName(b));
      if (sort === 'region') return regionOf(a).localeCompare(regionOf(b)) || displayName(a).localeCompare(displayName(b));
      return displayName(a).localeCompare(displayName(b));
    });

    return { list: sorted, km };
  }, [dispensaries, menuCounts, query, region, openOnly, deliveryOnly, menuOnly, sort, origin]);

  const { list, km } = results;

  const activeFilters = Boolean(region || openOnly || deliveryOnly || menuOnly || query.trim());

  const clearAll = () => {
    setQuery('');
    setRegion(null);
    setOpenOnly(false);
    setDeliveryOnly(false);
    setMenuOnly(false);
    setOpenLicence(null);
  };

  const toggle = (licence: string) => {
    const closing = openLicence === licence;
    setOpenLicence(closing ? null : licence);
    if (closing) return;
    // Bring the card's top into view so the detail is not half off-screen.
    requestAnimationFrame(() => {
      const el = document.getElementById(`shop-${licence}`);
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
    });
  };

  return (
    <section id="directory" className="shell scroll-mt-20 py-12">
      <div className="flex flex-col gap-4">
        <label className="relative block">
          <span className="sr-only">Search by name, address, ZIP or licence number</span>
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
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, street, ZIP or licence number (OCM-CAURD-…)"
            className="field pl-11"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={locateMe}
            disabled={locating}
            className={clsx('chip', origin?.label === 'your location' && 'chip-on')}
          >
            {locating ? 'Finding you…' : 'Shops near me'}
          </button>

          <label className="flex items-center gap-2">
            <span className="sr-only">ZIP code</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={5}
              value={zip}
              onChange={(e) => useZip(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="or a ZIP"
              className="w-28 rounded-full border border-ink-700 bg-ink-900/80 px-3 py-1.5 text-sm text-chalk-50 placeholder:text-chalk-500 focus:border-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-600/25"
            />
          </label>

          {origin && (
            <>
              <span className="text-sm text-chalk-400">
                Nearest to <span className="text-chalk-100">{origin.label}</span>, straight-line
              </span>
              <button type="button" onClick={clearOrigin} className="link text-sm">
                clear
              </button>
            </>
          )}
        </div>

        {locateError && (
          <p role="status" className="text-sm text-amber-400">
            {locateError}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setRegion(null)}
            className={clsx('chip', region === null && 'chip-on')}
          >
            All areas
          </button>
          {regions.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRegion(region === r ? null : r)}
              className={clsx('chip', region === r && 'chip-on')}
            >
              {r}
            </button>
          ))}

          <span aria-hidden className="mx-1 hidden h-5 w-px bg-ink-700 sm:block" />

          <button
            type="button"
            onClick={() => setOpenOnly((v) => !v)}
            className={clsx('chip', openOnly && 'chip-on')}
          >
            Open now listed
          </button>
          <button
            type="button"
            onClick={() => setDeliveryOnly((v) => !v)}
            className={clsx('chip', deliveryOnly && 'chip-on')}
          >
            Delivers
          </button>
          <button
            type="button"
            onClick={() => setMenuOnly((v) => !v)}
            aria-pressed={menuOnly}
            className={clsx('chip', menuOnly && 'chip-on')}
          >
            Flower menu collected
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-700/70 pb-4">
          <p className="text-sm text-chalk-400">
            <span className="font-semibold text-chalk-50">{list.length}</span>
            {list.length === 1 ? ' dispensary' : ' dispensaries'}
            {activeFilters && (
              <>
                {' '}
                ·{' '}
                <button type="button" onClick={clearAll} className="link">
                  clear filters
                </button>
              </>
            )}
          </p>

          <label className="flex items-center gap-2 text-sm text-chalk-400">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-lg border border-ink-700 bg-ink-900 px-2.5 py-1.5 text-chalk-200 focus:border-moss-600 focus:outline-none"
            >
              <option value="status">Open first</option>
              <option value="name">Name</option>
              <option value="region">Area</option>
            </select>
          </label>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card mt-8 p-10 text-center">
          <p className="text-chalk-200">Nothing matches those filters.</p>
          <p className="mt-2 text-sm text-chalk-400">
            A shop missing from this list is not automatically illegal — it may simply not be in the
            register yet. Check it at{' '}
            <a
              className="link"
              href="https://cannabis.ny.gov/dispensary-location-verification"
              target="_blank"
              rel="noreferrer noopener"
            >
              the state verification tool
            </a>
            .
          </p>
        </div>
      ) : (
        <ul className="mt-8 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((d) => {
            const isOpen = openLicence === d.licenseNumber;
            return (
              <li
                key={d.id}
                id={`shop-${d.licenseNumber}`}
                // An expanded card takes the whole row: the detail needs the
                // width, and the list around it stays where the reader left it.
                className={isOpen ? 'sm:col-span-2 lg:col-span-3' : undefined}
              >
                <DispensaryCard
                  d={d}
                  expanded={isOpen}
                  onToggle={() => toggle(d.licenseNumber)}
                  menuCount={menuCounts[d.licenseNumber] ?? 0}
                  distance={
                    origin && km.has(d.licenseNumber)
                      ? prettyDistance(km.get(d.licenseNumber)!)
                      : null
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
