import Link from 'next/link';
import { TerritoryExplorer } from './TerritoryExplorer';
import { territoryPage } from '@/lib/territory-data';
import { prettyDate } from '@/lib/format';

/**
 * The page body shared by /upstate/ and /long-island/.
 *
 * Shared markup, never shared data: each route reads its own files, counts its
 * own records and states its own gaps. Nothing here can produce a blended
 * figure, because nothing here ever sees two territories at once.
 */
export const TerritoryView = ({ id, intro }: { id: string; intro: React.ReactNode }) => {
  const { t, shops, stats, counties, gaps } = territoryPage(id);

  return (
    <div className="shell py-12">
      <p className="label">Territory</p>
      <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-chalk-50 sm:text-4xl">
        {t.label}
      </h1>

      <div className="mt-5 max-w-2xl space-y-4 text-lg leading-relaxed text-chalk-200">{intro}</div>

      <dl className="mt-10 grid max-w-2xl grid-cols-2 gap-px overflow-hidden rounded-xl border border-ink-700 bg-ink-700 sm:grid-cols-4">
        {[
          { label: 'Licences', value: stats.total },
          { label: 'Registry-verified', value: stats.registryVerified },
          { label: 'Opened to the public', value: stats.openedOnFile },
          { label: 'Counties', value: stats.counties },
        ].map((stat) => (
          <div key={stat.label} className="bg-ink-900 px-4 py-4">
            <dd className="text-2xl font-semibold tabular-nums text-chalk-50">{stat.value}</dd>
            <dt className="mt-1 text-xs text-chalk-500">{stat.label}</dt>
          </div>
        ))}
      </dl>

      <p className="mt-4 max-w-2xl text-sm text-chalk-500">
        “Opened to the public” is the registry’s own field, and it records that the doors opened
        once — not that the shop is trading today. Nobody has checked that here.
        {stats.lastUpdated && <> Imported {prettyDate(stats.lastUpdated)}.</>}{' '}
        <Link href="/about/" className="link">
          how this list is built
        </Link>
      </p>

      {/* What we do not know, before the list rather than after it. A reader who
          finds out at the bottom has already formed a view from the top. */}
      <section className="mt-12">
        <div className="card border-amber-400/30 bg-amber-400/[0.04] p-6">
          <h2 className="text-lg font-semibold tracking-tight text-chalk-50">
            What this page does not know
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-chalk-300">
            This territory has a registry import and nothing more. New York City and Westchester
            carry menus, coordinates, hours and hand-checked opt-outs; these records do not, and
            pretending otherwise is the one thing this register cannot do. Every figure below is
            counted from the records themselves.
          </p>
          <ul className="mt-5 space-y-3">
            {gaps.map((gap) => (
              <li key={gap.label} className="border-l-2 border-amber-400/40 pl-4">
                <p className="text-sm font-medium text-chalk-100">{gap.label}</p>
                <p className="mt-1 text-sm leading-relaxed text-chalk-400">{gap.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-xl font-semibold tracking-tight text-chalk-50">
          Licensed retail in {t.label}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-chalk-400">
          Every record here was imported from the state registry and carries its licence number, so
          you can check it yourself. A licence is not a shop: some of these have never opened.
        </p>

        <div className="mt-6">
          <TerritoryExplorer shops={shops} counties={counties} storageKey={t.id} />
        </div>
      </section>
    </div>
  );
};
