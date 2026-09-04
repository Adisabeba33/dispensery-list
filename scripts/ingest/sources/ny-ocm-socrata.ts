/**
 * Source adapter: New York State Office of Cannabis Management licence registry.
 *
 * Dataset "Current OCM Licenses" on Open Data NY, resource id jskf-tt3q.
 *   page:  https://data.ny.gov/Economic-Development/Current-OCM-Licenses/jskf-tt3q
 *   SODA:  https://data.ny.gov/resource/jskf-tt3q.json
 *
 * The exact snake_case column names Socrata exposes were not verifiable from the
 * environment this adapter was written in, and Socrata renames columns when a
 * publisher edits a dataset. So nothing here hard-codes a column name: each
 * field lists candidate names, `pickField` resolves them against the real
 * payload, and a failed resolution prints the actual column list instead of
 * silently producing records full of nulls.
 */

export const DATASET_ID = 'jskf-tt3q';
export const SODA_ENDPOINT = `https://data.ny.gov/resource/${DATASET_ID}.json`;

export type SocrataRow = Record<string, unknown>;

/** Candidate column names per logical field, most likely first. */
export const FIELD_CANDIDATES = {
  licenseNumber: ['license_number', 'licensenumber', 'license', 'license_no'],
  applicationNumber: ['application_number', 'applicationnumber', 'app_number'],
  licenseType: ['license_type', 'licensetype', 'type'],
  licenseStatus: ['license_status', 'licensestatus', 'status', 'license_status_code'],
  entityName: ['entity_name', 'entityname', 'legal_name', 'business_name', 'name'],
  dba: ['dba', 'business_dba', 'dba_name', 'trade_name'],
  addressLine1: ['address_line_1', 'address1', 'address', 'premises_address', 'street_address'],
  addressLine2: ['address_line_2', 'address2'],
  city: ['city', 'premises_city'],
  county: ['county', 'premises_county'],
  state: ['state', 'premises_state'],
  zip: ['zip_code', 'zip', 'zipcode', 'postal_code'],
  region: ['region'],
  website: ['business_website', 'website', 'url'],
  operationalStatus: ['operational_status', 'operationalstatus', 'operating_status'],
  seeCategory: ['see_category', 'seecategory', 'equity_category'],
  issuedDate: ['issued_date', 'issue_date', 'date_issued'],
  effectiveDate: ['effective_date', 'license_effective_date'],
  expirationDate: ['expiration_date', 'expiry_date', 'license_expiration_date'],
  hours: ['hours_of_operation', 'hours', 'business_hours'],
} as const;

export type LogicalField = keyof typeof FIELD_CANDIDATES;

/** Resolves each logical field to a real column, using the keys actually present. */
export const resolveFieldMap = (
  sampleRow: SocrataRow,
): { map: Partial<Record<LogicalField, string>>; unresolved: LogicalField[] } => {
  const present = new Set(Object.keys(sampleRow).map((k) => k.toLowerCase()));
  const map: Partial<Record<LogicalField, string>> = {};
  const unresolved: LogicalField[] = [];

  for (const [logical, candidates] of Object.entries(FIELD_CANDIDATES) as [
    LogicalField,
    readonly string[],
  ][]) {
    const hit = candidates.find((c) => present.has(c));
    if (hit) map[logical] = hit;
    else unresolved.push(logical);
  }

  return { map, unresolved };
};

/**
 * Fields without which a row cannot become a record at all. If any of these are
 * unresolved the run must stop — everything downstream would be guesswork.
 */
export const REQUIRED_FIELDS: LogicalField[] = [
  'licenseNumber',
  'licenseType',
  'licenseStatus',
  'entityName',
  'city',
  'county',
  'zip',
];

/** Counties in phase 1 scope. */
export const SCOPE_COUNTIES = ['New York', 'Kings', 'Queens', 'Bronx', 'Richmond', 'Westchester'];

/**
 * Retail licence types we publish. Matching is done on a lowercased substring
 * because the registry spells these out in prose ("Adult-Use Retail Dispensary
 * License") rather than as codes.
 */
export const RETAIL_TYPE_PATTERNS = [
  'retail dispensary',
  'caurd',
  'conditional adult-use retail',
  'microbusiness',
  'registered organization',
  'dispensing',
];

/** Paged fetch of the whole dataset. Socrata caps a page at 1000 rows. */
export const fetchAll = async (
  endpoint: string = SODA_ENDPOINT,
  appToken?: string,
): Promise<SocrataRow[]> => {
  const PAGE = 1000;
  const rows: SocrataRow[] = [];

  for (let offset = 0; ; offset += PAGE) {
    const url = `${endpoint}?$limit=${PAGE}&$offset=${offset}&$order=:id`;
    const res = await fetch(url, {
      headers: appToken ? { 'X-App-Token': appToken } : undefined,
    });

    if (!res.ok) {
      throw new Error(
        `Socrata responded ${res.status} ${res.statusText} for ${url}. ` +
          (res.status === 429
            ? 'Rate limited — register an app token at data.ny.gov and pass it as NY_APP_TOKEN.'
            : 'Check that the dataset id is still jskf-tt3q.'),
      );
    }

    const page = (await res.json()) as SocrataRow[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }

  return rows;
};
