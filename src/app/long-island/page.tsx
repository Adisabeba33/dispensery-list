import type { Metadata } from 'next';
import { TerritoryView } from '@/components/TerritoryView';

export const metadata: Metadata = {
  title: 'Long Island',
  description:
    'State-licensed cannabis retail licences in Suffolk and Nassau counties, imported from the OCM registry with licence numbers you can check.',
};

export default function LongIslandPage() {
  return (
    <TerritoryView
      id="long-island"
      intro={
        <>
          <p>
            Suffolk and Nassau — two counties that are neither the city nor upstate, and would
            otherwise fall between the two and be covered by neither.
          </p>
          <p className="text-base text-chalk-300">
            The two counties are close in population, and nothing like it in licences: the
            registry puts almost all of the island’s retail in Suffolk. The usual explanation is
            municipal opt-out — town after town using the ban the law gave it — but this register
            has not established which municipalities opted out, so it is offered here as the
            likely reason and not as a finding.
          </p>
        </>
      }
    />
  );
}
