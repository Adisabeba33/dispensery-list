import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandIndex } from '@/components/BrandIndex';
import { PageHead } from '@/components/PageParts';
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
    <div className="shell pb-16">
      <PageHead kicker="Shelves" title="Brands on the shelves">
        <p>
          Pick a brand to see which of its strains are on a New York shelf now, in which weights, and
          at which shops.
        </p>
      </PageHead>

      <ShelfStamp linkToShops />

      <div className="mt-8">
        <BrandIndex brands={brands} />
      </div>

      <p className="note mt-12 max-w-2xl">
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
