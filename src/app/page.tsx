import Link from 'next/link';
import clsx from 'clsx';
import { DirectoryExplorer } from '@/components/DirectoryExplorer';
import { BuildStamp } from '@/components/BuildStamp';
import { DemoBanner } from '@/components/DemoBanner';
import { HeroLeaf, HudBox } from '@/components/HeroArt';
import { dispensaries, isDemoData, stats } from '@/lib/data';
import { menuCounts } from '@/lib/menu';

/* "Oct 19, 2026": short enough to share the build stamp's line, and the day
   it was in New York, not on the machine that built the page. */
const shortDate = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  });
};

export default function HomePage() {
  const s = stats();
  const updated = shortDate(s.lastUpdated);
  const figures = [
    { label: 'Listed', value: s.total },
    { label: 'Open now', value: s.open },
    { label: 'Registry-verified', value: s.verifiedOfficial },
    { label: 'Areas', value: s.regions.length },
  ];

  return (
    <>
      {isDemoData && <DemoBanner />}

      {/* Full width, so the leaf behind the headline is cut by the edge of
          the screen rather than by the edge of the column. */}
      <section className="relative isolate overflow-hidden">
        <div className="shell relative pb-4 pt-2.5 sm:pt-8 lg:pt-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-[4.5rem] top-[3.75rem] -z-10 w-[15rem] opacity-50 blur-[0.4px] [mask-image:linear-gradient(to_bottom,#000_60%,transparent)] sm:right-0 sm:top-6 sm:w-[18rem] lg:right-0 lg:top-10 lg:w-[30rem] lg:opacity-[0.35]"
          >
            <HeroLeaf className="h-auto w-full" />
          </div>

          <BuildStamp>
            {updated && `updated ${updated}`}
            <Link
              href="/about/"
              aria-label="OCM registry: how this list is built"
              className="rounded-sm py-1.5 text-chalk-400 underline-offset-2 transition-colors hover:text-moss-400 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-moss-400"
            >
              OCM registry
            </Link>
          </BuildStamp>

          {/* On a phone the first line, "Every dispensary here", is sized to
              fit beside the readout; from about 465px it grows more gently,
              up to 4rem. From lg the readout follows the headline in a row,
              so a wider font can never run the words under it. */}
          <div className="relative mt-2.5 sm:mt-6 lg:flex lg:items-start lg:gap-24">
            <h1 className="max-w-[calc(100%-3rem)] text-[clamp(1.625rem,min(9.52vw-0.525rem,1.25rem+3.4vw),4rem)] font-extrabold leading-[1.06] tracking-[-0.03em] text-chalk-50 sm:max-w-3xl lg:w-max lg:max-w-4xl">
              Every dispensary here <br className="hidden sm:inline" />
              is a{' '}
              <span className="inline-block bg-gradient-to-b from-moss-300 to-moss-400 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(var(--glow),0.45)]">
                licensed
              </span>{' '}
              one.
            </h1>
            <HudBox className="absolute -right-1 -top-2.5 px-1 pb-2.5 pt-5 text-[0.40625rem] leading-[1.5] tracking-[0.06em] sm:right-0 sm:top-0 sm:px-3 sm:pb-4 sm:pt-7 sm:text-[0.625rem] lg:relative lg:shrink-0" />
          </div>

          <p className="mt-3.5 max-w-[23rem] text-[0.84rem] leading-[1.6] text-chalk-200 sm:mt-6 sm:max-w-xl sm:text-base">
            A register of the legal cannabis market in New York City and Westchester. Only
            businesses licensed by the Office of Cannabis Management, with licence numbers and
            sources for every entry.
          </p>

          <div className="mt-5 sm:mt-8 sm:w-max">
            <dl className="flex flex-wrap gap-1.5 sm:gap-2">
              {figures.map((figure, i) => (
                <div
                  key={figure.label}
                  className={clsx(
                    'relative flex flex-auto flex-col-reverse rounded-[5px] px-2.5 py-2 [@media(max-width:374px)]:px-2 [@media(min-width:400px)]:px-3.5 sm:min-w-[8rem] sm:flex-none sm:px-4 sm:py-3.5 lg:min-w-[9.5rem] lg:px-5',
                    // Its stretch of the rule beneath the row, lit under the first.
                    'after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-[0.6875rem] after:h-px',
                    // The lit box is the second widest, as drawn, where the row
                    // has the room; on a narrower phone it would push the row
                    // onto two lines. (Plain media variants: Tailwind's min-[…]
                    // goes away beside the em-based `nav` screen.)
                    i === 0
                      ? 'card-lit [@media(min-width:420px)_and_(max-width:639px)]:min-w-[5.875rem] after:bg-moss-400 after:shadow-[0_0_6px_rgba(var(--glow),0.8)]'
                      : 'border border-ink-600 bg-ink-900/70 after:bg-moss-700/45',
                  )}
                >
                  <dt className="mt-0.5 whitespace-nowrap text-[0.72rem] leading-tight text-chalk-200 sm:text-sm">
                    {figure.label}
                  </dt>
                  <dd className="bg-gradient-to-b from-moss-300 to-moss-400 bg-clip-text text-[1.3rem] font-semibold leading-tight tabular-nums text-transparent sm:text-[1.75rem]">
                    {figure.value}
                  </dd>
                </div>
              ))}
            </dl>
            {/* A rule under the row, with a gauge's ticks standing on its start. */}
            <div aria-hidden className="mt-[0.9375rem]">
              <div className="h-[3px] w-7 bg-[repeating-linear-gradient(90deg,rgba(var(--glow),0.45)_0_1px,transparent_1px_3px)] opacity-70" />
              <div className="h-px bg-gradient-to-r from-moss-700/50 via-moss-700/35 to-moss-700/10" />
            </div>
          </div>
        </div>
      </section>

      <DirectoryExplorer dispensaries={dispensaries} menuCounts={menuCounts()} />

      <section className="shell">
        <div className="card hud-corners relative flex flex-col gap-5 rounded-lg border-moss-700/50 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-6">
          <div className="flex max-w-2xl gap-4">
            {/* The decal's QR code, drawn. */}
            <span
              aria-hidden
              className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-moss-600/50 bg-moss-600/10 text-moss-400 shadow-[0_0_14px_-4px_rgba(var(--glow),0.5)]"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              >
                <rect x="3.5" y="3.5" width="6" height="6" rx="1" />
                <rect x="14.5" y="3.5" width="6" height="6" rx="1" />
                <rect x="3.5" y="14.5" width="6" height="6" rx="1" />
                <path d="M14.5 14.5h2.5v2.5h-2.5zM18.5 18.5h2v2h-2zM14.5 20.5h1M20.5 14.5v1.5" />
              </svg>
            </span>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-chalk-50 sm:text-lg">
                Buying from an unlicensed shop is easy to do by accident
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-chalk-200">
                Licensed dispensaries display a QR-coded verification decal at the entrance. Scan
                it, or look the address up on the state tool, before you hand over money.
              </p>
            </div>
          </div>
          <a
            href="https://cannabis.ny.gov/dispensary-location-verification"
            target="_blank"
            rel="noreferrer noopener"
            className="chip-on inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium text-moss-300 transition-colors hover:bg-moss-600/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-400"
          >
            Check a shop on cannabis.ny.gov
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 17 17 7M9 7h8v8" />
            </svg>
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
      </section>
    </>
  );
}
