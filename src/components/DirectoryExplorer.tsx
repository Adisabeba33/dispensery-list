'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import type { Dispensary } from '@/lib/types';
import { displayName, regionOf } from '@/lib/data';
import { DispensaryCard } from './DispensaryCard';

const REGION_ORDER = ['Manhattan', 'Brooklyn', 'Queens', 'The Bronx', 'Staten Island', 'Westchester'];

type SortKey = 'name' | 'region' | 'status';

export const DirectoryExplorer = ({ dispensaries }: { dispensaries: Dispensary[] }) => {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(false);
  const [deliveryOnly, setDeliveryOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('name');

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

    return [...filtered].sort((a, b) => {
      if (sort === 'status') return openFirst(a) - openFirst(b) || displayName(a).localeCompare(displayName(b));
      if (sort === 'region') return regionOf(a).localeCompare(regionOf(b)) || displayName(a).localeCompare(displayName(b));
      return displayName(a).localeCompare(displayName(b));
    });
  }, [dispensaries, query, region, openOnly, deliveryOnly, sort]);

  const activeFilters = Boolean(region || openOnly || deliveryOnly || query.trim());

  const clearAll = () => {
    setQuery('');
    setRegion(null);
    setOpenOnly(false);
    setDeliveryOnly(false);
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
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-700/70 pb-4">
          <p className="text-sm text-chalk-400">
            <span className="font-semibold text-chalk-50">{results.length}</span>
            {results.length === 1 ? ' dispensary' : ' dispensaries'}
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
              <option value="name">Name</option>
              <option value="region">Area</option>
              <option value="status">Open first</option>
            </select>
          </label>
        </div>
      </div>

      {results.length === 0 ? (
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
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((d) => (
            <li key={d.id}>
              <DispensaryCard d={d} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
