import type { Metadata } from 'next';
import { stats } from '@/lib/data';

export const metadata: Metadata = {
  title: 'How this register is built',
  description:
    'The sources, verification rules and known limits behind the NY Dispensary Register.',
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="border-t border-ink-700/70 py-8 first:border-0">
    <h2 className="text-xl font-semibold tracking-tight text-chalk-50">{title}</h2>
    <div className="mt-3 space-y-3 text-sm leading-relaxed text-chalk-200">{children}</div>
  </section>
);

export default function AboutPage() {
  const s = stats();

  return (
    <div className="shell max-w-3xl py-12">
      <p className="label">Method</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-chalk-50 sm:text-4xl">
        How this register is built
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-chalk-200">
        A directory of legal dispensaries is only worth something if you can check it. So every
        record here carries its licence number, its sources, and an honest label for how well it has
        been verified.
      </p>

      <div className="mt-10">
        <Section title="Where the data comes from">
          <p>
            The spine of this register is the New York State Office of Cannabis Management licence
            registry, published as the{' '}
            <a
              className="link"
              href="https://data.ny.gov/Economic-Development/Current-OCM-Licenses/jskf-tt3q"
              target="_blank"
              rel="noreferrer noopener"
            >
              Current OCM Licenses
            </a>{' '}
            dataset on Open Data NY. It is the state&apos;s own list of who holds a licence.
          </p>
          <p>
            The registry does not carry phone numbers, opening hours or whether a shop has actually
            opened its doors. Those come from the operators&apos; own websites and menu platforms,
            and each one is recorded with the source it came from.
          </p>
          <p>
            Weedmaps, Leafly and similar aggregators are not used to establish that a shop is
            licensed. They list unlicensed businesses too, which is precisely the confusion this
            register exists to remove.
          </p>
        </Section>

        <Section title="What the verification labels mean">
          <ul className="space-y-3">
            <li>
              <span className="font-medium text-moss-400">Registry-verified</span> — the licence
              number and the address both matched a record in the state registry.
            </li>
            <li>
              <span className="font-medium text-amber-400">Secondary sources</span> — not yet
              matched in the registry, but two independent sources agree on the licence and the
              address. Treat these as provisional.
            </li>
            <li>
              <span className="font-medium text-rust-400">Unverified</span> — anything less. These
              are kept out of the default view.
            </li>
          </ul>
        </Section>

        <Section title="Unknown is not the same as no">
          <p>
            When a field says <span className="text-chalk-50">Unknown</span>, it means nobody has
            checked it — not that the answer is no. A shop shown without delivery may well deliver.
            Recording an unchecked field as a definite &ldquo;no&rdquo; would make the register look
            more complete than it is, at your expense.
          </p>
          <p>
            The same rule applies to opening status. A licence being active does not mean the doors
            are open: New York issued many licences long before the shops were built.
          </p>
        </Section>

        <Section title="What this register does not do">
          <p>
            It does not sell cannabis, take payment, or rank shops. It is not affiliated with or
            endorsed by the Office of Cannabis Management or any other state agency.
          </p>
          <p>
            A shop missing from this list is not proof that the shop is illegal — the register may
            simply be behind. Equally, a listing here is not a substitute for the check you can do
            yourself at the door.
          </p>
        </Section>

        <Section title="Current coverage">
          <p>
            {s.total} {s.total === 1 ? 'record' : 'records'} across{' '}
            {s.regions.map((r) => `${r.name} (${r.count})`).join(', ')}. Phase one covers the five
            boroughs of New York City and Westchester County.
          </p>
        </Section>

        <Section title="Corrections">
          <p>
            If a record here is wrong — a shop has closed, an address has changed, a licence has
            lapsed — the fix belongs in the underlying dataset, not in a caption. Report it with the
            licence number and a source, and it will be corrected at the next import.
          </p>
        </Section>
      </div>
    </div>
  );
}
