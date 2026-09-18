/**
 * The three territories this register covers, read from data/territories.json.
 *
 * They are kept apart on purpose. NYC + Westchester is the delivered dataset
 * and keeps the original paths at data/*.json, so nothing about it moves and
 * nothing about it breaks; upstate and Long Island each own a directory beside
 * it. Merging them would produce one coverage number, one opt-out rule and one
 * platform mix standing in for three genuinely different markets.
 *
 * Every script that takes `--territory <id>` defaults to `nyc`, which resolves
 * to exactly the paths it used before this file existed.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');

export interface Territory {
  id: string;
  label: string;
  dataDir: string;
  route: string;
  /** The counties it contains. Mutually exclusive with excludeCounties. */
  counties?: string[];
  /** Everything EXCEPT these. Used by upstate so a new county is covered. */
  excludeCounties?: string[];
  note?: string;
}

export const TERRITORIES: Territory[] = (
  JSON.parse(readFileSync(resolve(ROOT, 'data/territories.json'), 'utf8')) as {
    territories: Territory[];
  }
).territories;

export const DEFAULT_TERRITORY = 'nyc';

export function getTerritory(id: string = DEFAULT_TERRITORY): Territory {
  const found = TERRITORIES.find((t) => t.id === id);
  if (!found) {
    throw new Error(
      `Unknown territory "${id}". Known: ${TERRITORIES.map((t) => t.id).join(', ')}`,
    );
  }
  return found;
}

/** Reads --territory off argv; absent means the original NYC scope. */
export function territoryFromArgv(argv: string[] = process.argv): Territory {
  const at = argv.indexOf('--territory');
  return getTerritory(at === -1 ? DEFAULT_TERRITORY : argv[at + 1]);
}

/** Does this county belong to the territory? */
export function inTerritory(t: Territory, county: string | null): boolean {
  if (!county) return false;
  if (t.counties) return t.counties.includes(county);
  if (t.excludeCounties) return !t.excludeCounties.includes(county);
  return false;
}

/** An absolute path inside the territory's data directory. */
export function dataPath(t: Territory, file: string): string {
  return resolve(ROOT, t.dataDir, file);
}
