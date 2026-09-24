import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandIndex } from '@/components/BrandIndex';
import { ShelfStamp } from '@/components/ShelfStamp';
import { brandSummaries } from '@/lib/shelf';

export const metadata: Metadata = {
  title: 'Brands on the shelves',
  description:
    'Every flower brand read off licensed New York dispensary menus — which of its strains are on a shelf now, by the eighth, quarter, half and ounce, and at which shops.',
};

export default function BrandsPage() {
  const brands = brandSummaries();

  return (
    <div className="shell py-12">
      <p className="label">Shelves</p>
      <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-chalk-50 sm:text-4xl">
        Brands on the shelves
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-chalk-200">
        Pick a brand to see which of its strains are on a New York shelf now, in which weights, and
        at which shops.
      </p>

      <ShelfStamp linkToShops />

      <div className="mt-8">
        <BrandIndex brands={brands} />
      </div>

      <p className="mt-12 max-w-2xl text-sm text-chalk-400">
        A brand is what the shop printed. Shops write the same cultivator several ways, and those are
        read as one — but a shop that prints the wrong brand on a jar is taken at its word. To search
        by strain instead,{' '}
        <Link href="/menus/" className="link">
          find a strain
        </Link>
        .
      </p>
    </div>
  );
}
