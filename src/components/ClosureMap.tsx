import React, { useEffect, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MapLibreMap, Marker } from 'maplibre-gl';
import { GLASGOW_CENTRE, LngLat } from '../config/closures';
import { CLOSED_LINE_COLOUR, DIVERSION_LINE_COLOUR, MAP_CREDIT, MAP_STYLE_URL } from '../config/map';

export interface MapPin {
  id: string;
  /** Number shown on the pin (matches the list beside the map); a plain dot when left out */
  number?: number;
  lng: number;
  lat: number;
  /** Read out by screen readers and shown as a tooltip */
  label: string;
}

export interface MapLine {
  id: string;
  kind: 'closed' | 'diversion';
  points: LngLat[];
}

interface ClosureMapProps {
  pins: MapPin[];
  lines?: MapLine[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Accessible name for the map region */
  label: string;
  /** Tailwind height classes for the map box */
  heightClassName?: string;
  /** Show the red / blue dashed line legend under the map */
  legend?: boolean;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function linesToGeoJson(lines: MapLine[], kind: MapLine['kind']) {
  return {
    type: 'FeatureCollection' as const,
    features: lines
      .filter((l) => l.kind === kind && l.points.length >= 2)
      .map((l) => ({
        type: 'Feature' as const,
        properties: { id: l.id },
        geometry: { type: 'LineString' as const, coordinates: l.points },
      })),
  };
}

/**
 * A draggable street map with numbered pins, the closed stretch in red and the diversion as a blue dashed line.
 *
 * The map library is large, so it is not part of the site's main code: it is downloaded only when a map is
 * about to scroll into view. On phones the page scrolls with one finger and the map moves with two, so the
 * map never traps a reader who is scrolling past it.
 */
export const ClosureMap: React.FC<ClosureMapProps> = ({
  pins,
  lines = [],
  selectedId = null,
  onSelect,
  label,
  heightClassName = 'h-[320px] sm:h-[420px]',
  legend = false,
}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, { marker: Marker; el: HTMLButtonElement }>>(new Map());
  const libRef = useRef<typeof import('maplibre-gl') | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [state, setState] = useState<'waiting' | 'loading' | 'ready' | 'failed'>('waiting');

  // 1. Start loading the map code when the box is about to come into view
  useEffect(() => {
    const box = boxRef.current;
    if (!box || state !== 'waiting') return;
    if (!('IntersectionObserver' in window)) {
      setState('loading');
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          setState('loading');
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(box);
    return () => observer.disconnect();
  }, [state]);

  // 2. Create the map
  useEffect(() => {
    if (state !== 'loading' || !boxRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        const [lib, worker] = await Promise.all([
          import('maplibre-gl'),
          import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'),
          import('maplibre-gl/dist/maplibre-gl.css'),
        ]);
        if (cancelled || !boxRef.current) return;
        lib.setWorkerUrl(worker.default);
        libRef.current = lib;

        const map = new lib.Map({
          container: boxRef.current,
          style: MAP_STYLE_URL,
          center: GLASGOW_CENTRE,
          zoom: 11,
          minZoom: 8,
          maxZoom: 17,
          attributionControl: { compact: true },
          cooperativeGestures: true,
          dragRotate: false,
          pitchWithRotate: false,
        });
        map.touchZoomRotate.disableRotation();
        map.addControl(new lib.NavigationControl({ showCompass: false }), 'top-right');
        mapRef.current = map;

        map.on('load', () => {
          if (cancelled) return;
          for (const kind of ['diversion', 'closed'] as const) {
            map.addSource(`ds-${kind}`, { type: 'geojson', data: linesToGeoJson([], kind) });
            // A white casing under each line keeps it readable over any background
            map.addLayer({
              id: `ds-${kind}-casing`,
              type: 'line',
              source: `ds-${kind}`,
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint: { 'line-color': '#ffffff', 'line-width': 9 },
            });
            map.addLayer({
              id: `ds-${kind}-line`,
              type: 'line',
              source: `ds-${kind}`,
              layout: { 'line-cap': kind === 'closed' ? 'round' : 'butt', 'line-join': 'round' },
              paint:
                kind === 'closed'
                  ? { 'line-color': CLOSED_LINE_COLOUR, 'line-width': 6 }
                  : { 'line-color': DIVERSION_LINE_COLOUR, 'line-width': 4, 'line-dasharray': [2, 1.5] },
            });
          }
          setState('ready');
        });
        map.on('error', (e) => {
          // A missing tile is not fatal; failing to load the map style is
          if (!map.isStyleLoaded() && /style|Failed to fetch|NetworkError/i.test(String(e?.error?.message || ''))) {
            setState((s) => (s === 'ready' ? s : 'failed'));
          }
        });
      } catch (err) {
        console.warn('Map failed to load:', err);
        if (!cancelled) setState('failed');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state]);

  // Remove the map when the component goes away
  useEffect(
    () => () => {
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    },
    [],
  );

  // 3. Draw pins and lines, and frame them, whenever they change
  const pinsKey = pins.map((p) => `${p.id}:${p.number ?? ''}:${p.lng}:${p.lat}`).join('|');
  const linesKey = lines.map((l) => `${l.id}:${l.kind}:${l.points.length}:${l.points[0]?.join(',')}`).join('|');
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (state !== 'ready' || !map || !lib) return;

    (map.getSource('ds-closed') as GeoJSONSource | undefined)?.setData(linesToGeoJson(lines, 'closed'));
    (map.getSource('ds-diversion') as GeoJSONSource | undefined)?.setData(linesToGeoJson(lines, 'diversion'));

    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current.clear();
    pins.forEach((pin) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'ds-pin';
      el.textContent = pin.number !== undefined ? String(pin.number) : '';
      el.setAttribute('aria-label', pin.label);
      el.title = pin.label;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectRef.current?.(pin.id);
      });
      const marker = new lib.Marker({ element: el, anchor: 'center' }).setLngLat([pin.lng, pin.lat]).addTo(map);
      markersRef.current.set(pin.id, { marker, el });
    });

    const points: LngLat[] = [...pins.map((p) => [p.lng, p.lat] as LngLat), ...lines.flatMap((l) => l.points)];
    if (points.length === 1) {
      map.jumpTo({ center: points[0], zoom: 14 });
    } else if (points.length > 1) {
      const bounds = points.reduce((b, p) => b.extend(p), new lib.LngLatBounds(points[0], points[0]));
      map.fitBounds(bounds, { padding: 48, maxZoom: 15, animate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, pinsKey, linesKey]);

  // 4. Highlight the selected pin and bring it into view
  useEffect(() => {
    const map = mapRef.current;
    if (state !== 'ready' || !map) return;
    markersRef.current.forEach(({ el }, id) => {
      const selected = id === selectedId;
      el.classList.toggle('ds-pin-selected', selected);
      el.setAttribute('aria-pressed', selected ? 'true' : 'false');
      el.style.zIndex = selected ? '2' : '1';
    });
    const pin = pins.find((p) => p.id === selectedId);
    if (pin && !map.getBounds().contains([pin.lng, pin.lat])) {
      if (prefersReducedMotion()) map.jumpTo({ center: [pin.lng, pin.lat] });
      else map.easeTo({ center: [pin.lng, pin.lat], duration: 400 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, selectedId, pinsKey]);

  return (
    <div>
      <div className={`relative bg-surface-2 border-2 border-ink ${heightClassName}`}>
        <div ref={boxRef} role="region" aria-label={label} className="w-full h-full" />
        {state !== 'ready' && (
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm font-bold text-ink pointer-events-none">
            {state === 'failed'
              ? 'The map could not be loaded. Every closure is still listed on this page.'
              : 'Loading map…'}
          </p>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-ink-muted">
        {legend && (
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 font-bold text-ink" aria-label="Map key">
            <li className="flex items-center gap-2">
              <span className="inline-block w-7 h-1.5" style={{ background: CLOSED_LINE_COLOUR }} aria-hidden="true" />
              Closed
            </li>
            <li className="flex items-center gap-2">
              <span
                className="inline-block w-7 border-t-4 border-dashed"
                style={{ borderColor: DIVERSION_LINE_COLOUR }}
                aria-hidden="true"
              />
              Diversion
            </li>
          </ul>
        )}
        <p>
          Map:{' '}
          {MAP_CREDIT.map((credit, i) => (
            <React.Fragment key={credit.href}>
              {i > 0 && ' · '}
              <a href={credit.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">
                {credit.label}
              </a>
            </React.Fragment>
          ))}
        </p>
      </div>
    </div>
  );
};
