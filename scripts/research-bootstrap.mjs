import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const OUT = 'research-output';
await mkdir(OUT, { recursive: true });

const urls = {
  licenses: 'https://data.ny.gov/api/v3/views/jskf-tt3q/query.json?accessType=DOWNLOAD',
  columns: 'https://data.ny.gov/api/views/jskf-tt3q/columns.json',
  verification: 'https://cannabis.ny.gov/dispensary-location-verification',
  localities: 'https://cannabis.ny.gov/localities',
  localOptOut: 'https://cannabis.ny.gov/ocm-local-opt-out-data',
  localGovernment: 'https://cannabis.ny.gov/local-government',
  rockefeller: 'https://rockinst.org/issue-areas/state-local-government/municipal-opt-out-tracker/'
};

async function fetchText(url, { optional = false } = {}) {
  try {
    const r = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; dispensary-list-research/1.0; +https://github.com/Adisabeba33/dispensery-list)',
        accept: 'text/html,application/json,text/plain,*/*'
      },
      redirect: 'follow'
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return { ok: true, text: await r.text(), error: null };
  } catch (error) {
    if (!optional) throw new Error(`${url}: ${error.message}`);
    return { ok: false, text: '', error: `${url}: ${error.message}` };
  }
}

async function fetchBinary(url, { optional = false } = {}) {
  try {
    const r = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; dispensary-list-research/1.0; +https://github.com/Adisabeba33/dispensery-list)',
        accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream,*/*'
      },
      redirect: 'follow'
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return { ok: true, bytes: Buffer.from(await r.arrayBuffer()), error: null };
  } catch (error) {
    if (!optional) throw new Error(`${url}: ${error.message}`);
    return { ok: false, bytes: Buffer.alloc(0), error: `${url}: ${error.message}` };
  }
}

const [licensesRes, columnsRes, verificationRes, localitiesRes, localOptOutRes, localGovernmentRes, rockefellerRes] = await Promise.all([
  fetchText(urls.licenses),
  fetchText(urls.columns),
  fetchText(urls.verification),
  fetchText(urls.localities, { optional: true }),
  fetchBinary(urls.localOptOut, { optional: true }),
  fetchText(urls.localGovernment, { optional: true }),
  fetchText(urls.rockefeller, { optional: true })
]);

const licensesText = licensesRes.text;
const columnsText = columnsRes.text;
const verificationHtml = verificationRes.text;
const raw = JSON.parse(licensesText);
const columns = JSON.parse(columnsText);
const counties = new Set(['New York', 'Kings', 'Queens', 'Bronx', 'Richmond', 'Westchester']);

const scoped = raw.filter((r) => counties.has(r.county));
const retailish = scoped.filter((r) => {
  const t = String(r.license_type || '').toLowerCase();
  const p = String(r.business_purpose || '').toLowerCase();
  return p.includes('retail') || t.includes('retail') || t.includes('dispensary') || t.includes('registered organization');
});
const licensedRetailish = retailish.filter((r) => /^OCM-[A-Z0-9]{2,10}-\d{2}-\d{4,8}$/.test(r.license_number || ''));

const countBy = (rows, field) => rows.reduce((acc, row) => {
  const key = row[field] ?? '(null)';
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const generatedAt = new Date().toISOString();
const optionalFailures = [localitiesRes, localOptOutRes, localGovernmentRes, rockefellerRes].filter((x) => !x.ok).map((x) => x.error);
const summary = {
  generatedAt,
  sourceUrls: urls,
  rawRows: raw.length,
  scopedRows: scoped.length,
  retailishRows: retailish.length,
  licensedRetailishRows: licensedRetailish.length,
  byCounty: countBy(licensedRetailish, 'county'),
  byType: countBy(licensedRetailish, 'license_type'),
  byStatus: countBy(licensedRetailish, 'license_status'),
  optionalFailures,
  sha256: {
    licenses: sha256(licensesText),
    columns: sha256(columnsText),
    verification: sha256(verificationHtml),
    ...(localitiesRes.ok ? { localities: sha256(localitiesRes.text) } : {}),
    ...(localOptOutRes.ok ? { localOptOut: sha256(localOptOutRes.bytes) } : {}),
    ...(localGovernmentRes.ok ? { localGovernment: sha256(localGovernmentRes.text) } : {}),
    ...(rockefellerRes.ok ? { rockefeller: sha256(rockefellerRes.text) } : {})
  }
};

const writes = [
  writeFile(`${OUT}/ocm-licenses.json`, JSON.stringify(raw, null, 2) + '\n'),
  writeFile(`${OUT}/ocm-columns.json`, JSON.stringify(columns, null, 2) + '\n'),
  writeFile(`${OUT}/retail-candidates.json`, JSON.stringify(licensedRetailish, null, 2) + '\n'),
  writeFile(`${OUT}/ocm-verification.html`, verificationHtml),
  writeFile(`${OUT}/summary.json`, JSON.stringify(summary, null, 2) + '\n')
];
if (localitiesRes.ok) writes.push(writeFile(`${OUT}/ocm-localities.html`, localitiesRes.text));
if (localOptOutRes.ok) writes.push(writeFile(`${OUT}/ocm-local-opt-out-data.xlsx`, localOptOutRes.bytes));
if (localGovernmentRes.ok) writes.push(writeFile(`${OUT}/ocm-local-government.html`, localGovernmentRes.text));
if (rockefellerRes.ok) writes.push(writeFile(`${OUT}/rockefeller-opt-out.html`, rockefellerRes.text));
await Promise.all(writes);

console.log(JSON.stringify(summary, null, 2));
