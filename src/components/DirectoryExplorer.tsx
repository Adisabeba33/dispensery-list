'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import type { Dispensary, LicenseType } from '@/lib/types';
import { displayName, LICENSE_TYPE_LABEL, regionOf } from '@/lib/data';
import { shopHoursState } from '@/lib/hours';
import { DispensaryCard } from './DispensaryCard';
import { useNyMoment } from './LiveHours';
import { AllAreasIcon, AreaIcon, ShelfBarsIcon } from './AreaIcons';

const REGION_ORDER = ['Manhattan', 'Brooklyn', 'Queens', 'The Bronx', 'Staten Island', 'Westchester'];

type SortKey = 'name' | 'region' | 'status';

const SORT_LABEL: Record<SortKey, string> = {
  status: 'Open first',
  name: 'Name',
  region: 'Area',
};

/* The licence types a reader can narrow the list to. Never delivery: the
   register says what is on the shelves, not how to get it, so a delivery-only
   licence would be listed but is never offered as a filter. */
const FILTER_TYPES = (Object.keys(LICENSE_TYPE_LABEL) as LicenseType[]).filter((t) => t !== 'DELIVERY_ONLY');

/** A ring the keyboard can always see, in the accent. */
const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-400';

/* Sized so that, at a phone's 428px, the six areas fall into the two rows of
   four and three that the owner's mockup draws; tighter below that, so the
   common phones down to 375px keep the same rows (only a 360px one takes a
   third). Wider screens get the room. (Plain media variants: Tailwind's
   max-[…] goes away beside the em-based `nav` screen.) */
const chipClass = (on: boolean, { greyIcon = false, wordsOnly = false } = {}) =>
  clsx(
    'chip h-[1.875rem] gap-2 py-0 text-[0.6875rem] sm:h-8 sm:text-[0.8125rem]',
    wordsOnly
      ? 'px-3 sm:px-3.5'
      : 'pl-[0.5625rem] pr-2.5 [@media(max-width:427px)]:gap-1 [@media(max-width:427px)]:pl-[0.3125rem] [@media(max-width:427px)]:pr-1.5 sm:pl-3 sm:pr-3.5',
    FOCUS_RING,
    // Pressed (chip-on), the words and the drawing light up together.
    on ? 'chip-on' : clsx('text-chalk-50', greyIcon && '[&_svg]:text-chalk-200'),
  );

const SearchIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden
    focusable="false"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <circle cx="10.5" cy="10.5" r="7" />
    <path d="m20.5 20.5-4.75-4.75" />
  </svg>
);

const SlidersIcon = () => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden
    focusable="false"
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
  >
    <path d="M3.5 6h10M18.5 6h2M3.5 12h3M11.5 12h9M3.5 18h11M19.5 18h1" />
    <circle cx="16" cy="6" r="2.25" />
    <circle cx="9" cy="12" r="2.25" />
    <circle cx="17" cy="18" r="2.25" />
  </svg>
);

const ChevronsIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 16 16"
    aria-hidden
    focusable="false"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m3.75 6 4.25-4 4.25 4M3.75 10 8 14l4.25-4" />
  </svg>
);

/* Puts a card's top just below the header, however tall the header is (an
   installed app adds the status bar) — or near the top of the screen, where
   the header scrolls away (a phone held sideways). */
const scrollToCard = (licence: string, behavior: ScrollBehavior): boolean => {
  const el = document.getElementById(`shop-${licence}`);
  if (!el) return false;
  const head = Math.max(0, document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 56);
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - head - 24, behavior });
  return true;
};

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
  // The shops whose shelf we read — the green lamps — out of everything the
  // registry licenses.
  const [menuOnly, setMenuOnly] = useState(false);
  // One kind of licence: CAURD, adult-use retail, a microbusiness… Kept behind
  // the sliders button, as it is the filter fewest readers want.
  const [licenseType, setLicenseType] = useState<LicenseType | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Open shops first by default: sorting by name leads with registry entity
  // names that carry no shop sign, and buries the shops someone can walk into.
  const [sort, setSort] = useState<SortKey>('status');
  // Which shop is open in place. Nothing navigates: opening a card must not
  // cost the reader the search they typed and the place they had reached.
  const [openLicence, setOpenLicence] = useState<string | null>(null);
  const restoredScroll = useRef(false);

  /* Following a link out of the list and coming back reloads the page. Without
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
      setMenuOnly(Boolean(saved.menuOnly));
      // A type no shop holds any more, one that is not a filter, or a view
      // saved before there was this filter, comes back as every type: the
      // panel has no chip to show it by, and the list would be empty.
      setLicenseType(
        FILTER_TYPES.includes(saved.licenseType) && dispensaries.some((d) => d.licenseType === saved.licenseType)
          ? (saved.licenseType as LicenseType)
          : null,
      );
      // A view saved when the list could still be sorted by distance.
      setSort(['name', 'region', 'status'].includes(saved.sort) ? (saved.sort as SortKey) : 'status');
      setOpenLicence(saved.openLicence ?? null);
      const scrollY = typeof saved.scrollY === 'number' ? saved.scrollY : 0;
      if (saved.openLicence || scrollY > 0) {
        // After the restored list has laid out, not before. The open card is
        // what the reader was reading, so it comes back to the top of the
        // screen, as when it was opened. A remembered offset would land wide
        // of it: the cards above are not laid out yet, only estimated.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (saved.openLicence && scrollToCard(saved.openLicence, 'instant')) return;
            window.scrollTo({ top: scrollY, behavior: 'instant' });
          });
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
          query, region, openOnly, menuOnly, licenseType, sort, openLicence, scrollY: window.scrollY,
        }),
      );
    } catch {
      // Not remembering is a small loss; blocking the page is not.
    }
  }, [query, region, openOnly, menuOnly, licenseType, sort, openLicence]);

  const regions = useMemo(() => {
    const present = new Set(dispensaries.map(regionOf));
    return REGION_ORDER.filter((r) => present.has(r));
  }, [dispensaries]);

  // Only the types someone holds, in the register's own order, each with how
  // many hold it.
  const licenseTypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of dispensaries) counts.set(d.licenseType, (counts.get(d.licenseType) ?? 0) + 1);
    return FILTER_TYPES.filter((t) => counts.has(t))
      .map((t) => ({ type: t, count: counts.get(t) ?? 0 }));
  }, [dispensaries]);

  // "Open now" and "Open first" follow the shops' hours, as the cards do: open
  // now, then hours unknown, then closed for the night, then the shops the
  // registry does not list as trading. Until the browser has the time, the
  // registry's word stands in.
  const now = useNyMoment();
  const openRank = useCallback(
    (d: Dispensary): number => {
      if (!now) return d.operationalStatus === 'OPEN' ? 0 : 3;
      const state = shopHoursState(d, now);
      return state === 'open' ? 0 : state === 'unknown' ? 1 : state === 'closed' ? 2 : 3;
    },
    [now],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = dispensaries.filter((d) => {
      if (region && regionOf(d) !== region) return false;
      if (openOnly && openRank(d) !== 0) return false;
      if (menuOnly && !menuCounts[d.licenseNumber]) return false;
      if (licenseType && d.licenseType !== licenseType) return false;
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

    return [...filtered].sort((a, b) => {
      if (sort === 'status') return openRank(a) - openRank(b) || displayName(a).localeCompare(displayName(b));
      if (sort === 'region') return regionOf(a).localeCompare(regionOf(b)) || displayName(a).localeCompare(displayName(b));
      return displayName(a).localeCompare(displayName(b));
    });
  }, [dispensaries, menuCounts, query, region, openOnly, menuOnly, licenseType, sort, openRank]);

  const list = results;
  const shelvesRead = useMemo(
    () => dispensaries.filter((d) => menuCounts[d.licenseNumber]).length,
    [dispensaries, menuCounts],
  );

  const activeFilters = Boolean(region || openOnly || menuOnly || licenseType || query.trim());

  const clearAll = () => {
    setQuery('');
    setRegion(null);
    setOpenOnly(false);
    setMenuOnly(false);
    setLicenseType(null);
    setOpenLicence(null);
  };

  const toggle = (licence: string) => {
    const closing = openLicence === licence;
    setOpenLicence(closing ? null : licence);
    if (closing) return;
    // Bring the card's top into view so the detail is not half off-screen.
    requestAnimationFrame(() => scrollToCard(licence, 'smooth'));
  };

  return (
    <section id="directory" className="shell scroll-mt-20 pb-12 sm:pt-6 lg:pt-8">
      <div className="flex gap-2">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">Search by name, address, ZIP or licence number</span>
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-[1.375rem] w-[1.375rem] -translate-y-1/2 text-chalk-100" />
          {/* The placeholder is set smaller on a phone narrower than 428px, so
              it fits whole (typed text stays 16px), and the clear button,
              which holds its room even while hidden, goes until there is text
              to clear. */}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, street, ZIP or licence number…"
            className="field h-[2.5625rem] text-ellipsis rounded-[7px] border-moss-600/55 py-0 pl-10 pr-3 placeholder:text-[clamp(0.6875rem,4.6vw-0.42rem,0.8125rem)] placeholder:text-chalk-300 sm:h-11 sm:placeholder:text-sm [&:placeholder-shown::-webkit-search-cancel-button]:hidden"
          />
        </label>

        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          aria-controls="directory-filters"
          className={clsx(
            'relative grid h-[2.5625rem] w-9 shrink-0 place-items-center rounded-[7px] border bg-ink-900/80 text-chalk-50 transition-colors hover:border-moss-500 sm:h-11 sm:w-11',
            FOCUS_RING,
            filtersOpen ? 'chip-on' : 'border-moss-600/55',
          )}
        >
          <span className="sr-only">
            More filters{licenseType ? `: ${LICENSE_TYPE_LABEL[licenseType]} only` : ''}
          </span>
          <SlidersIcon />
          {/* A filter is on that the closed panel does not show. */}
          {licenseType && (
            <span
              aria-hidden
              className="absolute right-[0.3125rem] top-[0.3125rem] h-1.5 w-1.5 rounded-full bg-moss-400 shadow-[0_0_6px_rgba(var(--glow),0.9)]"
            />
          )}
        </button>
      </div>

      <div
        id="directory-filters"
        hidden={!filtersOpen}
        className="mt-2.5 rounded-[7px] border border-moss-700/50 bg-ink-900/80 p-3 sm:p-4"
      >
        <div className="sm:flex sm:items-center sm:gap-5">
          <p id="directory-licence-type" className="label shrink-0 text-chalk-400">
            Licence type
          </p>
          <div
            role="group"
            aria-labelledby="directory-licence-type"
            className="mt-2.5 flex flex-wrap gap-x-[0.4375rem] gap-y-2 sm:mt-0 sm:gap-2"
          >
            <button
              type="button"
              onClick={() => setLicenseType(null)}
              aria-pressed={licenseType === null}
              className={chipClass(licenseType === null, { wordsOnly: true })}
            >
              All types
            </button>
            {licenseTypes.map(({ type, count }) => (
              <button
                key={type}
                type="button"
                onClick={() => setLicenseType(licenseType === type ? null : type)}
                aria-pressed={licenseType === type}
                className={chipClass(licenseType === type, { wordsOnly: true })}
              >
                {LICENSE_TYPE_LABEL[type]}
                <span className="tabular-nums text-chalk-400">{count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* On a phone the two toggles take a row of their own under the areas;
          wider, they follow on the same line. No divider between the two
          groups: wherever the line breaks it would be left hanging. */}
      <div className="mt-[0.6875rem] flex flex-col gap-[0.5625rem] sm:mt-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-2.5">
        <div
          role="group"
          aria-label="Area"
          className="flex flex-wrap gap-x-[0.4375rem] gap-y-[0.5625rem] [@media(max-width:427px)]:gap-x-1.5 sm:gap-2"
        >
          <button
            type="button"
            onClick={() => setRegion(null)}
            aria-pressed={region === null}
            className={chipClass(region === null, { greyIcon: true })}
          >
            <AllAreasIcon />
            All areas
          </button>
          {regions.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRegion(region === r ? null : r)}
              aria-pressed={region === r}
              className={chipClass(region === r, { greyIcon: true })}
            >
              <AreaIcon area={r} />
              {r}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-x-[0.4375rem] gap-y-[0.5625rem] sm:gap-2">
          {/* Open now by the shop's own hours, as its card's line says. */}
          <button
            type="button"
            onClick={() => setOpenOnly((v) => !v)}
            aria-pressed={openOnly}
            className={chipClass(openOnly)}
          >
            <span aria-hidden className="grid w-[0.9375rem] place-items-center">
              <span className="h-2 w-2 rounded-full bg-moss-400 shadow-[0_0_6px_rgba(var(--glow),0.6)]" />
            </span>
            Open now
          </button>
          <button
            type="button"
            onClick={() => setMenuOnly((v) => !v)}
            aria-pressed={menuOnly}
            className={chipClass(menuOnly)}
          >
            <ShelfBarsIcon />
            Shelf read <span className="tabular-nums text-chalk-400">{shelvesRead}</span>
          </button>
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-ink-700 pb-[0.1875rem] sm:mt-6 sm:pb-2">
        <p className="text-[0.8125rem] text-chalk-400 sm:text-sm">
          <span className="text-[0.9375rem] font-bold tabular-nums text-chalk-50 sm:text-base">{list.length}</span>
          {list.length === 1 ? ' dispensary' : ' dispensaries'}
          {activeFilters && (
            <>
              {' '}
              ·{' '}
              <button type="button" onClick={clearAll} className={clsx('link rounded-sm', FOCUS_RING)}>
                clear filters
              </button>
            </>
          )}
        </p>

        {/* The select is invisible and covers the box, at 16px so a phone does
            not zoom in when it is tapped; the box beside it shows the choice.
            It reaches a little above and below the box, for a finger. */}
        <label className="flex items-center gap-2.5 text-[0.8125rem] text-chalk-400 sm:text-sm">
          Sort
          <span
            className={clsx(
              'relative inline-flex h-7 min-w-[5.875rem] items-center rounded-[5px] border border-moss-700/60 bg-ink-900/80 transition-colors hover:border-moss-600 sm:h-8',
              'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-moss-400',
            )}
          >
            <span aria-hidden className="pl-[0.6875rem] pr-7 text-[0.78125rem] text-chalk-50 sm:pl-3 sm:pr-8 sm:text-[0.8125rem]">
              {SORT_LABEL[sort]}
            </span>
            <ChevronsIcon className="pointer-events-none absolute right-1.5 top-1/2 h-4 w-4 -translate-y-1/2 text-chalk-200" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="absolute inset-x-0 -inset-y-1 w-full cursor-pointer appearance-none bg-ink-900 text-base text-chalk-50 opacity-0 outline-none"
            >
              {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
                <option key={key} value={key}>
                  {SORT_LABEL[key]}
                </option>
              ))}
            </select>
          </span>
        </label>
      </div>

      {list.length === 0 ? (
        <div className="card hud-corners mt-4 rounded-lg border-moss-700/50 px-6 py-10 text-center sm:mt-6 sm:py-12">
          <span
            aria-hidden
            className="mx-auto grid h-10 w-10 place-items-center rounded-md border border-moss-600/50 bg-moss-600/10 text-moss-400 shadow-[0_0_14px_-4px_rgba(var(--glow),0.5)]"
          >
            <SearchIcon className="h-5 w-5" />
          </span>
          <p className="mt-4 font-semibold text-chalk-50">Nothing matches those filters.</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-chalk-300">
            A shop missing from this list is not automatically illegal — it may simply not be in the
            register yet. Check it at{' '}
            <a
              className={clsx('link rounded-sm', FOCUS_RING)}
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
        <ul className="mt-3.5 grid grid-cols-1 items-start gap-[0.6875rem] sm:mt-5 sm:gap-4 lg:grid-cols-2 lg:gap-5">
          {list.map((d) => {
            const isOpen = openLicence === d.licenseNumber;
            return (
              <li
                key={d.id}
                id={`shop-${d.licenseNumber}`}
                className={clsx(
                  // An expanded card takes the whole row: the detail needs the
                  // width, and the list around it stays where the reader left it.
                  isOpen && 'lg:col-span-2',
                  // Nearly five hundred cards at once: the browser lays out only
                  // those near the screen, and holds a card's place by its usual
                  // height (138px, the padding aside) until it does. That
                  // containment clips at the box, so the box reaches out past
                  // the card far enough to keep its glow. Never the open card,
                  // which is read, not scrolled past.
                  !isOpen && '-m-2.5 p-2.5 [contain-intrinsic-size:auto_8.625rem] [content-visibility:auto]',
                )}
              >
                <DispensaryCard
                  d={d}
                  expanded={isOpen}
                  onToggle={() => toggle(d.licenseNumber)}
                  menuCount={menuCounts[d.licenseNumber] ?? 0}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
