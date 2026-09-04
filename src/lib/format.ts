import type { Dispensary, DayHours, Weekday } from './types';

export const WEEKDAYS: { key: Weekday; label: string }[] = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

/** 24h to 12h, because that is how opening hours are read in New York. */
export const prettyTime = (hhmm: string): string => {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h < 12 ? 'am' : 'pm';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour}${suffix}` : `${hour}:${String(m).padStart(2, '0')}${suffix}`;
};

export const prettyDay = (value: DayHours): string => {
  if (value === null) return 'Unknown';
  if (value === 'CLOSED') return 'Closed';
  return value.map((s) => `${prettyTime(s.open)} – ${prettyTime(s.close)}`).join(', ');
};

export const fullAddress = (d: Dispensary): string =>
  [d.address.line1, d.address.line2, `${d.address.city}, NY ${d.address.zip}`]
    .filter(Boolean)
    .join(', ');

/**
 * Directions link built from the address rather than coordinates: most records
 * have no verified geocode, and a maps search on a correct address beats a
 * pin dropped on a guessed one.
 */
export const mapsUrl = (d: Dispensary): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${d.address.line1}, ${d.address.city}, NY ${d.address.zip}`,
  )}`;

export const prettyPhone = (phone: string | null): string | null =>
  phone ? phone.replace(/^\+1-/, '').replace(/-/g, ' ') : null;

export const prettyDate = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

/** Service flags worth surfacing, in the order a shopper cares about them. */
export const SERVICE_LABELS: { key: keyof NonNullable<Dispensary['services']>; label: string }[] = [
  { key: 'inStorePurchase', label: 'In-store' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'pickup', label: 'Pickup' },
  { key: 'curbside', label: 'Curbside' },
  { key: 'servesMedical', label: 'Medical' },
  { key: 'onsiteConsumption', label: 'On-site use' },
  { key: 'adaAccessible', label: 'Accessible' },
  { key: 'acceptsDebit', label: 'Debit' },
  { key: 'atmOnSite', label: 'ATM' },
  { key: 'parking', label: 'Parking' },
];
