import clsx from 'clsx';

/**
 * A strip of bars drawn from a licence number, the way a printed record
 * carries one beside its reference. It encodes nothing anyone could scan —
 * it is ornament, so it is hidden from screen readers, and the number itself
 * is always printed beside it in words.
 *
 * One path whatever the length: 472 cards draw it at once.
 */
const bars = (code: string): { d: string; width: number } => {
  let x = 0;
  let d = '';
  const bar = (w: number) => {
    d += `M${x} 0h${w}v12h-${w}z`;
    x += w;
  };
  const gap = (w: number) => {
    x += w;
  };

  // Guard bars at each end, as on a real one, so it reads as a barcode even
  // where the number is short. Between them, two bars for each digit: about
  // twenty in all, thick enough to read as bars at this size.
  const digits = code.replace(/[^0-9]/g, '');
  const source = digits.length >= 6 ? digits : code.replace(/[^0-9A-Za-z]/g, '');
  bar(1);
  gap(1);
  bar(1);
  gap(1.5);
  for (const ch of source) {
    const v = /[0-9]/.test(ch) ? Number(ch) : ch.toUpperCase().charCodeAt(0) % 10;
    bar(1 + (v % 2));
    gap(1);
    bar(1 + ((v >> 1) % 2) * 1.5);
    gap(1 + ((v >> 2) % 2));
  }
  gap(0.5);
  bar(1);
  gap(1);
  bar(1);
  return { d, width: x };
};

export const Barcode = ({ code, className }: { code: string; className?: string }) => {
  const { d, width } = bars(code);
  return (
    <svg
      viewBox={`0 0 ${width} 12`}
      preserveAspectRatio="none"
      className={clsx('h-3 w-[2.85rem] shrink-0 fill-current', className)}
      aria-hidden
      focusable="false"
    >
      <path d={d} shapeRendering="crispEdges" />
    </svg>
  );
};
