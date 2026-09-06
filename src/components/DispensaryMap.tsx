'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as LeafletMap, CircleMarker, LayerGroup } from 'leaflet';
import clsx from 'clsx';
import 'leaflet/dist/leaflet.css';
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
      p.menuCount > 0 ? ` · ${p.menuCount} strains listed` : ''
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
      }).setView([40.75, -73.93], 11);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(map);

      /* A map two thirds of a screen tall sits in the middle of a scrolling
         page, so it must not swallow the wheel on the way past. Clicking into
         it hands the wheel over; leaving it hands the wheel back. */
      map.on('click', () => map.scrollWheelZoom.enable());
      containerRef.current.addEventListener('mouseleave', () => map.scrollWheelZoom.disable());

      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setReady(true);
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

      <div
        ref={containerRef}
        className="mt-4 h-[68vh] min-h-[420px] w-full overflow-hidden rounded-xl border border-ink-700 bg-ink-900"
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
