/**
 * Full robots.txt audit for all 255 dispensaries with menus.
 * Runs in background - outputs results to audit-results.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { URL } from 'node:url';

const dispensaries = JSON.parse(readFileSync('./data/dispensaries.json'));
const withMenus = dispensaries.filter(d => d.contact?.website && d.menu);

console.log(`Auditing ${withMenus.length} dispensaries (this may take several minutes)...\n`);

const results = { blocked: 0, allowed: 0, noRobots: 0, errors: 0, shops: [] };
let tested = 0;

for (const d of withMenus) {
  tested++;
  if (tested % 20 === 0) console.log(`  Checked ${tested}/${withMenus.length}...`);

  const website = d.contact.website;
  if (!website?.startsWith('http')) continue;

  const shop = d.dbaName || d.legalName;

  try {
    const url = new URL(website);
    const robotsUrl = `${url.protocol}//${url.hostname}/robots.txt`;
    const response = await fetch(robotsUrl, { headers: { 'User-Agent': 'Audit/1.0' }, timeout: 3000 });

    if (response.status === 404) {
      results.noRobots++;
      results.shops.push({ shop, website, status: 'no-robots' });
      continue;
    }

    if (!response.ok) {
      results.errors++;
      continue;
    }

    const text = await response.text();
    const blocksScraping = text.toLowerCase().match(/disallow:\s*\//);

    if (blocksScraping) {
      results.blocked++;
      results.shops.push({ shop, website, status: 'blocked' });
    } else {
      results.allowed++;
      results.shops.push({ shop, website, status: 'allowed' });
    }
  } catch (e) {
    results.errors++;
  }
}

const total = results.blocked + results.allowed + results.noRobots;
results.summary = {
  tested: total,
  blocked: results.blocked,
  blockedPercent: Math.round(results.blocked / total * 100),
  allowed: results.allowed,
  allowedPercent: Math.round(results.allowed / total * 100),
  noRobots: results.noRobots,
  errors: results.errors,
};

writeFileSync('/tmp/audit-results.json', JSON.stringify(results, null, 2));
console.log(`\n✅ Results saved to /tmp/audit-results.json\n`);
console.log(`Summary: ${results.blocked}/${total} blocked (${results.summary.blockedPercent}%), ${results.allowed} allowed`);
