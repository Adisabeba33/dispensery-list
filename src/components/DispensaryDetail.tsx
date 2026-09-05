import {
  COUNTY_LABEL,
  displayName,
  LICENSE_TYPE_LABEL,
  regionOf,
} from '@/lib/data';
import {
  fullAddress,
  mapsUrl,
  prettyDate,
  prettyDay,
  prettyPhone,
  SERVICE_LABELS,
  WEEKDAYS,
} from '@/lib/format';
import { listingsFor } from '@/lib/menu';
import type { Dispensary } from '@/lib/types';
import { LicenseTag } from './Badges';
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
export const DispensaryDetail = ({ d }: { d: Dispensary }) => {
  const services = SERVICE_LABELS.map(({ key, label }) => ({
    label,
    value: d.services?.[key] as boolean | null | undefined,
  })).filter((s) => s.value !== undefined);

  const hasHours = d.hours !== null;
  const menu = listingsFor(d.licenseNumber);

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

      {menu.length > 0 && (
        <div className="mt-8">
          <FlowerMenu listings={menu} />
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
                <Row label="Expires">{prettyDate(d.dates.licenseExpiration)}</Row>
              )}
              {d.dates?.openedOn && <Row label="Opened">{prettyDate(d.dates.openedOn)}</Row>}
            </dl>
          </section>

          <section className="card p-6">
            <h2 className="text-base font-semibold tracking-tight text-chalk-50">Location</h2>
            <dl className="mt-3">
              <Row label="Address">
                <a className="link" href={mapsUrl(d)} target="_blank" rel="noreferrer noopener">
                  {fullAddress(d)}
                </a>
              </Row>
              <Row label="Area">
                {regionOf(d)} · {COUNTY_LABEL[d.address.county]} County
              </Row>
              {d.address.neighborhood && <Row label="Neighborhood">{d.address.neighborhood}</Row>}
              {d.contact?.phone && (
                <Row label="Phone">
                  <a className="link" href={`tel:${d.contact.phone}`}>
                    {prettyPhone(d.contact.phone)}
                  </a>
                </Row>
              )}
              {d.contact?.website && (
                <Row label="Website">
                  <a className="link break-all" href={d.contact.website} target="_blank" rel="noreferrer noopener">
                    {d.contact.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                </Row>
              )}
              {d.menu?.menuUrl && (
                <Row label="Menu">
                  <a className="link break-all" href={d.menu.menuUrl} target="_blank" rel="noreferrer noopener">
                    {d.menu.provider ? `${d.menu.provider.toLowerCase()} listing` : 'online menu'}
                  </a>
                </Row>
              )}
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
                checked — call ahead or use the shop&apos;s own site.
              </p>
            )}
          </section>
        </div>

        <div className="space-y-8">
          <section className="card p-6">
            <h2 className="text-base font-semibold tracking-tight text-chalk-50">Services</h2>
            {services.length === 0 ? (
              <p className="mt-3 text-sm text-chalk-400">Not collected yet.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {services.map((s) => (
                  <li key={s.label} className="flex items-center justify-between gap-3">
                    <span className="text-chalk-200">{s.label}</span>
                    <span
                      className={
                        s.value === true
                          ? 'text-moss-400'
                          : s.value === false
                            ? 'text-chalk-500'
                            : 'text-chalk-500'
                      }
                    >
                      {s.value === true ? 'Yes' : s.value === false ? 'No' : 'Unknown'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

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
