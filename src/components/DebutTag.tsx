import clsx from 'clsx';
import { debutDay, debutDetail, debutTag, isFreshDebut, type Debut } from '@/lib/menu-format';

/**
 * A grower's strain new to every shelf we read. Its first week it is a debut,
 * filled, with the number of shops it has reached — "Debut (3)"; after that
 * the tag steps back to an outline and says how long ago it was first seen.
 *
 * Chalk, not moss: on these cards green is the colour of a lab measurement
 * (the provenance pill beside it), and a debut is news, not verification.
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
        ? 'border-chalk-50 bg-chalk-50 font-medium text-ink-950'
        : 'border-ink-600 bg-transparent text-chalk-200',
      className,
    )}
    title={sample ? undefined : debutDetail(debut)}
  >
    {debutTag(debut)}
  </span>
);

/**
 * The date itself, quietly, beside the tag. In the first week: "First seen on
 * New York shelves Oct 8". After it, when the tag already says how long ago:
 * "On New York shelves since Sep 23 · 49 shops so far".
 */
export const DebutLine = ({ debut, className }: { debut: Debut; className?: string }) => {
  const date = (
    <time dateTime={debut.day} className="text-chalk-400">
      {debutDay(debut)}
    </time>
  );
  return (
    <span className={clsx('text-[0.72rem] text-chalk-500', className)} title={debutDetail(debut)}>
      {isFreshDebut(debut) ? (
        <>First seen on New York shelves {date}</>
      ) : (
        <>
          On New York shelves since {date}
          {debut.seenAt > 1 && ` · ${debut.seenAt} shops so far`}
        </>
      )}
    </span>
  );
};

/** Tag and date together, as a strain card shows them under the grower. */
export const DebutBadge = ({ debut, className }: { debut: Debut; className?: string }) => (
  <div className={clsx('flex flex-wrap items-center gap-x-2 gap-y-1', className)}>
    <DebutTag debut={debut} />
    <DebutLine debut={debut} />
  </div>
);
