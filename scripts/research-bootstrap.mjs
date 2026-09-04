import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Bootstrap is intentionally deterministic apart from retrieval timestamps/source refreshes.
const OUT = 'research-output';
await mkdir(OUT, { recursive: true });

const urls = {
  licenses: 'https://data.ny.gov/api/v3/views/jskf-tt3q/query.json?accessType=DOWNLOAD',
  columns: 'https://data.ny.gov/api/views/jskf-tt3q/columns.json',
  verification: 'https://cannabis.ny.gov/dispensary-location-verification',
  localities: 'https://cannabis.ny.gov/localities',
  localGovernment: 'https://cannabis.ny.gov/local-government',
  rockefeller: 'https://rockinst.org/issue-areas/state-local-government/municipal-opt-out-tracker/'
};

async function fetchText(url) {
  const r = await fetch(url, {
    headers: {
      'user-agent': 'dispensary-list research agent/1.0 (+https://github.com/Adisabeba33/dispensery-list)',
      accept: '*/*'
    }
  });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return await r.text();
}

const [licensesText, columnsText, verificationHtml, localitiesHtml, localGovernmentHtml, rockefellerHtml] = await Promise.all([
  fetchText(urls.licenses),
  fetchText(urls.columns),
  fetchText(urls.verification),
  fetchText(urls.localities),
  fetchText(urls.localGovernment),
  fetchText(urls.rockefeller)
]);

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

const byCounty = {};
for (const r of licensedRetailish) byCounty[r.county] = (byCounty[r.county] || 0) + 1;
const byType = {};
for (const r of licensedRetailish) byType[r.license_type] = (byType[r.license_type] || 0) + 1;
const byStatus = {};
for (const r of licensedRetailish) byStatus[r.license_status] = (byStatus[r.license_status] || 0) + 1;

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const generatedAt = new Date().toISOString();
const summary = {
  generatedAt,
  sourceUrls: urls,
  rawRows: raw.length,
  scopedRows: scoped.length,
  retailishRows: retailish.length,
  licensedRetailishRows: licensedRetailish.length,
  byCounty,
  byType,
  byStatus,
  sha256: {
    licenses: sha256(licensesText),
    columns: sha256(columnsText),
    verification: sha256(verificationHtml),
    localities: sha256(localitiesHtml),
    localGovernment: sha256(localGovernmentHtml),
    rockefeller: sha256(rockefellerHtml)
  }
};

await Promise.all([
  writeFile(`${OUT}/ocm-licenses.json`, JSON.stringify(raw, null, 2) + '\n'),
  writeFile(`${OUT}/ocm-columns.json`, JSON.stringify(columns, null, 2) + '\n'),
  writeFile(`${OUT}/retail-candidates.json`, JSON.stringify(licensedRetailish, null, 2) + '\n'),
  writeFile(`${OUT}/ocm-verification.html`, verificationHtml),
  writeFile(`${OUT}/ocm-localities.html`, localitiesHtml),
  writeFile(`${OUT}/ocm-local-government.html`, localGovernmentHtml),
  writeFile(`${OUT}/rockefeller-opt-out.html`, rockefellerHtml),
  writeFile(`${OUT}/summary.json`, JSON.stringify(summary, null, 2) + '\n')
]);

console.log(JSON.stringify(summary, null, 2));
