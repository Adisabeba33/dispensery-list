import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { DemoBanner } from '@/components/DemoBanner';
import { ShelfLamp, StatusBadge, VerificationBadge } from '@/components/Badges';
import { DispensaryDetail } from '@/components/DispensaryDetail';
import { PageHead } from '@/components/PageParts';
import { StorefrontArt } from '@/components/StorefrontArt';
import { dispensaries, displayName, getDispensary, isDemoData, LICENSE_TYPE_LABEL, regionOf } from '@/lib/data';
import { fullAddress } from '@/lib/format';
import { listingsFor, menuPaused } from '@/lib/menu';
import { shelfNote } from '@/lib/signals';

type Params = { params: Promise<{ slug: string }> };

export const generateStaticParams = () => dispensaries.map((d) => ({ slug: d.id }));

export const generateMetadata = async ({ params }: Params): Promise<Metadata> => {
  const { slug } = await params;
  const d = getDispensary(slug);
  if (!d) return { title: 'Not found' };

  return {
    title: `${displayName(d)} — ${regionOf(d)}`,
    description: `${displayName(d)}, ${fullAddress(d)}. Licence ${d.licenseNumber}, ${
      LICENSE_TYPE_LABEL[d.licenseType]
    }.`,
  };
};

export default async function DispensaryPage({ params }: Params) {
  const { slug } = await params;
  const d = getDispensary(slug);
  if (!d) notFound();
  const menu = listingsFor(d.licenseNumber);

  return (
    <>
      {isDemoData && <DemoBanner />}

      <article className="shell pb-16">
        <PageHead
          back={{ href: '/', label: 'All dispensaries' }}
          kicker={d.address.neighborhood ? `${d.address.neighborhood} · ${regionOf(d)}` : regionOf(d)}
          title={
            <>
              {/* The shelf's lamp, as on the shop's card: lit when we read its
                  shelf, red when we do not. */}
              <ShelfLamp read={menu.length > 0} className="mr-3 align-middle sm:mr-4" />
              {displayName(d)}
            </>
          }
          meta={
            <div className="flex items-center gap-3.5">
              {/* The shop's card's picture, small, beside what the card says
                  under the name, so the page is plainly the card opened out.
                  Drawn, not a photograph: nothing in it to read. */}
              <span
                aria-hidden
                className="relative block h-[4.5rem] w-[3.125rem] shrink-0 self-start overflow-hidden rounded-md border border-ink-700 bg-ink-900"
              >
                <StorefrontArt licenseNumber={d.licenseNumber} line1={d.address.line1} className="absolute inset-0" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={d.operationalStatus} />
                  <VerificationBadge status={d.verification.status} />
                </div>
                {displayName(d) !== d.legalName && (
                  <p className="mt-2.5 text-sm text-chalk-400">
                    Licensed to <span className="text-chalk-200">{d.legalName}</span>
                  </p>
                )}
              </div>
            </div>
          }
        />

        <DispensaryDetail
          d={d}
          menu={menu}
          partialShelf={shelfNote(d.licenseNumber)?.state === 'partial'}
          menuUnavailable={menuPaused(d.licenseNumber)}
        />

      </article>
    </>
  );
}
