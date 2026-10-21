import { useId } from 'react';
import clsx from 'clsx';

/*
 * We hold no photograph of any shop, and a picture that looked like one
 * would claim we had been there. So each card carries a drawing that is
 * plainly a drawing: a shopfront at night in graphite, with the street
 * number from the shop's own address on its sign, or a leaf, in blue neon —
 * the only colour in it, so the card's own green stays the register's. Never a word on it — no "open", no name, nothing it could be
 * taken to say about the shop.
 *
 * Which of the few drawings a shop gets is fixed by its licence number, so
 * it is the same on every visit and on every page. 472 of these render at
 * once: about forty nodes each, gradients only, no SVG filter.
 */

const hash = (s: string): number => {
  // FNV-1a: cheap, and spreads neighbouring licence numbers apart.
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

const random = (seed: number) => {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const r1 = (n: number) => Math.round(n * 10) / 10;

/* The leaflets of a cannabis leaf: angle from upright and length against the
   centre one. Shared with the strains pill, which draws the same leaf small. */
const LEAFLETS: [number, number][] = [
  [0, 1],
  [33, 0.84],
  [-33, 0.84],
  [66, 0.64],
  [-66, 0.64],
  [104, 0.38],
  [-104, 0.38],
];

/** A seven-leaflet leaf whose leaflets meet at (cx, cy), `size` from there to the tip. */
export const leafPath = (cx: number, cy: number, size: number): string => {
  let d = '';
  for (const [deg, len] of LEAFLETS) {
    const t = (deg * Math.PI) / 180;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const L = size * len;
    const w = L * 0.2;
    const p = (x: number, y: number) => `${r1(cx + x * c - y * s)} ${r1(cy + x * s + y * c)}`;
    d +=
      `M${p(0, 0)}C${p(w * 0.9, -L * 0.2)} ${p(w * 1.1, -L * 0.62)} ${p(0, -L)}` +
      `C${p(-w * 1.1, -L * 0.62)} ${p(-w * 0.9, -L * 0.2)} ${p(0, 0)}Z`;
  }
  const k = size * 0.045;
  d += `M${r1(cx - k)} ${r1(cy)}L${r1(cx + k)} ${r1(cy)}L${r1(cx + k / 2)} ${r1(cy + size * 0.3)}L${r1(cx - k / 2)} ${r1(cy + size * 0.3)}Z`;
  return d;
};

/** The building number at the start of the street line: "1720", "185-24", "99A". */
const streetNumber = (line1: string): string | null => {
  const m = line1.match(/^\s*(\d+(?:-\d+)?[A-Za-z]?)\b/);
  return m && m[1].length <= 6 ? m[1].toUpperCase() : null;
};

/* Goods on shelves, as dark shapes against the lit window: one path. A shelf
   is [y at x0, y at x1], so it can recede with the window it stands in. */
const goods = (rnd: () => number, x0: number, x1: number, shelves: [number, number][]): string => {
  let d = '';
  for (const [ya, yb] of shelves) {
    let x = x0 + rnd() * 2;
    while (x < x1 - 2) {
      const w = r1(1.6 + rnd() * 2.6);
      const h = r1(2.5 + rnd() * 5.5);
      if (x + w > x1) break;
      const y = r1(ya + ((yb - ya) * (x - x0)) / (x1 - x0));
      d += `M${r1(x)} ${y}h${w}v-${h}h-${w}z`;
      x += w + 0.8 + rnd() * 2.6;
    }
  }
  return d;
};

/* Every colour of the drawing, in one place: the street in graphite, the
   sign — the number or the leaf — in blue. */
const C = {
  wallTop: '#25292b',
  wallFoot: '#0b0d0e',
  frame: '#5d6569',
  line: '#30363a',
  dark: '#060708',
  shadow: '#0d0f10',
  neon: '#f4f6f7',
  glow: '#c9d1d5',
  // How brightly the window is lit varies a little from shop to shop.
  lit: ['#7d878c', '#6f787d', '#8a959a'],
  winMid: '#2f3538',
  winFoot: '#141719',
  glare: '#ffffff',
  awning: '#3a4044',
  pavement: '#121516',
  signNeon: '#dcefff',
  signGlow: '#5fb4ff',
};

const signSize = (num: string) => {
  const long = num.length > 4;
  const pitch = long ? 10.5 : 13;
  return { pitch, font: long ? 9.5 : 12, height: num.length * pitch + 6 };
};

/* A blade sign: the street number stacked down it, lit. */
const BladeSign = ({ x, y, num, halo }: { x: number; y: number; num: string; halo: string }) => {
  const { pitch, font, height } = signSize(num);
  return (
    <>
      <ellipse cx={x + 8} cy={y + height / 2} rx="24" ry={height / 2 + 16} fill={`url(#${halo})`} />
      <rect x={x} y={y} width="16" height={height} rx="2" fill={C.dark} fillOpacity="0.6" stroke={C.signGlow} strokeOpacity="0.22" />
      <text
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui, -apple-system, sans-serif"
        fontWeight="700"
        fontSize={font}
        fill={C.signNeon}
        stroke={C.signGlow}
        strokeOpacity="0.45"
        strokeWidth="2.6"
        paintOrder="stroke"
      >
        {num.split('').map((ch, i) => (
          <tspan key={i} x={x + 8} y={r1(y + 3 + pitch * (i + 1) - (pitch - font * 0.72) / 2)}>
            {ch}
          </tspan>
        ))}
      </text>
    </>
  );
};

type Props = {
  licenseNumber: string;
  line1: string;
  className?: string;
};

export const StorefrontArt = ({ licenseNumber, line1, className }: Props) => {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const h = hash(licenseNumber);
  const rnd = random(h);
  const num = streetNumber(line1);
  // Three drawings; a shop without a number we can read gets the leaf.
  const variant = num ? (['blade', 'leaf', 'awning'] as const)[h % 3] : 'leaf';
  const lit = C.lit[(h >>> 3) % C.lit.length];

  const wall = `${id}w`;
  const win = `${id}g`;
  const halo = `${id}h`;
  const fade = `${id}f`;
  const signHalo = `${id}s`;

  return (
    <svg
      viewBox="0 0 96 138"
      preserveAspectRatio="xMidYMax meet"
      className={clsx('block h-full w-full', className)}
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={wall} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.wallTop} />
          <stop offset="1" stopColor={C.wallFoot} />
        </linearGradient>
        <linearGradient id={win} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={lit} />
          <stop offset="0.55" stopColor={C.winMid} />
          <stop offset="1" stopColor={C.winFoot} />
        </linearGradient>
        <radialGradient id={halo}>
          <stop offset="0" stopColor={C.glow} stopOpacity="0.4" />
          <stop offset="1" stopColor={C.glow} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={signHalo}>
          <stop offset="0" stopColor={C.signGlow} stopOpacity="0.4" />
          <stop offset="1" stopColor={C.signGlow} stopOpacity="0" />
        </radialGradient>
        {/* Into the card on the right, so the picture has no hard edge there. */}
        <linearGradient id={fade} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.7" stopColor="#06100b" stopOpacity="0" />
          <stop offset="1" stopColor="#06100b" stopOpacity="0.7" />
        </linearGradient>
      </defs>

      {/* The wall runs up past the top, for a card made taller by a long address. */}
      <rect x="0" y="-300" width="96" height="438" fill={`url(#${wall})`} />
      {/* Its courses, faintly, and the dark windows of the floors above. */}
      <path
        d="M0 4h96M0 16h96M0 28h96M0 40h96M0 52h96M0 -8h96M0 -20h96"
        stroke={C.line}
        strokeOpacity="0.55"
        strokeWidth="0.6"
      />
      <path
        d="M6 -46h34v32H6zM56 -46h34v32H56zM6 -100h34v32H6zM56 -100h34v32H56z"
        fill={C.dark}
        fillOpacity="0.8"
        stroke={C.line}
      />

      {variant === 'blade' && num && (
        <>
          {/* A window on the side wall, receding: the shop is on a corner. */}
          <path d="M2 12L48 26V116L2 128Z" fill={`url(#${win})`} stroke={C.frame} strokeWidth="1.5" />
          <ellipse cx="22" cy="58" rx="22" ry="34" fill={`url(#${halo})`} opacity="0.7" />
          <path d="M2 12L22 18V60L2 62Z" fill={C.glare} opacity="0.07" />
          <path d="M25 19V122M2 34L48 44" stroke={C.shadow} strokeWidth="1.6" />
          <path d="M3 64L47 69M3 87L47 90M3 109L47 110" stroke={C.shadow} strokeWidth="1.2" />
          <path d={goods(rnd, 4, 46, [[63.5, 68.5], [86.5, 89.5], [108.5, 109.5]])} fill={C.shadow} opacity="0.85" />
          <path d="M50 -300V138M53 -300V138" stroke={C.line} />
          <rect x="60" y="80" width="30" height="52" fill={C.dark} stroke={C.line} />
          <rect x="64" y="85" width="22" height="26" fill={lit} opacity="0.3" />
          <path d="M80 20h8M80 52h8" stroke={C.frame} strokeWidth="1.4" />
          <BladeSign x={64} y={12} num={num} halo={signHalo} />
          <path
            d="M0 112h96M0 119h96M10 112v26M26 112v26M42 112v26M58 112v26M74 112v26M90 112v26"
            stroke={C.dark}
            strokeWidth="1.7"
          />
          <path d="M0 111.3h96" stroke={C.glow} strokeOpacity="0.5" strokeWidth="0.8" />
        </>
      )}

      {variant === 'leaf' && (
        <>
          <rect x="0" y="2" width="96" height="48" fill={C.dark} fillOpacity="0.55" />
          <ellipse cx="48" cy="26" rx="38" ry="30" fill={`url(#${signHalo})`} />
          <path d={leafPath(48, 35, 26)} fill="none" stroke={C.signGlow} strokeOpacity="0.45" strokeWidth="3.2" strokeLinejoin="round" />
          <path d={leafPath(48, 35, 26)} fill={C.signGlow} fillOpacity="0.2" stroke={C.signNeon} strokeWidth="1.1" strokeLinejoin="round" />
          <path d="M22 44h52" stroke={C.signGlow} strokeOpacity="0.6" strokeWidth="1.2" strokeDasharray="3 2" />
          <path d="M0 52h96" stroke={C.frame} strokeWidth="1.6" />
          <rect x="4" y="58" width="56" height="62" fill={`url(#${win})`} stroke={C.frame} strokeWidth="1.5" />
          <ellipse cx="30" cy="80" rx="26" ry="22" fill={`url(#${halo})`} opacity="0.6" />
          <path d="M4 58h18L4 84Z" fill={C.glare} opacity="0.07" />
          <path d="M32 58v62M4 70h56" stroke={C.shadow} strokeWidth="1.6" />
          <path d="M5 90h54M5 108h54" stroke={C.shadow} strokeWidth="1.2" />
          <path d={goods(rnd, 6, 58, [[89.5, 89.5], [107.5, 107.5]])} fill={C.shadow} opacity="0.85" />
          <rect x="4" y="120" width="56" height="8" fill={C.shadow} />
          <rect x="66" y="64" width="24" height="64" fill={C.dark} stroke={C.line} />
          <rect x="70" y="69" width="16" height="34" fill={lit} opacity="0.4" />
          {/* A lightbox over the door, blank. */}
          <rect x="67" y="56" width="22" height="5" rx="1" fill={C.glow} fillOpacity="0.35" stroke={C.glow} strokeOpacity="0.6" strokeWidth="0.6" />
        </>
      )}

      {variant === 'awning' && num && (
        <>
          <BladeSign x={6} y={12} num={num} halo={signHalo} />
          <path d="M26 40h66l4 13H22z" fill={C.awning} stroke={C.frame} />
          <path d="M33 40l-1.5 13M44 40l-1 13M55 40l-.5 13M66 40v13M77 40l.5 13M88 40l1 13" stroke={C.dark} strokeWidth="2.4" />
          <rect x="28" y="56" width="64" height="60" fill={`url(#${win})`} stroke={C.frame} strokeWidth="1.5" />
          <ellipse cx="58" cy="78" rx="30" ry="22" fill={`url(#${halo})`} opacity="0.6" />
          <path d="M28 56h20L28 86Z" fill={C.glare} opacity="0.07" />
          <path d="M49.5 56v60M71 56v60" stroke={C.shadow} strokeWidth="1.6" />
          <path d="M29 78h62M29 98h62" stroke={C.shadow} strokeWidth="1.2" />
          <path d={goods(rnd, 30, 90, [[77.5, 77.5], [97.5, 97.5]])} fill={C.shadow} opacity="0.85" />
          <rect x="4" y="74" width="18" height="54" fill={C.dark} stroke={C.line} />
          <rect x="7" y="79" width="12" height="26" fill={lit} opacity="0.35" />
          <rect x="28" y="116" width="64" height="12" fill={C.shadow} />
        </>
      )}

      {/* The pavement, catching the light from the window. */}
      <rect x="0" y="128" width="96" height="10" fill={C.pavement} />
      <path d="M0 128.5h96" stroke={C.glow} strokeOpacity="0.35" strokeWidth="0.6" />
      <rect x="0" y="-300" width="96" height="438" fill={`url(#${fade})`} />
    </svg>
  );
};
