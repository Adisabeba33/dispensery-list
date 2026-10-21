import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DebutBadge } from '@/components/DebutTag';
import { PageHead } from '@/components/PageParts';
import { StrainView } from '@/components/StrainView';
import { prettyDateTime } from '@/lib/format';
import { LINEAGE_LABEL, TERPENE_LABEL } from '@/lib/menu-format';
import { strainPage, strainSlugs } from '@/lib/strain-page';

type Params = { params: Promise<{ slug: string }> };

export const generateStaticParams = () => strainSlugs().map((slug) => ({ slug }));

export const generateMetadata = async ({ params }: Params): Promise<Metadata> => {
  const { slug } = await params;
  const strain = strainPage(slug);
  if (!strain) return { title: 'Strain not found' };
  const shops = strain.places.length;
  const facts = [
    strain.thc && `THC ${strain.thc.low === strain.thc.high ? strain.thc.low : `${strain.thc.low}–${strain.thc.high}`}%`,
    strain.terpenes?.kind === 'MEASURED' &&
      `leading terpenes ${strain.terpenes.top.map((t) => TERPENE_LABEL[t] ?? t).join(', ')}`,
  ].filter(Boolean);
  return {
    title: `${strain.name} — where to find it in New York`,
    description: `${strain.name} is on the shelf at ${shops} licensed ${shops === 1 ? 'dispensary' : 'dispensaries'} in New York City and Westchester${
      facts.length ? `: ${facts.join('; ')}` : ''
    }.`,
  };
};

export default async function StrainPage({ params }: Params) {
  const { slug } = await params;
  const strain = strainPage(slug);
  if (!strain) notFound();

  const shops = strain.places.length;
  const growers = strain.growers.length;
  const lineage = strain.lineage !== 'UNKNOWN';

  return (
    <article className="shell pb-16">
      <PageHead
        back={{ href: '/menus/', label: 'Back to strains' }}
        kicker="Strains"
        title={strain.name}
        meta={
          (lineage || strain.debut) && (
            <div className="flex flex-wrap items-center gap-2">
              {lineage && (
                <span className="tag border-moss-600/60 bg-moss-600/10 text-[0.8125rem] text-moss-300">
                  {LINEAGE_LABEL[strain.lineage] ?? strain.lineage}
                </span>
              )}
              {strain.debut && <DebutBadge debut={strain.debut} />}
            </div>
          )
        }
      >
        {/* What the shelves say about it, in a line: no description, because no
            shelf gives one that could be checked. */}
        <p>
          On the shelf at {shops} licensed {shops === 1 ? 'shop' : 'shops'} in New York City and Westchester
          {growers > 0 && `, from ${growers} ${growers === 1 ? 'grower' : 'growers'}`}.
        </p>
      </PageHead>

      <StrainView strain={strain} />

      <p className="stamp mt-12 max-w-2xl">
        {strain.readAt && <>Read from the shops&apos; own menus, most recently {prettyDateTime(strain.readAt)}. </>}
        Shelves change hourly and this page does not: it is what each shelf showed when it was read.
        A shop whose shelf we do not read is not listed, so a shop missing here is not a shop without
        it.
      </p>
    </article>
  );
}
