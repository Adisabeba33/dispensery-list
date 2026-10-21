'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import type { TerritoryShop } from '@/lib/territory-data';
import { displayName } from '@/lib/territory-data';
import { ShelfBarsIcon } from './AreaIcons';
import { EmptyState, FOCUS_RING, SEARCH_ICON, SearchIcon, SortSelect, chipClass } from './PageParts';
import { TerritoryCard } from './TerritoryCard';

/**
 * Search and county filter for a territory that has only its registry import.
 *
 * Not DirectoryExplorer with flags. That component offers "open now"
 * and a borough filter — controls that would return nothing at all here,
 * because no record in these territories has a confirmed trading status or a
 * borough. Dead controls read as a broken page, and teaching one component to
 * hide most of itself makes NYC's page pay for upstate's gaps.
 *
 * So: controls that work, and a count that does not lie. "Shelf read"
 * appears only for a territory whose shelves have been read. When these
 * territories are enriched, this grows — or is replaced by the fuller one.
 */

type SortKey = 'name' | 'county' | 'opened';

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'opened', label: 'Opened most recently' },
  { id: 'name', label: 'Name' },
  { id: 'county', label: 'County' },
];

export const TerritoryExplorer = ({
  shops,
  counties,
  storageKey,
  licenceExample = 'OCM-RETL-…',
  shelfCounts,
  shelfRoute,
  verify = { href: 'https://cannabis.ny.gov/dispensary-location-verification', label: 'the state verification tool' },
}: {
  shops: TerritoryShop[];
  counties: { name: string; count: number }[];
  /** Per territory. A county chosen upstate must not follow the reader to Long Island. */
  storageKey: string;
  /** What a licence number looks like in this state, for the search hint. */
  licenceExample?: string;
  /** Strains on the shelf per licence, for a territory whose shelves have pages.
      Absent everywhere else, and then no card links anywhere. */
  shelfCounts?: Record<string, number>;
  /** The territory's route; a shop's shelf page sits beneath it. */
  shelfRoute?: string;
  /** Where a reader checks a licence this list does not show. */
  verify?: { href: string; label: string };
}) => {
  const [query, setQuery] = useState('');
  const [county, setCounty] = useState<string | null>(null);
  const [openedOnly, setOpenedOnly] = useState(false);
  const [stockOnly, setStockOnly] = useState(false);
  // Shops whose shelf we read: the green lamps.
  const stockTotal = shelfCounts ? Object.keys(shelfCounts).length : 0;
  const [sort, setSort] = useState<SortKey>('opened');
  const [limit, setLimit] = useState(60);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = shops.filter((d) => {
      if (county && d.address.county !== county) return false;
      if (openedOnly && d.dates?.openedOn == null) return false;
      if (stockOnly && !(shelfCounts && d.licenseNumber in shelfCounts)) return false;
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
  }, [shops, query, county, openedOnly, stockOnly, shelfCounts, sort]);

  const active = Boolean(county || openedOnly || stockOnly || query.trim());
  const shown = list.slice(0, limit);

  return (
    <section id="list" className="scroll-mt-20" data-territory={storageKey}>
      <div className="flex flex-col gap-3 sm:gap-4">
        <label className="relative block">
          <span className="sr-only">Search by name, town, county or licence number</span>
          <SearchIcon className={SEARCH_ICON} />
          {/* The home page's field (the kit's SEARCH_FIELD), its placeholder
              a step smaller on a phone, for this longer one to fit more of
              itself; typed text stays 16px. */}
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(60);
            }}
            placeholder={`Search name, town, county or licence number (${licenceExample})`}
            className="field h-[2.5625rem] text-ellipsis rounded-[7px] border-moss-600/55 py-0 pl-10 pr-3 placeholder:text-[clamp(0.6875rem,4.6vw-0.6rem,0.8125rem)] placeholder:text-chalk-300 sm:h-11 sm:placeholder:text-sm [&:placeholder-shown::-webkit-search-cancel-button]:hidden"
          />
        </label>

        <div className="flex flex-wrap gap-x-[0.4375rem] gap-y-[0.5625rem] sm:gap-2">
          <button
            type="button"
            onClick={() => setCounty(null)}
            aria-pressed={county === null}
            className={chipClass(county === null)}
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
              aria-pressed={county === c.name}
              className={chipClass(county === c.name)}
            >
              {c.name}
              <span className="tabular-nums text-chalk-400">{c.count}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-[0.4375rem] gap-y-[0.5625rem] sm:gap-2">
          <button
            type="button"
            onClick={() => {
              setOpenedOnly((v) => !v);
              setLimit(60);
            }}
            aria-pressed={openedOnly}
            className={chipClass(openedOnly)}
          >
            Opening date on file
          </button>
          {stockTotal > 0 && (
            <button
              type="button"
              onClick={() => {
                setStockOnly((v) => !v);
                setLimit(60);
              }}
              aria-pressed={stockOnly}
              className={clsx(chipClass(stockOnly), 'pl-[0.5625rem] sm:pl-3')}
            >
              <ShelfBarsIcon />
              Shelf read
              <span className="tabular-nums text-chalk-400">{stockTotal}</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-ink-700 pb-[0.1875rem] sm:pb-2">
          <p className="text-[0.8125rem] text-chalk-400 sm:text-sm">
            <span className="text-[0.9375rem] font-bold tabular-nums text-chalk-50 sm:text-base">{list.length}</span>
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
                    setStockOnly(false);
                  }}
                  className={clsx('link rounded-sm', FOCUS_RING)}
                >
                  clear filters
                </button>
              </>
            )}
          </p>

          {/* As on the home page. */}
          <SortSelect value={sort} options={SORTS} onChange={setSort} />
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState title="Nothing matches those filters.">
          A shop missing from this list is not automatically illegal — it may simply not hold a
          licence in this snapshot. Check it at{' '}
          <a
            className={clsx('link rounded-sm', FOCUS_RING)}
            href={verify.href}
            target="_blank"
            rel="noreferrer noopener"
          >
            {verify.label}
          </a>
          .
        </EmptyState>
      ) : (
        <>
          <ul className="mt-3.5 grid grid-cols-1 gap-[0.6875rem] sm:mt-5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {shown.map((d) => (
              <li key={d.id}>
                <TerritoryCard
                  d={d}
                  shelf={shelfCounts?.[d.licenseNumber]}
                  shelfHref={
                    shelfCounts && shelfRoute && d.licenseNumber in shelfCounts ? `${shelfRoute}/${d.id}/` : undefined
                  }
                />
              </li>
            ))}
          </ul>

          {shown.length < list.length && (
            <div className="mt-6 text-center sm:mt-8">
              {/* Five hundred cards at once is a slow page on a phone, and
                  nobody reads past the first sixty without narrowing first. */}
              <button type="button" onClick={() => setLimit((n) => n + 120)} className="btn px-5">
                Show more — {list.length - shown.length} left
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};
