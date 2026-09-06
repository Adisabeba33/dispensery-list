/**
 * Distance, and turning a ZIP code into a point.
 *
 * Deliberately free of any data import. The nearby search runs in the browser,
 * and a client component that reaches for the register through this module
 * would pull the whole dataset into the bundle — which has already happened
 * once here, to the shelf file.
 */
import centroidFile from '../../data/zip-centroids.json';

type Point = { lat: number; lng: number };

const published = ((centroidFile as { centroids: Record<string, number[]> }).centroids ??
  {}) as Record<string, number[]>;

export const publishedCentroidCount = Object.keys(published).length;

/** The ZIPs of the five boroughs and Westchester, and nothing else. */
const SCOPE = new Set([100, 101, 102, 103, 104, 105, 106, 107, 108, 110, 111, 112, 113, 114, 116]);

export const zipInScope = (zip: string): boolean => {
  if (!/^\d{5}$/.test(zip)) return false;
  // 11004 and 11005 are the Queens corner of Glen Oaks and Floral Park.
  if (zip === '11004' || zip === '11005') return true;
  return SCOPE.has(Number(zip.slice(0, 3)));
};

/**
 * ZIP centres, published first.
 *
 * The Census gazetteer covers every ZIP in scope, including the ones with no
 * dispensary in them — which is where the question gets asked from. Until the
 * weekly refresh has fetched it, the centre of the shops we hold in a ZIP
 * stands in: thinner coverage, correct where it applies, and it means the
 * feature is never dark.
 */
export const buildZipCentroids = (
  shops: { address: { zip: string }; geo: { lat: number; lng: number } | null }[],
): Record<string, [number, number]> => {
  const sums: Record<string, [number, number, number]> = {};
  for (const s of shops) {
    if (!s.geo) continue;
    const acc = sums[s.address.zip] ?? [0, 0, 0];
    sums[s.address.zip] = [acc[0] + s.geo.lat, acc[1] + s.geo.lng, acc[2] + 1];
  }
  const out: Record<string, [number, number]> = {};
  for (const [zip, [lat, lng, n]] of Object.entries(sums)) {
    out[zip] = [Math.round((lat / n) * 1e5) / 1e5, Math.round((lng / n) * 1e5) / 1e5];
  }
  for (const [zip, point] of Object.entries(published)) {
    if (point.length === 2) out[zip] = [point[0], point[1]];
  }
  return out;
};

/**
 * Great-circle distance in kilometres — a straight line, not a route. A shop
 * half a mile away across a river is not half a mile away, and the interface
 * says "straight line" rather than implying a walk.
 */
export const distanceKm = (a: Point, b: Point): number => {
  const R = 6371;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(rad(a.lat)) * Math.cos(rad(b.lat));
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** Miles, because that is what a New Yorker asks for. */
export const prettyDistance = (km: number): string => {
  const miles = km * 0.621371;
  if (miles < 0.1) return '< 0.1 mi';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
};
