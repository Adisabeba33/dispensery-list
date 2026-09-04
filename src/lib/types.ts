/** Mirrors data/schema/dispensary.schema.json. Keep the two in step. */

export type LicenseType =
  | 'ADULT_USE_RETAIL_DISPENSARY'
  | 'CAURD'
  | 'MICROBUSINESS'
  | 'REGISTERED_ORGANIZATION_ADULT_USE'
  | 'REGISTERED_ORGANIZATION_MEDICAL'
  | 'DELIVERY_ONLY'
  | 'ONSITE_CONSUMPTION';

export type LicenseStatus =
  | 'ACTIVE'
  | 'PROVISIONAL'
  | 'PENDING'
  | 'SUSPENDED'
  | 'EXPIRED'
  | 'SURRENDERED'
  | 'REVOKED';

export type OperationalStatus =
  | 'OPEN'
  | 'APPROVED_NOT_OPEN'
  | 'TEMPORARILY_CLOSED'
  | 'PERMANENTLY_CLOSED'
  | 'UNKNOWN';

export type VerificationStatus = 'VERIFIED_OFFICIAL' | 'VERIFIED_SECONDARY' | 'UNVERIFIED';

export type Borough = 'MANHATTAN' | 'BROOKLYN' | 'QUEENS' | 'BRONX' | 'STATEN_ISLAND';

export type County = 'New York' | 'Kings' | 'Queens' | 'Bronx' | 'Richmond' | 'Westchester';

export type SourceType =
  | 'OFFICIAL_REGISTRY'
  | 'REGULATOR_PAGE'
  | 'BUSINESS_WEBSITE'
  | 'MENU_PLATFORM'
  | 'PRESS'
  | 'MAPS';

export type Source = {
  url: string;
  label: string | null;
  type: SourceType;
  retrievedAt: string;
};

export type HourSlot = { open: string; close: string };
export type DayHours = HourSlot[] | 'CLOSED' | null;
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type Hours = {
  timezone: 'America/New_York';
  week: Record<Weekday, DayHours>;
  notes?: string | null;
};

/** null means "nobody checked", which the UI must show differently from "no". */
export type Tri = boolean | null;

export type Services = {
  inStorePurchase?: Tri;
  pickup?: Tri;
  curbside?: Tri;
  delivery?: Tri;
  deliveryZips?: string[] | null;
  adaAccessible?: Tri;
  onsiteConsumption?: Tri;
  servesMedical?: Tri;
  servesAdultUse?: Tri;
  acceptsDebit?: Tri;
  acceptsCredit?: Tri;
  cashOnly?: Tri;
  atmOnSite?: Tri;
  parking?: Tri;
};

export type Dispensary = {
  id: string;
  licenseNumber: string;
  applicationNumber: string | null;
  licenseType: LicenseType;
  licenseStatus: LicenseStatus;
  operationalStatus: OperationalStatus;
  seeCategory: string | null;
  legalName: string;
  dbaName: string | null;
  address: {
    line1: string;
    line2: string | null;
    city: string;
    county: County;
    borough: Borough | null;
    neighborhood: string | null;
    state: 'NY';
    zip: string;
  };
  geo: { lat: number; lng: number; precision: string; source: string } | null;
  contact: {
    phone: string | null;
    email: string | null;
    website: string | null;
    orderOnlineUrl: string | null;
    instagram: string | null;
  } | null;
  hours: Hours | null;
  services: Services | null;
  menu: { provider: string | null; menuUrl: string | null; menuIsPublic: boolean | null } | null;
  dates: {
    licenseIssued: string | null;
    licenseEffective: string | null;
    licenseExpiration: string | null;
    openedOn: string | null;
  } | null;
  sources: Source[];
  verification: {
    status: VerificationStatus;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    verifiedAt: string;
    checkedAgainstOcmTool: boolean | null;
    notes: string | null;
  };
  warnings: string[];
  lastUpdated: string;
};

export type Municipality = {
  id: string;
  name: string;
  kind: 'CITY' | 'TOWN' | 'VILLAGE' | 'BOROUGH';
  county: County;
  retailOptOut: boolean | null;
  onsiteConsumptionOptOut: boolean | null;
  optOutDate: string | null;
  notes: string | null;
  sources: Source[];
  lastUpdated: string;
};
