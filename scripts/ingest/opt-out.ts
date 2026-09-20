/**
 * Municipal opt-out status, from the state's own LOCAL map.
 *
 *   npx tsx scripts/ingest/opt-out.ts --verify                     # do this FIRST
 *   npx tsx scripts/ingest/opt-out.ts --territory upstate --dry-run
 *   npx tsx scripts/ingest/opt-out.ts --territory upstate
 *
 * ── FROZEN, 2026-09-19 ────────────────────────────────────────────────
 *
 * This has deliberately NOT been run. Opt-out status contributes nothing to
 * SOMA's shelf coverage — SOMA is fed by menus — and matters only if the
 * register is published as a directory somebody navigates by. So upstate and
 * Long Island declare `municipalOptOut: NOT_ESTABLISHED` in
 * data/territories.json, the validator enforces that declaration, and their
 * pages render opt-out as "not checked".
 *
 * Nothing here is unfinished: it is ready and waiting on a decision plus an
 * open network. Read docs/FROZEN-municipal-opt-out.md before running it — in
 * particular §4 step 1, which is not optional.
 *
 * ── Why this is an ingest and not a research project ──────────────────
 *
 * The MRTA let every city, town and village opt out of retail dispensaries by
 * the end of 2021, and roughly a third of them did. For the six original
 * counties that was 53 records a person could check by hand. Statewide it is
 * on the order of 1,500, which is why docs/STATEWIDE-PLAN.md budgeted the
 * expansion as municipal research rather than engineering.
 *
 * That estimate was wrong in a useful direction. OCM publishes the status in
 * LOCAL — its Legal Online Cannabis Activities Locator — which is an ArcGIS
 * Experience Builder application, and every one of those is backed by
 * FeatureServer layers that answer JSON over REST. The work is an adapter.
 *
 * ── Why it discovers instead of hard-coding ───────────────────────────
 *
 * Same posture as the Socrata adapter next door, for the same reason: a layer
 * id or a field name written down today is a thing that breaks silently when
 * the publisher reorganises. This walks the app's own configuration to find
 * its layers, scores them on the fields a municipal opt-out layer must have,
 * and when it cannot decide it prints what it actually found rather than
 * emitting plausible nulls.
 *
 * ── The rule that governs every value it writes ───────────────────────
 *
 * A municipality the map does not cover gets `null`, never `false`. False
 * means "we established that it did not opt out"; null means "we do not know".
 * Sending somebody to a shop in a town that banned retail is exactly the
 * fabricated record this register exists to refuse, and the two are one
 * careless default apart.
 *
 * A village sits inside a town and opts out INDEPENDENTLY — the schema records
 * Mamaroneck, which is both — so both are kept as separate records and a
 * village is never inferred from its town.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');
import { dataPath, inTerritory, territoryFromArgv } from './territory.js';
import { canonicalCounty, slugify } from './normalize.js';

/** OCM's LOCAL application. Override with --app when they republish it. */
const DEFAULT_APP_ITEM = '230c52db6b0746c69c587599aa119273';
const ARCGIS_ITEM_DATA = (id: string) =>
  `https://www.arcgis.com/sharing/rest/content/items/${id}/data?f=json`;

const argv = process.argv.slice(2);
const flag = (name: string) => {
  const at = argv.indexOf(`--${name}`);
  return at === -1 ? null : argv[at + 1];
};
const dryRun = argv.includes('--dry-run');
const territory = territoryFromArgv();
const appItem = flag('app') ?? DEFAULT_APP_ITEM;
/** A layer URL, when discovery has already been done once and can be skipped. */
const layerOverride = flag('layer');
/** Compare against the hand-checked original scope instead of writing. */
const verify = argv.includes('--verify');

/** Field names a municipal opt-out layer is likely to use, best first. */
const FIELD_CANDIDATES: Record<string, string[]> = {
  name: ['muni_name', 'municipality', 'name', 'muniname', 'local_name', 'jurisdiction'],
  kind: ['muni_type', 'type', 'kind', 'class', 'municipality_type', 'swis_type'],
  county: ['county', 'county_name', 'cnty', 'countyname'],
  retailOptOut: ['retail_opt_out', 'optout_retail', 'retail', 'dispensary_opt_out', 'opt_out_retail', 'optedout_retail'],
  onsiteOptOut: ['onsite_opt_out', 'optout_onsite', 'onsite', 'consumption_opt_out', 'opt_out_onsite', 'on_site_opt_out'],
  optOutDate: ['opt_out_date', 'optout_date', 'date_filed', 'filed_date', 'local_law_date'],
};
const REQUIRED = ['name', 'county', 'retailOptOut'];

const KIND_MAP: Record<string, string> = {
  city: 'CITY', town: 'TOWN', village: 'VILLAGE', borough: 'BOROUGH',
  c: 'CITY', t: 'TOWN', v: 'VILLAGE',
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

async function getJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return (await res.json()) as Record<string, unknown>;
}

/** Every FeatureServer/MapServer layer URL mentioned anywhere in the app config. */
function layerUrls(node: unknown, found = new Set<string>()): Set<string> {
  if (typeof node === 'string') {
    if (/\/(Feature|Map)Server(\/\d+)?$/i.test(node)) found.add(node.replace(/\/$/, ''));
    return found;
  }
  if (Array.isArray(node)) {
    for (const item of node) layerUrls(item, found);
    return found;
  }
  if (node && typeof node === 'object') {
    for (const value of Object.values(node)) layerUrls(value, found);
  }
  return found;
}

/** How well a layer's fields match what an opt-out layer must carry. */
function scoreLayer(fields: { name: string }[]): { score: number; map: Record<string, string> } {
  const byNorm = new Map(fields.map((f) => [norm(f.name), f.name]));
  const map: Record<string, string> = {};
  let score = 0;
  for (const [logical, candidates] of Object.entries(FIELD_CANDIDATES)) {
    for (const candidate of candidates) {
      const hit = byNorm.get(norm(candidate));
      if (hit) {
        map[logical] = hit;
        score += REQUIRED.includes(logical) ? 3 : 1;
        break;
      }
    }
  }
  return { score, map };
}

/**
 * A boolean the map may encode a dozen ways. Anything it does not recognise
 * comes back null — the whole point — rather than defaulting to "did not opt
 * out", which is a claim nobody made.
 */
function readFlag(value: unknown): boolean | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null;
  const t = String(value).trim().toLowerCase();
  if (['yes', 'y', 'true', '1', 'opted out', 'opt out', 'optout'].includes(t)) return true;
  if (['no', 'n', 'false', '0', 'did not opt out', 'not opted out', 'opted in'].includes(t)) return false;
  return null;
}

async function pagedQuery(layer: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  const page = 1000;
  for (let offset = 0; ; offset += page) {
    const url =
      `${layer}/query?where=1%3D1&outFields=*&returnGeometry=false&f=json` +
      `&resultOffset=${offset}&resultRecordCount=${page}`;
    const body = await getJson(url);
    const features = (body.features ?? []) as { attributes: Record<string, unknown> }[];
    out.push(...features.map((f) => f.attributes));
    if (features.length < page) return out;
  }
}

const main = async () => {
  console.log(`Territory: ${territory.label} → ${territory.dataDir}/municipalities.json`);

  // --verify runs the adapter against the ORIGINAL scope and diffs it against
  // the hand-checked file, without writing anything. It is the only evidence
  // that the machine agrees with a person on data a person actually checked,
  // and it should be run before any territory's output is trusted.
  if (verify) {
    console.log('Verify mode: comparing against the hand-checked data/municipalities.json\n');
  } else if (territory.dataDir === 'data') {
    console.error(
      '\nRefusing to write the original scope.\n' +
        'data/municipalities.json was checked by hand, one municipality at a time, and\n' +
        'is the reference this adapter is measured against — not something to overwrite\n' +
        'with a first machine run. Compare against it instead:\n' +
        '  npx tsx scripts/ingest/opt-out.ts --territory upstate --dry-run',
    );
    process.exit(1);
  }

  let layer = layerOverride;
  if (!layer) {
    console.log(`Reading LOCAL app config (item ${appItem}) ...`);
    const config = await getJson(ARCGIS_ITEM_DATA(appItem));
    const candidates = [...layerUrls(config)];
    console.log(`  ${candidates.length} layer URL(s) referenced by the app`);
    if (candidates.length === 0) {
      console.error('\nNo FeatureServer layers in the app config. It has been restructured;\npass one directly with --layer <url>.');
      process.exit(1);
    }

    let best: { url: string; score: number; map: Record<string, string> } | null = null;
    for (const url of candidates) {
      const sub = /\/\d+$/.test(url) ? [url] : [`${url}/0`, `${url}/1`, `${url}/2`];
      for (const candidate of sub) {
        try {
          const meta = await getJson(`${candidate}?f=json`);
          const fields = (meta.fields ?? []) as { name: string }[];
          if (fields.length === 0) continue;
          const { score, map } = scoreLayer(fields);
          console.log(`  ${score.toString().padStart(2)}  ${meta.name ?? candidate}`);
          if (!best || score > best.score) best = { url: candidate, score, map };
        } catch {
          /* not a queryable layer; keep looking */
        }
      }
    }

    const missing = REQUIRED.filter((f) => !best?.map[f]);
    if (!best || missing.length > 0) {
      console.error(`\nCould not find a layer carrying: ${missing.join(', ')}`);
      console.error('Best candidate was:', best?.url ?? '(none)');
      console.error('Re-run with --layer <url> once the right one is identified.');
      process.exit(1);
    }
    layer = best.url;
    console.log(`\nUsing ${layer}`);
    console.log('  fields:', JSON.stringify(best.map));
  }

  const rows = await pagedQuery(layer);
  console.log(`  ${rows.length} municipalities in the layer`);
  if (rows.length === 0) throw new Error('Layer returned no rows — refusing to write.');

  const { map } = scoreLayer(Object.keys(rows[0]).map((name) => ({ name })));
  const missing = REQUIRED.filter((f) => !map[f]);
  if (missing.length > 0) {
    console.error(`\nLayer is missing required fields: ${missing.join(', ')}`);
    console.error('Fields actually present:', Object.keys(rows[0]).sort().join(', '));
    process.exit(1);
  }

  const retrievedAt = new Date().toISOString();
  const records = [];
  let outsideTerritory = 0;
  let unknownStatus = 0;

  for (const row of rows) {
    const county = canonicalCounty(String(row[map.county] ?? '') || null);
    if (!inTerritory(territory, county)) {
      outsideTerritory += 1;
      continue;
    }
    const name = String(row[map.name] ?? '').trim();
    if (!name) continue;
    const kindRaw = map.kind ? String(row[map.kind] ?? '').trim().toLowerCase() : '';
    const kind = KIND_MAP[kindRaw] ?? KIND_MAP[kindRaw.split(/\s+/)[0]] ?? 'TOWN';
    const retailOptOut = readFlag(row[map.retailOptOut]);
    if (retailOptOut === null) unknownStatus += 1;

    records.push({
      // A village and its town share a name and must stay two records.
      id: slugify(name, kind.toLowerCase()),
      name,
      kind,
      county,
      retailOptOut,
      onsiteConsumptionOptOut: map.onsiteOptOut ? readFlag(row[map.onsiteOptOut]) : null,
      optOutDate: map.optOutDate
        ? (String(row[map.optOutDate] ?? '').slice(0, 10) || null)
        : null,
      notes: null,
      sources: [
        {
          url: 'https://cannabis.ny.gov/ocm-local-opt-out-data',
          label: 'OCM — Official Local Opt-Out List (via the LOCAL map)',
          type: 'OFFICIAL_REGISTRY',
          retrievedAt,
        },
        { url: layer, label: 'LOCAL map feature layer', type: 'REGULATOR_PAGE', retrievedAt },
      ],
      lastUpdated: retrievedAt,
    });
  }

  records.sort((a, b) => a.id.localeCompare(b.id));
  const optedOut = records.filter((r) => r.retailOptOut === true).length;
  console.log(`\n  ${records.length} in ${territory.label} (${outsideTerritory} elsewhere, skipped)`);
  console.log(`  opted out of retail: ${optedOut}`);
  console.log(`  status not established: ${unknownStatus}  ← left null, never false`);

  if (verify) {
    const hand = JSON.parse(readFileSync(resolve(ROOT, 'data/municipalities.json'), 'utf8')) as {
      name: string; kind: string; retailOptOut: boolean | null;
    }[];
    const key = (m: { name: string; kind: string }) =>
      `${m.name.toLowerCase()}|${m.kind}`;
    const byKey = new Map(hand.map((m) => [key(m), m]));
    let agree = 0;
    const disagree: string[] = [];
    const missing: string[] = [];
    for (const m of hand) {
      const got = records.find((r) => key(r) === key(m));
      if (!got) { missing.push(`${m.name} (${m.kind})`); continue; }
      if (got.retailOptOut === m.retailOptOut) agree += 1;
      else disagree.push(`${m.name}: hand ${m.retailOptOut}, map ${got.retailOptOut}`);
    }
    const extra = records.filter((r) => !byKey.has(key(r))).length;
    console.log(`  agree:      ${agree} / ${hand.length}`);
    console.log(`  disagree:   ${disagree.length}`);
    for (const d of disagree.slice(0, 15)) console.log(`      ${d}`);
    console.log(`  absent from the map: ${missing.length}`);
    for (const m of missing.slice(0, 10)) console.log(`      ${m}`);
    console.log(`  in the map but not hand-checked: ${extra}`);
    console.log(
      disagree.length === 0 && missing.length === 0
        ? '\n  The adapter reproduces the hand-checked file. Trust it upstate.'
        : '\n  Reconcile every line above BEFORE trusting this upstate. A disagreement\n' +
          '  is either a stale hand record or a misread field, and which one it is\n' +
          '  decides whether the map or the person was right.',
    );
    return;
  }

  if (dryRun) {
    console.log('\n--dry-run: nothing written.');
    return;
  }
  const out = dataPath(territory, 'municipalities.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(records, null, 2)}\n`);
  console.log(`\nWrote ${records.length} records → ${out}`);
  console.log('Next: npm run validate');
};

main().catch((err) => {
  console.error('\nFailed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
