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
import { LicenseTag, ShelfPill } from './Badges';
import { FlowerMenu } from './FlowerMenu';
import { Chevron } from './PageParts';

/* A label and its value, as one line of the record: the label in the mono of
   the card's licence line, beside its value, and above it only on a phone too
   narrow for the two. (Plain media variants, bounded: Tailwind's min-[…]
   goes away beside the em-based `nav` screen.) */
const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid gap-x-3 gap-y-1 border-b border-ink-700/70 py-3 last:border-b-0 [@media(min-width:400px)_and_(max-width:639px)]:grid-cols-[8.5rem_minmax(0,1fr)] sm:grid-cols-[10.5rem_minmax(0,1fr)] sm:gap-x-4">
    <dt className="label pt-0.5">{label}</dt>
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
    <div className="mt-6 space-y-8 sm:mt-8">
      {d.warnings.length > 0 && (
        <div className="note note-caution">
          <p className="label text-amber-400">Caveats</p>
          <ul className="mt-2 space-y-1.5">
            {d.warnings.map((w) => (
              <li key={w}>· {w}</li>
            ))}
          </ul>
        </div>
      )}

      {menuState === 'loading' && (
        <p className="stamp flex items-center gap-2">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-moss-400 motion-reduce:animate-none" />
          Reading this shop&apos;s shelf…
        </p>
      )}

      {menuState === 'failed' && (
        <p className="note note-caution">
          This shop&apos;s shelf could not be loaded here.{' '}
          <a href={`/dispensary/${d.id}/#menu`} className="link">
            Open its page instead
          </a>
          .
        </p>
      )}

      {/* A shop whose shelf we do not read — never read, or no longer
          (data/menu-paused.json) — has a red lamp, and here it says so, in
          the place its shelf would be and with the card's own red pill. */}
      {(given ? given.length === 0 : !hasMenu) && (
        <section>
          <h2 className="section-title">Flower on the shelf</h2>
          <div className="card mt-3 flex flex-col items-start gap-2.5 p-4 sm:p-5">
            <ShelfPill count={0} />
            <p className="text-sm leading-relaxed text-chalk-300">
              {menuUnavailable
                ? 'We used to read this shop’s shelf and no longer can, so none is shown rather than an old one.'
                : 'We do not read this shop’s shelf, so there is nothing on it to show.'}
            </p>
          </div>
        </section>
      )}

      {menu.length > 0 && <FlowerMenu listings={menu} partialShelf={partialShelf} />}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-6">
        <div className="space-y-8">
          <section>
            <h2 className="section-title">Licence</h2>
            <dl className="card mt-3 px-4 sm:px-5">
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

          <section>
            <h2 className="section-title">Location</h2>
            <dl className="card mt-3 px-4 sm:px-5">
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

          <section>
            <h2 className="section-title">Opening hours</h2>
            {hasHours ? (
              <div className="card mt-3 px-4 sm:px-5">
                <table className="w-full text-sm">
                  <tbody>
                    {WEEKDAYS.map(({ key, label }) => (
                      <tr key={key} className="border-b border-ink-700/70 last:border-b-0">
                        <th scope="row" className="label py-2.5 text-left">
                          {label}
                        </th>
                        <td className="py-2.5 text-right tabular-nums text-chalk-100">
                          {prettyDay(d.hours!.week[key])}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {d.hours?.notes && (
                  <p className="stamp border-t border-ink-700/70 py-3">{d.hours.notes}</p>
                )}
              </div>
            ) : (
              <p className="card mt-3 px-4 py-3.5 text-sm leading-relaxed text-chalk-400 sm:px-5">
                Not collected yet. We would rather say nothing than publish hours we have not
                checked.
              </p>
            )}
          </section>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="section-title">Where this came from</h2>
            <div className="card mt-3 overflow-hidden">
              {/* What the record rests on: the state's registry and the
                  regulator's pages, the links out the register keeps. */}
              <ol className="divide-y divide-ink-700/70">
                {d.sources.map((source) => (
                  <li key={source.url}>
                    <a
                      className="row-link group px-4 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-moss-400 sm:px-5"
                      href={source.url}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-chalk-50 transition-colors [overflow-wrap:anywhere] group-hover:text-moss-400">
                          {source.label ?? source.url}
                        </span>
                        <span className="stamp mt-0.5 block">
                          {source.type.replaceAll('_', ' ').toLowerCase()} · retrieved{' '}
                          {prettyDate(source.retrievedAt)}
                        </span>
                      </span>
                      <Chevron className="text-chalk-400" />
                    </a>
                  </li>
                ))}
              </ol>
              {d.verification.notes && (
                <p className="border-t border-ink-700/70 px-4 py-3 text-xs leading-relaxed text-chalk-400 sm:px-5">
                  {d.verification.notes}
                </p>
              )}
            </div>
          </section>

          <section>
            <h2 className="section-title">Check it yourself</h2>
            <div className="card mt-3 p-4 sm:p-5">
              <p className="text-sm leading-relaxed text-chalk-200">
                Look for the QR-coded verification decal at the entrance, or search this address on
                the state tool.
              </p>
              <a
                href="https://cannabis.ny.gov/dispensary-location-verification"
                target="_blank"
                rel="noreferrer noopener"
                className="btn btn-lit mt-4"
              >
                Open the state verification tool
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
