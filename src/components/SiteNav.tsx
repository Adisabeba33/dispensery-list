'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

type Item = { href: string; label: string };

/* The top menu, as a strip that scrolls sideways inside itself.
 *
 * Eight pages do not fit across a phone, and a row of links that cannot
 * shrink made the header wider than the screen: the whole page grew with it,
 * Safari zoomed out to fit, and every page read as a narrow column with a
 * blank right half. The strip scrolls on its own now and the page keeps the
 * screen's width.
 *
 * A strip that scrolls has to say so. Whichever end has more beyond it fades
 * out and carries an arrow, and the page being read is scrolled into view, so
 * someone on Long Island sees "Long Island" lit rather than a menu that seems
 * to stop at Notices. */
export const SiteNav = ({ nav, territories }: { nav: Item[]; territories: Item[] }) => {
  const pathname = usePathname() ?? '/';
  const strip = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = strip.current;
    if (!el) return;
    // A pixel of slack: fractional widths leave scrollLeft a hair short of the end.
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setMore((was) => (was.left === left && was.right === right ? was : { left, right }));
  }, []);

  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const resized = new ResizeObserver(measure);
    resized.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      resized.disconnect();
    };
  }, [measure]);

  /* The page being read, brought into the strip's view. Set on the strip
     itself rather than with scrollIntoView, which would also scroll the page
     under a reader who has already moved down it. */
  useEffect(() => {
    const el = strip.current;
    const here = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el || !here) return;
    el.scrollLeft = here.offsetLeft - (el.clientWidth - here.offsetWidth) / 2;
    measure();
  }, [pathname, measure]);

  const nudge = (direction: 1 | -1) => {
    const el = strip.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.7, behavior: 'smooth' });
  };

  const isHere = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  const link = (item: Item, quiet: boolean) => (
    <Link
      key={item.href}
      href={item.href}
      aria-current={isHere(item.href) ? 'page' : undefined}
      title={quiet ? 'Registry import only — no menus, hours or opt-out data' : undefined}
      className={clsx(
        'shrink-0 whitespace-nowrap rounded-lg px-3 py-2 transition-colors hover:bg-ink-800',
        isHere(item.href)
          ? 'bg-ink-800 text-chalk-50'
          : quiet
            ? 'text-chalk-400 hover:text-chalk-100'
            : 'text-chalk-200 hover:text-chalk-50',
      )}
    >
      {item.label}
    </Link>
  );

  return (
    <nav aria-label="Pages" className="relative -mx-5 min-w-0 sm:mx-0 sm:flex-1">
      <div ref={strip} className="no-scrollbar flex overflow-x-auto px-5 pb-2 text-sm sm:px-0 sm:pb-0">
        {/* ml-auto keeps the menu to the right when it fits, and resolves to
            nothing when it does not — justify-end would push the overflow off
            the left edge, where no scrolling can reach it. */}
        <div className="flex shrink-0 items-center gap-1 sm:ml-auto">
          {nav.map((item) => link(item, false))}
          <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-ink-700" />
          {territories.map((item) => link(item, true))}
        </div>
      </div>

      {more.left && (
        <button
          type="button"
          aria-label="Earlier pages"
          onClick={() => nudge(-1)}
          className="absolute inset-y-0 left-0 flex w-12 items-center justify-start bg-gradient-to-r from-ink-950 via-ink-950/90 to-transparent pb-2 pl-1.5 text-chalk-200 sm:-left-1 sm:pb-0"
        >
          <Chevron flip />
        </button>
      )}
      {more.right && (
        <button
          type="button"
          aria-label="More pages"
          onClick={() => nudge(1)}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-end bg-gradient-to-l from-ink-950 via-ink-950/90 to-transparent pb-2 pr-1.5 text-chalk-200 sm:-right-1 sm:pb-0"
        >
          <Chevron />
        </button>
      )}
    </nav>
  );
};

const Chevron = ({ flip = false }: { flip?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden
    className={clsx('h-4 w-4', flip && 'rotate-180')}
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
  >
    <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
