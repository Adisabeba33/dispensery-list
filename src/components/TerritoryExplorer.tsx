'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import type { TerritoryShop } from '@/lib/territory-data';
import { displayName } from '@/lib/territory-data';
import { TerritoryCard } from './TerritoryCard';

/**
 * Search and county filter for a territory that has only its registry import.
 *
 * Not DirectoryExplorer with flags. That component offers "near me", a ZIP
 * search, "open now listed", "delivers" and "flower menu collected" — five
 * controls that would return nothing at all here, because no record in these
 * territories has coordinates, a confirmed trading status, a service flag or a
 * collected shelf. Dead controls read as a broken page, and teaching one
 * component to hide most of itself makes NYC's page pay for upstate's gaps.
 *
 * So: two controls that work, and a count that does not lie. When these
 * territories are enriched, this grows — or is replaced by the fuller one.
 */

type SortKey = 'name' | 'county' | 'opened';

export const TerritoryExplorer = ({
  shops,
  counties,
  storageKey,
}: {
  shops: TerritoryShop[];
  counties: { name: string; count: number }[];
  /** Per territory. A county chosen upstate must not follow the reader to Long Island. */
  storageKey: string;
}) => {
  const [query, setQuery] = useState('');
  const [county, setCounty] = useState<string | null>(null);
  const [openedOnly, setOpenedOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('opened');
  const [limit, setLimit] = useState(60);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = shops.filter((d) => {
      if (county && d.address.county !== county) return false;
      if (openedOnly && d.dates?.openedOn == null) return false;
      if (!q) return true;
      // Licence number included on purpose: it is how a reader checks the shop
      // in front of them against this list.
      return [
        displayName(d),
        d.legalName,
        d.licenseNumber,
        d.address.line1,
        d.address.city,
        d.address.county,
        d.address.zip,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });

    return [...filtered].sort((a, b) => {
      if (sort === 'opened') {
        // Shops the registry says have opened, most recent first, then the
        // rest alphabetically. It is the only quality signal this data carries.
        const ao = a.dates?.openedOn ?? null;
        const bo = b.dates?.openedOn ?? null;
        if (ao && bo) return bo.localeCompare(ao);
        if (ao) return -1;
        if (bo) return 1;
        return displayName(a).localeCompare(displayName(b));
      }
      if (sort === 'county') {
        return (
          a.address.county.localeCompare(b.address.county) ||
          displayName(a).localeCompare(displayName(b))
        );
      }
      return displayName(a).localeCompare(displayName(b));
    });
  }, [shops, query, county, openedOnly, sort]);

  const active = Boolean(county || openedOnly || query.trim());
  const shown = list.slice(0, limit);

  return (
    <section id="list" className="scroll-mt-28 sm:scroll-mt-20" data-territory={storageKey}>
      <div className="flex flex-col gap-4">
        <label className="relative block">
          <span className="sr-only">Search by name, town, county or licence number</span>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(60);
            }}
            placeholder="Search name, town, county or licence number (OCM-RETL-…)"
            className="field"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCounty(null)}
            className={clsx('chip', county === null && 'chip-on')}
          >
            All counties
          </button>
          {counties.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => {
                setCounty(county === c.name ? null : c.name);
                setLimit(60);
              }}
              className={clsx('chip', county === c.name && 'chip-on')}
            >
              {c.name}
              <span className="ml-1.5 tabular-nums text-chalk-500">{c.count}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setOpenedOnly((v) => !v);
              setLimit(60);
            }}
            aria-pressed={openedOnly}
            className={clsx('chip', openedOnly && 'chip-on')}
          >
            Opening date on file
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-700/70 pb-4">
          <p className="text-sm text-chalk-400">
            <span className="font-semibold text-chalk-50">{list.length}</span>
            {list.length === 1 ? ' licence' : ' licences'}
            {active && (
              <>
                {' · '}
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setCounty(null);
                    setOpenedOnly(false);
                  }}
                  className="link"
                >
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
              <option value="opened">Opened most recently</option>
              <option value="name">Name</option>
              <option value="county">County</option>
            </select>
          </label>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card mt-8 p-10 text-center">
          <p className="text-chalk-200">Nothing matches those filters.</p>
          <p className="mt-2 text-sm text-chalk-400">
            A shop missing from this list is not automatically illegal — it may simply not hold a
            licence in this snapshot. Check it at{' '}
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
        <>
          <ul className="mt-8 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((d) => (
              <li key={d.id}>
                <TerritoryCard d={d} />
              </li>
            ))}
          </ul>

          {shown.length < list.length && (
            <div className="mt-8 text-center">
              {/* Five hundred cards at once is a slow page on a phone, and
                  nobody reads past the first sixty without narrowing first. */}
              <button
                type="button"
                onClick={() => setLimit((n) => n + 120)}
                className="rounded-lg border border-ink-700 bg-ink-800 px-5 py-2.5 text-sm text-chalk-200 transition-colors hover:border-chalk-500 hover:text-chalk-50"
              >
                Show more — {list.length - shown.length} left
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};
