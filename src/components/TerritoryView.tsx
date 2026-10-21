import Link from 'next/link';
import { PageHead, StatBoxes } from './PageParts';
import { TerritoryExplorer } from './TerritoryExplorer';
import { territoryPage } from '@/lib/territory-data';
import { territory } from '@/lib/territories';
import { shelfCountsFor } from '@/lib/territory-shelves';
import { hasShelves, territoryShelfCounts } from '@/lib/territory-menu';
import { prettyDate } from '@/lib/format';

/**
 * The page body shared by /upstate/, /long-island/ and /massachusetts/.
 *
 * Shared markup, never shared data: each route reads its own files, counts its
 * own records and states its own gaps. Nothing here can produce a blended
 * figure, because nothing here ever sees two territories at once.
 */
export const TerritoryView = ({ id, intro }: { id: string; intro: React.ReactNode }) => {
  const { t, shops, stats, counties, gaps } = territoryPage(id, shelfCountsFor(territory(id).dataDir));

  return (
    <div className="shell pb-16">
      <PageHead kicker="Territory" title={t.label}>
        {intro}
      </PageHead>

      {/* Four boxes in one row on a phone, as on the home page: "Opened to
          the public" is too long a label for one line there, so the labels
          may break and the figures stay level along the top. A row that
          wrapped would put the rule under the first row through the second. */}
      <StatBoxes
        breakLabels
        className="mt-8 sm:mt-10"
        figures={[
          { label: 'Licences', value: stats.total },
          { label: 'Registry-verified', value: stats.registryVerified },
          { label: 'Opened to the public', value: stats.openedOnFile },
          { label: 'Counties', value: stats.counties },
        ]}
      />

      <p className="mt-4 max-w-2xl text-[0.8125rem] leading-relaxed text-chalk-400 sm:text-sm">
        “Opened to the public” is the registry’s own field, and it records that the doors opened
        once — not that the shop is trading today. Nobody has checked that here.
        {stats.lastUpdated && <> Imported {prettyDate(stats.lastUpdated)}.</>}{' '}
        <Link href="/about/" className="link">
          how this list is built
        </Link>
      </p>

      {/* What we do not know, before the list rather than after it. A reader who
          finds out at the bottom has already formed a view from the top. */}
      <section className="card mt-10 p-4 sm:mt-12 sm:p-6">
        <h2 className="section-title">What this page does not know</h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-chalk-300">
          {hasShelves(t.id)
            ? 'This territory has a registry import, the websites found so far and shelves read by hand, and nothing more.'
            : 'This territory has a registry import and nothing more.'}{' '}
          New York City and Westchester carry menus, coordinates, hours and hand-checked
          opt-outs; these records do not, and pretending otherwise is the one thing this register
          cannot do. Every figure below is counted from the records themselves.
        </p>
        {/* Each gap is a caution, and drawn as one. */}
        <ul className="mt-4 grid gap-2.5 sm:mt-5 lg:grid-cols-2">
          {gaps.map((gap) => (
            <li key={gap.label} className="note note-caution">
              <p className="font-medium text-chalk-50">{gap.label}</p>
              <p className="mt-1 text-chalk-300">{gap.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 sm:mt-14">
        <h2 className="section-title">Licensed retail in {t.label}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-chalk-300">
          Every record here was imported from the state registry and carries its licence number, so
          you can check it yourself. A licence is not a shop: some of these have never opened.
        </p>

        <div className="mt-5 sm:mt-6">
          <TerritoryExplorer
            shops={shops}
            counties={counties}
            storageKey={t.id}
            licenceExample={t.state === 'MA' ? 'MR28…' : undefined}
            shelfCounts={hasShelves(t.id) ? territoryShelfCounts(t.id) : undefined}
            shelfRoute={t.route}
            verify={
              t.state === 'MA'
                ? { href: 'https://masscannabiscontrol.com/open-data/data-catalog/', label: 'the Commission’s licence data' }
                : undefined
            }
          />
        </div>
      </section>
    </div>
  );
};
