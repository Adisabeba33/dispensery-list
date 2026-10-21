import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MoveIcon } from '@/components/MovesIcons';
import { MovesList } from '@/components/MovesList';
import { IconBox, PageHead } from '@/components/PageParts';
import { MOVE_KINDS, moveLists, windows, type MoveKind } from '@/lib/moves';
import { MOVE_TITLE, moveDescription, shortDay } from '@/lib/moves-copy';

type Params = { params: Promise<{ list: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => MOVE_KINDS.map((list) => ({ list }));

const kindOf = (list: string): MoveKind | null =>
  (MOVE_KINDS as readonly string[]).includes(list) ? (list as MoveKind) : null;

export const generateMetadata = async ({ params }: Params): Promise<Metadata> => {
  const kind = kindOf((await params).list);
  if (!kind) return { title: 'Not found' };
  return {
    title: `${MOVE_TITLE[kind]} — New & leaving`,
    description: moveDescription(kind, windows().rules),
  };
};

export default async function MoveListPage({ params }: Params) {
  const kind = kindOf((await params).list);
  if (!kind) notFound();
  const w = windows();
  const items = moveLists()[kind];

  return (
    <div className="shell pb-16">
      <PageHead
        back={{ href: '/moves/', label: 'New & leaving' }}
        kicker="Shelves"
        title={
          <span className="flex items-center gap-3 sm:gap-4">
            {/* The list's icon in its frame, as on its card. */}
            <IconBox className="h-10 w-10 sm:h-12 sm:w-12">
              <MoveIcon kind={kind} className="h-6 w-6 text-chalk-300 sm:h-7 sm:w-7" />
            </IconBox>
            <span className="min-w-0">{MOVE_TITLE[kind]}</span>
          </span>
        }
        aside={
          <span className="block bg-gradient-to-b from-moss-300 to-moss-400 bg-clip-text text-[clamp(1.75rem,5.2vw+0.5rem,3rem)] font-bold leading-[1.08] tabular-nums tracking-tight text-transparent">
            {items.length}
          </span>
        }
        meta={<p className="stamp">As of the daily read on {shortDay(w.day)}.</p>}
      >
        <p className="text-[0.9375rem] sm:text-base">{moveDescription(kind, w.rules)}</p>
      </PageHead>

      <MovesList kind={kind} items={items} />
    </div>
  );
}
