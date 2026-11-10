import React, { useEffect, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MapLibreMap, Marker } from 'maplibre-gl';
import { GLASGOW_CENTRE, LngLat } from '../../../src/config/closures';
import { CLOSED_LINE_COLOUR, DIVERSION_LINE_COLOUR, MAP_CREDIT, MAP_STYLE_URL } from '../../../src/config/map';

export type DrawMode = 'pin' | 'closed' | 'diversion';

interface ClosureMapEditorProps {
  pin: LngLat | null;
  closedLine: LngLat[];
  diversionLine: LngLat[];
  onChange: (next: { pin: LngLat | null; closedLine: LngLat[]; diversionLine: LngLat[] }) => void;
}

const MODES: { id: DrawMode; label: string; help: string }[] = [
  { id: 'pin', label: 'Place pin', help: 'Click the map where the numbered pin should go.' },
  { id: 'closed', label: 'Draw closed stretch', help: 'Click along the closed road, one point at a time. It is drawn in red.' },
  { id: 'diversion', label: 'Draw diversion', help: 'Click along the diversion route, one point at a time. It is drawn as a blue dashed line.' },
];

const round = (n: number) => Math.round(n * 1e6) / 1e6;

const lineData = (points: LngLat[]) => ({
  type: 'FeatureCollection' as const,
  features: [
    ...(points.length >= 2
      ? [{ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: points } }]
      : []),
    ...points.map((p) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: p } })),
  ],
});

/**
 * Newsroom map for a closure: click to place the pin, or to draw the closed stretch and the diversion one
 * point at a time. Nothing needs typing; the latitude / longitude boxes in the form stay available as a fallback.
 */
export const ClosureMapEditor: React.FC<ClosureMapEditorProps> = ({ pin, closedLine, diversionLine, onChange }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const libRef = useRef<typeof import('maplibre-gl') | null>(null);
  const pinMarker = useRef<Marker | null>(null);
  const [mode, setMode] = useState<DrawMode>('pin');
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');

  // The click handler always needs the latest values
  const latest = useRef({ mode, pin, closedLine, diversionLine, onChange });
  latest.current = { mode, pin, closedLine, diversionLine, onChange };

  useEffect(() => {
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
        const start = latest.current.pin || latest.current.closedLine[0] || GLASGOW_CENTRE;
        const map = new lib.Map({
          container: boxRef.current,
          style: MAP_STYLE_URL,
          center: start,
          zoom: latest.current.pin ? 14 : 11,
          dragRotate: false,
          pitchWithRotate: false,
          attributionControl: { compact: true },
        });
        map.addControl(new lib.NavigationControl({ showCompass: false }), 'top-right');
        map.getCanvas().style.cursor = 'crosshair';
        mapRef.current = map;

        map.on('load', () => {
          if (cancelled) return;
          for (const [kind, colour] of [['diversion', DIVERSION_LINE_COLOUR], ['closed', CLOSED_LINE_COLOUR]] as const) {
            map.addSource(`edit-${kind}`, { type: 'geojson', data: lineData([]) });
            map.addLayer({
              id: `edit-${kind}-line`,
              type: 'line',
              source: `edit-${kind}`,
              filter: ['==', ['geometry-type'], 'LineString'],
              paint:
                kind === 'closed'
                  ? { 'line-color': colour, 'line-width': 6 }
                  : { 'line-color': colour, 'line-width': 4, 'line-dasharray': [2, 1.5] },
            });
            map.addLayer({
              id: `edit-${kind}-points`,
              type: 'circle',
              source: `edit-${kind}`,
              filter: ['==', ['geometry-type'], 'Point'],
              paint: { 'circle-radius': 5, 'circle-color': '#ffffff', 'circle-stroke-color': colour, 'circle-stroke-width': 3 },
            });
          }
          setState('ready');
        });

        map.on('click', (e) => {
          const point: LngLat = [round(e.lngLat.lng), round(e.lngLat.lat)];
          const now = latest.current;
          if (now.mode === 'pin') now.onChange({ pin: point, closedLine: now.closedLine, diversionLine: now.diversionLine });
          else if (now.mode === 'closed') now.onChange({ pin: now.pin, closedLine: [...now.closedLine, point], diversionLine: now.diversionLine });
          else now.onChange({ pin: now.pin, closedLine: now.closedLine, diversionLine: [...now.diversionLine, point] });
        });
      } catch (err) {
        console.warn('Map failed to load:', err);
        if (!cancelled) setState('failed');
      }
    })();
    return () => {
      cancelled = true;
      pinMarker.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Redraw whenever the values change
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (state !== 'ready' || !map || !lib) return;
    (map.getSource('edit-closed') as GeoJSONSource | undefined)?.setData(lineData(closedLine));
    (map.getSource('edit-diversion') as GeoJSONSource | undefined)?.setData(lineData(diversionLine));
    pinMarker.current?.remove();
    pinMarker.current = null;
    if (pin) pinMarker.current = new lib.Marker({ color: '#f7e14b' }).setLngLat(pin).addTo(map);
  }, [state, pin, closedLine, diversionLine]);

  const current = mode === 'closed' ? closedLine : diversionLine;
  const setLine = (points: LngLat[]) =>
    onChange(mode === 'closed' ? { pin, closedLine: points, diversionLine } : { pin, closedLine, diversionLine: points });

  const button = (active: boolean) =>
    `px-3 py-2 rounded text-xs font-bold border ${
      active ? 'bg-[#f7e14b] text-neutral-900 border-[#f7e14b]' : 'bg-neutral-800 text-neutral-200 border-neutral-600 hover:bg-neutral-700'
    }`;

  return (
    <div className="space-y-2">
      <div role="group" aria-label="What a click on the map does" className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => setMode(m.id)} className={button(mode === m.id)}>
            {m.label}
          </button>
        ))}
        {mode === 'pin' ? (
          <button type="button" disabled={!pin} onClick={() => onChange({ pin: null, closedLine, diversionLine })} className={`${button(false)} disabled:opacity-40`}>
            Remove pin
          </button>
        ) : (
          <>
            <button type="button" disabled={current.length === 0} onClick={() => setLine(current.slice(0, -1))} className={`${button(false)} disabled:opacity-40`}>
              Undo last point
            </button>
            <button type="button" disabled={current.length === 0} onClick={() => setLine([])} className={`${button(false)} disabled:opacity-40`}>
              Clear this line
            </button>
          </>
        )}
      </div>
      <p className="text-xs text-neutral-300">{MODES.find((m) => m.id === mode)?.help}</p>

      <div className="relative h-[360px] bg-neutral-800 border border-neutral-600 rounded overflow-hidden">
        <div ref={boxRef} className="w-full h-full" role="region" aria-label="Map for placing the closure" />
        {state !== 'ready' && (
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-neutral-200 pointer-events-none">
            {state === 'failed'
              ? 'The map could not be loaded. You can still type the latitude and longitude below.'
              : 'Loading map…'}
          </p>
        )}
      </div>
      <p className="text-[11px] text-neutral-400">
        Map: {MAP_CREDIT.map((c) => c.label).join(' · ')}. Closed stretch: {closedLine.length} points. Diversion: {diversionLine.length} points.
      </p>
    </div>
  );
};
