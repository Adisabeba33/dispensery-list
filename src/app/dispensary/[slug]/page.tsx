import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { DemoBanner } from '@/components/DemoBanner';
import { StatusBadge, VerificationBadge } from '@/components/Badges';
import { DispensaryDetail } from '@/components/DispensaryDetail';
import { dispensaries, displayName, getDispensary, isDemoData, LICENSE_TYPE_LABEL, regionOf } from '@/lib/data';
import { fullAddress } from '@/lib/format';

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

  return (
    <>
      {isDemoData && <DemoBanner />}

      <article className="shell py-12">
        <Link href="/" className="text-sm text-chalk-400 transition-colors hover:text-moss-400">
          ← All dispensaries
        </Link>

        <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight text-chalk-50 sm:text-4xl">
              {displayName(d)}
            </h1>
            {d.dbaName && d.dbaName !== d.legalName && (
              <p className="mt-2 text-sm text-chalk-400">
                Licensed to <span className="text-chalk-200">{d.legalName}</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={d.operationalStatus} />
            <VerificationBadge status={d.verification.status} />
          </div>
        </header>

        <DispensaryDetail d={d} />

      </article>
    </>
  );
}
