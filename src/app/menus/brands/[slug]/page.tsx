import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
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
    <div className="shell py-12">
      <p className="label">
        <Link href="/menus/brands/" className="link">
          Brands
        </Link>
      </p>
      <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-chalk-50 sm:text-4xl">
        {brand.name}
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-chalk-200">
        {brand.strains.length} {brand.strains.length === 1 ? 'strain' : 'strains'} on the shelf at{' '}
        {brand.shops} {brand.shops === 1 ? 'shop' : 'shops'} whose menus we read.
      </p>

      {bySize.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2 text-sm">
          {bySize.map((s) => (
            <li
              key={s.grams}
              className="rounded-md border border-ink-700 bg-ink-900/70 px-2.5 py-1 text-chalk-200"
            >
              <span className="font-medium">{sizeLabel(s.grams)}</span>
              <span className="ml-1.5 tabular-nums text-chalk-500">
                {s.short} · {s.strains} {s.strains === 1 ? 'strain' : 'strains'}
              </span>
            </li>
          ))}
        </ul>
      )}

      <ShelfStamp linkToShops />

      <div className="mt-8">
        <ShelfIndex strains={brand.strains} shopsRead={brand.shops} />
      </div>

      <p className="mt-12 max-w-2xl text-sm text-chalk-400">
        Only the shops whose menus we read. A strain missing here may still be on a shelf we have not
        reached, and a shop that prints the wrong brand on a jar is taken at its word.
      </p>
    </div>
  );
}
