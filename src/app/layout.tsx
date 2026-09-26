import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { AgeGate } from '@/components/AgeGate';
import { SiteNav } from '@/components/SiteNav';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://theflowerindex.com'),
  title: {
    default: 'The Flower Index — licensed cannabis dispensaries and the flower on their shelves',
    template: '%s · The Flower Index',
  },
  description:
    'A directory of state-licensed cannabis dispensaries in New York City and Westchester County. Every entry carries its licence number and its sources.',
  openGraph: {
    title: 'The Flower Index',
    siteName: 'The Flower Index',
    description:
      'State-licensed cannabis dispensaries in New York City and Westchester County — every entry traceable to the state registry.',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'The Flower Index' }],
  },
  twitter: { card: 'summary_large_image', images: ['/og.png'] },
  /* The mark in every size a browser or a phone asks for. The SVG is the one
     modern browsers take; the .ico is for the ones that still look for it by
     name, and the PNGs are what a home-screen install uses. */
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: { title: 'Flower Index', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#0B2419',
};

/* The first four are New York City and Westchester — the register proper, with
   menus, coordinates and hand-checked opt-outs behind them. Upstate and Long
   Island are registry imports and nothing more, so they sit after a divider
   rather than among them: a reader who cannot tell which is which will assume
   the weaker pages are as complete as the stronger ones. */
const NAV = [
  { href: '/', label: 'Directory' },
  { href: '/menus/', label: 'Strains' },
  { href: '/moves/', label: 'New & leaving' },
  { href: '/menus/brands/', label: 'Brands' },
  { href: '/map/', label: 'Map' },
  { href: '/westchester/', label: 'Westchester' },
  { href: '/about/', label: 'Method' },
  { href: '/legal/', label: 'Notices' },
];

const TERRITORY_NAV = [
  { href: '/upstate/', label: 'Upstate' },
  { href: '/long-island/', label: 'Long Island' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AgeGate />
        <header className="sticky top-0 z-40 border-b border-ink-700/80 bg-ink-950/80 backdrop-blur-md">
          {/* On a phone the name keeps a line of its own and the menu gets the
              screen's whole width below it; it was wrapping to three lines
              beside a menu squeezed to nothing. */}
          <div className="shell flex flex-col sm:h-16 sm:flex-row sm:items-center sm:gap-6">
            <Link href="/" className="group flex h-12 shrink-0 items-center sm:h-auto">
              {/* The mark and the name as one drawing, so the name is set in
                  the logo's serif without the site loading a font for it. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/lockup.svg" alt="The Flower Index" width={180} height={32} className="h-8 w-auto" />
            </Link>

            <SiteNav nav={NAV} territories={TERRITORY_NAV} />
          </div>
        </header>

        <main>{children}</main>

        <footer className="mt-24 border-t border-ink-700/80 py-10">
          <div className="shell space-y-4 text-sm text-chalk-400">
            <p className="max-w-3xl">
              This directory lists businesses licensed by the New York State Office of Cannabis
              Management. It is informational only: it does not sell cannabis, and it is not
              affiliated with or endorsed by any state agency. Cannabis is for adults 21 and over —
              see{' '}
              <Link href="/legal/" className="link">
                legal and data notices
              </Link>
              .
            </p>
            <p>
              Always confirm a shop yourself before you buy —{' '}
              <a
                className="link"
                href="https://cannabis.ny.gov/dispensary-location-verification"
                target="_blank"
                rel="noreferrer noopener"
              >
                cannabis.ny.gov/dispensary-location-verification
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
