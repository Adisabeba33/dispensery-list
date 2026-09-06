import type { Metadata } from 'next';
import Link from 'next/link';
import { ShelfIndex, type StrainEntry } from '@/components/ShelfIndex';
import { dispensaries, displayName, regionOf } from '@/lib/data';
import { prettyDate } from '@/lib/format';
import { listings, sizeChips } from '@/lib/menu';

export const metadata: Metadata = {
  title: 'Flower on the shelves',
  description:
    'Every flower strain read off the menus of licensed New York dispensaries, by the gram, eighth, quarter, half and ounce — and which shop has it.',
};

export default function MenusPage() {
  const shopOf = new Map(dispensaries.map((d) => [d.licenseNumber, d]));

  /* One entry per strain, gathering every shop that has it. A strain in four
     shops is the question this page exists to answer — the directory can only
     ever tell you what one shop stocks. */
  const byStrain = new Map<string, StrainEntry>();
  for (const l of listings) {
    const key = l.strainNameCanonical ?? l.strainNameRaw.toLowerCase();
    const shop = shopOf.get(l.licenseNumber);
    if (!shop) continue;

    let entry = byStrain.get(key);
    if (!entry) {
      entry = {
        key,
        name: l.strainNameRaw,
        lineage: l.lineage,
        thcPercent: l.thcPercent,
        sizes: [],
        brands: [],
        hasTerpenes: false,
        shops: [],
      };
      byStrain.set(key, entry);
    }

    entry.sizes = [...new Set([...entry.sizes, ...(l.availableSizesGrams ?? [])])].sort((a, b) => a - b);
    // Shops write the same brand differently — "mini mart" and "Mini MART" —
    // and listing both makes one brand look like two.
    if (l.brand && !entry.brands.some((b) => b.toLowerCase() === l.brand!.toLowerCase())) {
      entry.brands.push(l.brand);
    }
    if (entry.lineage === 'UNKNOWN') entry.lineage = l.lineage;
    // Shops disagree on potency for the same strain; the figure shown is the
    // highest any of them states, and the shop's own page carries its own.
    if (l.thcPercent !== null) entry.thcPercent = Math.max(entry.thcPercent ?? 0, l.thcPercent);
    if (l.terpenes.profile.length > 0) entry.hasTerpenes = true;
    if (!entry.shops.some((s) => s.id === shop.id)) {
      entry.shops.push({ id: shop.id, name: displayName(shop), region: regionOf(shop) });
    }
  }

  const strains = [...byStrain.values()].sort(
    (a, b) => b.shops.length - a.shops.length || a.name.localeCompare(b.name),
  );

  const shelves = [...new Set(listings.map((l) => l.licenseNumber))]
    .map((licence) => {
      const shop = shopOf.get(licence);
      const own = listings.filter((l) => l.licenseNumber === licence);
      return {
        shop,
        count: own.length,
        sizes: sizeChips(own.flatMap((l) => l.availableSizesGrams ?? [])),
      };
    })
    .filter((s) => s.shop)
    .sort((a, b) => b.count - a.count);

  const capturedAt = listings
    .map((l) => l.capturedAt)
    .sort()
    .at(-1);

  return (
    <div className="shell py-12">
      <p className="label">Shelves</p>
      <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-chalk-50 sm:text-4xl">
        Flower on the shelves
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-chalk-200">
        {strains.length} strains read off the menus of {shelves.length} licensed shops — by the gram,
        eighth, quarter, half and ounce. Nothing here is invented: every line came off a shop&apos;s
        own menu{capturedAt ? ` on ${prettyDate(capturedAt)}` : ''}, and a shop whose menu we have
        not read shows none.
      </p>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight text-chalk-50">Shops with a menu</h2>
        <p className="mt-2 max-w-2xl text-sm text-chalk-400">
          Of {dispensaries.length} licensed dispensaries in the register, these are the ones whose
          shelf has been read. The rest are in the{' '}
          <Link href="/" className="link">
            directory
          </Link>{' '}
          — the menus simply are not reachable yet.
        </p>

        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shelves.map(({ shop, count, sizes }) => (
            <li key={shop!.id}>
              <Link href={`/dispensary/${shop!.id}/#menu`} className="card card-hover block p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="block truncate font-semibold tracking-tight text-chalk-50">
                      {displayName(shop!)}
                    </span>
                    <span className="mt-0.5 block text-xs text-chalk-500">{regionOf(shop!)}</span>
                  </div>
                  <span className="pill shrink-0 border-moss-600/45 bg-moss-600/10 text-moss-400">
                    {count} strains
                  </span>
                </div>
                <p className="mt-3 text-xs text-chalk-400">
                  {sizes.map((s) => s.short).join(' · ')}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14 border-t border-ink-700/70 pt-10">
        <h2 className="text-xl font-semibold tracking-tight text-chalk-50">Find a strain</h2>
        <p className="mt-2 max-w-2xl text-sm text-chalk-400">
          Search across every collected shelf at once. A strain carried by more than one shop lists
          them all, so you can see where it is before you travel.
        </p>
        <div className="mt-6">
          <ShelfIndex strains={strains} />
        </div>
      </section>

      <p className="mt-12 max-w-2xl text-xs leading-relaxed text-chalk-500">
        Shelves change hourly and this page does not. Treat it as what a shop published when its
        menu was read, not as what is in the jar today — and confirm anything that matters with the
        shop before you travel.
      </p>
    </div>
  );
}
