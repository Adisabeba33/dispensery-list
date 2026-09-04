import dispensariesRaw from '../../data/dispensaries.json';
import demoRaw from '../../data/dispensaries.demo.json';
import municipalitiesRaw from '../../data/municipalities.json';
import type { Borough, County, Dispensary, Municipality } from './types';

/**
 * The delivered dataset is data/dispensaries.json. Until the research agent
 * fills it, the site falls back to the demo seed — and says so on every page.
 * Silently showing demo records as if they were the real directory is the one
 * failure mode this project cannot afford.
 */
const delivered = dispensariesRaw as unknown as Dispensary[];
const demo = demoRaw as unknown as Dispensary[];

export const isDemoData = delivered.length === 0;
export const dispensaries: Dispensary[] = isDemoData ? demo : delivered;
export const municipalities = municipalitiesRaw as unknown as Municipality[];

export const COUNTY_LABEL: Record<County, string> = {
  'New York': 'Manhattan',
  Kings: 'Brooklyn',
  Queens: 'Queens',
  Bronx: 'The Bronx',
  Richmond: 'Staten Island',
  Westchester: 'Westchester',
};

export const BOROUGH_LABEL: Record<Borough, string> = {
  MANHATTAN: 'Manhattan',
  BROOKLYN: 'Brooklyn',
  QUEENS: 'Queens',
  BRONX: 'The Bronx',
  STATEN_ISLAND: 'Staten Island',
};

export const LICENSE_TYPE_LABEL: Record<string, string> = {
  ADULT_USE_RETAIL_DISPENSARY: 'Adult-use retail',
  CAURD: 'CAURD',
  MICROBUSINESS: 'Microbusiness',
  REGISTERED_ORGANIZATION_ADULT_USE: 'Registered org — adult-use',
  REGISTERED_ORGANIZATION_MEDICAL: 'Registered org — medical',
  DELIVERY_ONLY: 'Delivery only',
  ONSITE_CONSUMPTION: 'On-site consumption',
};

export const OPERATIONAL_LABEL: Record<string, string> = {
  OPEN: 'Open',
  APPROVED_NOT_OPEN: 'Licensed, not open yet',
  TEMPORARILY_CLOSED: 'Temporarily closed',
  PERMANENTLY_CLOSED: 'Closed',
  UNKNOWN: 'Status unconfirmed',
};

export const displayName = (d: Dispensary): string => d.dbaName ?? d.legalName;

/** Region a record belongs to in the navigation: a borough, or Westchester. */
export const regionOf = (d: Dispensary): string =>
  d.address.borough ? BOROUGH_LABEL[d.address.borough] : 'Westchester';

export const getDispensary = (id: string): Dispensary | undefined =>
  dispensaries.find((d) => d.id === id);

export const optedOutMunicipalities = (): Municipality[] =>
  municipalities
    .filter((m) => m.county === 'Westchester' && m.retailOptOut === true)
    .sort((a, b) => a.name.localeCompare(b.name));

export type Stats = {
  total: number;
  open: number;
  verifiedOfficial: number;
  regions: { name: string; count: number }[];
  lastUpdated: string | null;
};

export const stats = (): Stats => {
  const byRegion = new Map<string, number>();
  for (const d of dispensaries) {
    const key = regionOf(d);
    byRegion.set(key, (byRegion.get(key) ?? 0) + 1);
  }

  const dates = dispensaries.map((d) => d.lastUpdated).filter(Boolean).sort();

  return {
    total: dispensaries.length,
    open: dispensaries.filter((d) => d.operationalStatus === 'OPEN').length,
    verifiedOfficial: dispensaries.filter((d) => d.verification.status === 'VERIFIED_OFFICIAL').length,
    regions: [...byRegion.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    lastUpdated: dates.length > 0 ? dates[dates.length - 1] : null,
  };
};
