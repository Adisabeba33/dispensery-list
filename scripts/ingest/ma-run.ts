/**
 * Pulls the Massachusetts licence register and writes
 * data/massachusetts/dispensaries.json.
 *
 *   npx tsx scripts/ingest/ma-run.ts                 fetch, normalize, write
 *   npx tsx scripts/ingest/ma-run.ts --dry-run       fetch and report, write nothing
 *   npx tsx scripts/ingest/ma-run.ts --from-raw <registry.json> --locator-raw <locator.js>
 *                                                    rebuild from snapshots on disk
 *
 * The New York runner (run.ts) is not reused, and that is a finding rather than
 * a shortcut: its field resolution, its retail filter and its duplicate rule are
 * all shaped by the OCM dataset. What does carry over is everything after the
 * row is read — slugs, URL cleaning, the record shape, the validator.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  LOCATOR_LABEL,
  LOCATOR_PAGE,
  LOCATOR_URL,
  REGISTRY_LABEL,
  REGISTRY_URL,
  REQUIRED_COLUMNS,
  RETAIL_TYPES,
  fetchText,
  parseLocator,
  parseRegistry,
  type CccRow,
  type LocatorEntry,
} from './sources/ma-ccc.js';
import { canonicalCounty, normalizeZip, slugify, websiteUrl } from './normalize.js';
import { dataPath, getTerritory, inTerritory } from './territory.js';

const ROOT = resolve(import.meta.dirname, '..', '..');
const territory = getTerritory('massachusetts');
const OUT = dataPath(territory, 'dispensaries.json');
const RAW_DIR = resolve(ROOT, 'data/raw');

const argAfter = (flag: string): string | null => {
  const at = process.argv.indexOf(flag);
  return at === -1 ? null : process.argv[at + 1];
};
const dryRun = process.argv.includes('--dry-run');
const fromRaw = argAfter('--from-raw');
const locatorRaw = argAfter('--locator-raw');
const today = new Date().toISOString().slice(0, 10);
const retrievedAt = new Date().toISOString();

const cell = (row: CccRow, column: string): string | null => {
  const v = row[column];
  if (v === undefined || v === null) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
};

/** The register writes dates as MM-DD-YYYY. Anything else is null, not a guess. */
const mdyDate = (raw: string | null): string | null => {
  const m = raw?.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.getUTCDate() !== Number(dd) ? null : `${yyyy}-${mm}-${dd}`;
};

/**
 * Premises are published in capitals ("1764 MAIN STREET", "TYNGSBOROUGH").
 * Words are title-cased for the page; a token holding a digit ("1A", "2ND") is
 * left exactly as published, so a unit letter is never changed. The register's
 * own spelling stays in data/raw.
 */
const titleCase = (raw: string): string =>
  raw
    .split(/(\s+|-)/)
    .map((w) => (/\d/.test(w) ? w : w.toLowerCase().replace(/(^|')([a-z])/g, (_, q: string, c: string) => q + c.toUpperCase())))
    .join('');

/**
 * "Late Spring, Inc. D/B/A Gage Cannabis Company" is a legal name and a trading
 * name in one field. Split on the register's own marker, and only on it.
 */
const splitDba = (raw: string): { legalName: string; dbaName: string | null } => {
  const m = raw.match(/^(.*?)\s+(?:d\/b\/a|dba)\s+(.+)$/i);
  if (!m) return { legalName: raw.replace(/\s+/g, ' ').trim(), dbaName: null };
  return { legalName: m[1].replace(/\s+/g, ' ').trim(), dbaName: m[2].replace(/\s+/g, ' ').trim() };
};

const STREET_WORD: Record<string, string> = {
  STREET: 'ST', ROAD: 'RD', AVENUE: 'AVE', AV: 'AVE', TURNPIKE: 'TPKE', TPK: 'TPKE', HIGHWAY: 'HWY',
  BOULEVARD: 'BLVD', DRIVE: 'DR', PLACE: 'PL', PARKWAY: 'PKWY', LANE: 'LN', SQUARE: 'SQ',
  COURT: 'CT', CIRCLE: 'CIR', TERRACE: 'TER', ROUTE: 'RTE', RT: 'RTE',
  NORTH: 'N', SOUTH: 'S', EAST: 'E', WEST: 'W',
};

/**
 * A street address reduced to the part two publishers agree on: the first
 * line up to any unit, with the usual abbreviations folded, plus the ZIP.
 * "250 Worcester Rd" and "250 WORCESTER ROAD" meet; "Unit 225" is dropped
 * because one side often omits it.
 */
const addressKey = (line: string, zip: string | null): string | null => {
  const z = normalizeZip(zip);
  if (!z) return null;
  const head = line.split(/,|\b(?:UNIT|SUITE|STE|#)\b/i)[0];
  const words = head
    .toUpperCase()
    .replace(/[.']/g, '')
    .split(/[^A-Z0-9-]+/)
    .filter(Boolean)
    .map((w) => STREET_WORD[w] ?? w);
  if (words.length < 2 || !/^\d/.test(words[0])) return null;
  return `${words.join(' ')} ${z}`;
};

const phoneOf = (raw: string): string | null => {
  const digits = raw.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return digits.length === 10 ? `+1-${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}` : null;
};

const statusOf = (raw: string | null): string | null => {
  const s = raw?.toLowerCase() ?? '';
  if (s.includes('revoked')) return 'REVOKED';
  if (s.includes('surrender')) return 'SURRENDERED';
  if (s.includes('suspend')) return 'SUSPENDED';
  if (s.includes('expired')) return 'EXPIRED';
  if (s.includes('pending')) return 'PENDING';
  if (s === 'active') return 'ACTIVE';
  return null;
};

const main = async () => {
  console.log(`Territory: ${territory.label} → ${territory.dataDir}/dispensaries.json`);

  const registryText = fromRaw
    ? readFileSync(resolve(ROOT, fromRaw), 'utf8')
    : (console.log(`Fetching ${REGISTRY_URL} ...`), await fetchText(REGISTRY_URL));
  const locatorText = locatorRaw
    ? readFileSync(resolve(ROOT, locatorRaw), 'utf8')
    : fromRaw
      ? null
      : (console.log(`Fetching ${LOCATOR_URL} ...`), await fetchText(LOCATOR_URL));

  const rows = parseRegistry(registryText);
  console.log(`  ${rows.length} licences, every type`);
  if (rows.length === 0) throw new Error('Register returned no rows — refusing to overwrite existing data.');

  const present = new Set(rows.flatMap((r) => Object.keys(r)));
  const missing = REQUIRED_COLUMNS.filter((c) => !present.has(c));
  if (missing.length > 0) {
    console.error('\nColumns this adapter reads are missing:', missing.join(', '));
    console.error('\nColumns actually present:');
    for (const key of [...present].sort()) console.error(`  ${key}`);
    process.exit(1);
  }

  if (!dryRun && !fromRaw) {
    mkdirSync(RAW_DIR, { recursive: true });
    // Verbatim, byte-order mark and all: this is the provenance, not a copy of it.
    writeFileSync(resolve(RAW_DIR, `ma-ccc-licenses-${today}.json`), registryText);
    if (locatorText) writeFileSync(resolve(RAW_DIR, `ma-ccc-where-to-buy-${today}.js`), locatorText);
    console.log(`  raw snapshots → data/raw/ma-ccc-*-${today}.*`);
  }

  const retail = rows.filter((r) => RETAIL_TYPES.has(cell(r, 'LICENSE_TYPE') ?? ''));
  console.log(`  ${retail.length} Marijuana Retailer licences`);

  /* The state field on a premises address is sometimes the licensee's head
     office. Jushi MA's Tyngsborough and Millbury shops read "FL", GreenSoul's
     Cambridge shop "DE", Lemonnade Springfield "CA" — each with a Massachusetts
     ZIP and county, at a premises the Commission can only have licensed in
     Massachusetts. The record says MA and carries a warning naming what the
     register printed, so the correction is visible rather than silent. */
  const records = retail.map((row) => {
    const licenseNumber = cell(row, 'LICENSE_NUMBER')!;
    const { legalName, dbaName } = splitDba(cell(row, 'BUSINESS_NAME') ?? '');
    const county = canonicalCounty(cell(row, 'ESTABLISHMENT_COUNTY'));
    const city = titleCase(cell(row, 'ESTABLISHMENT_CITY') ?? '');
    const line1Raw = cell(row, 'ESTABLISHMENT_ADDRESS_1') ?? '';
    const line2Raw = cell(row, 'ESTABLISHMENT_ADDRESS_2');
    const zip = normalizeZip(cell(row, 'ESTABLISHMENT_ZIP'));
    const licenseStatus = statusOf(cell(row, 'LICENSE_STATUS'));
    const printedState = cell(row, 'ESTABLISHMENT_STATE');
    const warnings: string[] = [];
    if (printedState && printedState !== 'MA') {
      warnings.push(
        `The register prints the premises state as "${printedState}" — the licensee's head-office state — with a Massachusetts ZIP and county. Recorded as MA.`,
      );
    }

    return {
      id: slugify(dbaName ?? legalName, city),
      licenseNumber,
      applicationNumber: cell(row, 'APPLICATION_NUMBER'),
      licenseType: 'ADULT_USE_RETAIL_DISPENSARY',
      licenseStatus,
      // The register records that operations commenced once. Whether the shop
      // trades today is a different fact, and nobody has checked it here.
      operationalStatus: licenseStatus === 'REVOKED' || licenseStatus === 'SURRENDERED' ? 'PERMANENTLY_CLOSED' : 'UNKNOWN',
      // New York's Social & Economic Equity categories. Massachusetts has its
      // own equity programmes, and they do not map onto these.
      seeCategory: null,
      legalName,
      dbaName,
      address: {
        line1: titleCase(line1Raw),
        line2: line2Raw ? titleCase(line2Raw) : null,
        city,
        county,
        borough: null,
        neighborhood: null,
        state: 'MA',
        zip,
      },
      geo: null,
      contact: { phone: null, email: null, website: null, orderOnlineUrl: null, instagram: null } as Record<string, string | null>,
      hours: null,
      services: null,
      menu: null,
      dates: {
        licenseIssued: mdyDate(cell(row, 'CNB_DATE_OF_FINAL_LICENSURE')),
        licenseEffective: mdyDate(cell(row, 'LIC_START_DATE')),
        licenseExpiration: mdyDate(cell(row, 'LIC_EXPIRATION_DATE')),
        openedOn: mdyDate(cell(row, 'COMMENCE_OPERATIONS_DATE')),
      },
      sources: [
        { url: REGISTRY_URL, label: REGISTRY_LABEL, type: 'OFFICIAL_REGISTRY', retrievedAt },
      ] as { url: string; label: string; type: string; retrievedAt: string }[],
      verification: {
        status: 'VERIFIED_OFFICIAL',
        confidence: 'LOW',
        verifiedAt: retrievedAt,
        checkedAgainstOcmTool: null,
        notes: 'Imported from the Cannabis Control Commission register. Hours, services and menus are not yet enriched.',
      },
      warnings,
      lastUpdated: retrievedAt,
      _key: addressKey(line1Raw, zip),
    };
  });

  const outside = records.filter((r) => !inTerritory(territory, r.address.county, r.address.state));
  if (outside.length > 0) {
    throw new Error(`${outside.length} licence(s) sit in no Massachusetts county: ${outside.map((r) => r.licenseNumber).join(', ')}`);
  }

  /* Phone and website, from the Commission's own store locator.
   *
   * The locator carries no licence number, so the join is on the premises: the
   * same street address and ZIP, on exactly one licence and exactly one
   * adult-use locator entry. Two licences at one address (there are two such
   * pairs) or two entries for one door are left alone — a phone number filed
   * under the wrong licence is the plausible guess this register refuses. The
   * locator's titles are not used: some are legal names, some trading names,
   * one is mis-encoded ("Nature'2019s"), and the register already names the
   * licensee. */
  let joined = 0;
  let locatorAdultUse = 0;
  if (locatorText) {
    const entries = parseLocator(locatorText);
    const adultUse = entries.filter((e) => /adult/i.test(e.use ?? ''));
    locatorAdultUse = adultUse.length;
    const byKey = new Map<string, LocatorEntry[]>();
    for (const e of adultUse) {
      const k = addressKey(e.address ?? '', e.zip);
      if (!k) continue;
      byKey.set(k, [...(byKey.get(k) ?? []), e]);
    }
    const licencesAt = new Map<string, number>();
    for (const r of records) if (r._key) licencesAt.set(r._key, (licencesAt.get(r._key) ?? 0) + 1);

    for (const r of records) {
      if (!r._key || licencesAt.get(r._key) !== 1) continue;
      const hits = byKey.get(r._key) ?? [];
      if (hits.length !== 1) continue;
      const e = hits[0];
      const website = websiteUrl(e.website);
      const phone = phoneOf(e.phone ?? '');
      if (!website && !phone) continue;
      r.contact.website = website;
      r.contact.phone = phone;
      r.sources.push({ url: LOCATOR_PAGE, label: LOCATOR_LABEL, type: 'REGULATOR_PAGE', retrievedAt });
      joined += 1;
    }
    console.log(`  store locator: ${entries.length} entries, ${adultUse.length} adult-use; ${joined} matched to a licence by address`);
  } else {
    console.log('  store locator: not read (no --locator-raw given with --from-raw)');
  }

  // Carry forward what was collected by hand, as the New York runner does: a
  // re-run refreshes the register's facts without discarding enrichment.
  if (existsSync(OUT)) {
    const previous = JSON.parse(readFileSync(OUT, 'utf8')) as Record<string, any>[];
    const old = new Map(previous.map((p) => [p.licenseNumber, p]));
    let carried = 0;
    for (const r of records as Record<string, any>[]) {
      const p = old.get(r.licenseNumber);
      if (!p) continue;
      carried += 1;
      r.id = p.id ?? r.id; // slugs are permanent once published
      // A trading name found by research (website-research.json) fills the
      // register's silence; one the register prints itself wins.
      r.dbaName = r.dbaName ?? p.dbaName ?? null;
      for (const field of ['geo', 'hours', 'services', 'menu']) r[field] = p[field] ?? r[field];
      for (const [k, v] of Object.entries(p.contact ?? {})) if (v !== null && v !== undefined) r.contact[k] = v;
      if (p.operationalStatus && p.operationalStatus !== 'UNKNOWN') r.operationalStatus = p.operationalStatus;
      for (const s of p.sources ?? []) {
        if (!r.sources.some((x: { url: string }) => x.url === s.url)) r.sources.push(s);
      }
    }
    console.log(`  carried enrichment forward for ${carried} licence(s)`);
  }

  // Name + town collides for an operator with two shops in one town; the
  // licence number breaks the tie, after a sort, so feed order never decides.
  const bySlug = new Map<string, typeof records>();
  for (const r of records) bySlug.set(r.id, [...(bySlug.get(r.id) ?? []), r]);
  for (const group of bySlug.values()) {
    if (group.length < 2) continue;
    for (const r of group) r.id = `${r.id}-${r.licenseNumber.toLowerCase()}`;
  }

  const out = records
    .map(({ _key, ...r }) => r)
    .sort((a, b) => a.id.localeCompare(b.id));

  const byCounty = new Map<string, number>();
  for (const r of out) byCounty.set(r.address.county ?? '?', (byCounty.get(r.address.county ?? '?') ?? 0) + 1);
  console.log('\nBy county:');
  for (const [c, n] of [...byCounty].sort((a, b) => b[1] - a[1])) console.log(`  ${c.padEnd(12)} ${n}`);
  console.log(`\n  opened (commenced operations): ${out.filter((r) => r.dates.openedOn).length} of ${out.length}`);
  console.log(`  with a website: ${out.filter((r) => r.contact.website).length} of ${out.length}`);
  console.log(`  locator adult-use entries: ${locatorAdultUse}`);

  if (dryRun) {
    console.log('\nDry run — nothing written.');
    return;
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`\nWrote ${out.length} records → ${OUT}`);
  console.log('Next: npm run validate');
};

main().catch((err) => {
  console.error(`\nIngest failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
