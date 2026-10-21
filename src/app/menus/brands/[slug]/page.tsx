import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHead } from '@/components/PageParts';
import { ShelfIndex } from '@/components/ShelfIndex';
import { ShelfStamp } from '@/components/ShelfStamp';
import { SIZES, sizeLabel } from '@/lib/menu-format';
import { brandShelf, brandSummaries } from '@/lib/shelf';

type Params = { params: Promise<{ slug: string }> };

export const generateStaticParams = () => brandSummaries().map((b) => ({ slug: b.key }));

export const generateMetadata = async ({ params }: Params): Promise<Metadata> => {
  const { slug } = await params;
  const brand = brandShelf(slug);
  if (!brand) return { title: 'Brand not found' };
  return {
    title: `${brand.name} on New York shelves`,
    description: `Which ${brand.name} strains are on licensed New York dispensary shelves now, in which weights, and at which shops.`,
  };
};

export default async function BrandPage({ params }: Params) {
  const { slug } = await params;
  const brand = brandShelf(slug);
  if (!brand) notFound();

  /* How many of the brand's strains come in each counter size — the line a
     buyer reads first: "an ounce of it exists somewhere, and here is how much". */
  const bySize = SIZES.map((s) => ({
    ...s,
    strains: brand.strains.filter((st) => st.sizes.includes(s.grams)).length,
  })).filter((s) => s.strains > 0);

  return (
    <div className="shell pb-16">
      <PageHead
        back={{ href: '/menus/brands/', label: 'Brands' }}
        kicker="Brands"
        title={brand.name}
      >
        <p>
          {brand.strains.length} {brand.strains.length === 1 ? 'strain' : 'strains'} on the shelf at{' '}
          {brand.shops} {brand.shops === 1 ? 'shop' : 'shops'} whose menus we read.
        </p>
        {bySize.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {bySize.map((s) => (
              <li key={s.grams} className="tag text-[0.8125rem]">
                <span className="font-medium">{sizeLabel(s.grams)}</span>
                <span className="tabular-nums text-chalk-400">
                  {s.short} · {s.strains} {s.strains === 1 ? 'strain' : 'strains'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </PageHead>

      <ShelfStamp linkToShops />

      <div className="mt-8">
        <ShelfIndex strains={brand.strains} shopsRead={brand.shops} />
      </div>

      <p className="note mt-12 max-w-2xl">
        Only the shops whose menus we read. A strain missing here may still be on a shelf we have not
        reached, and a shop that prints the wrong brand on a jar is taken at its word.
      </p>
    </div>
  );
}
