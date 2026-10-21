import type { Metadata } from 'next';
import { PageHead } from '@/components/PageParts';
import { debts, stats } from '@/lib/data';

export const metadata: Metadata = {
  title: 'How this register is built',
  description:
    'The sources, verification rules and known limits behind The Flower Index.',
};

/* A section of the record: its heading with the lit bar, the prose a step
   larger than a card's, for reading down a page. */
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-10 first:mt-0 sm:mt-12">
    <h2 className="section-title">{title}</h2>
    <div className="mt-3 space-y-3 text-[0.9375rem] leading-[1.7] text-chalk-200 sm:mt-4 sm:text-[1rem]">
      {children}
    </div>
  </section>
);

/* A list inside a section, read as entries of the record: one frame, a rule
   between the entries. */
const RULED_LIST = 'card divide-y divide-ink-700/70 px-4 sm:px-5 [&>li]:py-3';

export default function AboutPage() {
  const s = stats();
  const d = debts();

  return (
    // At the left edge, under the logo, as every page's head is; the text
    // kept to a reading measure.
    <div className="shell pb-16">
      <PageHead kicker="Method" title="How this register is built" className="max-w-3xl">
        <p>
          A directory of legal dispensaries is only worth something if you can check it. So every
          record here carries its licence number, its sources, and an honest label for how well it
          has been verified.
        </p>
      </PageHead>

      <div className="mt-10 max-w-3xl sm:mt-14">
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
          <ul className={RULED_LIST}>
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
            checked it — not that the answer is no. Recording an unchecked field as a definite &ldquo;no&rdquo; would make the register look
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

        <Section title="What this register still does not know">
          <p>
            Every one of these is a gap we can name and count. Naming them is the point: a
            directory that only shows what it is sure of, without saying what it is unsure of,
            invites you to mistake its silence for completeness.
          </p>
          <ul className={`${RULED_LIST} !mt-5`}>
            <li>
              <span className="font-semibold text-chalk-50">{d.unknownStatus} records with an
              unconfirmed status.</span>{' '}
              The state registry lists the licence as active, but the shop does not appear on
              OCM&apos;s public list of open dispensaries, and we will not call a shop open on a
              guess.
            </li>
            <li>
              <span className="font-semibold text-chalk-50">{d.expiredButActive} licences past
              their published expiry.</span>{' '}
              The registry still marks them active. Whether they were renewed is not something the
              published data answers, so each such record says so on its own page rather than
              showing the date without comment.
            </li>
            <li>
              <span className="font-semibold text-chalk-50">{d.addressDisputed} addresses the
              state gives two ways.</span>{' '}
              The licence registry and OCM&apos;s public-open list disagree, usually on the ZIP
              code. The registry address is treated as canonical and the disagreement is recorded
              on the record instead of being quietly resolved.
            </li>
            <li>
              <span className="font-semibold text-chalk-50">Medical dispensaries are listed but
              rarely confirmed open.</span>{' '}
              The {d.medical} Registered Organizations here are licensed to serve patients. OCM&apos;s
              public-open list covers adult-use retail, so for most of them there is no source that
              confirms they are trading today.
            </li>
          </ul>
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
