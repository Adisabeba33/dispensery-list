import type { Metadata } from 'next';
import { DispensaryCard } from '@/components/DispensaryCard';
import { DemoBanner } from '@/components/DemoBanner';
import { dispensaries, isDemoData, optedOutMunicipalities } from '@/lib/data';

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

  return (
    <>
      {isDemoData && <DemoBanner />}

      <div className="shell py-12">
        <p className="label">County guide</p>
        <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-chalk-50 sm:text-4xl">
          Westchester County
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-chalk-200">
          Westchester is not one market but dozens. Under the state&apos;s legalisation law, each
          city, town and village could refuse to host retail dispensaries — and roughly twenty of
          them did. That is why whole stretches of the county have no shops at all.
        </p>

        <section className="mt-12">
          <h2 className="text-xl font-semibold tracking-tight text-chalk-50">
            Dispensaries in the county
          </h2>
          {local.length === 0 ? (
            <div className="card mt-4 p-8">
              <p className="text-chalk-200">No Westchester records in the dataset yet.</p>
              <p className="mt-2 text-sm text-chalk-400">
                Westchester coverage arrives with the first full registry import. Until then this
                page documents which municipalities can host a dispensary at all.
              </p>
            </div>
          ) : (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {local.map((d) => (
                <li key={d.id}>
                  <DispensaryCard d={d} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-semibold tracking-tight text-chalk-50">
            Municipalities that opted out of retail
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-chalk-400">
            The deadline to opt out was 31 December 2021; a municipality that did not opt out then
            can no longer do so. A town and the village inside it decided separately, which is why
            some names appear twice.
          </p>

          <ul className="mt-5 flex flex-wrap gap-2">
            {optedOut.map((m) => (
              <li
                key={m.id}
                className="rounded-lg border border-ink-700 bg-ink-850/70 px-3 py-2 text-sm text-chalk-200"
              >
                {m.name}
                <span className="ml-2 text-[0.7rem] uppercase tracking-wide text-chalk-500">
                  {m.kind.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-6 max-w-2xl text-xs leading-relaxed text-chalk-500">
            This list is compiled from secondary reporting and the Rockefeller Institute opt-out
            tracker, and is pending confirmation against the state&apos;s filed opt-out data. Treat
            it as a guide, not as legal fact.
          </p>
        </section>
      </div>
    </>
  );
}
