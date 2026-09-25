import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { dayLabel, shelfSignals, type Shop } from '@/lib/signals';

export const metadata: Metadata = {
  title: 'New & leaving',
  description:
    'Which strains turned up on licensed New York shelves this week, which came in a new batch, and which are running low or gone — from the daily read of every collected menu.',
};

/* How many shops a card names before it says "and N more". */
const SHOWN_SHOPS = 8;
/* How many single-shop arrivals stand in the open before the rest fold away. */
const SHOWN_ARRIVALS = 30;

const Shops = ({ shops }: { shops: Shop[] }) =>
  shops.length === 0 ? null : (
    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
      {shops.slice(0, SHOWN_SHOPS).map((shop) => (
        <li key={shop.id}>
          <Link href={`/dispensary/${shop.id}/#menu`} className="link">
            {shop.name}
          </Link>
          <span className="text-chalk-500"> · {shop.region}</span>
        </li>
      ))}
      {shops.length > SHOWN_SHOPS && (
        <li className="text-chalk-500">and {shops.length - SHOWN_SHOPS} more</li>
      )}
    </ul>
  );

const Card = ({
  strain,
  brand,
  tag,
  children,
}: {
  strain: string;
  brand: string | null;
  tag?: ReactNode;
  children: ReactNode;
}) => (
  <li className="card p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="truncate text-[0.95rem] font-semibold tracking-tight text-chalk-50">{strain}</h3>
        <p className="mt-0.5 truncate text-xs text-chalk-500">{brand ?? 'Brand not stated'}</p>
      </div>
      {tag}
    </div>
    {children}
  </li>
);

const Section = ({
  id,
  title,
  lead,
  empty,
  count,
  children,
}: {
  id: string;
  title: string;
  lead: ReactNode;
  empty: string;
  count: number;
  children: ReactNode;
}) => (
  <section id={id} className="mt-14 scroll-mt-28 sm:scroll-mt-20">
    <h2 className="text-xl font-semibold tracking-tight text-chalk-50">
      {title} <span className="tabular-nums text-chalk-500">{count}</span>
    </h2>
    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-chalk-400">{lead}</p>
    {count === 0 ? <p className="mt-4 text-sm text-chalk-500">{empty}</p> : children}
  </section>
);

const Grid = ({ children }: { children: ReactNode }) => (
  <ul className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</ul>
);

const Tag = ({ children }: { children: ReactNode }) => (
  <span className="shrink-0 rounded-md border border-moss-600 bg-moss-600/15 px-2 py-0.5 text-[0.7rem] text-moss-400">
    {children}
  </span>
);

export default function MovesPage() {
  const s = shelfSignals();
  const { rules } = s;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  return (
    <div className="shell py-12">
      <p className="label">Shelves</p>
      <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-chalk-50 sm:text-4xl">
        New on the shelves, and leaving them
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-chalk-200">
        What changed across every collected menu, as of the daily read on {dayLabel(s.day)}: the
        strains that turned up this week, the ones that came in a new batch, and the ones that are
        running low or gone.
      </p>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-chalk-400">
        A date here is the day our read first saw a strain on a shelf, not the day it was packed — no
        menu we read states a packaging date. What looked new because we learned to read a menu
        better, rather than because the shop restocked, is left out. A strain we no longer see may
        still be on shelves we do not read.
      </p>

      <nav aria-label="Sections" className="mt-6 flex flex-wrap gap-2 text-sm">
        {[
          ['#waves', 'Waves', s.waves.length],
          ['#batches', 'New batches', s.batches.length],
          ['#new', 'New this week', s.arrivals.length],
          ['#low', 'Running low', s.runningLow.length],
          ['#gone', 'Gone', s.gone.length],
        ].map(([href, label, n]) => (
          <a key={href} href={String(href)} className="chip">
            {label} <span className="tabular-nums text-chalk-500">{n}</span>
          </a>
        ))}
      </nav>

      <Section
        id="waves"
        title="Waves"
        count={s.waves.length}
        empty="No strain turned up on several shelves at once this week."
        lead={`One brand's strain turning up on ${rules.waveShelves} or more shelves within ${rules.newDays} days — a delivery going round. Shops that share one menu count as one shelf.`}
      >
        <Grid>
          {s.waves.map((a) => (
            <Card
              key={`${a.brand}|${a.strain}`}
              strain={a.strain}
              brand={a.brand}
              tag={a.today > 0 ? <Tag>+{a.today} today</Tag> : undefined}
            >
              <p className="mt-3 text-sm text-chalk-300">
                New on {plural(a.shelves, 'shelf', 'shelves')} since {dayLabel(a.first)}
              </p>
              <Shops shops={a.shops} />
            </Card>
          ))}
        </Grid>
      </Section>

      <Section
        id="batches"
        title="New batches"
        count={s.batches.length}
        empty="No new batch turned up this week."
        lead="A THC figure this brand's strain had not shown at any shop before. The figure comes off the batch's lab certificate, so a new one is a new batch — even of a strain that never left the shelf."
      >
        <Grid>
          {s.batches.map((b) => (
            <Card
              key={`${b.brand}|${b.strain}|${b.thc}`}
              strain={b.strain}
              brand={b.brand}
              tag={<Tag>THC {b.thc}%</Tag>}
            >
              <p className="mt-3 text-sm text-chalk-300">
                First seen {dayLabel(b.first)}
                {b.shops.length > 0 && `, now at ${plural(b.shops.length, 'shop', 'shops')}`}
              </p>
              <p className="mt-1 text-xs text-chalk-500">
                Earlier batches: {b.before.slice(0, 5).join('%, ')}%{b.before.length > 5 ? ' …' : ''}
              </p>
              <Shops shops={b.shops} />
            </Card>
          ))}
        </Grid>
      </Section>

      <Section
        id="new"
        title="New this week"
        count={s.arrivals.length}
        empty="Nothing else turned up this week."
        lead={`Strains that turned up on one or two shelves in the last ${rules.newDays} days and were still there at the next read.`}
      >
        <ArrivalList arrivals={s.arrivals.slice(0, SHOWN_ARRIVALS)} />
        {s.arrivals.length > SHOWN_ARRIVALS && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-moss-400">
              Show the other {s.arrivals.length - SHOWN_ARRIVALS}
            </summary>
            <ArrivalList arrivals={s.arrivals.slice(SHOWN_ARRIVALS)} />
          </details>
        )}
      </Section>

      <Section
        id="low"
        title="Running low"
        count={s.runningLow.length}
        empty="Nothing is running low."
        lead={`On ${rules.lowPeak} or more shops in the last ${rules.movesDays} days, and on fewer than ${rules.lowBelow} now. Where to still find it is listed.`}
      >
        <Grid>
          {s.runningLow.map((m) => (
            <Card key={`${m.brand}|${m.strain}`} strain={m.strain} brand={m.brand}>
              <p className="mt-3 text-sm text-chalk-300">
                On {plural(m.now.length, 'shop', 'shops')} now, down from {m.peak} on{' '}
                {dayLabel(m.peakDay)}
              </p>
              <Shops shops={m.now} />
            </Card>
          ))}
        </Grid>
      </Section>

      <Section
        id="gone"
        title="Gone"
        count={s.gone.length}
        empty={`No strain that was on ${rules.gonePeak} or more shops has left every shelf we read.`}
        lead={`On ${rules.gonePeak} or more shops in the last ${rules.movesDays} days, and on none of the shelves we read now.`}
      >
        <Grid>
          {s.gone.map((m) => (
            <Card key={`${m.brand}|${m.strain}`} strain={m.strain} brand={m.brand}>
              <p className="mt-3 text-sm text-chalk-300">
                Last seen {dayLabel(m.lastSeen)}, on {m.peak} shops at most
              </p>
              <Shops shops={m.lastShops} />
            </Card>
          ))}
        </Grid>
      </Section>
    </div>
  );
}

const ArrivalList = ({
  arrivals,
}: {
  arrivals: ReturnType<typeof shelfSignals>['arrivals'];
}) => (
  <ul className="mt-5 divide-y divide-ink-700/60 border-y border-ink-700/60">
    {arrivals.map((a) => (
      <li key={`${a.brand}|${a.strain}`} className="py-3">
        <p className="text-sm">
          <span className="font-medium text-chalk-50">{a.strain}</span>
          <span className="text-chalk-500"> · {a.brand ?? 'Brand not stated'} · since {dayLabel(a.first)}</span>
        </p>
        <Shops shops={a.shops} />
      </li>
    ))}
  </ul>
);
