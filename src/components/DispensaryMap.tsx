'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as LeafletMap, CircleMarker, LayerGroup } from 'leaflet';
import { AllAreasIcon, AreaIcon, ShelfBarsIcon } from './AreaIcons';
import { chipClass } from './PageParts';
import 'leaflet/dist/leaflet.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import './map-theme.css';

export type MapPoint = {
  id: string;
  name: string;
  address: string;
  region: string;
  status: 'OPEN' | 'APPROVED_NOT_OPEN' | 'TEMPORARILY_CLOSED' | 'PERMANENTLY_CLOSED' | 'UNKNOWN';
  lat: number;
  lng: number;
  menuCount: number;
};

const REGION_ORDER = ['Manhattan', 'Brooklyn', 'Queens', 'The Bronx', 'Staten Island', 'Westchester'];

/* One colour per meaning, taken from the palette the badges already use, so a
   pin and a badge for the same shop never disagree: moss-400, chalk-400,
   amber-400, rust-400, and chalk-500 for a status nobody has confirmed. */
const STATUS_COLOR: Record<MapPoint['status'], string> = {
  OPEN: '#41e591',
  APPROVED_NOT_OPEN: '#879990',
  TEMPORARILY_CLOSED: '#f2b544',
  PERMANENTLY_CLOSED: '#ef6f62',
  UNKNOWN: '#75877d',
};

const STATUS_LABEL: Record<MapPoint['status'], string> = {
  OPEN: 'Open',
  APPROVED_NOT_OPEN: 'Licensed, not open yet',
  TEMPORARILY_CLOSED: 'Temporarily closed',
  PERMANENTLY_CLOSED: 'Closed',
  UNKNOWN: 'Status unconfirmed',
};

/** Popup bodies are built as HTML, so every value from the dataset is escaped. */
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* The status in its own colour, as on the cards; the shelf after it in the
   lamp's: green when we read it, red with "No data yet" when we do not. */
const popupHtml = (p: MapPoint) => `
  <div class="map-popup">
    <a class="map-popup-name" href="/dispensary/${esc(p.id)}/">${esc(p.name)}</a>
    <p class="map-popup-meta">${esc(p.address)}</p>
    <p class="map-popup-status"><span style="color:${STATUS_COLOR[p.status]}">${STATUS_LABEL[p.status]}</span>${
      p.menuCount > 0
        ? ` · <span class="map-popup-shelf">${p.menuCount} strains on the shelf</span>`
        : ' · <span class="map-popup-shelf map-popup-unread">No data yet</span>'
    }</p>
  </div>`;

/* The directory's chips, drawn by the kit's own helper so the two pages
   filter alike: the six areas in two rows of four and three at a phone's
   428px, and the two toggles on a row of their own under them. */
const mapChip = (on: boolean, { greyIcon = false } = {}) => chipClass(on, { icon: true, greyIcon });

export const DispensaryMap = ({ points }: { points: MapPoint[] }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const [ready, setReady] = useState(false);

  const [region, setRegion] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(false);
  const [menuOnly, setMenuOnly] = useState(false);

  const regions = useMemo(() => {
    const present = new Set(points.map((p) => p.region));
    return REGION_ORDER.filter((r) => present.has(r));
  }, [points]);

  // The pins whose shelf we read, for the toggle's count.
  const shelvesRead = useMemo(() => points.filter((p) => p.menuCount > 0).length, [points]);

  const visible = useMemo(
    () =>
      points.filter((p) => {
        if (region && p.region !== region) return false;
        if (openOnly && p.status !== 'OPEN') return false;
        if (menuOnly && p.menuCount === 0) return false;
        return true;
      }),
    [points, region, openOnly, menuOnly],
  );

  /* Leaflet reads `window` the moment it is imported, and this page is
     pre-rendered to static HTML at build time — so the library can only be
     pulled in once the component is running in a browser. */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const L = await import('leaflet');
      if (cancelled || !containerRef.current || mapRef.current) return;

      leafletRef.current = L;
      const map = L.map(containerRef.current, {
        zoomControl: true,
        scrollWheelZoom: false, // a map inside a scrolling page must not hijack the wheel
        attributionControl: true,
        maxZoom: 19, // street level; the base map below goes no further than 22
      }).setView([40.75, -73.93], 11);

      /* A map two thirds of a screen tall sits in the middle of a scrolling
         page, so it must not swallow the wheel on the way past. Clicking into
         it hands the wheel over; leaving it hands the wheel back. */
      map.on('click', () => map.scrollWheelZoom.enable());
      containerRef.current.addEventListener('mouseleave', () => map.scrollWheelZoom.disable());

      // The pins first: they need Leaflet alone, not the base map below.
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setReady(true);

      /* The base map: OpenFreeMap, OpenStreetMap drawn from vector tiles, free
         with no key and no limit on views. CARTO's dark tiles, used until
         October 2026, began answering every request without a key with an
         "API key required" picture. MapLibre draws it inside the Leaflet map
         and needs WebGL2; without it the pins stand on the dark ground. */
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return;
      probe.getExtension('WEBGL_lose_context')?.loseContext();

      const maplibre = await import('maplibre-gl');
      const { maplibreGL } = await import('@maplibre/maplibre-gl-leaflet');
      if (cancelled || mapRef.current !== map) return;
      // MapLibre looks for its worker beside its own file, which the bundle
      // moves; this hands it the copy the bundle emits.
      maplibre.setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).href);

      const base = maplibreGL({
        style: 'https://tiles.openfreemap.org/styles/dark',
        // The credit is ours to write, not HTML taken from the tile server.
        attributionControl: {
          customAttribution:
            '<a href="https://openfreemap.org">OpenFreeMap</a> <a href="https://www.openmaptiles.org/">&copy; OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        },
      }).addTo(map);
      // During a pinch, draw the base in the same frame as the pins.
      map.on('zoom', () => base.getMaplibreMap()?.redraw());
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Redraw the pins whenever the filters change.
  useEffect(() => {
    const L = leafletRef.current;
    const layer = layerRef.current;
    if (!ready || !L || !layer) return;

    layer.clearLayers();

    for (const p of visible) {
      const marker: CircleMarker = L.circleMarker([p.lat, p.lng], {
        radius: p.menuCount > 0 ? 7 : 5,
        color: STATUS_COLOR[p.status],
        weight: p.menuCount > 0 ? 2.4 : 1.4,
        opacity: 0.95,
        fillColor: STATUS_COLOR[p.status],
        fillOpacity: p.status === 'OPEN' ? 0.55 : 0.3,
      }).bindPopup(popupHtml(p), { closeButton: true, maxWidth: 280 });

      marker.addTo(layer);

      /* Leaflet draws pins as bare SVG paths, which no keyboard can reach.
         Without this the map is mouse-only. */
      const el = marker.getElement();
      if (el) {
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', `${p.name}, ${p.address}. ${STATUS_LABEL[p.status]}`);
        el.addEventListener('keydown', (event) => {
          const key = (event as KeyboardEvent).key;
          if (key === 'Enter' || key === ' ') {
            event.preventDefault();
            marker.openPopup();
          }
        });
      }
    }
  }, [ready, visible]);

  const fitToResults = () => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || visible.length === 0) return;
    map.fitBounds(L.latLngBounds(visible.map((p) => [p.lat, p.lng] as [number, number])), {
      padding: [32, 32],
      maxZoom: 15,
    });
  };

  return (
    <div>
      {/* As on the home page: on a phone the two toggles take a row of their
          own under the areas; wider, they follow on the same line. */}
      <div className="flex flex-col gap-[0.5625rem] sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-2.5">
        <div
          role="group"
          aria-label="Area"
          className="flex flex-wrap gap-x-[0.4375rem] gap-y-[0.5625rem] [@media(max-width:427px)]:gap-x-1.5 sm:gap-2"
        >
          <button
            type="button"
            onClick={() => setRegion(null)}
            aria-pressed={region === null}
            className={mapChip(region === null, { greyIcon: true })}
          >
            <AllAreasIcon />
            All areas
          </button>
          {regions.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRegion(region === r ? null : r)}
              aria-pressed={region === r}
              className={mapChip(region === r, { greyIcon: true })}
            >
              <AreaIcon area={r} />
              {r}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-x-[0.4375rem] gap-y-[0.5625rem] sm:gap-2">
          {/* The registry's operational status, not opening hours. */}
          <button
            type="button"
            onClick={() => setOpenOnly((v) => !v)}
            aria-pressed={openOnly}
            className={mapChip(openOnly)}
          >
            <span aria-hidden className="grid w-[0.9375rem] place-items-center">
              <span className="h-2 w-2 rounded-full bg-moss-400 shadow-[0_0_6px_rgba(var(--glow),0.6)]" />
            </span>
            Open now
          </button>
          <button
            type="button"
            onClick={() => setMenuOnly((v) => !v)}
            aria-pressed={menuOnly}
            className={mapChip(menuOnly)}
          >
            <ShelfBarsIcon />
            Shelf read <span className="tabular-nums text-chalk-400">{shelvesRead}</span>
          </button>
        </div>
      </div>

      {/* The count, and the one action on the map, over a rule — as the
          directory's count sits over its list. */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-ink-700 pb-2 sm:mt-6">
        <p className="text-[0.8125rem] text-chalk-400 sm:text-sm" aria-live="polite">
          <span className="text-[0.9375rem] font-bold tabular-nums text-chalk-50 sm:text-base">
            {visible.length}
          </span>{' '}
          of {points.length} mapped dispensaries shown.
        </p>
        {/* At the right, as the directory's sort is, even when a narrow
            phone puts it on a line of its own. */}
        <button type="button" onClick={fitToResults} className="btn ml-auto">
          Fit to results
        </button>
      </div>

      {/* The map in the dim frame, its border lit at two corners like an
          instrument's display; the key on a strip along its foot. The
          brackets lie on the frame's border and turn with its radius. */}
      <div
        className="card hud-corners hud-corners-round mt-4 sm:mt-5"
      >
        {/* isolate: Leaflet's panes stack in the hundreds; inside their own
            context they stay under the header, its menu and the phone's bar. */}
        <div
          ref={containerRef}
          className="isolate h-[68vh] min-h-[420px] w-full overflow-hidden rounded-t-[calc(0.5rem-1px)] bg-ink-900"
        />

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-ink-700 px-4 py-3 text-[0.8125rem] text-chalk-300 sm:text-sm">
          {(['OPEN', 'APPROVED_NOT_OPEN', 'UNKNOWN'] as const).map((s) => (
            <span key={s} className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: STATUS_COLOR[s], opacity: s === 'OPEN' ? 1 : 0.55 }}
              />
              {STATUS_LABEL[s]}
            </span>
          ))}
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden
              className="h-3.5 w-3.5 rounded-full border-2"
              style={{ borderColor: STATUS_COLOR.OPEN }}
            />
            Larger ring: a menu has been collected
          </span>
        </div>
      </div>
    </div>
  );
};
