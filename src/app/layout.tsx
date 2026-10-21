import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { AgeGate } from '@/components/AgeGate';
import { HeaderMap } from '@/components/HeaderMap';
import { SiteNav, TabBar } from '@/components/SiteNav';
import { SITE_URL } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
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

/* "cover" lets the page reach under a phone's rounded corners and home
   indicator, so the bar pinned to the bottom can measure them
   (env(safe-area-inset-*)) and stand clear of them. */
export const viewport: Viewport = {
  themeColor: '#0B2419',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen pb-[calc(4rem+env(safe-area-inset-bottom))] antialiased nav:pb-0">
        {/* On a phone the page ends above the bar pinned to the bottom. */}
        <AgeGate />
        <header className="site-header sticky top-0 z-40 rounded-b-xl border-b border-ink-600/80 bg-ink-950/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
          <div className="shell flex h-[4.2rem] items-center nav:h-[4.5rem]">
            <Link
              href="/"
              className="mr-4 flex shrink-0 flex-col justify-center self-stretch rounded-md pt-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-400"
            >
              {/* The mark and the name as one drawing, so the name is set in
                  the logo's serif without the site loading a font for it. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/lockup.svg" alt="The Flower Index" width={180} height={32} className="h-8 w-auto" />
              {/* Under the words, not the mark: the words start 77.5 of the
                  lockup's 359.6 units in, which at its 2rem height is 2.42rem. */}
              <span className="-mt-px block pl-[2.45rem] font-mono text-[0.5625rem] uppercase leading-none tracking-[0.16em] text-chalk-400">
                NY Dispensary Register
              </span>
            </Link>

            <HeaderMap />
            <SiteNav />
          </div>
        </header>

        {/* Fixed to the bottom of the screen, but early in the page, so the
            keyboard reaches the five sections before the page's content. */}
        <TabBar />

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
