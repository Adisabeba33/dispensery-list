import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MoveIcon } from '@/components/MovesIcons';
import { MovesList } from '@/components/MovesList';
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
    <div className="shell py-12">
      <Link href="/moves/" className="text-sm text-chalk-400 transition-colors hover:text-moss-400">
        ← New &amp; leaving
      </Link>

      <div className="mt-6 flex items-center gap-3">
        <MoveIcon kind={kind} className="h-8 w-8" />
        <h1 className="text-3xl font-semibold tracking-tight text-chalk-50 sm:text-4xl">{MOVE_TITLE[kind]}</h1>
        <span className="ml-auto text-3xl font-semibold tabular-nums tracking-tight text-chalk-400">
          {items.length}
        </span>
      </div>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-chalk-400">{moveDescription(kind, w.rules)}</p>
      <p className="mt-2 text-xs text-chalk-500">As of the daily read on {shortDay(w.day)}.</p>

      <MovesList kind={kind} items={items} />
    </div>
  );
}
