'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as topojson from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection, Geometry } from 'geojson';
import { fetchAllRisks } from '@/lib/api';
import type { RiskSummary } from '@/lib/types';
import { DEPARTMENTS } from '@/lib/data/departments';

const COLOMBIA_BOUNDS: [[number, number], [number, number]] = [[-82, -4.5], [-66, 12.5]];
const MIN_ZOOM = 3.5;

/** Bogotá (11) is merged visually into Cundinamarca (25) */
const CODE_REMAP: Record<number, number> = { 11: 25 };

const RISK_COLORS: Record<string, string> = {
  low: '#22c55e', medium: '#eab308', high: '#f97316', 'very-high': '#ef4444',
};

/** Free CARTO basemaps — no token required */
const CARTO_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const CARTO_LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

const DEPT_NAMES = new Map(DEPARTMENTS.map(d => [d.code, d.name]));

interface ColombiaMapProps {
  onDepartmentClick: (code: number) => void;
  selectedCode: number | null;
  highlightedCodes?: Set<number> | null;
  compact?: boolean;
}

export default function ColombiaMap({
  onDepartmentClick,
  selectedCode,
  highlightedCodes = null,
  compact = false,
}: ColombiaMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const geojsonRef = useRef<FeatureCollection<Geometry> | null>(null);
  const hovIdRef = useRef<number | null>(null);
  const addLayersRef = useRef<() => void>(() => { });
  const appliedTheme = useRef<string>('');
  const [layersReady, setLayersReady] = useState(false);

  const { resolvedTheme } = useTheme();

  // Risks now load asynchronously from Supabase. Stays empty until the
  // first fetch resolves; the choropleth shows a fallback gray until then.
  const risks = useRef<RiskSummary[]>([]);

  // Stable refs so event handlers inside the init closure always read current props
  const clickRef = useRef(onDepartmentClick);
  const hlRef = useRef(highlightedCodes);
  useEffect(() => { clickRef.current = onDepartmentClick; }, [onDepartmentClick]);
  useEffect(() => { hlRef.current = highlightedCodes; }, [highlightedCodes]);

  // Initialize map once on mount
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const isDark = document.documentElement.classList.contains('dark');
    appliedTheme.current = isDark ? 'dark' : 'light';

    const m = new maplibregl.Map({
      container: containerRef.current,
      style: isDark ? CARTO_DARK : CARTO_LIGHT,
      bounds: COLOMBIA_BOUNDS,
      fitBoundsOptions: { padding: compact ? 20 : 60 },
      minZoom: MIN_ZOOM,
      attributionControl: false,
      dragRotate: false,
    });
    mapRef.current = m;

    popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false });

    // Build enriched GeoJSON from the TopoJSON file. Reads `risks.current`
    // at call time, so re-running this after risks load gives fresh colors.
    const buildGeoJSON = async () => {
      const res = await fetch('/colombia_departamentos.json');
      const topo = (await res.json()) as Topology;
      const raw = topojson.feature(
        topo,
        topo.objects['MGN_DPTO_POLITICO_rJAC'] as GeometryCollection,
      ) as FeatureCollection<Geometry>;

      const riskMap = new Map(
        risks.current.map((r: RiskSummary) => [r.dept_code, r]),
      );

      raw.features = raw.features.map(f => {
        const p = (f.properties ?? {}) as Record<string, unknown>;
        const rawCode = (p.codigo_departamento_n as number) ?? 0;
        const code = CODE_REMAP[rawCode] ?? rawCode;   // Bogotá → Cundinamarca
        const risk = riskMap.get(code);
        return {
          ...f,
          properties: {
            ...p,
            deptCode: code,
            deptName: DEPT_NAMES.get(code) ?? `Dept ${code}`,
            riskColor: risk ? (RISK_COLORS[risk.risk_level] ?? '#6b7280') : '#6b7280',
            predictedCases: risk?.predicted_cases ?? 0,
            isHighlighted: 1,   // 1 = highlighted, 0 = grayed; updated via setData()
          },
        };
      });

      geojsonRef.current = raw;
    };

    // Add / refresh choropleth layers (called on initial load AND on style change)
    const addLayers = () => {
      if (!geojsonRef.current) return;

      // Remove existing if present
      (['departments-border', 'departments-fill'] as const).forEach(id => {
        if (m.getLayer(id)) m.removeLayer(id);
      });
      if (m.getSource('departments')) m.removeSource('departments');

      m.addSource('departments', {
        type: 'geojson',
        data: geojsonRef.current,
        generateId: true,
      });

      m.addLayer({
        id: 'departments-fill',
        type: 'fill',
        source: 'departments',
        paint: {
          'fill-color': [
            'case',
            ['==', ['get', 'isHighlighted'], 0], '#94a3b8',
            ['get', 'riskColor'],
          ],
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false], 0.88,
            ['==', ['get', 'isHighlighted'], 0], 0.22,
            0.68,
          ],
        },
      });

      m.addLayer({
        id: 'departments-border',
        type: 'line',
        source: 'departments',
        paint: {
          'line-color': '#1e4a7a',
          'line-width': 0.8,
        },
      });

      hovIdRef.current = null;
      setLayersReady(true);
    };

    // Keep the ref up-to-date so the theme effect can trigger a re-add
    addLayersRef.current = addLayers;

    // Map events use stable refs so closures always read current props
    m.on('mousemove', 'departments-fill', (e) => {
      if (!e.features?.length) return;
      const feat = e.features[0];
      const code = feat.properties?.deptCode as number;
      const hl = hlRef.current;
      if (hl !== null && !hl.has(code)) { m.getCanvas().style.cursor = ''; return; }

      m.getCanvas().style.cursor = 'pointer';

      if (hovIdRef.current !== null) {
        m.setFeatureState({ source: 'departments', id: hovIdRef.current }, { hover: false });
      }
      hovIdRef.current = feat.id as number;
      m.setFeatureState({ source: 'departments', id: feat.id as number }, { hover: true });

      const name = feat.properties?.deptName as string ?? `Dept ${code}`;
      const cases = (feat.properties?.predictedCases as number) ?? 0;

      popupRef.current
        ?.setLngLat(e.lngLat)
        .setHTML(
          `<div style="font-family:system-ui,sans-serif;padding:8px 12px;` +
          `background:rgba(10,14,26,0.95);border:1px solid rgba(255,255,255,0.12);` +
          `border-radius:10px;color:#f8fafc;font-size:12px;backdrop-filter:blur(10px);min-width:160px">` +
          `<div style="font-weight:700;margin-bottom:3px;font-size:13px">${name}</div>` +
          `<div style="color:#94a3b8">Next week: <span style="color:#22d3ee;font-weight:600">` +
          `${cases.toLocaleString()} cases</span></div></div>`,
        )
        .addTo(m);
    });

    m.on('mouseleave', 'departments-fill', () => {
      m.getCanvas().style.cursor = '';
      if (hovIdRef.current !== null) {
        m.setFeatureState({ source: 'departments', id: hovIdRef.current }, { hover: false });
        hovIdRef.current = null;
      }
      popupRef.current?.remove();
    });

    m.on('click', 'departments-fill', (e) => {
      if (!e.features?.length) return;
      const code = e.features[0].properties?.deptCode as number;
      const hl = hlRef.current;
      if (hl !== null && !hl.has(code)) return;
      clickRef.current(code);
    });

    // After every style swap (setStyle), re-add choropleth layers
    m.on('style.load', () => {
      if (geojsonRef.current) addLayersRef.current();
    });

    // Initial full load: fetch risk data + build GeoJSON, then add layers.
    // We fetch risks BEFORE building so the first paint already has colors.
    m.on('load', async () => {
      try {
        risks.current = await fetchAllRisks();
      } catch (err) {
        // Don't break the map if Supabase is unreachable; render gray.
        console.error('[ColombiaMap] fetchAllRisks failed:', err);
      }
      await buildGeoJSON();
      addLayersRef.current();
    });

    return () => { m.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap tile style when theme changes
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !resolvedTheme) return;
    if (resolvedTheme === appliedTheme.current) return;   // already applied

    appliedTheme.current = resolvedTheme;
    setLayersReady(false);
    // style.load handler will call addLayersRef.current() once the new style loads
    m.setStyle(resolvedTheme === 'dark' ? CARTO_DARK : CARTO_LIGHT);
  }, [resolvedTheme]);

  // Update choropleth data when highlighted codes change
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !geojsonRef.current || !layersReady) return;

    const updated = {
      ...geojsonRef.current,
      features: geojsonRef.current.features.map(f => ({
        ...f,
        properties: {
          ...f.properties,
          isHighlighted:
            highlightedCodes === null || highlightedCodes.has(f.properties?.deptCode as number)
              ? 1
              : 0,
        },
      })),
    };
    (m.getSource('departments') as maplibregl.GeoJSONSource | undefined)?.setData(updated);
  }, [highlightedCodes, layersReady]);

  // Fly to selected department and highlight its border
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !layersReady) return;

    const ease = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

    if (selectedCode === null) {
      m.fitBounds(COLOMBIA_BOUNDS, { padding: compact ? 20 : 60, duration: 1000, easing: ease });
    } else {
      const features = m.querySourceFeatures('departments', {
        filter: ['==', ['get', 'deptCode'], selectedCode],
      });
      if (features.length) {
        const coords: number[][] = [];
        features.forEach(f => {
          const g = f.geometry as GeoJSON.Geometry | null;
          if (!g) return;
          if (g.type === 'Polygon') coords.push(...g.coordinates.flat());
          else if (g.type === 'MultiPolygon') coords.push(...g.coordinates.flat(2));
        });
        if (coords.length) {
          const lngs = coords.map(c => c[0]);
          const lats = coords.map(c => c[1]);
          m.fitBounds(
            [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
            { padding: 80, duration: 1000, maxZoom: 8, easing: ease },
          );
        }
      }
    }

    if (m.getLayer('departments-border')) {
      m.setPaintProperty('departments-border', 'line-color', [
        'case',
        ['==', ['get', 'deptCode'], selectedCode ?? -1], '#22d3ee',
        '#1e4a7a',
      ]);
      m.setPaintProperty('departments-border', 'line-width', [
        'case',
        ['==', ['get', 'deptCode'], selectedCode ?? -1], 2.5,
        0.8,
      ]);
    }
  }, [selectedCode, layersReady, compact]);

  return <div ref={containerRef} className="w-full h-full" />;
}