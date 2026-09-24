import type { Metadata } from 'next';
import Link from 'next/link';
import { ShelfIndex } from '@/components/ShelfIndex';
import { ShelfStamp } from '@/components/ShelfStamp';
import { shelvesRead, strainEntries } from '@/lib/shelf';

export const metadata: Metadata = {
  title: 'Find a strain',
  description:
    'Search every flower strain read off the menus of licensed New York dispensaries — by the gram, eighth, quarter, half and ounce — and see which shops have it.',
};

export default function MenusPage() {
  const strains = strainEntries();
  const shelves = shelvesRead();

  return (
    <div className="shell py-12">
      <p className="label">Shelves</p>
      <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-chalk-50 sm:text-4xl">
        Find a strain
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-chalk-200">
        Search {strains.length} strains across every collected shelf at once. A strain carried by
        more than one shop lists them all, so you can see where it is before you travel — by strain,
        by brand, or by shop.
      </p>

      <ShelfStamp linkToShops />

      {/* The search is the page now. It used to sit below a grid of every shop
          read, half a screen down, which is a long way to scroll to reach the
          thing the page is for. The grid has a page of its own. */}
      <div className="mt-8">
        <ShelfIndex strains={strains} shopsRead={shelves.length} />
      </div>

      <p className="mt-12 max-w-2xl text-sm text-chalk-400">
        Read from {shelves.length} shops&apos; own menus —{' '}
        <Link href="/menus/shops/" className="link">
          see which shops
        </Link>
        , or{' '}
        <Link href="/menus/brands/" className="link">
          browse by brand
        </Link>
        . A shop whose menu we have not read shows no strains at all, so a strain missing here is
        not a strain nobody stocks.
      </p>

      <p className="mt-6 max-w-2xl text-xs leading-relaxed text-chalk-500">
        Shelves change hourly and this page does not. Treat it as what a shop published when its
        menu was read, not as what is in the jar today — and confirm anything that matters with the
        shop before you travel.
      </p>
    </div>
  );
}
