'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as LeafletMap, CircleMarker, LayerGroup } from 'leaflet';
import clsx from 'clsx';
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
   pin and a badge for the same shop never disagree. */
const STATUS_COLOR: Record<MapPoint['status'], string> = {
  OPEN: '#3fc97d',
  APPROVED_NOT_OPEN: '#8b9a93',
  TEMPORARILY_CLOSED: '#f2b544',
  PERMANENTLY_CLOSED: '#ef6f62',
  UNKNOWN: '#6d7d76',
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

const popupHtml = (p: MapPoint) => `
  <div class="map-popup">
    <a class="map-popup-name" href="/dispensary/${esc(p.id)}/">${esc(p.name)}</a>
    <p class="map-popup-meta">${esc(p.address)}</p>
    <p class="map-popup-status" style="color:${STATUS_COLOR[p.status]}">${STATUS_LABEL[p.status]}${
      p.menuCount > 0 ? ` · ${p.menuCount} strains on the shelf` : ' · No data yet'
    }</p>
  </div>`;

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
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setRegion(null)}
          className={clsx('chip', region === null && 'chip-on')}
        >
          All areas
        </button>
        {regions.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRegion(region === r ? null : r)}
            className={clsx('chip', region === r && 'chip-on')}
          >
            {r}
          </button>
        ))}
        <span aria-hidden className="mx-1 h-5 w-px bg-ink-700" />
        <button
          type="button"
          onClick={() => setOpenOnly((v) => !v)}
          aria-pressed={openOnly}
          className={clsx('chip', openOnly && 'chip-on')}
        >
          Open now trading
        </button>
        <button
          type="button"
          onClick={() => setMenuOnly((v) => !v)}
          aria-pressed={menuOnly}
          className={clsx('chip', menuOnly && 'chip-on')}
        >
          Has a collected menu
        </button>
        <button type="button" onClick={fitToResults} className="chip">
          Fit to results
        </button>
      </div>

      <p className="mt-3 text-sm text-chalk-400" aria-live="polite">
        {visible.length} of {points.length} mapped dispensaries shown.
      </p>

      {/* isolate: Leaflet's panes stack in the hundreds; inside their own
          context they stay under the header, its menu and the phone's bar. */}
      <div
        ref={containerRef}
        className="isolate mt-4 h-[68vh] min-h-[420px] w-full overflow-hidden rounded-xl border border-ink-700 bg-ink-900"
      />

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-chalk-400">
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
  );
};
