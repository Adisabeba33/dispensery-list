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

/* One leaflet, pointing up from the origin: widest a third of the way out,
   its edges saw-toothed with the teeth leaning towards the tip. Worked out
   once when the module loads; the page is static, so it never runs in a
   reader's browser. */
const leaflet = (length: number, width: number, teeth = 12) => {
  const half = (t: number) => width * Math.sin(Math.PI * t ** 0.7) ** 1.2;
  const step = 1 / (teeth + 1);
  const edge: [number, number][] = [];
  for (let i = 0; i <= teeth; i++) {
    const notch = i * step;
    const tip = notch + step * 0.8;
    if (i > 0) edge.push([half(notch) * 0.82, -length * notch]);
    if (tip < 1) edge.push([half(tip), -length * tip]);
  }
  const r = (n: number) => Math.round(n * 10) / 10;
  const right = edge.map(([x, y]) => `${r(x)} ${r(y)}`);
  const left = [...edge].reverse().map(([x, y]) => `${r(-x)} ${r(y)}`);
  const outline = `M0 0L${right.join('L')}L0 ${-length}L${left.join('L')}Z`;

  // The midrib and four pairs of side veins, as one path.
  let veins = `M0 0L0 ${r(-length * 0.94)}`;
  for (const t of [0.2, 0.38, 0.56, 0.74]) {
    const x = r(half(t + 0.08) * 0.75);
    veins += `M0 ${r(-length * t)}L${x} ${r(-length * (t + 0.11))}M0 ${r(-length * t)}L${-x} ${r(-length * (t + 0.11))}`;
  }
  return { outline, veins };
};

/* Seven leaflets fanned from the stem, the pairs shorter the further out. */
const LEAFLETS = [
  { angle: 0, ...leaflet(106, 12, 13) },
  { angle: 30, ...leaflet(94, 11.5) },
  { angle: -30, ...leaflet(94, 11.5) },
  { angle: 60, ...leaflet(74, 9.5, 10) },
  { angle: -60, ...leaflet(74, 9.5, 10) },
  { angle: 94, ...leaflet(44, 6.5, 7) },
  { angle: -94, ...leaflet(44, 6.5, 7) },
];

/* A cannabis leaf in the register's green, drawn once behind the hero. */
export const HeroLeaf = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 240 250"
    aria-hidden
    focusable="false"
    className={clsx('pointer-events-none select-none', className)}
  >
    <defs>
      <linearGradient id="hero-leaf-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#25d17b" stopOpacity="0.32" />
        <stop offset="1" stopColor="#0f7c47" stopOpacity="0.12" />
      </linearGradient>
    </defs>
    <g transform="translate(120 150) rotate(-8)">
      <path
        d="M0 0C2 22-3 50-12 92"
        fill="none"
        stroke="#41e591"
        strokeOpacity="0.45"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {LEAFLETS.map(({ angle, outline, veins }) => (
        <g key={angle} transform={`rotate(${angle})`}>
          <path
            d={outline}
            fill="url(#hero-leaf-fill)"
            stroke="#41e591"
            strokeOpacity="0.55"
            strokeWidth="0.8"
            strokeLinejoin="round"
          />
          <path d={veins} fill="none" stroke="#86f5b8" strokeOpacity="0.35" strokeWidth="0.6" />
        </g>
      ))}
    </g>
  </svg>
);
