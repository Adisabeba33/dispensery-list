import type { Metadata } from 'next';
import { DispensaryCard } from '@/components/DispensaryCard';
import { DemoBanner } from '@/components/DemoBanner';
import { PageHead } from '@/components/PageParts';
import { dispensaries, isDemoData, optedOutMunicipalities } from '@/lib/data';
import { menuCounts } from '@/lib/menu';

export const metadata: Metadata = {
  title: 'Westchester County',
  description:
    'Licensed cannabis dispensaries in Westchester County, and the towns and villages that opted out of hosting retail.',
};

export default function WestchesterPage() {
  const local = dispensaries
    .filter((d) => d.address.county === 'Westchester')
    .sort((a, b) => a.address.city.localeCompare(b.address.city));

  const optedOut = optedOutMunicipalities();
  const counts = menuCounts();

  return (
    <>
      {isDemoData && <DemoBanner />}

      <div className="shell pb-16">
        <PageHead kicker="County guide" title="Westchester County">
          <p>
            Westchester is not one market but dozens. Under the state&apos;s legalisation law, each
            city, town and village could refuse to host retail dispensaries — and roughly twenty of
            them did. That is why whole stretches of the county have no shops at all.
          </p>
        </PageHead>

        <section className="mt-10 sm:mt-12">
          <h2 className="section-title">Dispensaries in the county</h2>
          {local.length === 0 ? (
            <div className="card mt-4 p-6 sm:p-8">
              <p className="text-chalk-200">No Westchester records in the dataset yet.</p>
              <p className="mt-2 text-sm text-chalk-400">
                Westchester coverage arrives with the first full registry import. Until then this
                page documents which municipalities can host a dispensary at all.
              </p>
            </div>
          ) : (
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {local.map((d) => (
                <li key={d.id}>
                  <DispensaryCard d={d} menuCount={counts[d.licenseNumber] ?? 0} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-12 sm:mt-14">
          <h2 className="section-title">Municipalities that opted out of retail</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-chalk-300">
            The deadline to opt out was 31 December 2021; a municipality that did not opt out then
            can no longer do so. A town and the village inside it decided separately, which is why
            some names appear twice.
          </p>

          {/* One frame, a ruled list inside it: names to read down, not a
              row of controls to press. Two columns even on a phone, the kind
              under the name there and beside it where there is room. */}
          <ul className="card mt-5 grid grid-cols-2 gap-x-5 px-4 sm:gap-x-8 sm:px-5 lg:grid-cols-3">
            {optedOut.map((m) => (
              <li
                key={m.id}
                className="-mb-px flex min-w-0 flex-col border-b border-ink-700/70 py-2.5 text-sm text-chalk-100 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3"
              >
                {m.name}
                <span className="label shrink-0">{m.kind.toLowerCase()}</span>
              </li>
            ))}
          </ul>

          <p className="note note-caution mt-5 max-w-2xl text-xs">
            This list is compiled from secondary reporting and the Rockefeller Institute opt-out
            tracker, and is pending confirmation against the state&apos;s filed opt-out data. Treat
            it as a guide, not as legal fact.
          </p>
        </section>
      </div>
    </>
  );
}
