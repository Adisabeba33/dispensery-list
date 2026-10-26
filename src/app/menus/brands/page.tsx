import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandIndex } from '@/components/BrandIndex';
import { PageHead } from '@/components/PageParts';
import { ShelfStamp } from '@/components/ShelfStamp';
import { ShelvesArt } from '@/components/ShelvesArt';
import { brandSummaries, PAGE_MIN_SHELVES } from '@/lib/shelf';

export const metadata: Metadata = {
  title: 'Brands on the shelves',
  description:
    'Every flower brand read off licensed New York dispensary menus — which of its strains are on a shelf now, by the eighth, quarter, half and ounce, and at which shops.',
};

export default function BrandsPage() {
  const brands = brandSummaries();

  return (
    <div className="pb-16">
      {/* Clipped across, so the drawing at the screen's edge never scrolls
          the page sideways; never down, where the stamp's glow would be cut.
          Where the screen is wider than the page, the drawing fades out at
          its right instead of being cut there. */}
      <section className="relative isolate overflow-x-clip">
        <div className="shell relative">
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-0 -z-10 w-[48%] max-w-[17rem] sm:w-[20rem] sm:max-w-none lg:w-[27rem] lg:[mask-image:linear-gradient(to_left,transparent,#000_14%)]"
          >
            <ShelvesArt className="h-auto w-full" />
          </div>

          <PageHead
            kicker="Brands"
            title={
              /* A size over the other pages' titles, on two lines, the
                 second lit as the home page's "licensed" is. */
              <span className="block text-[clamp(2rem,6.6vw+0.4rem,3.5rem)]">
                Brands on <br />
                <span className="inline-block bg-gradient-to-b from-moss-300 to-moss-400 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(var(--glow),0.45)]">
                  the shelves
                </span>
              </span>
            }
            className="pt-5 sm:pt-10 lg:pt-12"
          />
          {/* The home page's lede on a phone: a size under the other pages',
              so the two lines leave the drawing its room. */}
          <p className="lede mt-3 max-w-2xl text-[0.84rem] leading-[1.6] sm:mt-4 sm:text-[1.0625rem] sm:leading-[1.65]">
            Pick a brand to see which of its strains are on a New York shelf now, in which weights, and at
            which shops.
          </p>

          <ShelfStamp lit linkToShops className="mt-4 sm:mt-6" />
        </div>
      </section>

      <div className="shell">
        <div className="mt-4 sm:mt-8">
          {/* "On shelves" asks of a brand what a strain's own page asks of a strain. */}
          <BrandIndex brands={brands} minShelves={PAGE_MIN_SHELVES} />
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
    </div>
  );
}
