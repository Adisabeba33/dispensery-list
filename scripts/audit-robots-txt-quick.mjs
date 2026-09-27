/**
 * Quick audit of robots.txt for first 30 dispensaries with menus.
 * Checks for any disallow rules that would restrict scraping.
 */

import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

const dispensaries = JSON.parse(readFileSync('./data/dispensaries.json', 'utf-8'));
const withMenus = dispensaries
  .filter(d => d.contact?.website && d.menu)
  .slice(0, 30); // Check first 30 for speed

console.log(`\nQuick audit of ${withMenus.length} dispensaries...\n`);

const results = { blocked: [], allowed: [], errors: [], noRobots: [] };

for (const d of withMenus) {
  const website = d.contact.website;
  if (!website?.startsWith('http')) continue;

  try {
    const url = new URL(website);
    const robotsUrl = `${url.protocol}//${url.hostname}/robots.txt`;

    const response = await fetch(robotsUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (audit)' },
      timeout: 3000,
    });

    const shop = d.dbaName || d.legalName;

    if (response.status === 404) {
      results.noRobots.push(shop);
      continue;
    }

    if (!response.ok) {
      results.errors.push({ shop, status: response.status });
      continue;
    }

    const text = await response.text();
    // Check for any disallow rule
    const hasDisallow = text.toLowerCase().includes('disallow:');
    const blocksScraping = text.toLowerCase().match(/disallow:\s*\//);

    if (blocksScraping) {
      results.blocked.push(shop);
    } else if (hasDisallow) {
      results.allowed.push(shop);
    } else {
      results.allowed.push(shop);
    }
  } catch (e) {
    results.errors.push({ shop: d.dbaName || d.legalName, error: e.message });
  }
}

const total = results.blocked.length + results.allowed.length + results.noRobots.length;
console.log(`✅ AUDIT RESULTS (${total} sites checked)\n`);
console.log(`Allowed / No specific block: ${results.allowed.length}`);
console.log(`Blocked by robots.txt: ${results.blocked.length}`);
console.log(`No robots.txt file: ${results.noRobots.length}`);
console.log(`Errors: ${results.errors.length}\n`);

if (results.blocked.length > 0) {
  console.log(`⚠️  BLOCKED SITES:\n${results.blocked.map(s => '  • ' + s).join('\n')}\n`);
}

if (results.errors.length > 0) {
  console.log(`❌ ERRORS:\n${results.errors.map(e => `  • ${e.shop}: ${e.error || e.status}`).join('\n')}\n`);
}

console.log(`---`);
console.log(`Safe to scrape: ${results.allowed.length}/${total} (${Math.round(results.allowed.length/total*100)}%)`);
if (results.blocked.length > 0) {
  console.log(`Should skip: ${results.blocked.length}/${total} (${Math.round(results.blocked.length/total*100)}%)`);
}
