import { DEBUT_NOTE, debutDay } from '@/lib/menu-format';

/**
 * A brand's strain on its first week on any shelf we read: "Debut · Oct 13".
 * The date is the day the read first saw it anywhere, not a packaging date.
 */
export const DebutTag = ({ day }: { day: string }) => (
  <span
    className="pill shrink-0 border-moss-500 bg-moss-500 font-medium text-ink-950"
    title={`${DEBUT_NOTE}: first seen ${debutDay(day)}`}
  >
    Debut · {debutDay(day)}
  </span>
);
