import type { Metadata } from 'next';
import Link from 'next/link';
import { DispensaryMap, type MapPoint } from '@/components/DispensaryMap';
import { Chevron, PageHead } from '@/components/PageParts';
import { dispensaries, displayName, regionOf } from '@/lib/data';
import { fullAddress } from '@/lib/format';
import { listingsFor } from '@/lib/menu';

export const metadata: Metadata = {
  title: 'Map',
  description:
    'Every licensed New York City and Westchester dispensary in the register, placed on a map by the address on its licence.',
};

export default function MapPage() {
  /* Only what a pin needs crosses into the client bundle: the full records are
     over a megabyte, and the map has no use for licences, hours or sources. */
  const points: MapPoint[] = dispensaries
    .filter((d) => d.geo !== null)
    .map((d) => ({
      id: d.id,
      name: displayName(d),
      address: fullAddress(d),
      region: regionOf(d),
      status: d.operationalStatus,
      lat: d.geo!.lat,
      lng: d.geo!.lng,
      // Every strain on the shelf, like the cards.
      menuCount: listingsFor(d.licenseNumber).length,
    }));

  const unmapped = dispensaries.filter((d) => d.geo === null);

  return (
    <div className="shell pb-16">
      <PageHead kicker="Map" title="Where the licensed shops are">
        <p>
          {points.length} of the {dispensaries.length} dispensaries in the register have
          coordinates. Each pin is a business licensed by the New York State Office of Cannabis
          Management — open one to read its record.
        </p>
      </PageHead>

      <div className="mt-8 sm:mt-10">
        <DispensaryMap points={points} />
      </div>

      <div className="mt-12 grid gap-x-10 gap-y-12 sm:mt-14 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section>
          <h2 className="section-title">How precise these pins are</h2>
          <div className="mt-3 max-w-3xl space-y-3 text-sm leading-relaxed text-chalk-200">
            <p>
              Every coordinate here is derived from the postal address on the licence, not
              surveyed on the ground. That places a pin on the right block and usually the right
              building, but it can land on a neighbour, and on a long address range it can drift
              further.
            </p>
            <p>
              A pin is not proof a shop is trading today. Licensed-but-not-open businesses are on
              the map too, in grey, because knowing a licence exists at an address is part of the
              record.
            </p>
          </div>
        </section>

        <section>
          <h2 className="section-title">
            Not on the map <span className="font-medium tabular-nums text-chalk-400">({unmapped.length})</span>
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-chalk-200">
            These records are in the register but could not be placed: the address on the licence
            did not resolve to a single point. They are listed in full in the directory.
          </p>
          {/* One frame, a ruled list of records inside it, each row leading
              to its page. Every row keeps its rule, the last ones' lying over
              the frame's own, so the columns end level. */}
          <ul className="card mt-5 grid px-4 sm:grid-cols-2 sm:gap-x-8 sm:px-5">
            {unmapped.map((d) => (
              <li key={d.id} className="row-link -mb-px py-0 last:border-b">
                <Link
                  href={`/dispensary/${d.id}/`}
                  className="flex min-h-[2.75rem] min-w-0 flex-1 items-center gap-3 rounded-sm py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-400"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-chalk-50">{displayName(d)}</span>
                    <span className="block truncate text-xs text-chalk-400">{d.address.city}</span>
                  </span>
                  <Chevron className="text-chalk-400" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="stamp mt-12 max-w-3xl">
        Base map by{' '}
        <a className="link" href="https://openfreemap.org" target="_blank" rel="noreferrer noopener">
          OpenFreeMap
        </a>
        , tiles &copy;{' '}
        <a className="link" href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer noopener">
          OpenMapTiles
        </a>
        , map data &copy;{' '}
        <a className="link" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer noopener">
          OpenStreetMap
        </a>{' '}
        contributors, available under the Open Database Licence.
      </p>
    </div>
  );
}
