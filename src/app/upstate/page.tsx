import type { Metadata } from 'next';
import { TerritoryView } from '@/components/TerritoryView';
import { territoryShelfCounts } from '@/lib/territory-menu';

export const metadata: Metadata = {
  title: 'Upstate New York',
  description:
    'State-licensed cannabis retail licences in upstate New York — every county above Westchester, imported from the OCM registry with licence numbers you can check.',
};

/* Counted from the shelf file, so the sentence cannot drift from it. */
const shelves = Object.keys(territoryShelfCounts('upstate')).length;

export default function UpstatePage() {
  return (
    <TerritoryView
      id="upstate"
      intro={
        <>
          <p>
            Everything above Westchester, to the Canadian border — fifty-two counties, and more
            licensed retail than the city register covers: 518 licences against 469. It is not one
            market, though. Erie County holds 75 of them; the twenty-five smallest counties hold
            68 between them, and five have exactly one.
          </p>
          {shelves > 0 && (
            <p className="text-sm text-chalk-300 sm:text-[0.9375rem]">
              {shelves} of these shops have had their shelf read — by hand, not every day. To see
              what is on one, press{' '}
              <a href="#list" className="link">
                “Shelf read”
              </a>{' '}
              in the list below and open a shop.
            </p>
          )}
          <p className="text-sm text-chalk-300 sm:text-[0.9375rem]">
            Otherwise this is a licence list, not yet a shop guide. It was cut from the same
            registry snapshot as the city register, on the same day, so the two are exactly
            comparable — and kept in a separate file, on a separate page, so that neither borrows
            the other’s credibility.
          </p>
        </>
      }
    />
  );
}
