import clsx from 'clsx';
import { debutDay, debutDetail, debutTag, isFreshDebut, type Debut } from '@/lib/menu-format';

/**
 * A brand's strain new to every shelf we read. Its first week it is a debut,
 * filled, with the number of shops it has reached — "Debut (3)"; after that
 * the tag steps back to an outline and says how long ago it was first seen.
 */
export const DebutTag = ({
  debut,
  className,
  sample = false,
}: {
  debut: Debut;
  className?: string;
  /** A key's example of the tag, not a strain's: no date to explain. */
  sample?: boolean;
}) => (
  <span
    className={clsx(
      'pill shrink-0 whitespace-nowrap',
      isFreshDebut(debut)
        ? 'border-moss-500 bg-moss-500 font-medium text-ink-950'
        : 'border-moss-600/45 bg-transparent text-moss-400',
      className,
    )}
    title={sample ? undefined : debutDetail(debut)}
  >
    {debutTag(debut)}
  </span>
);

/** The date itself, quietly, under the strain: "First seen on New York shelves Oct 8". */
export const DebutLine = ({ debut, className }: { debut: Debut; className?: string }) => (
  <p className={clsx('text-[0.72rem] text-chalk-500', className)} title={debutDetail(debut)}>
    First seen on New York shelves{' '}
    <time dateTime={debut.day} className="text-chalk-400">
      {debutDay(debut)}
    </time>
    {!isFreshDebut(debut) && debut.seenAt > 1 && ` · at ${debut.seenAt} shops since`}
  </p>
);
