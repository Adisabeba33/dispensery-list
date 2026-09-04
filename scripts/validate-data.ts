/**
 * Validates the research deliverables against their JSON Schemas and against the
 * semantic rules in docs/AGENT_RESEARCH_BRIEF.md section 7.
 *
 * Schema validation alone is not enough here: the schema cannot express "an OPEN
 * shop must hold a live licence" or "a Westchester record must not claim a
 * borough". Those rules are what stop a plausible-looking record from reaching
 * the site, so they live here and run in CI.
 *
 * Usage: npm run validate
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv2020, { type ErrorObject } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const ROOT = resolve(import.meta.dirname, '..');

type Problem = { file: string; where: string; message: string };

const errors: Problem[] = [];
const warnings: Problem[] = [];

const fail = (file: string, where: string, message: string) =>
  errors.push({ file, where, message });
const warn = (file: string, where: string, message: string) =>
  warnings.push({ file, where, message });

const readJson = (relPath: string): unknown => {
  const abs = resolve(ROOT, relPath);
  if (!existsSync(abs)) return undefined;
  return JSON.parse(readFileSync(abs, 'utf8'));
};

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

/** Compiled validators are cached: ajv rejects re-registering the same $id. */
const compiledSchemas = new Map<string, ReturnType<typeof ajv.compile>>();
const compile = (schemaPath: string) => {
  const cached = compiledSchemas.get(schemaPath);
  if (cached) return cached;
  const fn = ajv.compile(readJson(schemaPath) as object);
  compiledSchemas.set(schemaPath, fn);
  return fn;
};

const formatAjvErrors = (file: string, index: number, errs: ErrorObject[] | null | undefined) => {
  for (const e of errs ?? []) {
    fail(file, `[${index}]${e.instancePath}`, `${e.message}${e.params && Object.keys(e.params).length ? ` (${JSON.stringify(e.params)})` : ''}`);
  }
};

// ---------------------------------------------------------------------------
// Reference data for the semantic rules
// ---------------------------------------------------------------------------

const NYC_COUNTIES = new Set(['New York', 'Kings', 'Queens', 'Bronx', 'Richmond']);

/** Borough each NYC county must declare, so the two can never drift apart. */
const COUNTY_TO_BOROUGH: Record<string, string> = {
  'New York': 'MANHATTAN',
  Kings: 'BROOKLYN',
  Queens: 'QUEENS',
  Bronx: 'BRONX',
  Richmond: 'STATEN_ISLAND',
};

const LIVE_LICENCE = new Set(['ACTIVE', 'PROVISIONAL']);
const DEAD_LICENCE = new Set(['REVOKED', 'SURRENDERED', 'EXPIRED']);
const TRADING_STATUS = new Set(['OPEN', 'APPROVED_NOT_OPEN']);

/**
 * ZIP prefixes. NYC uses 100xx-104xx and 110xx-119xx; Westchester uses
 * 105xx-108xx. A ZIP outside its county's range means the address was pasted
 * from the wrong row, which is exactly the failure this catches.
 */
const zipMatchesCounty = (zip: string, county: string): boolean => {
  const n = Number(zip.slice(0, 3));
  if (county === 'Westchester') return n >= 105 && n <= 108;
  if (NYC_COUNTIES.has(county)) return (n >= 100 && n <= 104) || (n >= 110 && n <= 119);
  return false;
};

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

// ---------------------------------------------------------------------------
// Dispensaries
// ---------------------------------------------------------------------------

/**
 * @param FILE            path to validate
 * @param requireRegistry whether a missing OFFICIAL_REGISTRY source is fatal.
 *                        The demo seed is openly secondary-sourced, so there it
 *                        is a warning; for the delivered dataset it is an error.
 */
const validateDispensaries = (FILE: string, requireRegistry: boolean) => {
  const raw = readJson(FILE);

  if (raw === undefined) {
    warn(FILE, '-', 'file not found — nothing to validate yet (expected before the research agent delivers)');
    return;
  }
  if (!Array.isArray(raw)) {
    fail(FILE, '-', 'top level must be an array of dispensary records');
    return;
  }

  const validate = compile('data/schema/dispensary.schema.json');

  const seenIds = new Map<string, number>();
  const seenLicences = new Map<string, number>();

  raw.forEach((record, i) => {
    if (!validate(record)) formatAjvErrors(FILE, i, validate.errors);

    // Anything below assumes the shape is roughly right; guard loosely so one
    // malformed record does not mask the rules for every other record.
    const r = record as Record<string, any>;
    const at = (field: string) => `[${i}] ${r.id ?? r.licenseNumber ?? 'unknown'} → ${field}`;

    // Rule 1 — uniqueness.
    if (typeof r.id === 'string') {
      const prev = seenIds.get(r.id);
      if (prev !== undefined) fail(FILE, at('id'), `duplicate id, also used by record [${prev}]`);
      else seenIds.set(r.id, i);
    }
    if (typeof r.licenseNumber === 'string') {
      const prev = seenLicences.get(r.licenseNumber);
      if (prev !== undefined) {
        fail(FILE, at('licenseNumber'), `duplicate licence ${r.licenseNumber}, also used by record [${prev}]. One licence is one location — a multi-store operator needs one record per store.`);
      } else seenLicences.set(r.licenseNumber, i);
    }

    const sources: any[] = Array.isArray(r.sources) ? r.sources : [];
    const hasRegistrySource = sources.some((s) => s?.type === 'OFFICIAL_REGISTRY');

    // Rule 2 — provenance.
    if (!hasRegistrySource) {
      const report = requireRegistry ? fail : warn;
      report(FILE, at('sources'), 'no source of type OFFICIAL_REGISTRY — every record must trace back to the state registry');
    }

    // Rule 8 — official verification needs an official source.
    if (r.verification?.status === 'VERIFIED_OFFICIAL' && !hasRegistrySource) {
      fail(FILE, at('verification.status'), 'VERIFIED_OFFICIAL requires an OFFICIAL_REGISTRY source');
    }

    // Rules 3 and 4 — licence status must support the trading status.
    if (r.operationalStatus === 'OPEN' && !LIVE_LICENCE.has(r.licenseStatus)) {
      fail(FILE, at('operationalStatus'), `OPEN is not allowed with licenseStatus ${r.licenseStatus} — an open shop must hold an ACTIVE or PROVISIONAL licence`);
    }
    if (DEAD_LICENCE.has(r.licenseStatus) && TRADING_STATUS.has(r.operationalStatus)) {
      fail(FILE, at('operationalStatus'), `licenseStatus ${r.licenseStatus} cannot be paired with operationalStatus ${r.operationalStatus}`);
    }

    // Rule 5 — borough must agree with county.
    const county = r.address?.county;
    const borough = r.address?.borough ?? null;
    if (typeof county === 'string') {
      if (NYC_COUNTIES.has(county)) {
        const expected = COUNTY_TO_BOROUGH[county];
        if (borough !== expected) {
          fail(FILE, at('address.borough'), `county ${county} requires borough ${expected}, got ${borough ?? 'null'}`);
        }
      } else if (borough !== null) {
        fail(FILE, at('address.borough'), `county ${county} must have borough null, got ${borough}`);
      }

      // Rule 6 — ZIP must sit inside the county.
      const zip = r.address?.zip;
      if (typeof zip === 'string' && !zipMatchesCounty(zip, county)) {
        fail(FILE, at('address.zip'), `ZIP ${zip} is outside the range for ${county} county`);
      }
    }

    // Rule 9 — opening hours must describe a real interval.
    const week = r.hours?.week;
    if (week && typeof week === 'object') {
      for (const [day, value] of Object.entries(week)) {
        if (!Array.isArray(value)) continue;
        value.forEach((slot: any, slotIndex: number) => {
          if (typeof slot?.open !== 'string' || typeof slot?.close !== 'string') return;
          const open = toMinutes(slot.open);
          const close = toMinutes(slot.close);
          // Equal times are always wrong; close < open is only meaningful as an
          // overnight interval, which we allow but flag so it gets a second look.
          if (close === open) {
            fail(FILE, at(`hours.week.${day}[${slotIndex}]`), `open and close are both ${slot.open}`);
          } else if (close < open) {
            warn(FILE, at(`hours.week.${day}[${slotIndex}]`), `${slot.open}–${slot.close} reads as an overnight interval — confirm that is intended`);
          }
        });
      }
    }

    // Rule 10 — an expired date under a live licence is suspicious, not fatal.
    const expiry = r.dates?.licenseExpiration;
    if (typeof expiry === 'string' && LIVE_LICENCE.has(r.licenseStatus)) {
      if (new Date(expiry).getTime() < Date.now()) {
        warn(FILE, at('dates.licenseExpiration'), `licence expired on ${expiry} but status is ${r.licenseStatus} — re-check the registry and explain in verification.notes`);
      }
    }

    // Honesty checks: unverified records should not be dressed up as solid.
    if (r.verification?.status === 'UNVERIFIED' && r.verification?.confidence === 'HIGH') {
      fail(FILE, at('verification'), 'UNVERIFIED cannot carry HIGH confidence');
    }
    if (r.operationalStatus === 'OPEN' && r.verification?.checkedAgainstOcmTool !== true) {
      warn(FILE, at('operationalStatus'), 'claimed OPEN without checkedAgainstOcmTool — confirm against cannabis.ny.gov/dispensary-location-verification');
    }
  });

  const total = raw.length;
  if (total > 0) {
    const official = raw.filter((r: any) => r?.verification?.status === 'VERIFIED_OFFICIAL').length;
    const share = official / total;
    // Acceptance criterion from the brief, section 10. It applies to the
    // delivered dataset; the demo seed is not held to it.
    if (requireRegistry && share < 0.95) {
      warn(FILE, '-', `only ${(share * 100).toFixed(1)}% of records are VERIFIED_OFFICIAL (acceptance threshold is 95%)`);
    }
  }
};

// ---------------------------------------------------------------------------
// Municipalities
// ---------------------------------------------------------------------------

const validateMunicipalities = () => {
  const FILE = 'data/municipalities.json';
  const raw = readJson(FILE);

  if (raw === undefined) {
    warn(FILE, '-', 'file not found — nothing to validate yet');
    return;
  }
  if (!Array.isArray(raw)) {
    fail(FILE, '-', 'top level must be an array of municipality records');
    return;
  }

  const validate = compile('data/schema/municipality.schema.json');

  const seen = new Map<string, number>();

  raw.forEach((record, i) => {
    if (!validate(record)) formatAjvErrors(FILE, i, validate.errors);
    const r = record as Record<string, any>;

    if (typeof r.id === 'string') {
      const prev = seen.get(r.id);
      if (prev !== undefined) fail(FILE, `[${i}] ${r.id}`, `duplicate id, also used by record [${prev}]`);
      else seen.set(r.id, i);
    }

    // A town and the village inside it are separate legal subjects with separate
    // opt-out decisions, so the same name may legitimately appear twice — but
    // only with different `kind` values.
    if (r.kind === 'BOROUGH' && r.county === 'Westchester') {
      fail(FILE, `[${i}] ${r.id}`, 'Westchester has no boroughs');
    }

    // The opt-out window closed on 31 December 2021; a later date is a data error.
    if (typeof r.optOutDate === 'string' && r.optOutDate > '2021-12-31') {
      fail(FILE, `[${i}] ${r.id}`, `optOutDate ${r.optOutDate} is after the 2021-12-31 statutory deadline`);
    }
  });
};

// ---------------------------------------------------------------------------

validateDispensaries('data/dispensaries.json', true);
validateDispensaries('data/dispensaries.demo.json', false);
validateMunicipalities();

const print = (label: string, items: Problem[]) => {
  if (items.length === 0) return;
  console.log(`\n${label} (${items.length}):`);
  for (const p of items) console.log(`  ${p.file}  ${p.where}\n    ${p.message}`);
};

print('WARNINGS', warnings);
print('ERRORS', errors);

if (errors.length > 0) {
  console.log(`\nFAILED — ${errors.length} error(s), ${warnings.length} warning(s).`);
  process.exit(1);
}

console.log(`\nPASSED — 0 errors, ${warnings.length} warning(s).`);
