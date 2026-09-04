import Link from 'next/link';
import { DirectoryExplorer } from '@/components/DirectoryExplorer';
import { DemoBanner } from '@/components/DemoBanner';
import { dispensaries, isDemoData, stats } from '@/lib/data';
import { prettyDate } from '@/lib/format';

export default function HomePage() {
  const s = stats();

  return (
    <>
      {isDemoData && <DemoBanner />}

      <section className="shell pb-4 pt-16 sm:pt-24">
        <p className="label">New York City · Westchester County</p>

        <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight text-chalk-50 sm:text-5xl">
          Every dispensary here is a{' '}
          <span className="text-moss-400">licensed</span> one.
        </h1>

        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-chalk-200">
          New York has a licensed cannabis market and a much larger unlicensed one. This register
          lists only businesses licensed by the state Office of Cannabis Management, and shows you
          the licence number and the sources behind every entry, so you can check our work.
        </p>

        <dl className="mt-10 grid max-w-2xl grid-cols-2 gap-px overflow-hidden rounded-xl border border-ink-700 bg-ink-700 sm:grid-cols-4">
          {[
            { label: 'Listed', value: s.total },
            { label: 'Confirmed open', value: s.open },
            { label: 'Registry-verified', value: s.verifiedOfficial },
            { label: 'Areas', value: s.regions.length },
          ].map((stat) => (
            <div key={stat.label} className="bg-ink-900 px-4 py-4">
              <dd className="text-2xl font-semibold tabular-nums text-chalk-50">{stat.value}</dd>
              <dt className="mt-1 text-xs text-chalk-500">{stat.label}</dt>
            </div>
          ))}
        </dl>

        {s.lastUpdated && (
          <p className="mt-4 text-sm text-chalk-500">
            Data last updated {prettyDate(s.lastUpdated)} ·{' '}
            <Link href="/about/" className="link">
              how this list is built
            </Link>
          </p>
        )}
      </section>

      <DirectoryExplorer dispensaries={dispensaries} />

      <section className="shell">
        <div className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-lg font-semibold tracking-tight text-chalk-50">
              Buying from an unlicensed shop is easy to do by accident
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-chalk-200">
              Licensed dispensaries display a QR-coded verification decal at the entrance. Scan it,
              or look the address up on the state tool, before you hand over money.
            </p>
          </div>
          <a
            href="https://cannabis.ny.gov/dispensary-location-verification"
            target="_blank"
            rel="noreferrer noopener"
            className="shrink-0 rounded-lg border border-moss-600/60 bg-moss-600/12 px-4 py-2.5 text-sm font-medium text-moss-400 transition-colors hover:bg-moss-600/20"
          >
            Check a shop on cannabis.ny.gov
          </a>
        </div>
      </section>
    </>
  );
}
