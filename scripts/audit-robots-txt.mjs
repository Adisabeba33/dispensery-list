/**
 * Audit robots.txt compliance for dispensary menu scrapers.
 * Checks if the websites of dispensaries with collected menus have
 * robots.txt that forbid scraping, and reports any conflicts.
 */

import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

const dispensaries = JSON.parse(readFileSync('./data/dispensaries.json', 'utf-8'));

// Filter to those with websites and menus that were collected
const withMenus = dispensaries.filter(d => d.contact?.website && d.menu);

console.log(`\nAuditing ${withMenus.length} dispensaries with collected menus...\n`);

const results = {
  tested: 0,
  blocked: [],
  allowed: [],
  errors: [],
};

for (const d of withMenus) {
  const website = d.contact.website;
  if (!website || !website.startsWith('http')) continue;

  results.tested += 1;

  try {
    const url = new URL(website);
    const robotsUrl = `${url.protocol}//${url.hostname}/robots.txt`;

    const response = await fetch(robotsUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AuditBot/1.0)' },
      timeout: 5000,
    });

    if (!response.ok) {
      // No robots.txt found (404) is OK - means no restrictions
      if (response.status === 404) {
        results.allowed.push({ shop: d.dbaName || d.legalName, website, reason: 'No robots.txt' });
      } else {
        results.errors.push({ shop: d.dbaName || d.legalName, website, status: response.status });
      }
      continue;
    }

    const robotsText = await response.text();
    const blocked = robotsText.toLowerCase().includes('disallow: /') ||
                    robotsText.toLowerCase().match(/disallow:\s*\//);

    if (blocked) {
      results.blocked.push({
        shop: d.dbaName || d.legalName,
        website,
        robotsUrl,
      });
    } else {
      results.allowed.push({
        shop: d.dbaName || d.legalName,
        website,
        reason: 'robots.txt found, no general disallow',
      });
    }
  } catch (e) {
    results.errors.push({
      shop: d.dbaName || d.legalName,
      website,
      error: e.message,
    });
  }
}

// Report
console.log(`\n=== ROBOTS.TXT AUDIT RESULTS ===\n`);
console.log(`Tested: ${results.tested} websites`);
console.log(`Blocked by robots.txt: ${results.blocked.length}`);
console.log(`Allowed (no disallow): ${results.allowed.length}`);
console.log(`Errors/timeouts: ${results.errors.length}`);

if (results.blocked.length > 0) {
  console.log(`\n⚠️  BLOCKED BY ROBOTS.TXT:\n`);
  for (const item of results.blocked) {
    console.log(`  • ${item.shop}`);
    console.log(`    Website: ${item.website}`);
    console.log(`    robots.txt: ${item.robotsUrl}\n`);
  }
}

if (results.errors.length > 0) {
  console.log(`\n⚠️  ERRORS (could not verify):\n`);
  for (const item of results.errors) {
    console.log(`  • ${item.shop}: ${item.error || `Status ${item.status}`}\n`);
  }
}

console.log(`\n=== SUMMARY ===`);
console.log(`✅ Safe to scrape: ${results.allowed.length}/${results.tested}`);
console.log(`❌ Blocked: ${results.blocked.length}/${results.tested}`);
console.log(`⚠️  Could not verify: ${results.errors.length}/${results.tested}\n`);
