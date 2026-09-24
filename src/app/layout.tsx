import type { Metadata } from 'next';
import Link from 'next/link';
import { AgeGate } from '@/components/AgeGate';
import { SiteNav } from '@/components/SiteNav';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'NY Dispensary Register — verified licensed cannabis dispensaries',
    template: '%s · NY Dispensary Register',
  },
  description:
    'A directory of state-licensed cannabis dispensaries in New York City and Westchester County. Every entry carries its licence number and its sources.',
  openGraph: {
    title: 'NY Dispensary Register',
    description:
      'State-licensed cannabis dispensaries in New York City and Westchester County — every entry traceable to the state registry.',
    type: 'website',
  },
};

/* The first four are New York City and Westchester — the register proper, with
   menus, coordinates and hand-checked opt-outs behind them. Upstate and Long
   Island are registry imports and nothing more, so they sit after a divider
   rather than among them: a reader who cannot tell which is which will assume
   the weaker pages are as complete as the stronger ones. */
const NAV = [
  { href: '/', label: 'Directory' },
  { href: '/menus/', label: 'Strains' },
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
            <Link href="/" className="group flex h-12 shrink-0 items-center gap-2.5 sm:h-auto">
              <span
                aria-hidden
                className="grid h-8 w-8 place-items-center rounded-lg border border-moss-600/50 bg-moss-600/10 text-moss-400"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="whitespace-nowrap text-[0.95rem] font-semibold tracking-tight text-chalk-50">
                NY Dispensary Register
              </span>
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
