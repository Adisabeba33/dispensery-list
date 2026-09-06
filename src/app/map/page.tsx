import type { Metadata } from 'next';
import Link from 'next/link';
import { DispensaryMap, type MapPoint } from '@/components/DispensaryMap';
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
      menuCount: listingsFor(d.licenseNumber).length,
    }));

  const unmapped = dispensaries.filter((d) => d.geo === null);

  return (
    <div className="shell py-12">
      <p className="label">Map</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-chalk-50 sm:text-4xl">
        Where the licensed shops are
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-chalk-200">
        {points.length} of the {dispensaries.length} dispensaries in the register have coordinates.
        Each pin is a business licensed by the New York State Office of Cannabis Management — open
        one to read its record.
      </p>

      <div className="mt-10">
        <DispensaryMap points={points} />
      </div>

      <section className="mt-12 grid gap-6 border-t border-ink-700/70 pt-8 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-chalk-50">
            How precise these pins are
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-chalk-200">
            Every coordinate here is derived from the postal address on the licence, not surveyed
            on the ground. That places a pin on the right block and usually the right building, but
            it can land on a neighbour, and on a long address range it can drift further. For
            directions, use the address itself — each record links out to a maps search built from
            it rather than from the pin.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-chalk-200">
            A pin is not proof a shop is trading today. Licensed-but-not-open businesses are on the
            map too, in grey, because knowing a licence exists at an address is part of the record.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold tracking-tight text-chalk-50">
            Not on the map ({unmapped.length})
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-chalk-200">
            These records are in the register but could not be placed: the address on the licence
            did not resolve to a single point. They are listed in full in the directory.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {unmapped.map((d) => (
              <li key={d.id}>
                <Link href={`/dispensary/${d.id}/`} className="link">
                  {displayName(d)}
                </Link>
                <span className="text-chalk-400"> — {d.address.city}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <p className="mt-10 text-xs leading-relaxed text-chalk-500">
        Base map tiles &copy;{' '}
        <a className="link" href="https://carto.com/attributions" target="_blank" rel="noreferrer noopener">
          CARTO
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
