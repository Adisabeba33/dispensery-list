import clsx from 'clsx';
import { leafPath } from './StorefrontArt';

/*
 * The drawing beside the brands page's title: a wall of shelves at night,
 * glass jars on them lit green, and a sign on the wall that says what every
 * shelf in the register is — New York's licensed market. Ornament only:
 * hidden from screen readers, never in the way of a tap, and fading out to
 * the left and the foot so the title and the lede over it keep their
 * contrast. No jar carries a word or a brand: the drawing is of no shelf in
 * particular, and must not be taken for one.
 */

const W = 400;
const H = 310;

/* The shelving, left of the sign and a sliver of it right of the sign: the
   boards' tops, and how far each run reaches. */
const BOARDS = [64, 136, 208, 280];
const RUNS: [number, number][] = [
  [0, 238],
  [356, W],
];

/* A fixed seed, so every build draws the same jars. */
const random = (() => {
  let seed = 0x6a52;
  return () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
})();

const r1 = (n: number) => Math.round(n * 10) / 10;

type Jar = { x: number; y: number; w: number; h: number; s: number; lit: number };

/* Jars grow towards the sign, as if the wall were seen from its right; the
   ones near it are lit brighter. */
const JARS: Jar[] = (() => {
  const jars: Jar[] = [];
  for (const [x0, x1] of RUNS)
    for (const board of BOARDS) {
      let x = x0 + 3 + random() * 5;
      while (x < x1 - (x1 < W ? 10 : 0)) {
        const s = 0.8 + 0.35 * Math.min(1, x / 238);
        const w = r1((29 + random() * 10) * s);
        const h = r1(Math.min(58, (38 + random() * 14) * s));
        // The run right of the sign goes on past the drawing's edge.
        if (x1 < W && x + w > x1 - 3) break;
        const lit = x1 === W ? 0.6 : 0.45 + 0.55 * Math.min(1, x / 238);
        jars.push({ x: r1(x), y: board, w, h, s, lit });
        x += w + (2.5 + random() * 5) * s;
      }
    }
  return jars;
})();

/* One jar: the glass, its neck and lid, the flower inside it, a blank label
   and the glints down its sides. */
const JarShape = ({ x, y, w, h, s, lit }: Jar) => {
  const lid = r1(5.5 * s);
  const neck = r1(2.5 * s);
  const top = y - h + neck;
  return (
    <g opacity={r1(0.5 + 0.5 * lit)}>
      <ellipse cx={x + w / 2} cy={y + 1} rx={w * 0.66} ry={2.6 * s} fill="#41e591" fillOpacity={0.3 * lit} />
      <rect x={x} y={top} width={w} height={h - neck} rx={6 * s} fill="url(#shelves-glass)" stroke="#41e591" strokeOpacity="0.7" strokeWidth="0.9" />
      <rect x={x + 2.2} y={top + h * 0.3} width={w - 4.4} height={h * 0.7 - neck - 2.2} rx={4.5 * s} fill="url(#shelves-bud)" />
      <rect x={x + w * 0.18} y={top + h * 0.46} width={w * 0.64} height={h * 0.2} rx="1.2" fill="#e6fff1" fillOpacity="0.07" stroke="#86f5b8" strokeOpacity="0.22" strokeWidth="0.6" />
      <rect x={x + 2.4 * s} y={top - neck - 0.5} width={w - 4.8 * s} height={neck + 1} fill="#0b2a1b" stroke="#41e591" strokeOpacity="0.45" strokeWidth="0.6" />
      <rect x={x + 1.4 * s} y={top - neck - lid} width={w - 2.8 * s} height={lid} rx={1.4 * s} fill="url(#shelves-lid)" stroke="#86f5b8" strokeOpacity="0.6" strokeWidth="0.7" />
      <path d={`M${r1(x + 3 * s)} ${r1(top - neck - lid / 2)}H${r1(x + w - 3 * s)}`} stroke="#86f5b8" strokeOpacity="0.25" strokeWidth="0.6" />
      <path d={`M${r1(x + 3.4 * s)} ${r1(top + 5 * s)}v${r1(h - 12 * s)}`} stroke="#e6fff1" strokeOpacity={0.6 * lit} strokeWidth={1.5 * s} strokeLinecap="round" />
      <path d={`M${r1(x + w - 3 * s)} ${r1(top + 8 * s)}v${r1(h * 0.35)}`} stroke="#86f5b8" strokeOpacity={0.35 * lit} strokeWidth={0.9 * s} strokeLinecap="round" />
    </g>
  );
};

/* The sign's leaf, small, lit. */
const LEAF = leafPath(298, 250, 30);

export const ShelvesArt = ({ className }: { className?: string }) => (
  <svg
    viewBox={`0 0 ${W} ${H}`}
    aria-hidden
    focusable="false"
    className={clsx('pointer-events-none select-none', className)}
  >
    <defs>
      <linearGradient id="shelves-wall" x1="0" y1="0" x2="1" y2="0.3">
        <stop offset="0" stopColor="#030b07" />
        <stop offset="0.6" stopColor="#061a10" />
        <stop offset="1" stopColor="#04120b" />
      </linearGradient>
      <radialGradient id="shelves-light" cx="0.55" cy="0.1" r="0.8">
        <stop offset="0" stopColor="#41e591" stopOpacity="0.3" />
        <stop offset="1" stopColor="#41e591" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="shelves-glass" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#86f5b8" stopOpacity="0.38" />
        <stop offset="0.3" stopColor="#0f3a25" stopOpacity="0.6" />
        <stop offset="0.8" stopColor="#0b2a1b" stopOpacity="0.55" />
        <stop offset="1" stopColor="#41e591" stopOpacity="0.3" />
      </linearGradient>
      <linearGradient id="shelves-bud" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2c9a60" stopOpacity="0.9" />
        <stop offset="1" stopColor="#0c3420" stopOpacity="0.95" />
      </linearGradient>
      <linearGradient id="shelves-lid" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#1f5a3c" />
        <stop offset="1" stopColor="#081c12" />
      </linearGradient>
      {/* The strip of light under each board, falling on the row beneath. */}
      <linearGradient id="shelves-strip" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#41e591" stopOpacity="0.28" />
        <stop offset="1" stopColor="#41e591" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="shelves-board" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#1c3a2a" />
        <stop offset="1" stopColor="#07140d" />
      </linearGradient>
      <linearGradient id="shelves-sign" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#06170e" />
        <stop offset="1" stopColor="#020906" />
      </linearGradient>
      {/* Faded in from the left and out at the foot, so the words laid over
          the drawing never sit on its brightest part. */}
      <linearGradient id="shelves-fade-x" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#fff" stopOpacity="0" />
        <stop offset="0.22" stopColor="#fff" stopOpacity="0.3" />
        <stop offset="0.5" stopColor="#fff" stopOpacity="1" />
      </linearGradient>
      <linearGradient id="shelves-fade-y" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0.78" stopColor="#fff" stopOpacity="1" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <mask id="shelves-mask-x" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
        <rect width={W} height={H} fill="url(#shelves-fade-x)" />
      </mask>
      <mask id="shelves-mask-y" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
        <rect width={W} height={H} fill="url(#shelves-fade-y)" />
      </mask>
      <filter id="shelves-neon" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2.4" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    <g mask="url(#shelves-mask-y)">
      <g mask="url(#shelves-mask-x)">
        <rect width={W} height={H} fill="url(#shelves-wall)" />
        <rect width={W} height={H} fill="url(#shelves-light)" />

        {/* The boards, each with its lit front edge. */}
        {RUNS.map(([x0, x1]) =>
          BOARDS.map((y) => (
            <g key={`${x0}-${y}`}>
              <rect x={x0} y={y + 7} width={x1 - x0} height="46" fill="url(#shelves-strip)" />
              <rect x={x0} y={y} width={x1 - x0} height="7" fill="url(#shelves-board)" />
              <path d={`M${x0} ${y + 0.5}H${x1}`} stroke="#41e591" strokeOpacity="0.75" strokeWidth="1" />
              <path d={`M${x0} ${y + 7}H${x1}`} stroke="#86f5b8" strokeOpacity="0.5" strokeWidth="1.2" />
            </g>
          )),
        )}

        {JARS.map((jar, i) => (
          <JarShape key={i} {...jar} />
        ))}

        {/* The shelving's side, and the wall the sign hangs on. */}
        <rect x="238" y="0" width="118" height={H} fill="#020a06" />
        <path d="M238.5 0V310M355.5 0V310" stroke="#41e591" strokeOpacity="0.22" />

        {/* The sign: a panel framed twice, the words tilted as the wall is. */}
        <rect x="244" y="-6" width="106" height="300" rx="4" fill="url(#shelves-sign)" stroke="#41e591" strokeOpacity="0.7" strokeWidth="1.2" />
        <rect x="249" y="-1" width="96" height="290" rx="2.5" fill="none" stroke="#41e591" strokeOpacity="0.25" />
        <g filter="url(#shelves-neon)" transform="rotate(-9 297 150)">
          <text
            x="303"
            y="102"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
            fontWeight="800"
            fontSize="78"
            letterSpacing="-2"
            fill="#41e591"
            transform="translate(303 0) scale(0.74 1) translate(-303 0)"
          >
            NY
          </text>
          <g
            fontFamily="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
            fontWeight="700"
            fontSize="20"
            letterSpacing="0.4"
            textAnchor="middle"
            fill="#86f5b8"
            transform="translate(297 0) scale(0.76 1) translate(-297 0)"
          >
            <text x="297" y="140">LICENSED</text>
            <text x="297" y="165">CANNABIS</text>
            <text x="297" y="190">MARKET</text>
          </g>
          <path d={LEAF} fill="#41e591" fillOpacity="0.85" />
        </g>
      </g>
    </g>
  </svg>
);
