import { readFileSync, existsSync } from 'node:fs';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const schema = JSON.parse(readFileSync(new URL('../data/schema/coa-dates.schema.json', import.meta.url)));
const validate = ajv.compile(schema);
const good = { about: 'fixture', certificates: { 'https://lab.test/report.pdf': {
  lab: 'Smithers', sampled: '2026-05-11', sampledFrom: 'sampled', packaged: null, harvested: null,
  packagedFrom: null, harvestedFrom: null, sourceKind: 'brand-page', sourcePage: 'https://brand.test/coas',
  documentUrl: 'https://lab.test/report.pdf',
} } };
if (!validate(good)) throw Error(JSON.stringify(validate.errors));
good.certificates['https://lab.test/report.pdf'].sampledFrom = 'expiry';
if (validate(good)) throw Error('Expiry must not masquerade as a sampled event');
const actual = JSON.parse(readFileSync(new URL('../data/coa-dates.json', import.meta.url)));
if (!validate(actual)) throw Error(JSON.stringify(validate.errors));
const httpSchema = JSON.parse(readFileSync(new URL('../data/schema/coa-http-state.schema.json', import.meta.url)));
const httpState = JSON.parse(readFileSync(new URL('../data/coa-http-state.json', import.meta.url)));
const validHttpState = ajv.compile(httpSchema);
if (!validHttpState(httpState)) throw Error(JSON.stringify(validHttpState.errors));
if (existsSync(new URL('../data/coa-sources.json', import.meta.url))) {
  const sourcesSchema = JSON.parse(readFileSync(new URL('../data/schema/coa-sources.schema.json', import.meta.url)));
  const sources = JSON.parse(readFileSync(new URL('../data/coa-sources.json', import.meta.url)));
  const validSources = ajv.compile(sourcesSchema);
  if (!validSources(sources)) throw Error(JSON.stringify(validSources.errors));
}
console.log('coa-schema-check: OK');
