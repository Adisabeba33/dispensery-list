/**
 * Massachusetts — the Cannabis Control Commission's open data.
 *
 * The first source outside New York, and the first thing the second-state
 * trial measured: none of ny-ocm-socrata.ts carries over. The Commission ran a
 * Socrata portal once (opendata.mass-cannabis-control.com); by October 2026 it
 * no longer completes a TLS handshake, and the same datasets are published as
 * plain files under masscannabiscontrol.com/resource/. There is no query API,
 * no paging and no app token — one GET returns every licence in the state.
 *
 * Two files are read:
 *
 *   l_licenses_all_details_public.json   every licence, every type. The register.
 *   wp-content/themes/enfold-child/dispensaries.js
 *                                        the Commission's own "Where to Buy"
 *                                        store locator. Trading names, phones
 *                                        and websites — which the register does
 *                                        not carry at all — for about a quarter
 *                                        of the shops, and no licence number.
 *
 * Both begin with a UTF-8 byte-order mark, which JSON.parse refuses.
 */

export const REGISTRY_URL = 'https://masscannabiscontrol.com/resource/l_licenses_all_details_public.json';
export const REGISTRY_LABEL = 'Massachusetts Cannabis Control Commission — Licenses, all details (open data)';
export const LOCATOR_URL = 'https://masscannabiscontrol.com/wp-content/themes/enfold-child/dispensaries.js';
/** Where a reader can see the locator, as opposed to the script behind it. */
export const LOCATOR_PAGE = 'https://masscannabiscontrol.com/where-to-buy/';
export const LOCATOR_LABEL = 'Massachusetts Cannabis Control Commission — Where to Buy (store locator)';

export type CccRow = Record<string, string>;

export type LocatorEntry = {
  id: number;
  title: string;
  address: string;
  town: string;
  zip: string;
  state: string;
  phone: string;
  use: string;
  website: string;
  coordinates: [string, string];
};

/**
 * The register's columns this adapter reads. They are checked by name before
 * anything is written, and a missing one stops the run with the real column
 * list — the same posture as the New York adapter, for the same reason: a
 * reshaped dataset must fail out loud rather than turn into a file of nulls.
 */
export const REQUIRED_COLUMNS = [
  'LICENSE_NUMBER',
  'LICENSE_TYPE',
  'LICENSE_STATUS',
  'BUSINESS_NAME',
  'ESTABLISHMENT_ADDRESS_1',
  'ESTABLISHMENT_CITY',
  'ESTABLISHMENT_ZIP',
  'ESTABLISHMENT_COUNTY',
  'COMMENCE_OPERATIONS_DATE',
] as const;

/**
 * Retail is one licence type here, not five.
 *
 * Left out on purpose:
 * - Medical Marijuana Treatment Centers serve registered patients only. A
 *   treatment centre that also sells to adults holds a separate Marijuana
 *   Retailer licence for it, which IS read — so counting both would publish one
 *   door twice.
 * - Microbusinesses here are cultivators and manufacturers, not shops.
 * - Delivery operators and couriers have no door to send anybody to.
 */
export const RETAIL_TYPES = new Set(['Marijuana Retailer']);

const stripBom = (text: string): string => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);

export const parseRegistry = (text: string): CccRow[] => {
  const rows = JSON.parse(stripBom(text)) as unknown;
  if (!Array.isArray(rows)) throw new Error('Registry file is not an array of rows.');
  return rows as CccRow[];
};

/**
 * The locator is a script, `const dispensaries = [...]`, and its array literal
 * is cut out and parsed as data — never evaluated. It is nearly JSON, but not
 * quite: one shop is titled "b\well", an escape JavaScript reads as a plain
 * "w" and JSON refuses. A backslash that starts no JSON escape is dropped,
 * which is exactly what a browser does with it.
 */
export const parseLocator = (text: string): LocatorEntry[] => {
  const body = stripBom(text);
  const start = body.indexOf('[');
  const end = body.lastIndexOf(']');
  if (start === -1 || end <= start) throw new Error('Store locator script holds no array.');
  return JSON.parse(body.slice(start, end + 1).replace(/\\(?!["\\/bfnrtu])/g, '')) as LocatorEntry[];
};

export const fetchText = async (url: string): Promise<string> => {
  const res = await fetch(url, { headers: { Accept: 'application/json, text/javascript, */*' } });
  if (!res.ok) throw new Error(`${url} answered ${res.status} ${res.statusText}`);
  return res.text();
};
