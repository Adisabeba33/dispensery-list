/**
 * Pulls the New York licence registry and writes data/dispensaries.json.
 *
 *   npm run ingest           fetch, normalize, write
 *   npm run ingest:dry       fetch and report, write nothing
 *
 * Environment:
 *   NY_APP_TOKEN   optional Socrata app token; without it the portal rate-limits
 *
 * This produces the registry skeleton only. Phone numbers, hours, geocodes,
 * services and menu platforms are not in the registry — they come from the
 * enrichment pass described in docs/AGENT_RESEARCH_BRIEF.md. Re-running ingest
 * preserves those enriched fields for licences that already exist in the file.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  SODA_ENDPOINT,
  REQUIRED_FIELDS,
  RETAIL_TYPE_PATTERNS,
  SCOPE_COUNTIES,
  fetchAll,
  resolveFieldMap,
  type SocrataRow,
} from './sources/ny-ocm-socrata.js';
import { canonicalCounty, read, toDispensary } from './normalize.js';

const ROOT = resolve(import.meta.dirname, '..', '..');
const OUT = resolve(ROOT, 'data/dispensaries.json');
const RAW_DIR = resolve(ROOT, 'data/raw');

const dryRun = process.argv.includes('--dry-run');
const today = new Date().toISOString().slice(0, 10);
const retrievedAt = new Date().toISOString();

const main = async () => {
  console.log(`Fetching ${SODA_ENDPOINT} ...`);
  const rows = await fetchAll(SODA_ENDPOINT, process.env.NY_APP_TOKEN);
  console.log(`  ${rows.length} rows`);

  if (rows.length === 0) throw new Error('Registry returned no rows — refusing to overwrite existing data.');

  // Resolve logical fields against the columns actually present. This is the
  // step that catches a dataset the publisher has reshaped since we last ran.
  const { map, unresolved } = resolveFieldMap(rows[0]);
  const missingRequired = unresolved.filter((f) => REQUIRED_FIELDS.includes(f));

  if (missingRequired.length > 0) {
    console.error('\nCould not resolve required columns:', missingRequired.join(', '));
    console.error('\nColumns actually present in the dataset:');
    for (const key of Object.keys(rows[0]).sort()) console.error(`  ${key}`);
    console.error('\nAdd the real names to FIELD_CANDIDATES in scripts/ingest/sources/ny-ocm-socrata.ts.');
    process.exit(1);
  }

  if (unresolved.length > 0) {
    console.log(`  optional columns not found (left null): ${unresolved.join(', ')}`);
  }

  mkdirSync(RAW_DIR, { recursive: true });
  const rawPath = resolve(RAW_DIR, `ocm-licenses-${today}.json`);
  if (!dryRun) {
    writeFileSync(rawPath, JSON.stringify(rows, null, 2));
    console.log(`  raw snapshot → ${rawPath}`);
  }

  // Filter to retail licences inside the phase 1 counties.
  const inScope = rows.filter((row: SocrataRow) => {
    const county = canonicalCounty(read(row, map, 'county'));
    if (!county || !SCOPE_COUNTIES.includes(county)) return false;

    const type = read(row, map, 'licenseType')?.toLowerCase() ?? '';
    if (!RETAIL_TYPE_PATTERNS.some((p) => type.includes(p))) return false;

    // The dataset mixes licensees with proximity-protection applicants. An
    // applicant has no licence number, so that is what separates them.
    return Boolean(read(row, map, 'licenseNumber'));
  });

  console.log(`  ${inScope.length} retail licences in scope`);

  const records = inScope.map((row) => toDispensary(row, { map, retrievedAt, sourceUrl: SODA_ENDPOINT }));

  // Carry forward enrichment already present for the same licence, so a re-run
  // refreshes registry facts without discarding hand-collected detail.
  if (existsSync(OUT)) {
    const previous = JSON.parse(readFileSync(OUT, 'utf8')) as Record<string, any>[];
    const byLicence = new Map(previous.map((p) => [p.licenseNumber, p]));
    let carried = 0;

    for (const record of records) {
      const old = byLicence.get(record.licenseNumber);
      if (!old) continue;
      carried += 1;
      record.id = old.id ?? record.id; // slugs are permanent once published
      record.geo = old.geo ?? record.geo;
      record.hours = old.hours ?? record.hours;
      record.services = old.services ?? record.services;
      record.menu = old.menu ?? record.menu;
      record.seeCategory = old.seeCategory ?? record.seeCategory;
      record.contact = { ...record.contact, ...(old.contact ?? {}) };
      record.address.neighborhood = old.address?.neighborhood ?? null;
      if (old.dates?.openedOn) record.dates.openedOn = old.dates.openedOn;
      // The registry cannot confirm a shop is trading; only the earlier check can.
      if (old.operationalStatus && old.operationalStatus !== 'UNKNOWN') {
        record.operationalStatus = old.operationalStatus;
      }
      if (old.verification) {
        record.verification = { ...record.verification, ...old.verification, verifiedAt: retrievedAt };
      }
    }
    console.log(`  carried enrichment forward for ${carried} licence(s)`);
  }

  const byCounty = records.reduce<Record<string, number>>((acc, r) => {
    const key = r.address.county ?? 'unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  console.log('\nBy county:');
  for (const [county, n] of Object.entries(byCounty).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${county.padEnd(12)} ${n}`);
  }

  if (dryRun) {
    console.log('\nDry run — nothing written.');
    return;
  }

  records.sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(OUT, `${JSON.stringify(records, null, 2)}\n`);
  console.log(`\nWrote ${records.length} records → ${OUT}`);
  console.log('Next: npm run validate');
};

main().catch((err) => {
  console.error(`\nIngest failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
