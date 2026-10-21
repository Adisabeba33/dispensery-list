import type { Metadata } from 'next';
import { ShelfLamp, ShelfPill } from '@/components/Badges';
import { FlowerMenu } from '@/components/FlowerMenu';
import { PageHead } from '@/components/PageParts';
import { displayName, shopsIn, type TerritoryShop } from '@/lib/territory-data';
import { territory } from '@/lib/territories';
import { shelfReadAt, territoryListingsFor, territoryShelfCounts } from '@/lib/territory-menu';
import { prettyDate } from '@/lib/format';

/**
 * One shop outside New York City and Westchester, and the shelf read from its
 * menu: the page under /massachusetts/, /upstate/ and /long-island/.
 *
 * Generated only for shops whose shelf has been read: the others have nothing
 * on them that the territory page's card does not already say. The city's shop
 * page (/dispensary/) is not reused — it is built for records that carry
 * hours, services, a borough and a daily-refreshed shelf, and every one of
 * those would render empty or wrong here.
 */

/** What each state's page says about whose record the opening date is, and
    about a shelf that is read by hand rather than every day. */
const COPY: Record<string, { opened: string; read: string; once: string; apart: string }> = {
  MA: {
    opened: 'Commission records it opened',
    read: 'Read once,',
    once: 'the first stage of the Massachusetts trial. Unlike New York’s shelves, this one is not refreshed every day, so the shelf may have changed since.',
    apart:
      'Massachusetts shelves are kept apart: they are not in the strain index or the brand pages, and they are not passed to SŌMA. Terpenes appear only where the shop’s own menu lists them; no New York strain reference is borrowed.',
  },
  NY: {
    opened: 'Registry records it opened',
    read: 'Read',
    once: 'by hand. Unlike the shelves of New York City and Westchester, which are read every day, this one is not refreshed daily, so the shelf may have changed since.',
    apart:
      'Shelves outside the city are kept apart: they are not in the strain index or the brand pages, and they are not passed to SŌMA. Terpenes appear only where the shop’s own menu lists them; no strain reference from the city’s shelves is borrowed.',
  },
};

/* A label and its value, as one line of the record — drawn as the city shop
   page draws its own (DispensaryDetail's Row): the label in mono beside its
   value, and above it only on a phone too narrow for the two. The label
   column is a little wider than the city's, for "Commission records it
   opened" to take two lines rather than three. */
const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid gap-x-3 gap-y-1 border-b border-ink-700/70 py-3 last:border-b-0 [@media(min-width:400px)_and_(max-width:639px)]:grid-cols-[10rem_minmax(0,1fr)] sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-x-4">
    <dt className="label pt-0.5">{label}</dt>
    <dd className="min-w-0 text-sm text-chalk-100">{children}</dd>
  </div>
);

const withShelf = (id: string) => shopsIn(id).filter((d) => territoryListingsFor(id, d.licenseNumber).length > 0);
export const territoryShopBySlug = (id: string, slug: string): TerritoryShop | undefined =>
  withShelf(id).find((d) => d.id === slug);
export const territoryShopParams = (id: string) => withShelf(id).map((d) => ({ slug: d.id }));

export const territoryShopMetadata = (id: string, slug: string): Metadata => {
  const d = territoryShopBySlug(id, slug);
  if (!d) return { title: 'Not found' };
  const t = territory(id);
  const where = t.state === 'MA' ? 'Massachusetts' : 'New York';
  return {
    title: `${displayName(d)} — ${d.address.city}, ${where}`,
    description: `The flower on the shelf at ${displayName(d)}, ${d.address.line1}, ${d.address.city}, ${t.state}. Licence ${d.licenseNumber}.`,
  };
};

export const TerritoryShopPage = ({ id, d }: { id: string; d: TerritoryShop }) => {
  const t = territory(id);
  const copy = COPY[t.state] ?? COPY.NY;
  const listings = territoryListingsFor(id, d.licenseNumber);
  const readAt = shelfReadAt(id, d.licenseNumber);
  const onShelf = territoryShelfCounts(id)[d.licenseNumber] ?? 0;

  return (
    <article className="shell pb-16">
      <PageHead
        back={{ href: `${t.route}/#list`, label: t.label }}
        kicker={`${d.address.county} County`}
        title={
          <>
            {/* The shelf's lamp, as on the city's shop pages: lit, since a
                page here exists only for a shelf we read. */}
            <ShelfLamp read={listings.length > 0} className="mr-3 align-middle sm:mr-4" />
            {displayName(d)}
          </>
        }
        meta={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
            {onShelf > 0 ? (
              <ShelfPill count={onShelf} />
            ) : (
              // A shelf read with nothing on it but samples: read, so not red.
              <span className="pill border-moss-600/60 bg-moss-600/10 text-moss-400">0 strains</span>
            )}
            {displayName(d) !== d.legalName && (
              <p className="text-sm text-chalk-400">
                Licensed to <span className="text-chalk-200">{d.legalName}</span>
              </p>
            )}
          </div>
        }
      />

      <div className="mt-6 grid gap-4 sm:mt-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
        <dl className="card px-4 sm:px-5">
          <Row label="Address">
            {[d.address.line1, d.address.line2, `${d.address.city}, ${t.state} ${d.address.zip}`]
              .filter(Boolean)
              .join(', ')}
          </Row>
          <Row label="Licence">
            <span className="font-mono text-[0.8125rem] tracking-tight">{d.licenseNumber}</span>
          </Row>
          {d.dates?.openedOn && <Row label={copy.opened}>{prettyDate(d.dates.openedOn)}</Row>}
        </dl>

        {/* Said before the shelf, not after it: the city's shelves are read every
            day, and a reader arriving from there would assume this one is too. */}
        <div className="note note-caution">
          <p>
            <span className="font-medium text-chalk-50">
              {copy.read}
              {readAt ? ` on ${prettyDate(readAt.slice(0, 10))}` : ''}
            </span>{' '}
            — {copy.once}
          </p>
          <p className="mt-2 text-chalk-300">{copy.apart}</p>
        </div>
      </div>

      {/* The shelf brings its own #menu anchor, under the heading this page
          has always given it. */}
      <div className="mt-10 sm:mt-12">
        <FlowerMenu
          listings={listings}
          title={`On the shelf — ${onShelf} ${onShelf === 1 ? 'strain' : 'strains'}`}
        />
      </div>
    </article>
  );
};
