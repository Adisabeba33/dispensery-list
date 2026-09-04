/**
 * Renders the whole directory into one self-contained HTML file.
 *
 * The Next.js app is the real product; this is the shareable snapshot — a single
 * file with the data inlined, so a link can be handed to someone with no build
 * step and no hosting. Re-run it whenever the dataset changes.
 *
 *   npm run preview
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

const read = (rel: string) => JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8'));

const delivered = read('data/dispensaries.json') as unknown[];
const dispensaries = delivered.length > 0 ? delivered : read('data/dispensaries.demo.json');
const municipalities = read('data/municipalities.json');
const isDemo = delivered.length === 0;

let html = readFileSync(resolve(ROOT, 'scripts/preview.template.html'), 'utf8');

html = html
  .replace('/*__DISPENSARIES__*/', JSON.stringify(dispensaries))
  .replace('/*__MUNICIPALITIES__*/', JSON.stringify(municipalities));

// The sample-data notice is only honest while the delivered dataset is empty.
if (!isDemo) {
  html = html.replace(/<div class="notice">[\s\S]*?<\/div>\s*<\/div>\s*/, '');
}

mkdirSync(resolve(ROOT, 'preview'), { recursive: true });
const out = resolve(ROOT, 'preview/index.html');
writeFileSync(out, html);

console.log(`Wrote ${out}`);
console.log(`  ${dispensaries.length} dispensaries${isDemo ? ' (sample data)' : ''}, ${municipalities.length} municipalities`);
console.log(`  ${(Buffer.byteLength(html) / 1024).toFixed(1)} kB`);
