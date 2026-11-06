"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Feature, Polygon, MultiPolygon, MultiLineString } from "geojson";
import simplify from "@turf/simplify";
import { DrawingControls } from "./DrawingControls";
import { cleanPolygon } from "@/lib/geo/clean";
import { loadDensityGrid, type DensityGrid } from "@/lib/population/densityGrid";
import { loadProvinceLines, type ProvinceGeometries } from "@/lib/geo/provinces";

export type MapRegion = "es" | "world";

export type SpainMapProps = {
  /** Territorio del mapa: España (por defecto) o el mundo entero. */
  region?: MapRegion;
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
  /**
   * Geometría fija a mostrar en modo solo lectura (p. ej. el intento ya
   * confirmado del reto Diario). Sustituye cualquier trazo en curso y no se
   * puede editar; combínalo con `disabled`.
   */
  lockedGeometry?: Polygon | MultiPolygon | null;
  /**
   * Encuadre al que mover la cámara. Se aplica cada vez que cambia
   * `focusKey` (p. ej. al empezar una ronda nueva), no en cada render.
   */
  focusBounds?: Bounds | null;
  focusKey?: string | number;
  /** Zonas de solo lectura a mostrar (modos Guess y More or Less). */
  overlays?: MapOverlay[];
  /** Oculta los botones de encuadre por continente. */
  hideViewButtons?: boolean;
};

export type MapOverlay = {
  geometry: Polygon | MultiPolygon;
  /** "a" usa el color de acento; "b", el color secundario. */
  tone: "a" | "b";
  label?: string;
};

type DensityStatus = "idle" | "loading" | "ready" | "error";
type ProvincesStatus = "idle" | "loading" | "ready" | "error";

type LngLat = readonly [number, number];
export type Bounds = readonly [LngLat, LngLat]; // [suroeste, noreste]

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

const WORLD_VIEWS = {
  mundo: [
    [-168, -56],
    [178, 74],
  ],
  europa: [
    [-11, 35],
    [32, 60],
  ],
  asia: [
    [60, -8],
    [145, 50],
  ],
  africa: [
    [-19, -35],
    [52, 37],
  ],
  america: [
    [-125, -55],
    [-34, 50],
  ],
} satisfies Record<string, Bounds>;

const WORLD_VIEW_BUTTONS: { key: keyof typeof WORLD_VIEWS; label: string }[] = [
  { key: "mundo", label: "World" },
  { key: "europa", label: "Europe" },
  { key: "asia", label: "Asia" },
  { key: "africa", label: "Africa" },
  { key: "america", label: "Americas" },
];

const VIEW_BUTTONS: { key: keyof typeof VIEWS; label: string }[] = [
  { key: "peninsula", label: "Mainland" },
  { key: "baleares", label: "Balearics" },
  { key: "canarias", label: "Canaries" },
  { key: "ceutaMelilla", label: "Ceuta & Melilla" },
];

/** Latitud de referencia para la corrección de aspecto (centro aprox. de España). */
const REF_COS_LAT = Math.cos((40 * Math.PI) / 180);
const VIEW_PADDING_PX = 28;
const MIN_POINT_DISTANCE_PX = 3;
const SIMPLIFY_TOLERANCE_PX = 3;
const GOTO_DURATION_MS = 500;
const MIN_PINCH_DISTANCE_PX = 1;
const MIN_SCALE_FACTOR = 0.6; // respecto al ajuste inicial a la península
const MAX_SCALE_FACTOR = 35;
const WORLD_MIN_SCALE_FACTOR = 0.9; // respecto al mapa mundial completo
const WORLD_MAX_SCALE_FACTOR = 450; // permite dibujar a escala de ciudad

/**
 * `k` es la corrección de aspecto (cos de la latitud de referencia): fija
 * para España; en el mundo sigue a la latitud del centro de la vista, para
 * que cada zona se vea con proporciones razonables al acercarse.
 */
type Camera = { centerLng: number; centerLat: number; scale: number; k: number };

function kFor(region: MapRegion, lat: number): number {
  if (region === "es") return REF_COS_LAT;
  const clamped = Math.max(-60, Math.min(60, lat));
  return Math.cos((clamped * Math.PI) / 180);
}

type CountryLabel = [name: string, lng: number, lat: number, minZ: number, maxZ: number, rank: number];
type CityLabel = [name: string, lng: number, lat: number, minZ: number, pop: number];
type WorldLabels = { countries: CountryLabel[]; cities: CityLabel[] };
/** Una sola lista ordenada por zoom mínimo: países y capitales grandes compiten en igualdad. */
type MapLabel = { name: string; lng: number; lat: number; minZ: number; maxZ: number; city: boolean };

function mergeLabels(l: WorldLabels): MapLabel[] {
  const out: MapLabel[] = [
    ...l.countries.map(([name, lng, lat, minZ, maxZ]) => ({
      name: name.toUpperCase(), lng, lat, minZ: minZ - 0.6, maxZ: maxZ + 1, city: false,
    })),
    ...l.cities.map(([name, lng, lat, minZ]) => ({
      name, lng, lat, minZ: minZ + 0.6, maxZ: 99, city: true,
    })),
  ];
  // Estable: dentro del mismo zoom se mantiene el orden de origen (países por rango, ciudades por población).
  return out.sort((a, b) => a.minZ - b.minZ);
}

/** Máximo de etiquetas en pantalla: el mapa es para dibujar, no un atlas. */
const MAX_LABELS = 36;
/** Margen (px) alrededor de cada etiqueta para que nunca se toquen. */
const LABEL_GAP = 6;

type WorldMap = {
  land: MultiPolygon;
  borders: MultiLineString;
  /** bbox [minLng, minLat, maxLng, maxLat] de cada polígono de tierra, para no pintar lo que no se ve. */
  landBoxes: [number, number, number, number][];
  borderBoxes: [number, number, number, number][];
};

function boxOf(points: number[][]): [number, number, number, number] {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, y] of points) {
    if (x < a) a = x;
    if (y < b) b = y;
    if (x > c) c = x;
    if (y > d) d = y;
  }
  return [a, b, c, d];
}

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
  zoneB: string;
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
  zoneB: "#c2410c",
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
    zoneB: read("--color-zone-b", FALLBACK_COLORS.zoneB),
  };
}

function cameraForBounds(
  bounds: Bounds,
  width: number,
  height: number,
  region: MapRegion = "es",
): Camera {
  const [[minLng, minLat], [maxLng, maxLat]] = bounds;
  const lngSpan = Math.max(maxLng - minLng, 1e-6);
  const latSpan = Math.max(maxLat - minLat, 1e-6);
  const availW = Math.max(width - VIEW_PADDING_PX * 2, 1);
  const availH = Math.max(height - VIEW_PADDING_PX * 2, 1);
  const centerLat = (minLat + maxLat) / 2;
  const k = kFor(region, centerLat);
  const scale = Math.min(availW / (lngSpan * k), availH / latSpan);
  return {
    centerLng: (minLng + maxLng) / 2,
    centerLat,
    scale,
    k,
  };
}

function project(
  camera: Camera,
  width: number,
  height: number,
  lng: number,
  lat: number,
): [number, number] {
  const x = width / 2 + (lng - camera.centerLng) * camera.scale * camera.k;
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
  const lng = camera.centerLng + (x - width / 2) / (camera.scale * camera.k);
  const lat = camera.centerLat - (y - height / 2) / camera.scale;
  return [lng, lat];
}

/**
 * Calcula la cámara (con la escala dada) que deja el punto del mundo
 * (worldLng, worldLat) proyectado exactamente en el punto de pantalla
 * (screenX, screenY). Es la base del zoom con gesto de pellizco: se fija el
 * punto del mundo bajo el punto medio de los dos dedos antes de cambiar el
 * zoom, y se recoloca la cámara para que siga bajo el punto medio después.
 */
function cameraPinnedAt(
  width: number,
  height: number,
  scale: number,
  worldLng: number,
  worldLat: number,
  screenX: number,
  screenY: number,
  k: number,
): Camera {
  return {
    centerLng: worldLng - (screenX - width / 2) / (scale * k),
    centerLat: worldLat - (height / 2 - screenY) / scale,
    scale,
    k,
  };
}

type PointerPoint = { x: number; y: number };

function pinchStateFromPointers(pointers: Map<number, PointerPoint>): {
  distance: number;
  midX: number;
  midY: number;
} {
  const [a, b] = pointers.values();
  return {
    distance: Math.hypot(b.x - a.x, b.y - a.y),
    midX: (a.x + b.x) / 2,
    midY: (a.y + b.y) / 2,
  };
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
  region = "es",
  onSelectionChange,
  resetSignal = 0,
  disabled = false,
  showDensityToggle = false,
  lockedGeometry = null,
  focusBounds = null,
  focusKey,
  overlays,
  hideViewButtons = false,
}: SpainMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  const cameraRef = useRef<Camera>({ centerLng: -3.7, centerLat: 40, scale: 1, k: REF_COS_LAT });
  const worldRef = useRef<WorldMap | null>(null);
  const labelsRef = useRef<MapLabel[] | null>(null);
  const isWorld = region === "world";
  const overlaysRef = useRef<MapOverlay[]>([]);
  const focusRef = useRef<Bounds | null>(focusBounds);
  const firstFocusRef = useRef(true);
  // Declarado antes que el resto de efectos: se actualiza antes de que estos lo lean.
  useEffect(() => {
    focusRef.current = focusBounds;
  }, [focusBounds]);
  const baseScaleRef = useRef(1);
  const pointersRef = useRef<Map<number, PointerPoint>>(new Map());
  const pinchRef = useRef<{ distance: number; midX: number; midY: number } | null>(null);
  /** Arrastre del mapa con el botón derecho o central del ratón (escritorio). */
  const panRef = useRef<{ x: number; y: number } | null>(null);
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
  const [provincesAvailable, setProvincesAvailable] = useState(false);

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

    // Límites visibles (con margen) para descartar geometría fuera de pantalla.
    const [vLng0, vLat0] = unproject(camera, width, height, -40, height + 40);
    const [vLng1, vLat1] = unproject(camera, width, height, width + 40, -40);
    const visible = (b: [number, number, number, number]) =>
      b[2] >= vLng0 && b[0] <= vLng1 && b[3] >= vLat0 && b[1] <= vLat1;

    // Contorno de la tierra (gris cálido neutro; el teal se reserva
    // por completo para la selección del usuario)
    const world = worldRef.current;
    ctx.beginPath();
    if (world) {
      world.land.coordinates.forEach((poly, i) => {
        if (!visible(world.landBoxes[i])) return;
        for (const ring of poly) {
          ring.forEach(([lng, lat], idx) => {
            const [x, y] = proj(lng, lat);
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
        }
      });
    } else {
      for (const ring of ringsOf(outline.geometry)) {
        ring.forEach(([lng, lat], idx) => {
          const [x, y] = proj(lng, lat);
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
      }
    }
    ctx.fillStyle = colors.mapLand;
    ctx.fill("evenodd");
    ctx.strokeStyle = colors.mapLandLine;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Fronteras entre países (solo en el mapa mundial)
    if (world) {
      ctx.beginPath();
      world.borders.coordinates.forEach((line, i) => {
        if (!visible(world.borderBoxes[i])) return;
        line.forEach(([lng, lat], idx) => {
          const [x, y] = proj(lng, lat);
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
      });
      ctx.strokeStyle = colors.provinceLine;
      ctx.lineWidth = 0.75;
      ctx.stroke();
    }

    // Etiquetas de países y ciudades (solo mundo). Aparecen según el zoom,
    // con la misma escala que los mapas web, y nunca se solapan: se colocan
    // por prioridad y se descarta cualquiera que choque con una ya puesta.
    const labels = labelsRef.current;
    if (world && labels) {
      const z = Math.log2((camera.scale * camera.k * 360) / 256);
      const placed: [number, number, number, number][] = [];
      const fits = (x0: number, y0: number, x1: number, y1: number) => {
        if (x0 < 4 || y0 < 4 || x1 > width - 4 || y1 > height - 4) return false;
        for (const [a, b, c, d] of placed) {
          if (x0 < c + LABEL_GAP && x1 + LABEL_GAP > a && y0 < d + LABEL_GAP && y1 + LABEL_GAP > b) return false;
        }
        return true;
      };
      const halo = (text: string, x: number, y: number, fill: string) => {
        ctx.lineJoin = "round";
        ctx.lineWidth = 3;
        ctx.strokeStyle = colors.mapLand;
        ctx.strokeText(text, x, y);
        ctx.fillStyle = fill;
        ctx.fillText(text, x, y);
      };
      ctx.textBaseline = "middle";

      // Las zonas del jugador y las del juego son obstáculos: ninguna etiqueta las pisa.
      // (las zonas con letra A/B reservan además el hueco de la etiqueta, encima)
      const obstacles: [Polygon | MultiPolygon, number][] = overlaysRef.current.map((o) => [
        o.geometry,
        o.label ? 32 : 0,
      ]);
      if (polygonRef.current) obstacles.push([polygonRef.current, 0]);
      for (const [g, extraTop] of obstacles) {
        let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
        for (const ring of ringsOf(g)) for (const [lng, lat] of ring) {
          const [x, y] = proj(lng, lat);
          if (x < a) a = x;
          if (y < b) b = y;
          if (x > c) c = x;
          if (y > d) d = y;
        }
        placed.push([a, b - extraTop, c, d]);
      }
      const reserved = placed.length;

      const countryFont = "600 9.5px system-ui, -apple-system, 'Segoe UI', sans-serif";
      const cityFont = "500 11px system-ui, -apple-system, 'Segoe UI', sans-serif";
      for (const l of labels) {
        if (placed.length - reserved >= MAX_LABELS) break;
        if (z < l.minZ) break; // lista ordenada por zoom mínimo: el resto tampoco cabe
        if (z > l.maxZ) continue;
        if (l.lng < vLng0 || l.lng > vLng1 || l.lat < vLat0 || l.lat > vLat1) continue;
        const [x, y] = proj(l.lng, l.lat);
        if (l.city) {
          ctx.font = cityFont;
          const w = ctx.measureText(l.name).width;
          if (!fits(x - 3, y - 7, x + 6 + w, y + 7)) continue;
          placed.push([x - 3, y - 7, x + 6 + w, y + 7]);
          ctx.beginPath();
          ctx.arc(x, y, 2.2, 0, Math.PI * 2);
          ctx.fillStyle = colors.ink;
          ctx.globalAlpha = 0.55;
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.textAlign = "left";
          halo(l.name, x + 6, y, colors.ink + "b3");
        } else {
          ctx.font = countryFont;
          const w = ctx.measureText(l.name).width;
          if (!fits(x - w / 2, y - 6, x + w / 2, y + 6)) continue;
          placed.push([x - w / 2, y - 6, x + w / 2, y + 6]);
          ctx.textAlign = "center";
          halo(l.name, x, y, colors.muted);
        }
      }
    }

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

    // Zonas de solo lectura (Guess / More or Less)
    for (const ov of overlaysRef.current) {
      const color = ov.tone === "a" ? colors.accent : colors.zoneB;
      const rings = ringsOf(ov.geometry);
      ctx.beginPath();
      let sx = 0, n = 0, top = Infinity;
      for (const ring of rings) {
        ring.forEach(([lng, lat], idx) => {
          const [x, y] = proj(lng, lat);
          sx += x; n++;
          if (y < top) top = y;
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
      }
      ctx.fillStyle = color + "33";
      ctx.fill("evenodd");
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      if (ov.label && n > 0) {
        // La etiqueta va encima de la zona, nunca sobre ella: no tapa lo que hay que mirar.
        const cx = sx / n, cy = top - 17;
        ctx.beginPath();
        ctx.arc(cx, cy, 13, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "700 14px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(ov.label, cx, cy + 0.5);
      }
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
      const initialCamera = isWorld
        ? cameraForBounds(WORLD_VIEWS.mundo, width, height, "world")
        : cameraForBounds(VIEWS.peninsula, width, height);
      // El zoom se limita respecto al mapa completo, aunque arranquemos en una región.
      baseScaleRef.current = initialCamera.scale;
      if (focusRef.current) {
        firstFocusRef.current = false;
        cameraRef.current = cameraForBounds(focusRef.current, width, height, region);
        draw();
        return;
      }
      cameraRef.current = initialCamera;
      baseScaleRef.current = initialCamera.scale;
    }
    draw();
  }, [draw, isWorld]);

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
          k: start.k + (target.k - start.k) * eased,
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

  // Geometría fija de solo lectura (p. ej. el intento ya confirmado del
  // reto Diario): sustituye cualquier trazo en curso sin pasar por
  // clearSelection, así no dispara onSelectionChange ni molesta al padre.
  useEffect(() => {
    if (!lockedGeometry) return;
    drawingRef.current = false;
    pathRef.current = [];
    polygonRef.current = lockedGeometry;
    setHasSelection(true);
    draw();
  }, [lockedGeometry, draw]);

  useEffect(() => {
    overlaysRef.current = overlays ?? [];
    draw();
  }, [overlays, draw]);

  // Nuevo encuadre al cambiar de ronda. El primero se aplica de golpe (sin
  // viajar desde el mapamundi); los siguientes, con una transición corta.
  useEffect(() => {
    if (focusKey === undefined || !focusRef.current) return;
    const { width, height } = sizeRef.current;
    if (width <= 0 || height <= 0) return; // el primer resize ya aplica el encuadre
    const target = cameraForBounds(focusRef.current, width, height, region);
    if (firstFocusRef.current) {
      firstFocusRef.current = false;
      cameraRef.current = target;
      draw();
      return;
    }
    animateTo(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  // Carga del contorno de España y arranque del canvas
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    colorsRef.current = readThemeColors();

    fetch(isWorld ? "/world/map.json" : "/data/spain-outline.geojson")
      .then((res) => {
        if (!res.ok) throw new Error("Couldn't download the map.");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (isWorld) {
          fetch("/world/labels.json")
            .then((r) => (r.ok ? r.json() : null))
            .then((l: WorldLabels | null) => {
              if (cancelled || !l) return;
              labelsRef.current = mergeLabels(l);
              draw();
            })
            .catch(() => {
              // Sin etiquetas el mapa sigue funcionando.
            });
          const { land, borders } = data as { land: MultiPolygon; borders: MultiLineString };
          worldRef.current = {
            land,
            borders,
            landBoxes: land.coordinates.map((poly) => boxOf(poly[0])),
            borderBoxes: borders.coordinates.map((line) => boxOf(line)),
          };
          outlineRef.current = { type: "Feature", properties: {}, geometry: land };
        } else {
          outlineRef.current = data as Feature<Polygon | MultiPolygon>;
        }
        setMapReady(true);
        resize();
      })
      .catch(() => {
        if (!cancelled) {
          setMapError(
            isWorld
              ? "Couldn't load the world map. Reload the page."
              : "Couldn't load the map of Spain. Reload the page.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Comprueba en silencio si existe public/provincias.geojson (capa opcional,
  // todavía no generada). Mientras no exista, el interruptor de provincias ni
  // siquiera aparece: no hay error que mostrar ni que quitar más tarde, solo
  // se activa solo cuando el fichero esté disponible.
  useEffect(() => {
    if (typeof window === "undefined" || isWorld) return;
    let cancelled = false;
    fetch("/provincias.geojson", { method: "HEAD" })
      .then((res) => {
        if (!cancelled) setProvincesAvailable(res.ok);
      })
      .catch(() => {
        if (!cancelled) setProvincesAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Zoom con la rueda del ratón o el trackpad (escritorio), centrado en el
  // cursor. Listener nativo no pasivo para poder evitar el scroll de página.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      if (disabledRef.current && !isWorld) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const { width, height } = sizeRef.current;
      const camera = cameraRef.current;
      const minScale = baseScaleRef.current * (isWorld ? WORLD_MIN_SCALE_FACTOR : MIN_SCALE_FACTOR);
      const maxScale = baseScaleRef.current * (isWorld ? WORLD_MAX_SCALE_FACTOR : MAX_SCALE_FACTOR);
      const newScale = Math.min(Math.max(camera.scale * Math.exp(-e.deltaY * 0.0015), minScale), maxScale);
      const [lng, lat] = unproject(camera, width, height, x, y);
      const pinned = cameraPinnedAt(width, height, newScale, lng, lat, x, y, camera.k);
      cameraRef.current = isWorld ? { ...pinned, k: kFor("world", pinned.centerLat) } : pinned;
      draw();
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [draw, isWorld]);

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

  /** Punto del evento en píxeles relativos al canvas (para el seguimiento de pellizco). */
  const screenPointFromEvent = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>): PointerPoint => {
      const rect = canvasRef.current!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    [],
  );

  const commitDrawnPath = useCallback(() => {
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
  }, [draw]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!mapReady) return;
      // Botón derecho o central: mover el mapa, también con el dibujo bloqueado.
      if (e.pointerType === "mouse" && (e.button === 1 || e.button === 2)) {
        e.preventDefault();
        try {
          canvasRef.current?.setPointerCapture(e.pointerId);
        } catch {
          // no es crítico
        }
        panRef.current = screenPointFromEvent(e);
        return;
      }
      if (disabledRef.current) {
        // Sin dibujo: un dedo mueve el mapa y dos hacen zoom.
        e.preventDefault();
        try {
          canvasRef.current?.setPointerCapture(e.pointerId);
        } catch {
          // no es crítico
        }
        pointersRef.current.set(e.pointerId, screenPointFromEvent(e));
        if (pointersRef.current.size >= 2) {
          panRef.current = null;
          pinchRef.current = pinchStateFromPointers(pointersRef.current);
        } else {
          panRef.current = screenPointFromEvent(e);
        }
        return;
      }
      e.preventDefault();
      try {
        canvasRef.current?.setPointerCapture(e.pointerId);
      } catch {
        // Algunos navegadores pueden rechazar la captura; no es crítico.
      }
      pointersRef.current.set(e.pointerId, screenPointFromEvent(e));

      if (pointersRef.current.size >= 2) {
        // Un segundo dedo convierte el gesto en pellizco: se cancela
        // cualquier trazo de un solo dedo en curso (sin tocar la selección
        // ya confirmada) y se arranca el seguimiento del pellizco.
        drawingRef.current = false;
        pathRef.current = [];
        pinchRef.current = pinchStateFromPointers(pointersRef.current);
        draw();
        return;
      }

      // Un solo dedo: comportamiento de dibujo habitual.
      polygonRef.current = null;
      pathRef.current = [pointFromEvent(e)];
      drawingRef.current = true;
      setHasSelection(false);
      selectionChangeRef.current(null);
      draw();
    },
    [draw, mapReady, pointFromEvent, screenPointFromEvent],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (panRef.current) {
        e.preventDefault();
        const pt = screenPointFromEvent(e);
        const camera = cameraRef.current;
        const dx = pt.x - panRef.current.x;
        const dy = pt.y - panRef.current.y;
        panRef.current = pt;
        const centerLat = camera.centerLat + dy / camera.scale;
        cameraRef.current = {
          ...camera,
          centerLng: camera.centerLng - dx / (camera.scale * camera.k),
          centerLat,
          k: isWorld ? kFor("world", centerLat) : camera.k,
        };
        draw();
        return;
      }
      if (pointersRef.current.has(e.pointerId)) {
        pointersRef.current.set(e.pointerId, screenPointFromEvent(e));
      }

      if (pointersRef.current.size >= 2) {
        e.preventDefault();
        const state = pinchStateFromPointers(pointersRef.current);
        const prev = pinchRef.current;
        if (
          prev &&
          prev.distance > MIN_PINCH_DISTANCE_PX &&
          state.distance > MIN_PINCH_DISTANCE_PX
        ) {
          const { width, height } = sizeRef.current;
          const camera = cameraRef.current;
          const rawScale = camera.scale * (state.distance / prev.distance);
          const minScale =
            baseScaleRef.current * (isWorld ? WORLD_MIN_SCALE_FACTOR : MIN_SCALE_FACTOR);
          const maxScale =
            baseScaleRef.current * (isWorld ? WORLD_MAX_SCALE_FACTOR : MAX_SCALE_FACTOR);
          const newScale = Math.min(Math.max(rawScale, minScale), maxScale);
          const [worldLng, worldLat] = unproject(camera, width, height, prev.midX, prev.midY);
          const pinned = cameraPinnedAt(
            width,
            height,
            newScale,
            worldLng,
            worldLat,
            state.midX,
            state.midY,
            camera.k,
          );
          // En el mundo, la corrección de aspecto sigue a la latitud del centro.
          cameraRef.current = isWorld
            ? { ...pinned, k: kFor("world", pinned.centerLat) }
            : pinned;
        }
        pinchRef.current = state;
        draw();
        return;
      }

      if (!drawingRef.current) return;
      e.preventDefault();
      const { x, y } = screenPointFromEvent(e);
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
    [draw, screenPointFromEvent, isWorld],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      try {
        canvasRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // El navegador puede haber liberado ya la captura; no es crítico.
      }
      if (panRef.current) {
        panRef.current = null;
        pointersRef.current.delete(e.pointerId);
        return;
      }
      pointersRef.current.delete(e.pointerId);

      if (pointersRef.current.size >= 2) {
        // Sigue habiendo pellizco con los dedos restantes: resincroniza la
        // referencia para que el próximo movimiento no salte.
        pinchRef.current = pinchStateFromPointers(pointersRef.current);
        return;
      }

      const wasPinching = pinchRef.current !== null;
      pinchRef.current = null;

      if (pointersRef.current.size === 1) {
        // Quedó un dedo tras un pellizco: no reanudamos el dibujo con él
        // (evita un salto brusco). Hay que soltar y volver a apoyar.
        return;
      }

      if (wasPinching || !drawingRef.current) {
        drawingRef.current = false;
        pathRef.current = [];
        draw();
        return;
      }

      drawingRef.current = false;
      commitDrawnPath();
    },
    [commitDrawnPath, draw],
  );

  const goTo = useCallback(
    (view: string) => {
      const { width, height } = sizeRef.current;
      if (width <= 0 || height <= 0) return;
      const bounds = isWorld
        ? WORLD_VIEWS[view as keyof typeof WORLD_VIEWS]
        : VIEWS[view as keyof typeof VIEWS];
      if (!bounds) return;
      animateTo(cameraForBounds(bounds, width, height, region));
    },
    [animateTo, isWorld, region],
  );

  const viewButtons: { key: string; label: string }[] = isWorld ? WORLD_VIEW_BUTTONS : VIEW_BUTTONS;

  return (
    <div className="relative h-full w-full" data-testid={isWorld ? "world-map" : "spain-map"}>
      <div ref={containerRef} className="h-full w-full">
        <canvas
          ref={canvasRef}
          aria-label={
            isWorld
              ? "World map. Drag with your finger or mouse to draw a zone; pinch or scroll to zoom."
              : "Map of Spain. Drag with your finger or mouse to draw a zone."
          }
          className="touch-none"
          style={{ display: "block", cursor: disabled ? "default" : "crosshair" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      {!mapReady && !mapError && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-paper/70 text-sm text-muted"
          role="status"
        >
          Loading map…
        </div>
      )}

      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-paper p-6 text-center text-sm text-ink">
          {mapError}
        </div>
      )}

      {mapReady && !mapError && (
        <>
          <p className="pointer-events-none absolute bottom-1 right-2 text-[9px] text-muted/80">
            {isWorld ? "Population: GHSL · EC JRC · Map: Natural Earth" : "Population: INE"}
          </p>
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
                  ? "Loading density…"
                  : densityOn
                    ? "Hide density"
                    : "Show density"}
              </button>
            )}
            {densityStatus === "error" && (
              <p className="max-w-[220px] text-[11px] text-muted">
                Couldn&apos;t load the density layer.
              </p>
            )}
            {provincesAvailable && (
              <button
                type="button"
                onClick={toggleProvinces}
                disabled={provincesStatus === "loading"}
                className="rounded-full border border-line bg-white/90 px-3 py-1.5 text-[11px] font-medium text-ink shadow-sm backdrop-blur hover:border-accent hover:text-accent disabled:cursor-wait disabled:opacity-60"
              >
                {provincesStatus === "loading"
                  ? "Loading provinces…"
                  : provincesOn
                    ? "Hide provinces"
                    : "Show provinces"}
              </button>
            )}
            {provincesAvailable && provincesStatus === "error" && (
              <p className="max-w-[220px] text-[11px] text-muted">
                Couldn&apos;t load the province outlines.
              </p>
            )}
          </div>
          <div
            hidden={hideViewButtons}
            className="absolute bottom-20 left-3 flex flex-wrap gap-1.5"
            role="group"
            aria-label="Jump to a region"
          >
            {viewButtons.map(({ key, label }) => (
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
