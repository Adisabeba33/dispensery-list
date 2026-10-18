'use client';

import { useEffect, useState } from 'react';
import {
  COUNTY_LABEL,
  displayName,
  LICENSE_TYPE_LABEL,
  regionOf,
} from '@/lib/data';
import { fullAddress, prettyDate, prettyDay, prettyPhone, WEEKDAYS } from '@/lib/format';
import type { FlowerListing } from '@/lib/menu-format';
import type { Dispensary } from '@/lib/types';
import { LicenseTag, ShelfLamp } from './Badges';
import { FlowerMenu } from './FlowerMenu';

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1 border-b border-ink-700/60 py-3 last:border-0 sm:flex-row sm:gap-6">
    <dt className="label shrink-0 pt-0.5 sm:w-44">{label}</dt>
    <dd className="min-w-0 text-sm text-chalk-100">{children}</dd>
  </div>
);

/**
 * Everything about one dispensary below its name. Shared by the card that
 * expands in the directory and the standalone page a link points at, so the
 * two cannot drift apart.
 */
/**
 * `menu` is passed by the shop's own page, which is rendered on the server and
 * already holds the shelf. The directory cannot: its cards are interactive, and
 * a client bundle carrying every shop's menu would be six megabytes. So when it
 * is not passed, the one shop's menu is fetched as it is opened.
 */
export const DispensaryDetail = ({
  d,
  menu: given,
  hasMenu = true,
  partialShelf = false,
  menuUnavailable = false,
}: {
  d: Dispensary;
  menu?: FlowerListing[];
  /** The card already counted the shelf; without this we would ask for a file
      that is not there for three hundred and forty-six of the shops. */
  hasMenu?: boolean;
  /** We read only a window onto this shop's menu (scripts/shelf-history.py). */
  partialShelf?: boolean;
  /** The shop's online menu is not read (data/menu-paused.json): say so rather
      than show nothing, or a shelf weeks old. */
  menuUnavailable?: boolean;
}) => {
  const [fetched, setFetched] = useState<FlowerListing[] | null>(null);
  const [menuState, setMenuState] = useState<'idle' | 'loading' | 'failed'>('idle');

  useEffect(() => {
    if (given || !hasMenu) return;
    let cancelled = false;
    setMenuState('loading');
    fetch(`/shelves/${encodeURIComponent(d.licenseNumber)}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: FlowerListing[]) => {
        if (!cancelled) {
          setFetched(data);
          setMenuState('idle');
        }
      })
      .catch(() => {
        /* We only ask when the shop is known to have a shelf, so a failure here
           means the shelf files are missing or unreachable — the deployment
           did not run scripts/emit-shop-menus.mjs, most likely. Say so rather
           than render a shop with no menu, which reads as "this shop has
           none" and is a lie. */
        if (!cancelled) {
          setFetched([]);
          setMenuState('failed');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [d.licenseNumber, given, hasMenu]);

  const hasHours = d.hours !== null;
  const menu = given ?? fetched ?? [];

  /* Fifteen records carry a licence the registry calls active whose published
     expiry has already passed. Showing the date without saying so leaves the
     reader to notice it themselves, and most will not.
     Compared against the day we last read the registry, not today: the page is
     built once and read later, so today's date would differ between the
     server's markup and the browser's, and the register can only speak as of
     its own snapshot anyway. */
  const expired =
    d.dates?.licenseExpiration != null && d.dates.licenseExpiration < d.lastUpdated.slice(0, 10);

  return (
    <>
      {d.warnings.length > 0 && (
        <div className="mt-6 rounded-xl border border-amber-400/30 bg-amber-400/[0.07] p-4">
          <p className="label text-amber-400">Caveats</p>
          <ul className="mt-2 space-y-1.5 text-sm text-chalk-200">
            {d.warnings.map((w) => (
              <li key={w}>· {w}</li>
            ))}
          </ul>
        </div>
      )}

      {menuState === 'loading' && (
        <p className="mt-8 text-sm text-chalk-500">Reading this shop&apos;s shelf…</p>
      )}

      {menuState === 'failed' && (
        <p className="mt-8 text-sm text-amber-400">
          This shop&apos;s shelf could not be loaded here.{' '}
          <a href={`/dispensary/${d.id}/#menu`} className="link">
            Open its page instead
          </a>
          .
        </p>
      )}

      {/* A shop whose shelf we do not read — never read, or no longer
          (data/menu-paused.json) — has a red lamp, and here it says so. */}
      {(given ? given.length === 0 : !hasMenu) && (
        <div className="mt-8 flex items-start gap-3 rounded-xl border border-rust-400/30 bg-rust-400/[0.06] p-4">
          <ShelfLamp read={false} className="mt-1.5" />
          <div>
            <p className="font-medium text-chalk-50">No data yet</p>
            <p className="mt-1 text-sm text-chalk-400">
              {menuUnavailable
                ? 'We used to read this shop’s shelf and no longer can, so none is shown rather than an old one.'
                : 'We do not read this shop’s shelf, so there is nothing on it to show.'}
            </p>
          </div>
        </div>
      )}

      {menu.length > 0 && (
        <div className="mt-8">
          <FlowerMenu listings={menu} partialShelf={partialShelf} />
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="space-y-8">
          <section className="card p-6">
            <h2 className="text-base font-semibold tracking-tight text-chalk-50">Licence</h2>
            <dl className="mt-3">
              <Row label="Licence number">
                <LicenseTag d={d} />
              </Row>
              <Row label="Licence type">{LICENSE_TYPE_LABEL[d.licenseType]}</Row>
              <Row label="Licence status">{d.licenseStatus.toLowerCase()}</Row>
              {d.seeCategory && d.seeCategory !== 'NONE' && (
                <Row label="Equity category">{d.seeCategory.replaceAll('_', ' ').toLowerCase()}</Row>
              )}
              {d.dates?.licenseIssued && <Row label="Issued">{prettyDate(d.dates.licenseIssued)}</Row>}
              {d.dates?.licenseExpiration && (
                <Row label="Expires">
                  {prettyDate(d.dates.licenseExpiration)}
                  {expired && (
                    <span className="ml-2 text-amber-400">
                      — this date has passed, though the registry still lists the licence as
                      active. Neither we nor the reader can tell from the published data whether it
                      was renewed.
                    </span>
                  )}
                </Row>
              )}
              {d.dates?.openedOn && <Row label="Opened">{prettyDate(d.dates.openedOn)}</Row>}
            </dl>
          </section>

          <section className="card p-6">
            <h2 className="text-base font-semibold tracking-tight text-chalk-50">Location</h2>
            <dl className="mt-3">
              <Row label="Address">{fullAddress(d)}</Row>
              <Row label="Area">
                {regionOf(d)} · {COUNTY_LABEL[d.address.county]} County
              </Row>
              {d.address.neighborhood && <Row label="Neighborhood">{d.address.neighborhood}</Row>}
              {/* An index, not a way in: no link to the shop's site, its menu or
                  a map — the phone number is a fact about the shop, shown as one. */}
              {d.contact?.phone && <Row label="Phone">{prettyPhone(d.contact.phone)}</Row>}
            </dl>
          </section>

          <section className="card p-6">
            <h2 className="text-base font-semibold tracking-tight text-chalk-50">Opening hours</h2>
            {hasHours ? (
              <>
                <table className="mt-3 w-full text-sm">
                  <tbody>
                    {WEEKDAYS.map(({ key, label }) => (
                      <tr key={key} className="border-b border-ink-700/60 last:border-0">
                        <th scope="row" className="py-2 text-left font-medium text-chalk-400">
                          {label}
                        </th>
                        <td className="py-2 text-right tabular-nums text-chalk-100">
                          {prettyDay(d.hours!.week[key])}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {d.hours?.notes && <p className="mt-3 text-xs text-chalk-500">{d.hours.notes}</p>}
              </>
            ) : (
              <p className="mt-3 text-sm text-chalk-400">
                Not collected yet. We would rather say nothing than publish hours we have not
                checked.
              </p>
            )}
          </section>
        </div>

        <div className="space-y-8">
          <section className="card p-6">
            <h2 className="text-base font-semibold tracking-tight text-chalk-50">
              Where this came from
            </h2>
            <ol className="mt-3 space-y-3 text-sm">
              {d.sources.map((source) => (
                <li key={source.url}>
                  <a className="link break-all" href={source.url} target="_blank" rel="noreferrer noopener">
                    {source.label ?? source.url}
                  </a>
                  <p className="mt-0.5 text-xs text-chalk-500">
                    {source.type.replaceAll('_', ' ').toLowerCase()} · retrieved{' '}
                    {prettyDate(source.retrievedAt)}
                  </p>
                </li>
              ))}
            </ol>
            {d.verification.notes && (
              <p className="mt-4 border-t border-ink-700/60 pt-3 text-xs leading-relaxed text-chalk-400">
                {d.verification.notes}
              </p>
            )}
          </section>

          <section className="card border-moss-600/30 bg-moss-600/[0.06] p-6">
            <h2 className="text-base font-semibold tracking-tight text-chalk-50">Check it yourself</h2>
            <p className="mt-2 text-sm leading-relaxed text-chalk-200">
              Look for the QR-coded verification decal at the entrance, or search this address on
              the state tool.
            </p>
            <a
              href="https://cannabis.ny.gov/dispensary-location-verification"
              target="_blank"
              rel="noreferrer noopener"
              className="mt-4 inline-block rounded-lg border border-moss-600/60 bg-moss-600/12 px-4 py-2.5 text-sm font-medium text-moss-400 transition-colors hover:bg-moss-600/20"
            >
              Open the state verification tool
            </a>
          </section>
        </div>
      </div>
    </>
  );
};
