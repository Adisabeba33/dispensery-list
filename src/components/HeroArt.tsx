import clsx from 'clsx';

/*
 * The two drawings beside the home page's headline. Both are ornament only:
 * hidden from screen readers, never in the way of a tap, and faint enough
 * that the text over them keeps its contrast.
 */

/* An instrument's readout in the corner of the hero, framed at two corners. */
export const HudBox = ({ className }: { className?: string }) => (
  <div
    aria-hidden
    className={clsx(
      'hud-corners pointer-events-none select-none border-x border-moss-500/10 font-mono uppercase text-chalk-400',
      // Its brackets lit and long, as drawn: brighter than the shared frame,
      // with a glow that follows the strokes (a box-shadow would ring a square).
      'before:h-[40%] after:h-[62%] before:border-moss-300 after:border-moss-300',
      'before:drop-shadow-[0_0_3px_rgba(var(--glow),0.8)] after:drop-shadow-[0_0_3px_rgba(var(--glow),0.8)]',
      className,
    )}
  >
    <span className="block">Legal</span>
    <span className="block">Market</span>
    <span className="block whitespace-nowrap">Real data</span>
    <span className="block whitespace-nowrap">NY state</span>
  </div>
);

/* The verification decal's code, drawn large: a 25-module QR code with its
   three finder squares, its timing rows and its alignment square, and a field
   of modules that encodes nothing (a fixed seed, so every build draws the same
   one). It stands for the decal at a licensed shop's door, the one a reader is
   told to scan. Worked out once when the module loads. */
const MODULES = 25;
const CELL = 10;
const QR_FIELD = (() => {
  let seed = 0x5eed;
  const random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const inFinder = (x: number, y: number) => x < 8 && y < 8;
  const reserved = (x: number, y: number) =>
    inFinder(x, y) ||
    inFinder(MODULES - 1 - x, y) ||
    inFinder(x, MODULES - 1 - y) ||
    (x >= 16 && x <= 20 && y >= 16 && y <= 20);
  let d = '';
  const cell = (x: number, y: number) => {
    d += `M${x * CELL + 1} ${y * CELL + 1}h8v8h-8z`;
  };
  for (let y = 0; y < MODULES; y++)
    for (let x = 0; x < MODULES; x++) {
      if (reserved(x, y)) continue;
      // The timing rows: every other module along row and column six.
      if (x === 6 || y === 6) {
        if ((x + y) % 2 === 0) cell(x, y);
        continue;
      }
      if (random() < 0.47) cell(x, y);
    }
  return d;
})();

const FINDERS = [
  [0, 0],
  [MODULES - 7, 0],
  [0, MODULES - 7],
];

/* The decal's code in the register's green, drawn once behind the hero. */
export const HeroCode = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 250 250"
    aria-hidden
    focusable="false"
    className={clsx('pointer-events-none select-none', className)}
  >
    <path d={QR_FIELD} fill="#25d17b" fillOpacity="0.14" stroke="#41e591" strokeOpacity="0.4" strokeWidth="0.6" />
    {FINDERS.map(([x, y]) => (
      <g key={`${x}-${y}`} fill="none" stroke="#41e591">
        <rect x={x * CELL + 2} y={y * CELL + 2} width="66" height="66" rx="5" strokeOpacity="0.6" strokeWidth="2.4" />
        <rect
          x={x * CELL + 20}
          y={y * CELL + 20}
          width="30"
          height="30"
          rx="2.5"
          fill="#25d17b"
          fillOpacity="0.22"
          strokeOpacity="0.6"
        />
      </g>
    ))}
    {/* The alignment square, near the far corner. */}
    <g fill="none" stroke="#41e591" strokeOpacity="0.55">
      <rect x="161" y="161" width="48" height="48" rx="3" strokeWidth="1.8" />
      <rect x="180" y="180" width="10" height="10" fill="#25d17b" fillOpacity="0.25" />
    </g>
  </svg>
);
