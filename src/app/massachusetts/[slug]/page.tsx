import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { FlowerMenu } from '@/components/FlowerMenu';
import { displayName, shopsIn } from '@/lib/territory-data';
import { shelfReadAt, territoryListingsFor, territoryShelfCounts } from '@/lib/territory-menu';
import { mapsUrl, prettyDate } from '@/lib/format';

/**
 * One Massachusetts shop and the shelf read from its menu.
 *
 * Generated only for shops whose shelf has been read: the other four hundred
 * have nothing on them that the territory page's card does not already say.
 * New York's shop page (/dispensary/) is not reused — it is built for records
 * that carry hours, services, a borough and a daily-refreshed shelf, and every
 * one of those would render empty or wrong here.
 */
type Params = { params: Promise<{ slug: string }> };

const TERRITORY = 'massachusetts';
const counts = territoryShelfCounts(TERRITORY);
const withShelf = () => shopsIn(TERRITORY).filter((d) => territoryListingsFor(TERRITORY, d.licenseNumber).length > 0);
const shopBySlug = (slug: string) => withShelf().find((d) => d.id === slug);

export const dynamicParams = false;
export const generateStaticParams = () => withShelf().map((d) => ({ slug: d.id }));

export const generateMetadata = async ({ params }: Params): Promise<Metadata> => {
  const d = shopBySlug((await params).slug);
  if (!d) return { title: 'Not found' };
  return {
    title: `${displayName(d)} — ${d.address.city}, Massachusetts`,
    description: `The flower on the shelf at ${displayName(d)}, ${d.address.line1}, ${d.address.city}, MA. Licence ${d.licenseNumber}.`,
  };
};

export default async function MassachusettsShopPage({ params }: Params) {
  const d = shopBySlug((await params).slug);
  if (!d) notFound();

  const listings = territoryListingsFor(TERRITORY, d.licenseNumber);
  const readAt = shelfReadAt(TERRITORY, d.licenseNumber);
  const inStock = counts[d.licenseNumber] ?? 0;
  const website = d.contact?.website ?? null;

  return (
    <article className="shell py-12">
      <Link href="/massachusetts/#list" className="text-sm text-chalk-400 transition-colors hover:text-moss-400">
        ← Massachusetts
      </Link>

      <header className="mt-6">
        <h1 className="text-3xl font-semibold tracking-tight text-chalk-50 sm:text-4xl">{displayName(d)}</h1>
        {d.dbaName && d.dbaName !== d.legalName && (
          <p className="mt-2 text-sm text-chalk-400">
            Licensed to <span className="text-chalk-200">{d.legalName}</span>
          </p>
        )}
      </header>

      <dl className="mt-6 grid max-w-2xl gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-chalk-500">Address</dt>
        <dd className="text-chalk-200">
          <a href={mapsUrl(d)} target="_blank" rel="noreferrer noopener" className="link">
            {[d.address.line1, d.address.line2, `${d.address.city}, MA ${d.address.zip}`].filter(Boolean).join(', ')}
          </a>
        </dd>
        <dt className="text-chalk-500">Licence</dt>
        <dd className="font-mono text-chalk-200">{d.licenseNumber}</dd>
        {d.dates?.openedOn && (
          <>
            <dt className="text-chalk-500">Commission records it opened</dt>
            <dd className="text-chalk-200">{prettyDate(d.dates.openedOn)}</dd>
          </>
        )}
        {website && (
          <>
            <dt className="text-chalk-500">Website</dt>
            <dd className="min-w-0">
              <a href={website} target="_blank" rel="noreferrer noopener" className="link break-all">
                {website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            </dd>
          </>
        )}
      </dl>

      {/* Said before the shelf, not after it: New York's shelves are read every
          day, and a reader arriving from there would assume this one is too. */}
      <div className="card mt-8 max-w-3xl border-amber-400/30 bg-amber-400/[0.04] p-5 text-sm leading-relaxed text-chalk-300">
        <p>
          <span className="font-medium text-chalk-100">
            Read once{readAt ? `, on ${prettyDate(readAt.slice(0, 10))}` : ''}
          </span>{' '}
          — the first stage of the Massachusetts trial. Unlike New York&apos;s shelves, this one is not
          refreshed every day, so what is in stock may have changed. Check with the shop before you go.
        </p>
        <p className="mt-2 text-chalk-400">
          Massachusetts shelves are kept apart: they are not in the strain index or the brand pages,
          and they are not passed to SŌMA. Terpenes appear only where the shop&apos;s own menu lists
          them; no New York strain reference is borrowed.
        </p>
      </div>

      <section id="menu" className="mt-10 scroll-mt-24">
        <h2 className="text-xl font-semibold tracking-tight text-chalk-50">
          On the shelf — {inStock} {inStock === 1 ? 'strain' : 'strains'} in stock
        </h2>
        <div className="mt-6">
          <FlowerMenu listings={listings} />
        </div>
      </section>
    </article>
  );
}
