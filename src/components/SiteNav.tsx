'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

type Item = { href: string; label: string; here?: (path: string) => boolean };

/* The five sections a reader moves between. On a phone they are one bar
   pinned to the bottom of the screen; from a tablet up (the `nav` screen in
   tailwind.config.ts), a row in the header.
   Strains and Brands share /menus/, so each says which of it is its own. */
const SECTIONS: (Item & { icon: React.ReactNode })[] = [
  {
    href: '/',
    label: 'Dispensaries',
    here: (p) => p === '/' || p.startsWith('/dispensary/'),
    icon: (
      <>
        <path d="M4.5 10.5V20h15v-9.5" />
        <path d="M3 10.5 4.8 4.5h14.4l1.8 6a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0Z" />
        <path d="M10 20v-4.5h4V20" />
      </>
    ),
  },
  {
    href: '/menus/',
    label: 'Strains',
    here: (p) => p.startsWith('/menus/') && !p.startsWith('/menus/brands/'),
    icon: (
      <>
        <path d="M5 19c0-8.5 5-14 14-14 0 9-5.5 14-14 14Z" />
        <path d="m5 19 8.5-8.5" />
      </>
    ),
  },
  {
    href: '/moves/',
    label: 'New & leaving',
    icon: <path d="M8 19.5V4.5M4 8.5l4-4 4 4M16 4.5v15M12 15.5l4 4 4-4" />,
  },
  {
    href: '/menus/brands/',
    label: 'Brands',
    icon: (
      <>
        <path d="M3.5 3.5h8.3l8.7 8.7a1.5 1.5 0 0 1 0 2.1l-6.2 6.2a1.5 1.5 0 0 1-2.1 0l-8.7-8.7V3.5Z" />
        <circle cx="8" cy="8" r="1.5" />
      </>
    ),
  },
  {
    href: '/map/',
    label: 'Map',
    icon: (
      <>
        <path d="m9 4.5-5.5 2v13l5.5-2 6 2 5.5-2v-13l-5.5 2-6-2Z" />
        <path d="M9 4.5v13M15 6.5v13" />
      </>
    ),
  },
];

/* Everything else, behind the menu button. Westchester is the register proper,
   with menus and coordinates behind it. Upstate, Long Island and Massachusetts
   are registry imports and little more, so they sit apart under their own
   heading: a reader who cannot tell which is which will assume the weaker
   pages are as complete as the stronger ones. */
const WESTCHESTER: Item = { href: '/westchester/', label: 'Westchester' };
const PLACES: Item[] = [
  { href: '/upstate/', label: 'Upstate' },
  { href: '/long-island/', label: 'Long Island' },
  { href: '/massachusetts/', label: 'Massachusetts' },
];
const ABOUT: Item[] = [
  { href: '/about/', label: 'Method' },
  { href: '/legal/', label: 'Notices' },
];
const IN_MENU = [WESTCHESTER, ...PLACES, ...ABOUT];

/* The address with its trailing slash, as the site's links are written, so a
   path read without one still matches. */
const usePath = () => {
  const path = usePathname() ?? '/';
  return path.endsWith('/') ? path : `${path}/`;
};

const isHere = (item: Item, path: string) => (item.here ? item.here(path) : path.startsWith(item.href));

const Icon = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={clsx('h-6 w-6 shrink-0', className)}
  >
    {children}
  </svg>
);

/* The header's side: the five sections in a row from a tablet up, and the
   menu button on every screen. */
export const SiteNav = () => {
  const path = usePath();
  const row = useRef<HTMLElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  /* Should the row have to scroll, the section being read is brought into it.
     Set on the row itself rather than with scrollIntoView, which would also
     scroll the page under a reader who has already moved down it. */
  useEffect(() => {
    const el = row.current;
    const here = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el || !here || el.scrollWidth <= el.clientWidth) return;
    el.scrollLeft = here.offsetLeft - (el.clientWidth - here.offsetWidth) / 2;
  }, [path]);

  /* The menu closes on a choice (the page being read included), a click or a
     tab outside it, or Escape — which hands the focus back to the button that
     opened it. */
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const inMenu = IN_MENU.some((item) => isHere(item, path));

  const menuLink = (item: Item) => (
    <Link
      key={item.href}
      href={item.href}
      aria-current={isHere(item, path) ? 'page' : undefined}
      onClick={() => setOpen(false)}
      className={clsx(
        'block rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-ink-800',
        isHere(item, path) ? 'bg-ink-800 text-chalk-50' : 'text-chalk-200 hover:text-chalk-50',
      )}
    >
      {item.label}
    </Link>
  );

  return (
    <div className="ml-auto flex min-w-0 items-center gap-2">
      {/* Scrolls inside itself rather than widen the page, should a system
          font run wider than the room the `nav` screen leaves for it. */}
      <nav ref={row} aria-label="Sections" className="no-scrollbar relative hidden min-w-0 scroll-px-1 overflow-x-auto nav:block">
        {/* w-max: the list's own padding scrolls with it, so a focus ring at
            either end is never cut off. */}
        <ul className="flex w-max items-center gap-1 p-1 text-sm">
          {SECTIONS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isHere(item, path) ? 'page' : undefined}
                onFocus={(e) => e.currentTarget.scrollIntoView({ inline: 'nearest', block: 'nearest' })}
                className={clsx(
                  'block whitespace-nowrap rounded-lg px-3 py-2 transition-colors hover:bg-ink-800',
                  isHere(item, path) ? 'bg-ink-800 text-chalk-50' : 'text-chalk-200 hover:text-chalk-50',
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div
        ref={box}
        className="relative shrink-0"
        onBlur={(e) => {
          /* Only when the focus went somewhere else: a tap on the panel's
             heading or padding moves it nowhere, and the click outside is
             the pointerdown listener's. */
          if (e.relatedTarget && !box.current?.contains(e.relatedTarget as Node)) setOpen(false);
        }}
      >
        <button
          ref={button}
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          aria-controls="site-menu"
          // "true", not "page": the button holds the page being read, it is not it.
          aria-current={inMenu ? 'true' : undefined}
          onClick={() => setOpen((v) => !v)}
          className={clsx(
            '-mr-2 grid h-11 w-11 place-items-center rounded-lg transition-colors hover:bg-ink-800 hover:text-chalk-50 nav:mr-0',
            open || inMenu ? 'bg-ink-800 text-chalk-50' : 'text-chalk-200',
          )}
        >
          <Icon className="h-5 w-5">
            {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </Icon>
        </button>

        <nav
          id="site-menu"
          aria-label="More pages"
          hidden={!open}
          className="absolute right-0 top-full z-50 mt-2 max-h-[calc(100dvh-9rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-72 overflow-y-auto rounded-xl border border-ink-700 bg-ink-900 p-1.5 shadow-xl shadow-black/40 nav:max-h-[calc(100dvh-5rem)]"
        >
          {menuLink(WESTCHESTER)}
          <div role="group" aria-labelledby="site-menu-places" className="mt-1.5 border-t border-ink-700">
            <p
              id="site-menu-places"
              className="px-3 pb-1 pt-3 text-[0.7rem] uppercase tracking-[0.14em] text-chalk-400"
            >
              Places · registry import only
            </p>
            {PLACES.map(menuLink)}
          </div>
          <div className="mt-1.5 border-t border-ink-700 pt-1.5">{ABOUT.map(menuLink)}</div>
        </nav>
      </div>
    </div>
  );
};

/* The phone's bar: the same five sections, pinned to the bottom of the screen
   where a thumb reaches them, above the home indicator on phones that have
   one. Hidden from a tablet up, where the header carries them. A step below
   the header (z-30), so the open menu draws over it on a short screen. */
export const TabBar = () => {
  const path = usePath();
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-700/80 bg-ink-950/90 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] backdrop-blur-md nav:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {SECTIONS.map((item) => {
          const here = isHere(item, path);
          return (
            <li key={item.href} className="min-w-0">
              <Link
                href={item.href}
                aria-current={here ? 'page' : undefined}
                className={clsx(
                  'flex h-16 flex-col items-center justify-start gap-1 px-0.5 pt-2 transition-colors',
                  here ? 'text-chalk-50' : 'text-chalk-400 hover:text-chalk-50',
                )}
              >
                <span className={clsx('grid h-7 w-12 place-items-center rounded-full', here && 'bg-ink-800')}>
                  <Icon className="h-5 w-5">{item.icon}</Icon>
                </span>
                {/* Two lines at most, on the narrowest phones, rather than a
                    name cut short. */}
                <span className="max-w-full text-center text-[clamp(0.6rem,2.8vw,0.6875rem)] leading-[1.15]">
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
