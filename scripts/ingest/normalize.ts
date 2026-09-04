/**
 * Maps raw registry rows onto the published schema.
 *
 * Everything the registry does not state is left null. The site renders null as
 * "not verified", which is the honest outcome — a false `false` would tell a
 * reader that a shop does not deliver when nobody ever checked.
 */
import type { LogicalField, SocrataRow } from './sources/ny-ocm-socrata.js';

export type FieldMap = Partial<Record<LogicalField, string>>;

const NYC_COUNTY_TO_BOROUGH: Record<string, string> = {
  'new york': 'MANHATTAN',
  kings: 'BROOKLYN',
  queens: 'QUEENS',
  bronx: 'BRONX',
  richmond: 'STATEN_ISLAND',
};

const CANONICAL_COUNTY: Record<string, string> = {
  'new york': 'New York',
  manhattan: 'New York',
  kings: 'Kings',
  brooklyn: 'Kings',
  queens: 'Queens',
  bronx: 'Bronx',
  richmond: 'Richmond',
  'staten island': 'Richmond',
  westchester: 'Westchester',
};

export const read = (row: SocrataRow, map: FieldMap, field: LogicalField): string | null => {
  const column = map[field];
  if (!column) return null;
  const value = row[column];
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
};

export const canonicalCounty = (raw: string | null): string | null =>
  raw ? (CANONICAL_COUNTY[raw.toLowerCase().replace(/\s+county$/, '').trim()] ?? null) : null;

export const boroughFor = (county: string | null): string | null =>
  county ? (NYC_COUNTY_TO_BOROUGH[county.toLowerCase()] ?? null) : null;

/** Maps the registry's prose licence type onto our enum. */
export const licenseTypeFor = (raw: string | null): string | null => {
  if (!raw) return null;
  const t = raw.toLowerCase();
  if (t.includes('caurd') || t.includes('conditional adult-use retail')) return 'CAURD';
  if (t.includes('microbusiness')) return 'MICROBUSINESS';
  if (t.includes('registered organization')) {
    return t.includes('adult') ? 'REGISTERED_ORGANIZATION_ADULT_USE' : 'REGISTERED_ORGANIZATION_MEDICAL';
  }
  if (t.includes('delivery')) return 'DELIVERY_ONLY';
  if (t.includes('consumption')) return 'ONSITE_CONSUMPTION';
  if (t.includes('retail dispensary') || t.includes('dispensing')) return 'ADULT_USE_RETAIL_DISPENSARY';
  return null;
};

export const licenseStatusFor = (raw: string | null): string | null => {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes('revoked')) return 'REVOKED';
  if (s.includes('surrender')) return 'SURRENDERED';
  if (s.includes('suspend')) return 'SUSPENDED';
  if (s.includes('expired')) return 'EXPIRED';
  if (s.includes('provisional')) return 'PROVISIONAL';
  if (s.includes('pending')) return 'PENDING';
  if (s.includes('active')) return 'ACTIVE';
  return null;
};

/**
 * The registry says whether a licence is live. It does not reliably say whether
 * the doors are open, so this never returns OPEN — that claim is only made after
 * a human or agent checks the OCM verification tool, per the research brief.
 */
export const operationalStatusFor = (rawOperational: string | null, licenseStatus: string | null): string => {
  const o = rawOperational?.toLowerCase() ?? '';
  if (o.includes('permanently closed')) return 'PERMANENTLY_CLOSED';
  if (o.includes('temporarily closed')) return 'TEMPORARILY_CLOSED';
  if (licenseStatus === 'REVOKED' || licenseStatus === 'SURRENDERED') return 'PERMANENTLY_CLOSED';
  return 'UNKNOWN';
};

export const slugify = (...parts: (string | null)[]): string =>
  parts
    .filter((p): p is string => Boolean(p))
    .join(' ')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');

/** Registry dates arrive in several shapes; anything unparseable becomes null. */
export const isoDate = (raw: string | null): string | null => {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

export const normalizeZip = (raw: string | null): string | null => {
  if (!raw) return null;
  const m = raw.match(/\b(\d{5})\b/);
  return m ? m[1] : null;
};

export type NormalizeContext = {
  map: FieldMap;
  retrievedAt: string;
  sourceUrl: string;
};

export const toDispensary = (row: SocrataRow, ctx: NormalizeContext) => {
  const { map, retrievedAt, sourceUrl } = ctx;

  const licenseNumber = read(row, map, 'licenseNumber');
  const entityName = read(row, map, 'entityName');
  const dba = read(row, map, 'dba');
  const county = canonicalCounty(read(row, map, 'county'));
  const city = read(row, map, 'city');
  const zip = normalizeZip(read(row, map, 'zip'));
  const licenseStatus = licenseStatusFor(read(row, map, 'licenseStatus'));

  return {
    id: slugify(dba ?? entityName, city),
    licenseNumber,
    applicationNumber: read(row, map, 'applicationNumber'),
    licenseType: licenseTypeFor(read(row, map, 'licenseType')),
    licenseStatus,
    operationalStatus: operationalStatusFor(read(row, map, 'operationalStatus'), licenseStatus),
    seeCategory: null,
    legalName: entityName,
    dbaName: dba,
    address: {
      line1: read(row, map, 'addressLine1'),
      line2: read(row, map, 'addressLine2'),
      city,
      county,
      borough: boroughFor(county),
      neighborhood: null,
      state: 'NY',
      zip,
    },
    // Everything below needs work the registry cannot do for us. It stays null
    // until the enrichment pass in the research brief fills it in.
    geo: null,
    contact: {
      phone: null,
      email: null,
      website: read(row, map, 'website'),
      orderOnlineUrl: null,
      instagram: null,
    },
    hours: null,
    services: null,
    menu: null,
    dates: {
      licenseIssued: isoDate(read(row, map, 'issuedDate')),
      licenseEffective: isoDate(read(row, map, 'effectiveDate')),
      licenseExpiration: isoDate(read(row, map, 'expirationDate')),
      openedOn: null,
    },
    sources: [
      {
        url: sourceUrl,
        label: 'NYS Office of Cannabis Management — Current OCM Licenses',
        type: 'OFFICIAL_REGISTRY',
        retrievedAt,
      },
    ],
    verification: {
      status: 'VERIFIED_OFFICIAL',
      confidence: 'LOW',
      verifiedAt: retrievedAt,
      checkedAgainstOcmTool: null,
      notes: 'Imported from the state registry. Contact details, hours and services are not yet enriched.',
    },
    warnings: [],
    lastUpdated: retrievedAt,
  };
};
