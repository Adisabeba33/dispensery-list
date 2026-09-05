import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Legal and data notices',
  description:
    'Where this register gets its data, what it is not, and how a licensed business can have its entry corrected or removed.',
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="border-t border-ink-700/70 py-8 first:border-0">
    <h2 className="text-xl font-semibold tracking-tight text-chalk-50">{title}</h2>
    <div className="mt-3 space-y-3 text-sm leading-relaxed text-chalk-200">{children}</div>
  </section>
);

export default function LegalPage() {
  return (
    <div className="shell max-w-3xl py-12">
      <p className="label">Notices</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-chalk-50 sm:text-4xl">
        Legal and data notices
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-chalk-200">
        This page exists so that anyone — a reader, a licensed business, or a regulator — can see
        exactly what this register is, where its contents come from, and how to get something
        changed.
      </p>

      <div className="mt-10">
        <Section title="For adults 21 and over">
          <p>
            New York law restricts cannabis to adults aged 21 and over, and this register carries
            cannabis-related content. Visitors are asked to confirm they are 21 or older before
            reading it. That is a declaration, not a verification: we do not check anyone&apos;s
            age and we hold no identity documents.
          </p>
        </Section>

        <Section title="Where the data comes from">
          <p>
            Licence records are taken from the{' '}
            <a
              className="link"
              href="https://data.ny.gov/Economic-Development/Current-OCM-Licenses/jskf-tt3q"
              target="_blank"
              rel="noreferrer noopener"
            >
              Current OCM Licenses
            </a>{' '}
            dataset published as open data by New York State. Every entry names the sources behind
            it on its own page, including the date each was retrieved.
          </p>
          <p>
            Where a shop&apos;s own website is the source — opening hours, a phone number, the
            products on its shelf — that is stated on the entry too. Nothing here is taken from a
            paid database or a competitor&apos;s listings.
          </p>
        </Section>

        <Section title="What this register is not">
          <p>
            It does not sell cannabis, take orders, process payments, or refer customers for a fee.
            No business has paid for its entry, its position, or its absence.
          </p>
          <p>
            It is not affiliated with, endorsed by, or acting on behalf of the New York State
            Office of Cannabis Management or any other public body. It is not legal advice, medical
            advice, or a substitute for checking a shop yourself at{' '}
            <a
              className="link"
              href="https://cannabis.ny.gov/dispensary-location-verification"
              target="_blank"
              rel="noreferrer noopener"
            >
              the state verification tool
            </a>
            .
          </p>
          <p>
            A shop missing from this list is not proof it is unlicensed, and an entry here is not a
            recommendation.
          </p>
        </Section>

        <Section title="If your business is listed here">
          <p>
            Entries describe licensed businesses using their own licence number, trading name and
            address as published by the state. If something is wrong — the shop has closed, moved,
            changed hands, or the details are simply out of date — tell us and it will be corrected
            at the next update, with the correction dated on the entry.
          </p>
          <p>
            If you would rather not be listed at all, say so and the entry will be removed. We will
            not ask you to justify it, and removal is not conditional on anything.
          </p>
          <p>
            Include the licence number in any request; it is the only identifier that reliably
            distinguishes one storefront from another.
          </p>
        </Section>

        <Section title="Accuracy and its limits">
          <p>
            The register is built to be checkable rather than complete. Every entry carries the
            sources it rests on and an honest label for how well it has been verified, and a field
            nobody has confirmed is left blank rather than filled with a plausible guess.
          </p>
          <p>
            Even so, shelves change hourly, licences lapse, and shops close without telling anyone.
            Confirm anything that matters before you travel.
          </p>
        </Section>
      </div>
    </div>
  );
}
