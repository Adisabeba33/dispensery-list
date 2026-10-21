import clsx from 'clsx';

/*
 * The header's sketch of what the register covers: New York City and the
 * county north of it, with a line climbing from one to the other. A drawing,
 * not a map to go by — no shop is on it and nothing is to scale — so it is
 * hidden from screen readers and never takes a tap.
 *
 * It fills the room between the logo and the controls, and draws itself at
 * the right of that room: beside the menu button on a phone, beside the row
 * of sections from a tablet up. Where the room is narrower than the drawing,
 * the drawing is cut at the left, and both edges fade so the cut never shows.
 * Just past the width where the sections join the header, though, they leave
 * it no more than a sliver — a frame line, half a county's name — so there it
 * is left out until the room holds it whole.
 * The header is drawn once a page, so its ids are fixed.
 */

/* Drawn in css pixels at a phone's header height: north is up, the Hudson
   runs down the left, Manhattan is the sliver with the light on it, the
   mainland (the Bronx, then Westchester) is above and to the right, and
   Queens and Brooklyn are across the water at the foot. */
const LAND = [
  // New Jersey, across the Hudson.
  'M-8 0H50L52 12 54 24 53 34 50 44 46 56 43 67H-8Z',
  // The Bronx and Westchester, up to the Sound.
  'M58 0 59 10 62 20 66 26 71 29 78 31 86 30 94 27 102 24 110 19 118 15 127 9 134 5 140 3V0Z',
  // Manhattan.
  'M56 64 58 56 61 47 64 38 67 30 70 28 71 31 68 40 64 50 60 59 58 65Z',
  // Queens and Brooklyn.
  'M64 67 63 62 66 55 70 49 75 44 83 41 92 40 101 37 110 34 120 30 130 27 140 25V67Z',
];

const FADE = 'linear-gradient(90deg, transparent, #000 2rem)';
const ART_FADE = 'linear-gradient(90deg, transparent 0%, #000 34%)';

export const HeaderMap = ({ className }: { className?: string }) => (
  <div
    aria-hidden
    className={clsx(
      'pointer-events-none relative min-w-0 flex-1 self-stretch overflow-hidden nav:opacity-80 [@media(min-width:48em)_and_(max-width:58.75em)]:hidden',
      className,
    )}
    style={{ WebkitMaskImage: FADE, maskImage: FADE }}
  >
    <svg
      viewBox="0 0 140 67"
      preserveAspectRatio="xMaxYMid slice"
      focusable="false"
      className="absolute inset-y-0 right-0 h-full w-[8.75rem] nav:right-5"
      style={{ WebkitMaskImage: ART_FADE, maskImage: ART_FADE }}
    >
      <defs>
        {/* The land's tint with a city's grain on it, scattered so the tile
            does not read as a mesh. */}
        <pattern id="header-map-grain" width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="#0f7c47" fillOpacity="0.12" />
          <g fill="#41e591">
            <circle cx="1" cy="1.2" r="0.45" fillOpacity="0.42" />
            <circle cx="4.2" cy="2.1" r="0.32" fillOpacity="0.3" />
            <circle cx="2.6" cy="4.4" r="0.38" fillOpacity="0.36" />
            <circle cx="5.3" cy="5.2" r="0.26" fillOpacity="0.24" />
            <circle cx="3.3" cy="0.3" r="0.22" fillOpacity="0.2" />
          </g>
        </pattern>
        <radialGradient id="header-map-halo">
          <stop offset="0" stopColor="#41e591" stopOpacity="0.6" />
          <stop offset="1" stopColor="#41e591" stopOpacity="0" />
        </radialGradient>
        {/* In the drawing's own units: a gradient sized to a straight line's
            box, which has no width, would not draw at all. */}
        <linearGradient id="header-map-edge" x1="0" y1="0" x2="0" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#41e591" stopOpacity="0.5" />
          <stop offset="1" stopColor="#41e591" stopOpacity="0" />
        </linearGradient>
        {/* From a tablet up the drawing ends beside the row of sections, not
            beside a button: there the land thins out before the frame, so the
            sketch fades into the header rather than stopping at a cut. In the
            land's own units, which start 8 to the right. */}
        <linearGradient id="header-map-land-ramp" x1="92" y1="0" x2="130" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="header-map-land-fade" maskUnits="userSpaceOnUse" x="-16" y="0" width="156" height="67">
          <rect x="-16" width="156" height="67" fill="url(#header-map-land-ramp)" />
        </mask>
      </defs>

      {/* Moved right, so the light stays in view on a narrow phone, where the
          room cuts the drawing at the left. The frame and the county's name
          keep to the right edge. */}
      <g transform="translate(8 0)">
        <g className="nav:[mask:url(#header-map-land-fade)]">
          <g
            fill="url(#header-map-grain)"
            stroke="#41e591"
            strokeOpacity="0.42"
            strokeWidth="0.5"
            strokeLinejoin="round"
          >
            {LAND.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
          {/* A few lines for roads, and the city's lights along them. */}
          <path
            d="M10 20 40 30M20 67 30 10M62 14 80 22 100 16M75 5 84 24M96 2 104 20M72 52 96 46 130 36M88 67 92 42M110 67 114 38"
            fill="none"
            stroke="#41e591"
            strokeOpacity="0.16"
            strokeWidth="0.45"
          />
          <path
            d="M63 42h0M66 35h0M59 55h0M80 26h0M98 20h0M75 47h0M90 43h0M120 13h0M84 41h0M126 31h0M44 22h0"
            stroke="#86f5b8"
            strokeOpacity="0.55"
            strokeWidth="0.9"
            strokeLinecap="round"
          />
        </g>

        {/* Sighting lines through the light, as on an instrument. */}
        <path
          d="M61 0V67M67 48H128"
          stroke="#41e591"
          strokeOpacity="0.22"
          strokeWidth="0.5"
          strokeDasharray="1 1.6"
        />

        {/* The line from the city to the county, lit. */}
        <g
          fill="none"
          strokeLinecap="round"
          style={{ filter: 'drop-shadow(0 0 2px rgba(65, 229, 145, 0.9))' }}
        >
          <path
            d="M61 48 57 60 55 67"
            stroke="#41e591"
            strokeOpacity="0.55"
            strokeWidth="0.8"
            strokeDasharray="1.4 1.8"
          />
          <path
            d="M61 48C64 40 66 33 70 27S84 14 96 9 114 3 122 0"
            stroke="#41e591"
            strokeOpacity="0.22"
            strokeWidth="2.6"
          />
          <path d="M61 48C64 40 66 33 70 27S84 14 96 9 114 3 122 0" stroke="#86f5b8" strokeWidth="0.95" />
        </g>
        <circle cx="104" cy="6.4" r="1.6" fill="#040a07" stroke="#86f5b8" strokeWidth="0.7" />

        <circle cx="61" cy="48" r="10" fill="url(#header-map-halo)" />
        <circle cx="61" cy="48" r="3.4" fill="none" stroke="#41e591" strokeOpacity="0.7" strokeWidth="0.6" />
        <circle cx="61" cy="48" r="1.9" fill="#dcffec" />

        {/* Left out where the room is too narrow to show it whole. */}
        <text
          x="49.5"
          y="50.5"
          textAnchor="end"
          className="font-mono [@media(max-width:389px)]:hidden"
          fill="#dde7e1"
          fontSize="7"
          letterSpacing="0.7"
        >
          NYC
        </text>
        <path d="M51.5 48H56" stroke="#dde7e1" strokeOpacity="0.8" strokeWidth="0.6" className="[@media(max-width:389px)]:hidden" />
      </g>

      <path d="M139.5 0V62" stroke="url(#header-map-edge)" strokeWidth="0.8" />
      <text
        x="137"
        y="26"
        textAnchor="end"
        className="font-mono"
        fill="#dde7e1"
        fontSize="7"
        letterSpacing="0.6"
      >
        WESTCHESTER
      </text>
    </svg>
  </div>
);
