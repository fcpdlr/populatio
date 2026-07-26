"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import simplify from "@turf/simplify";
import { DrawingControls } from "./DrawingControls";
import { cleanPolygon } from "@/lib/geo/clean";
import { loadDensityGrid, type DensityGrid } from "@/lib/population/densityGrid";
import { loadProvinceLines, type ProvinceGeometries } from "@/lib/geo/provinces";

export type SpainMapProps = {
  /** Se invoca con la geometría dibujada, o null si no hay selección. */
  onSelectionChange: (geometry: Polygon | MultiPolygon | null) => void;
  /** Incrementa este valor para borrar la selección desde fuera. */
  resetSignal?: number;
  /** Deshabilita el dibujo (p. ej. mientras se calcula). */
  disabled?: boolean;
  /**
   * Permite mostrar el interruptor de densidad de población (solo tiene
   * sentido en la pantalla de resultado; nunca durante el dibujo).
   */
  showDensityToggle?: boolean;
};

type DensityStatus = "idle" | "loading" | "ready" | "error";
type ProvincesStatus = "idle" | "loading" | "ready" | "error";

type LngLat = readonly [number, number];
type Bounds = readonly [LngLat, LngLat]; // [suroeste, noreste]

/** Encuadres rápidos por territorio. */
const VIEWS = {
  peninsula: [
    [-9.9, 35.6],
    [4.5, 43.95],
  ],
  canarias: [
    [-18.4, 27.5],
    [-13.3, 29.5],
  ],
  baleares: [
    [1.1, 38.5],
    [4.4, 40.2],
  ],
  ceutaMelilla: [
    [-5.6, 34.9],
    [-2.7, 36.0],
  ],
} satisfies Record<string, Bounds>;

const VIEW_BUTTONS: { key: keyof typeof VIEWS; label: string }[] = [
  { key: "peninsula", label: "Península" },
  { key: "baleares", label: "Baleares" },
  { key: "canarias", label: "Canarias" },
  { key: "ceutaMelilla", label: "Ceuta y Melilla" },
];

/** Latitud de referencia para la corrección de aspecto (centro aprox. de España). */
const REF_COS_LAT = Math.cos((40 * Math.PI) / 180);
const VIEW_PADDING_PX = 28;
const MIN_POINT_DISTANCE_PX = 3;
const SIMPLIFY_TOLERANCE_PX = 3;
const GOTO_DURATION_MS = 500;

type Camera = { centerLng: number; centerLat: number; scale: number };

type ThemeColors = {
  paper: string;
  ink: string;
  line: string;
  muted: string;
  accent: string;
  accentDeep: string;
  accentSoft: string;
  mapSea: string;
  mapLand: string;
  mapLandLine: string;
  densityRgb: string;
  provinceLine: string;
};

const FALLBACK_COLORS: ThemeColors = {
  paper: "#faf9f6",
  ink: "#16212e",
  line: "#e8ebee",
  muted: "#7c8896",
  accent: "#0e5c54",
  accentDeep: "#0a463f",
  accentSoft: "#e4f0ee",
  mapSea: "#eaf1f2",
  mapLand: "#f6f4ee",
  mapLandLine: "#dedbd0",
  densityRgb: "44, 55, 66",
  provinceLine: "#c9ccce",
};

function readThemeColors(): ThemeColors {
  if (typeof window === "undefined") return FALLBACK_COLORS;
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => {
    const value = style.getPropertyValue(name).trim();
    return value || fallback;
  };
  return {
    paper: read("--color-paper", FALLBACK_COLORS.paper),
    ink: read("--color-ink", FALLBACK_COLORS.ink),
    line: read("--color-line", FALLBACK_COLORS.line),
    muted: read("--color-muted", FALLBACK_COLORS.muted),
    accent: read("--color-accent", FALLBACK_COLORS.accent),
    accentDeep: read("--color-accent-deep", FALLBACK_COLORS.accentDeep),
    accentSoft: read("--color-accent-soft", FALLBACK_COLORS.accentSoft),
    mapSea: read("--color-map-sea", FALLBACK_COLORS.mapSea),
    mapLand: read("--color-map-land", FALLBACK_COLORS.mapLand),
    mapLandLine: read("--color-map-land-line", FALLBACK_COLORS.mapLandLine),
    densityRgb: read("--map-density-rgb", FALLBACK_COLORS.densityRgb),
    provinceLine: read("--color-province-line", FALLBACK_COLORS.provinceLine),
  };
}

function cameraForBounds(bounds: Bounds, width: number, height: number): Camera {
  const [[minLng, minLat], [maxLng, maxLat]] = bounds;
  const lngSpan = Math.max(maxLng - minLng, 1e-6);
  const latSpan = Math.max(maxLat - minLat, 1e-6);
  const availW = Math.max(width - VIEW_PADDING_PX * 2, 1);
  const availH = Math.max(height - VIEW_PADDING_PX * 2, 1);
  const scale = Math.min(
    availW / (lngSpan * REF_COS_LAT),
    availH / latSpan,
  );
  return {
    centerLng: (minLng + maxLng) / 2,
    centerLat: (minLat + maxLat) / 2,
    scale,
  };
}

function project(
  camera: Camera,
  width: number,
  height: number,
  lng: number,
  lat: number,
): [number, number] {
  const x = width / 2 + (lng - camera.centerLng) * camera.scale * REF_COS_LAT;
  const y = height / 2 - (lat - camera.centerLat) * camera.scale;
  return [x, y];
}

function unproject(
  camera: Camera,
  width: number,
  height: number,
  x: number,
  y: number,
): LngLat {
  const lng = camera.centerLng + (x - width / 2) / (camera.scale * REF_COS_LAT);
  const lat = camera.centerLat - (y - height / 2) / camera.scale;
  return [lng, lat];
}

/** Anillos (arrays de [lng,lat]) de un Polygon o MultiPolygon, aplanados. */
function ringsOf(geometry: Polygon | MultiPolygon): number[][][] {
  return geometry.type === "Polygon"
    ? geometry.coordinates
    : geometry.coordinates.flat();
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function SpainMap({
  onSelectionChange,
  resetSignal = 0,
  disabled = false,
  showDensityToggle = false,
}: SpainMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  const cameraRef = useRef<Camera>({ centerLng: -3.7, centerLat: 40, scale: 1 });
  const outlineRef = useRef<Feature<Polygon | MultiPolygon> | null>(null);
  const colorsRef = useRef<ThemeColors>(FALLBACK_COLORS);
  const polygonRef = useRef<Polygon | MultiPolygon | null>(null);
  const pathRef = useRef<LngLat[]>([]);
  const drawingRef = useRef(false);
  const animRef = useRef<number | null>(null);
  const selectionChangeRef = useRef(onSelectionChange);
  const disabledRef = useRef(disabled);
  const densityGridRef = useRef<DensityGrid | null>(null);
  const densityOnRef = useRef(false);
  const densityAllowedRef = useRef(showDensityToggle);
  const densityBinsRef = useRef<{ cols: number; rows: number; sums: Float64Array } | null>(
    null,
  );
  const provincesDataRef = useRef<ProvinceGeometries | null>(null);
  const provincesOnRef = useRef(false);

  const [hasSelection, setHasSelection] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [densityOn, setDensityOn] = useState(false);
  const [densityStatus, setDensityStatus] = useState<DensityStatus>("idle");
  const [provincesOn, setProvincesOn] = useState(false);
  const [provincesStatus, setProvincesStatus] = useState<ProvincesStatus>("idle");

  useEffect(() => {
    selectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  const draw = useCallback(() => {
    const ctx = ctxRef.current;
    const outline = outlineRef.current;
    if (!ctx || !outline) return;
    const { width, height } = sizeRef.current;
    const camera = cameraRef.current;
    const colors = colorsRef.current;
    const proj = (lng: number, lat: number) =>
      project(camera, width, height, lng, lat);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = colors.mapSea;
    ctx.fillRect(0, 0, width, height);

    // Contorno de España (tierra en gris cálido neutro; el teal se reserva
    // por completo para la selección del usuario)
    ctx.beginPath();
    for (const ring of ringsOf(outline.geometry)) {
      ring.forEach(([lng, lat], idx) => {
        const [x, y] = proj(lng, lat);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
    }
    ctx.fillStyle = colors.mapLand;
    ctx.fill("evenodd");
    ctx.strokeStyle = colors.mapLandLine;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Densidad de población (solo en el resultado, nunca durante el dibujo).
    // Se agrega la población en una rejilla de píxeles antes de pintar: así
    // cada celda contribuye una sola vez por bin y no se satura de negro por
    // el solape de miles de celdas de 1 km superpuestas en pantalla.
    const density = densityGridRef.current;
    if (densityAllowedRef.current && densityOnRef.current && density) {
      const { lngs, lats, pops } = density;
      const BIN_PX = 3;
      const cols = Math.max(1, Math.ceil(width / BIN_PX));
      const rows = Math.max(1, Math.ceil(height / BIN_PX));

      let bins = densityBinsRef.current;
      if (!bins || bins.cols !== cols || bins.rows !== rows) {
        bins = { cols, rows, sums: new Float64Array(cols * rows) };
        densityBinsRef.current = bins;
      } else {
        bins.sums.fill(0);
      }

      // Límites visibles actuales (con margen), para no iterar celdas fuera de pantalla.
      const [aLng, aLat] = unproject(camera, width, height, -20, height + 20);
      const [bLng, bLat] = unproject(camera, width, height, width + 20, -20);
      const minLng = Math.min(aLng, bLng);
      const maxLng = Math.max(aLng, bLng);
      const minLat = Math.min(aLat, bLat);
      const maxLat = Math.max(aLat, bLat);

      let maxBin = 0;
      const { sums } = bins;
      for (let k = 0; k < pops.length; k++) {
        const pop = pops[k];
        if (pop === 0) continue;
        const lng = lngs[k];
        if (lng < minLng || lng > maxLng) continue;
        const lat = lats[k];
        if (lat < minLat || lat > maxLat) continue;
        const [x, y] = proj(lng, lat);
        const col = Math.floor(x / BIN_PX);
        const row = Math.floor(y / BIN_PX);
        if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
        const idx = row * cols + col;
        const sum = sums[idx] + pop;
        sums[idx] = sum;
        if (sum > maxBin) maxBin = sum;
      }

      if (maxBin > 0) {
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const sum = sums[row * cols + col];
            if (sum <= 0) continue;
            const intensity = Math.sqrt(sum / maxBin);
            const cx = col * BIN_PX + BIN_PX / 2;
            const cy = row * BIN_PX + BIN_PX / 2;
            ctx.beginPath();
            ctx.arc(cx, cy, 0.5 + 1.4 * intensity, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${colors.densityRgb}, ${(0.08 + 0.6 * intensity).toFixed(3)})`;
            ctx.fill();
          }
        }
      }
    }

    // Líneas de provincia (opcionales, apagadas por defecto): por encima de
    // la tierra y la densidad, pero por debajo de la selección del usuario.
    const provinces = provincesDataRef.current;
    if (provincesOnRef.current && provinces) {
      ctx.beginPath();
      for (const geometry of provinces) {
        for (const ring of ringsOf(geometry)) {
          ring.forEach(([lng, lat], idx) => {
            const [x, y] = proj(lng, lat);
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
        }
      }
      ctx.strokeStyle = colors.provinceLine;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Selección cerrada
    const polygon = polygonRef.current;
    if (polygon) {
      const rings = ringsOf(polygon);
      ctx.beginPath();
      for (const ring of rings) {
        ring.forEach(([lng, lat], idx) => {
          const [x, y] = proj(lng, lat);
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
      }
      ctx.fillStyle = colors.accent + "29"; // ~16% de opacidad
      ctx.fill("evenodd");
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Vértices: teal con borde blanco
      for (const ring of rings) {
        const vertices = ring.slice(0, -1); // el último cierra sobre el primero
        for (const [lng, lat] of vertices) {
          const [x, y] = proj(lng, lat);
          ctx.beginPath();
          ctx.arc(x, y, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = colors.accent;
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = "#ffffff";
          ctx.stroke();
        }
      }
    }

    // Trazo en curso
    if (drawingRef.current && pathRef.current.length > 1) {
      ctx.beginPath();
      pathRef.current.forEach(([lng, lat], idx) => {
        const [x, y] = proj(lng, lat);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Línea de cierre, en discontinuo, hasta el punto inicial
      const [firstLng, firstLat] = pathRef.current[0];
      const [lastLng, lastLat] = pathRef.current[pathRef.current.length - 1];
      const [fx, fy] = proj(firstLng, firstLat);
      const [lx, ly] = proj(lastLng, lastLat);
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(lx, ly);
      ctx.lineTo(fx, fy);
      ctx.strokeStyle = colors.muted;
      ctx.lineWidth = 1.25;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, []);

  const resize = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const { width, height } = container.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctxRef.current = ctx;
    const hadSize = sizeRef.current.width > 0;
    sizeRef.current = { width, height };
    if (!hadSize) {
      cameraRef.current = cameraForBounds(VIEWS.peninsula, width, height);
    }
    draw();
  }, [draw]);

  const animateTo = useCallback(
    (target: Camera) => {
      const start = cameraRef.current;
      const startTime = performance.now();
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);

      const step = (now: number) => {
        const t = Math.min(1, (now - startTime) / GOTO_DURATION_MS);
        const eased = easeInOutQuad(t);
        cameraRef.current = {
          centerLng: start.centerLng + (target.centerLng - start.centerLng) * eased,
          centerLat: start.centerLat + (target.centerLat - start.centerLat) * eased,
          scale: start.scale + (target.scale - start.scale) * eased,
        };
        draw();
        animRef.current = t < 1 ? requestAnimationFrame(step) : null;
      };
      animRef.current = requestAnimationFrame(step);
    },
    [draw],
  );

  const clearSelection = useCallback(() => {
    polygonRef.current = null;
    pathRef.current = [];
    drawingRef.current = false;
    setHasSelection(false);
    selectionChangeRef.current(null);
    draw();
  }, [draw]);

  const toggleDensity = useCallback(async () => {
    if (densityOnRef.current) {
      densityOnRef.current = false;
      setDensityOn(false);
      draw();
      return;
    }
    if (!densityGridRef.current) {
      setDensityStatus("loading");
      try {
        densityGridRef.current = await loadDensityGrid();
      } catch {
        setDensityStatus("error");
        return;
      }
    }
    setDensityStatus("ready");
    densityOnRef.current = true;
    setDensityOn(true);
    draw();
  }, [draw]);

  const toggleProvinces = useCallback(async () => {
    if (provincesOnRef.current) {
      provincesOnRef.current = false;
      setProvincesOn(false);
      draw();
      return;
    }
    if (!provincesDataRef.current) {
      setProvincesStatus("loading");
      try {
        provincesDataRef.current = await loadProvinceLines();
      } catch {
        setProvincesStatus("error");
        return;
      }
    }
    setProvincesStatus("ready");
    provincesOnRef.current = true;
    setProvincesOn(true);
    draw();
  }, [draw]);

  // La densidad solo puede mostrarse en el resultado: al salir de esa fase
  // (nuevo intento, nuevo objetivo, o borrar la selección) se apaga y se
  // vuelve a exigir una activación explícita la próxima vez.
  useEffect(() => {
    densityAllowedRef.current = showDensityToggle;
    if (!showDensityToggle) {
      densityOnRef.current = false;
      setDensityOn(false);
    }
    draw();
  }, [showDensityToggle, draw]);

  // Carga del contorno de España y arranque del canvas
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    colorsRef.current = readThemeColors();

    fetch("/data/spain-outline.geojson")
      .then((res) => {
        if (!res.ok) throw new Error("No se ha podido descargar el contorno.");
        return res.json();
      })
      .then((geojson: Feature<Polygon | MultiPolygon>) => {
        if (cancelled) return;
        outlineRef.current = geojson;
        setMapReady(true);
        resize();
      })
      .catch(() => {
        if (!cancelled) {
          setMapError(
            "No se ha podido cargar el mapa de España. Recarga la página.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redimensionado del canvas al cambiar el tamaño del contenedor
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => resize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [resize]);

  // Borrado externo (reintentos, nuevo objetivo)
  useEffect(() => {
    if (resetSignal === 0) return;
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  const pointFromEvent = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>): LngLat => {
      const canvas = canvasRef.current;
      const rect = canvas!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const { width, height } = sizeRef.current;
      return unproject(cameraRef.current, width, height, x, y);
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (disabledRef.current || !mapReady) return;
      e.preventDefault();
      canvasRef.current?.setPointerCapture(e.pointerId);
      polygonRef.current = null;
      pathRef.current = [pointFromEvent(e)];
      drawingRef.current = true;
      setHasSelection(false);
      selectionChangeRef.current(null);
      draw();
    },
    [draw, mapReady, pointFromEvent],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      e.preventDefault();
      const canvas = canvasRef.current;
      const rect = canvas!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const path = pathRef.current;
      const { width, height } = sizeRef.current;
      const camera = cameraRef.current;
      if (path.length > 0) {
        const [lastLng, lastLat] = path[path.length - 1];
        const [lastX, lastY] = project(camera, width, height, lastLng, lastLat);
        const dist = Math.hypot(x - lastX, y - lastY);
        if (dist < MIN_POINT_DISTANCE_PX) return;
      }
      path.push(unproject(camera, width, height, x, y));
      draw();
    },
    [draw],
  );

  const finishDrawing = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      canvasRef.current?.releasePointerCapture(e.pointerId);

      const raw = pathRef.current;
      pathRef.current = [];

      if (raw.length < 3) {
        polygonRef.current = null;
        setHasSelection(false);
        selectionChangeRef.current(null);
        draw();
        return;
      }

      const ring = [...raw, raw[0]].map(([lng, lat]) => [lng, lat]);
      const toleranceDeg = SIMPLIFY_TOLERANCE_PX / cameraRef.current.scale;
      let simplifiedRing = ring;
      try {
        const simplified = simplify(
          {
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [ring] },
          },
          { tolerance: toleranceDeg, highQuality: true },
        );
        const candidate = simplified.geometry.coordinates[0];
        if (candidate && candidate.length >= 4) simplifiedRing = candidate;
      } catch {
        // Si la simplificación falla, se usa el anillo original.
      }

      const rawPolygon: Polygon = { type: "Polygon", coordinates: [simplifiedRing] };
      let polygon: Polygon | MultiPolygon = rawPolygon;
      try {
        polygon = cleanPolygon(rawPolygon);
      } catch {
        // Si la limpieza falla, seguimos con el trazo original.
      }
      polygonRef.current = polygon;
      setHasSelection(true);
      selectionChangeRef.current(polygon);
      draw();
    },
    [draw],
  );

  const goTo = useCallback(
    (view: keyof typeof VIEWS) => {
      const { width, height } = sizeRef.current;
      if (width <= 0 || height <= 0) return;
      animateTo(cameraForBounds(VIEWS[view], width, height));
    },
    [animateTo],
  );

  return (
    <div className="relative h-full w-full" data-testid="spain-map">
      <div ref={containerRef} className="h-full w-full">
        <canvas
          ref={canvasRef}
          aria-label="Mapa de España. Arrastra con el dedo o el ratón para dibujar una zona."
          className="touch-none"
          style={{ display: "block", cursor: disabled ? "default" : "crosshair" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrawing}
          onPointerCancel={finishDrawing}
        />
      </div>

      {!mapReady && !mapError && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-paper/70 text-sm text-muted"
          role="status"
        >
          Cargando mapa…
        </div>
      )}

      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-paper p-6 text-center text-sm text-ink">
          {mapError}
        </div>
      )}

      {mapReady && !mapError && (
        <>
          <DrawingControls
            hasSelection={hasSelection}
            disabled={disabled}
            onClear={clearSelection}
          />
          <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
            {showDensityToggle && (
              <button
                type="button"
                onClick={toggleDensity}
                disabled={densityStatus === "loading"}
                className="rounded-full border border-line bg-white/90 px-3 py-1.5 text-[11px] font-medium text-ink shadow-sm backdrop-blur hover:border-accent hover:text-accent disabled:cursor-wait disabled:opacity-60"
              >
                {densityStatus === "loading"
                  ? "Cargando densidad…"
                  : densityOn
                    ? "Ver mapa sin densidad"
                    : "Ver densidad"}
              </button>
            )}
            {densityStatus === "error" && (
              <p className="max-w-[220px] text-[11px] text-muted">
                No se ha podido cargar la densidad.
              </p>
            )}
            <button
              type="button"
              onClick={toggleProvinces}
              disabled={provincesStatus === "loading"}
              className="rounded-full border border-line bg-white/90 px-3 py-1.5 text-[11px] font-medium text-ink shadow-sm backdrop-blur hover:border-accent hover:text-accent disabled:cursor-wait disabled:opacity-60"
            >
              {provincesStatus === "loading"
                ? "Cargando provincias…"
                : provincesOn
                  ? "Ocultar provincias"
                  : "Mostrar provincias"}
            </button>
            {provincesStatus === "error" && (
              <p className="max-w-[220px] text-[11px] text-muted">
                No se ha podido cargar el contorno de provincias.
              </p>
            )}
          </div>
          <div
            className="absolute bottom-20 left-3 flex flex-wrap gap-1.5"
            role="group"
            aria-label="Ir a un territorio"
          >
            {VIEW_BUTTONS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => goTo(key)}
                className="rounded-full border border-line bg-white/90 px-2.5 py-1 text-[11px] font-medium text-ink shadow-sm backdrop-blur hover:border-accent hover:text-accent"
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
