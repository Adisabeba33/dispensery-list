import type { ComponentType, ReactNode } from 'react';
import clsx from 'clsx';

/*
 * The directory's chip icons: one drawing per area, in outline, at the height
 * of a line of chip text. Each keeps its own proportions — a bridge is wider
 * than a tower — so the width follows the drawing rather than a square box.
 * All decorative: the chip's words name the area.
 */

const Outline = ({
  width = 24,
  className,
  children,
}: {
  /** The drawing's width in a 24-high box. */
  width?: number;
  className?: string;
  children: ReactNode;
}) => (
  <svg
    viewBox={`0 0 ${width} 24`}
    width={width}
    height={24}
    aria-hidden
    focusable="false"
    className={clsx('h-[0.9375rem] w-auto shrink-0', className)}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

/** All areas: a globe in the crosshairs — everywhere the register covers. */
export const AllAreasIcon = ({ className }: { className?: string }) => (
  <Outline className={className}>
    <circle cx="12" cy="12" r="8.75" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1.5v6M12 16.5v6M1.5 12h6M16.5 12h6" />
  </Outline>
);

const Tower = () => (
  <Outline width={18}>
    <path d="M4 21.5V6h10v15.5M6.5 6V3.5h5V6M9 3.5V1.75M2.5 21.5h13" />
    <path d="M7 9.5h.01M11 9.5h.01M7 13h.01M11 13h.01M7 16.5h.01M11 16.5h.01" strokeWidth="2.2" />
    <path d="M7.75 21.5v-2.75h2.5v2.5" />
  </Outline>
);

const Bridge = () => (
  <Outline width={32}>
    <path d="M1.5 16h29M8 21.5V4M11.5 21.5V4M8 4h3.5M20.5 21.5V4M24 21.5V4M20.5 4H24" />
    <path d="M1.5 14.5C4.5 13 6.75 9.5 8 4.5M11.5 4.5c2 6.5 7 6.5 9 0M24 4.5c1.25 5 3.5 8.5 6.5 10M16 16v-5.25" />
  </Outline>
);

/** The Unisphere is the shape Queens is known by; drawn here as its globe. */
const Globe = () => (
  <Outline>
    <circle cx="12" cy="12" r="9.25" />
    <ellipse cx="12" cy="12" rx="4" ry="9.25" />
    <path d="M2.75 12h18.5M4.25 7.25h15.5M4.25 16.75h15.5" />
  </Outline>
);

const SubwayCar = () => (
  <Outline width={20}>
    <rect x="3.5" y="2.5" width="13" height="15.5" rx="3" />
    <path d="M3.5 10.5h13M7.5 5.25h5" />
    <path d="M7 14.25h.01M13 14.25h.01" strokeWidth="2.4" />
    <path d="M6.5 18 4.5 21.75M13.5 18l2 3.75" />
  </Outline>
);

const Ferry = () => (
  <Outline width={30}>
    <path d="M3 14.5h24l-2.75 4.5H5.75z" />
    <path d="M7 14.5v-3.25h16v3.25M10 11.25V8.5h10v2.75M13.5 8.5V5.5h3v3" />
    <path d="M10.5 16.75h.01M15 16.75h.01M19.5 16.75h.01" strokeWidth="2" />
    <path d="M2.5 22c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1 2 1 4 1 2-1 3-1" />
  </Outline>
);

const Mountains = () => (
  <Outline width={30}>
    <path d="M1.75 20.5 9.5 9.25l3.75 5.25M9.75 20.5 18.5 4l9.25 16.5z" />
    <path d="M1.75 20.5h8M15.75 9.25l2.75 2 2.75-2" />
  </Outline>
);

const BY_AREA: Record<string, ComponentType> = {
  Manhattan: Tower,
  Brooklyn: Bridge,
  Queens: Globe,
  'The Bronx': SubwayCar,
  'Staten Island': Ferry,
  Westchester: Mountains,
};

/** The drawing for one area of the directory, or nothing for an area without one. */
export const AreaIcon = ({ area }: { area: string }) => {
  const Drawing = BY_AREA[area];
  return Drawing ? <Drawing /> : null;
};

/**
 * Shelf read: three rising bars, filled, in the accent whether or not the
 * chip is pressed — it is the colour of a read shelf everywhere on the site.
 */
export const ShelfBarsIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 16 16"
    aria-hidden
    focusable="false"
    className={clsx('h-[0.9375rem] w-[0.9375rem] shrink-0 text-moss-400', className)}
    fill="currentColor"
  >
    <rect x="1.5" y="9" width="3.25" height="6" rx="0.5" />
    <rect x="6.375" y="5.5" width="3.25" height="9.5" rx="0.5" />
    <rect x="11.25" y="1.5" width="3.25" height="13.5" rx="0.5" />
  </svg>
);
