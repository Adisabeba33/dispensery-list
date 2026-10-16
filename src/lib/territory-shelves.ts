import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * How much of a territory's shelf has been read, counted from its own
 * flower-listings.json at build time.
 *
 * Its own module, read only by the server-rendered page: territory-data.ts is
 * also imported by the client-side explorer, and a shelf file is megabytes
 * that no browser needs in order to print two numbers.
 */
export const shelfCountsFor = (dataDir: string): { shops: number; listings: number } | null => {
  const file = join(process.cwd(), dataDir, 'flower-listings.json');
  if (!existsSync(file)) return null;
  const rows = JSON.parse(readFileSync(file, 'utf8')) as { licenseNumber: string }[];
  return { shops: new Set(rows.map((r) => r.licenseNumber)).size, listings: rows.length };
};
