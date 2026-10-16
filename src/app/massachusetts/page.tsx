import type { Metadata } from 'next';
import { TerritoryView } from '@/components/TerritoryView';
import { shopsIn } from '@/lib/territory-data';

export const metadata: Metadata = {
  title: 'Massachusetts',
  description:
    'State-licensed adult-use cannabis retailers in Massachusetts, imported from the Cannabis Control Commission’s register with licence numbers you can check.',
};

/* Counted from the records, so the sentence cannot drift from the file when
   the register is re-imported. */
const shops = shopsIn('massachusetts');
const opened = shops.filter((d) => d.dates?.openedOn != null).length;
const boston = shops.filter((d) => d.address.city === 'Boston').length;
const bostonOpened = shops.filter((d) => d.address.city === 'Boston' && d.dates?.openedOn != null).length;

export default function MassachusettsPage() {
  return (
    <TerritoryView
      id="massachusetts"
      intro={
        <>
          <p>
            The first territory outside New York. Massachusetts has sold to adults since 2018,
            four years before New York, and its Cannabis Control Commission licenses{' '}
            {shops.length} retailers, {opened} of which it records as having commenced operations —
            {' '}{boston} of them in the city of Boston, {bostonOpened} opened.
          </p>
          <p className="text-base text-chalk-300">
            It is here as an experiment: to learn what it costs to carry this register into a
            second state, and what breaks on the way. The records come from the Commission’s own
            open data, not from New York’s Office of Cannabis Management, and are kept in a separate
            file on a separate page. A Massachusetts licence reads MR followed by six digits.
          </p>
        </>
      }
    />
  );
}
