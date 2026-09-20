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
import { dirname, resolve } from 'node:path';
import {
  SODA_ENDPOINT,
  REQUIRED_FIELDS,
  RETAIL_TYPE_PATTERNS,
  fetchAll,
  resolveFieldMap,
  type SocrataRow,
} from './sources/ny-ocm-socrata.js';
import { canonicalCounty, read, toDispensary } from './normalize.js';
import { dataPath, inTerritory, territoryFromArgv } from './territory.js';

const ROOT = resolve(import.meta.dirname, '..', '..');
// Which of the three territories this run is for. Absent means nyc, whose
// dataDir is `data` — i.e. the exact path this script always wrote to.
const territory = territoryFromArgv();
const OUT = dataPath(territory, 'dispensaries.json');
const RAW_DIR = resolve(ROOT, 'data/raw');

const dryRun = process.argv.includes('--dry-run');
// --from-raw <path> rebuilds from a snapshot already on disk instead of
// calling the portal. The snapshots in data/raw are the provenance for every
// record, so a territory can be cut from one without a network round trip —
// and two territories cut from the SAME snapshot are exactly comparable.
const fromRawAt = process.argv.indexOf('--from-raw');
const fromRaw = fromRawAt === -1 ? null : process.argv[fromRawAt + 1];
const today = new Date().toISOString().slice(0, 10);
const retrievedAt = new Date().toISOString();

const main = async () => {
  console.log(`Territory: ${territory.label} → ${territory.dataDir}/dispensaries.json`);
  let rows: SocrataRow[];
  if (fromRaw) {
    const at = resolve(ROOT, fromRaw);
    console.log(`Reading snapshot ${at} ...`);
    rows = JSON.parse(readFileSync(at, 'utf8')) as SocrataRow[];
  } else {
    console.log(`Fetching ${SODA_ENDPOINT} ...`);
    rows = await fetchAll(SODA_ENDPOINT, process.env.NY_APP_TOKEN);
  }
  console.log(`  ${rows.length} rows`);

  if (rows.length === 0) throw new Error('Registry returned no rows — refusing to overwrite existing data.');

  // Resolve logical fields against the columns actually present. This is the
  // step that catches a dataset the publisher has reshaped since we last ran.
  const { map, unresolved } = resolveFieldMap(rows);
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
  if (!dryRun && !fromRaw) {
    writeFileSync(rawPath, JSON.stringify(rows, null, 2));
    console.log(`  raw snapshot → ${rawPath}`);
  }

  // Filter to retail licences inside this territory.
  const inScope = rows.filter((row: SocrataRow) => {
    const county = canonicalCounty(read(row, map, 'county'));
    if (!inTerritory(territory, county)) return false;

    const type = read(row, map, 'licenseType')?.toLowerCase() ?? '';
    if (!RETAIL_TYPE_PATTERNS.some((p) => type.includes(p))) return false;

    // The dataset mixes licensees with proximity-protection applicants. An
    // applicant has no licence number, so that is what separates them.
    return Boolean(read(row, map, 'licenseNumber'));
  });

  /* The state publishes some shops TWICE.
   *
   * The same licence appears under two location_id values with two spellings
   * of one address — "43005 State Route 28" and "43005 NY-28" are the same
   * door in Arkville. That is not a multi-store operator, and treating it as
   * one would put a shop in the register that does not exist.
   *
   * It is not a new problem, only a newly visible one: ten licences in the
   * original six counties, and 104 upstate, where the scale finally made the
   * register's own rule — one licence is one location — fail out loud.
   *
   * Keeps the first row for each licence, preferring the one with the fuller
   * address, so the choice is deterministic rather than feed-order luck. */
  const byLicence = new Map<string, SocrataRow>();
  let duplicates = 0;
  for (const row of inScope) {
    const licence = read(row, map, 'licenseNumber')!;
    const seen = byLicence.get(licence);
    if (!seen) {
      byLicence.set(licence, row);
      continue;
    }
    duplicates += 1;
    const detail = (r: SocrataRow) =>
      [read(r, map, 'addressLine1'), read(r, map, 'city'), read(r, map, 'zip')]
        .filter(Boolean)
        .join(' ').length;
    if (detail(row) > detail(seen)) byLicence.set(licence, row);
  }
  /* A licence with no premises address is not a shop anyone can visit.
   *
   * The registry publishes 152 upstate microbusinesses with no address line at
   * all — every one of them operational status UNKNOWN — against zero in the
   * original six counties. They are real licences and the state is right to
   * list them; a directory whose whole job is to send somebody to a licensed
   * door is not, because there is no door on file.
   *
   * Dropped rather than published with a null address, and COUNTED, so the gap
   * is visible in the run instead of quietly shrinking the register. */
  const withAddress = [...byLicence.values()].filter(
    (row) => read(row, map, 'addressLine1') !== null,
  );
  const addressless = byLicence.size - withAddress.length;
  const deduped = withAddress;

  console.log(`  ${deduped.length} retail licences in ${territory.label}`);
  if (duplicates > 0) {
    console.log(`  ${duplicates} duplicate row(s) collapsed — the registry lists some shops twice`);
  }
  if (addressless > 0) {
    console.log(`  ${addressless} licence(s) skipped — the registry publishes no premises address for them`);
  }

  const records = deduped.map((row) => toDispensary(row, { map, retrievedAt, sourceUrl: SODA_ENDPOINT }));

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
      /* Hand-collected detail wins, but only where it exists. A plain spread
         put old.contact's explicit nulls back over values the registry had
         just supplied — so a licence researched before the registry published
         its website kept the null forever. */
      for (const [field, value] of Object.entries(old.contact ?? {})) {
        if (value !== null && value !== undefined) (record.contact as any)[field] = value;
      }
      record.address.neighborhood = old.address?.neighborhood ?? null;
      // The registry now publishes this itself, so it wins. The hand-collected
      // value only fills the silence it leaves — the other way round would let
      // a stale note overwrite the source of record.
      record.dates.openedOn = record.dates.openedOn ?? old.dates?.openedOn ?? null;
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

  /* One operator, two shops, one town — a real thing, and the slug is name +
     city, so it collides. The licence number is the only guaranteed-unique
     fact we hold, so its tail disambiguates, which is the shape the original
     scope already carries (…-bronx-000215). Applied after the sort by licence
     so the suffix a shop gets never depends on feed order. */
  const bySlug = new Map<string, typeof records>();
  for (const r of records) {
    if (!bySlug.has(r.id)) bySlug.set(r.id, []);
    bySlug.get(r.id)!.push(r);
  }
  for (const group of bySlug.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => (a.licenseNumber ?? '').localeCompare(b.licenseNumber ?? ''));
    for (const r of group) {
      const tail = (r.licenseNumber ?? '').split('-').pop();
      if (tail) r.id = `${r.id}-${tail}`;
    }
  }

  records.sort((a, b) => a.id.localeCompare(b.id));
  // A territory added after this script was written has no directory yet.
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(records, null, 2)}\n`);
  console.log(`\nWrote ${records.length} records → ${OUT}`);
  console.log('Next: npm run validate');
};

main().catch((err) => {
  console.error(`\nIngest failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
