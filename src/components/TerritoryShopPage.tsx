import Link from 'next/link';
import type { Metadata } from 'next';
import { FlowerMenu } from '@/components/FlowerMenu';
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
    <article className="shell py-12">
      <Link href={`${t.route}/#list`} className="text-sm text-chalk-400 transition-colors hover:text-moss-400">
        ← {t.label}
      </Link>

      <header className="mt-6">
        <h1 className="text-3xl font-semibold tracking-tight text-chalk-50 sm:text-4xl">{displayName(d)}</h1>
        {displayName(d) !== d.legalName && (
          <p className="mt-2 text-sm text-chalk-400">
            Licensed to <span className="text-chalk-200">{d.legalName}</span>
          </p>
        )}
      </header>

      <dl className="mt-6 grid max-w-2xl gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-chalk-500">Address</dt>
        <dd className="text-chalk-200">
          {[d.address.line1, d.address.line2, `${d.address.city}, ${t.state} ${d.address.zip}`].filter(Boolean).join(', ')}
        </dd>
        <dt className="text-chalk-500">Licence</dt>
        <dd className="font-mono text-chalk-200">{d.licenseNumber}</dd>
        {d.dates?.openedOn && (
          <>
            <dt className="text-chalk-500">{copy.opened}</dt>
            <dd className="text-chalk-200">{prettyDate(d.dates.openedOn)}</dd>
          </>
        )}
      </dl>

      {/* Said before the shelf, not after it: the city's shelves are read every
          day, and a reader arriving from there would assume this one is too. */}
      <div className="card mt-8 max-w-3xl border-amber-400/30 bg-amber-400/[0.04] p-5 text-sm leading-relaxed text-chalk-300">
        <p>
          <span className="font-medium text-chalk-100">
            {copy.read}
            {readAt ? ` on ${prettyDate(readAt.slice(0, 10))}` : ''}
          </span>{' '}
          — {copy.once}
        </p>
        <p className="mt-2 text-chalk-400">{copy.apart}</p>
      </div>

      <section id="menu" className="mt-10 scroll-mt-24">
        <h2 className="text-xl font-semibold tracking-tight text-chalk-50">
          On the shelf — {onShelf} {onShelf === 1 ? 'strain' : 'strains'}
        </h2>
        <div className="mt-6">
          <FlowerMenu listings={listings} />
        </div>
      </section>
    </article>
  );
};
