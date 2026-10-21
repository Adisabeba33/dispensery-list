import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHead } from '@/components/PageParts';
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
    <div className="shell pb-16">
      <PageHead kicker="Shelves" title="Find a strain">
        <p>
          Search {strains.length} strains across every collected shelf at once. A strain on more than
          one shelf lists every one — by strain, by brand, or by shop.
        </p>
        <p className="text-sm text-chalk-300 sm:text-[0.9375rem]">
          What turned up this week, and what is running low?{' '}
          <Link href="/moves/" className="link">
            New &amp; leaving
          </Link>
          .
        </p>
      </PageHead>

      <ShelfStamp linkToShops />

      {/* The search is the page now. It used to sit below a grid of every shop
          read, half a screen down, which is a long way to scroll to reach the
          thing the page is for. The grid has a page of its own. */}
      <div className="mt-8">
        <ShelfIndex strains={strains} shopsRead={shelves.length} />
      </div>

      <p className="note mt-12 max-w-2xl">
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

      <p className="stamp mt-4 max-w-2xl">
        Shelves change hourly and this page does not. It is what each shop published when its menu
        was read, not what is in the jar today.
      </p>
    </div>
  );
}
