import type { Polygon } from "geojson";
import type { PopulationEstimator } from "./types";

/**
 * Zonas aleatorias para los modos Guess y More or Less: una forma orgánica
 * (círculo deformado con armónicos suaves) alrededor de un lugar poblado,
 * elegido con probabilidad proporcional a la raíz de su población para que
 * salgan tanto metrópolis como zonas rurales.
 */

export type Bounds = [[number, number], [number, number]];
export type SampledZone = { geometry: Polygon; population: number; center: [number, number]; radiusKm: number };

type Cells = { lng: Float32Array; lat: Float32Array; pop: Float32Array };

const KM_PER_DEG = 111.32;
const VERTICES = 32;

export function blob(center: [number, number], radiusKm: number, random: () => number): Polygon {
  const [lng0, lat0] = center;
  const amps = [0.16 * random(), 0.1 * random(), 0.06 * random()];
  const phases = [random(), random(), random()].map((p) => p * Math.PI * 2);
  const ring: [number, number][] = [];
  const cosLat = Math.max(0.15, Math.cos((lat0 * Math.PI) / 180));
  for (let i = 0; i < VERTICES; i++) {
    const a = (i / VERTICES) * Math.PI * 2;
    const f = 1 + amps[0] * Math.sin(a + phases[0]) + amps[1] * Math.sin(2 * a + phases[1]) + amps[2] * Math.sin(3 * a + phases[2]);
    const r = radiusKm * f;
    const lat = lat0 + (r * Math.sin(a)) / KM_PER_DEG;
    const lng = lng0 + (r * Math.cos(a)) / (KM_PER_DEG * cosLat);
    ring.push([Math.round(lng * 1e4) / 1e4, Math.round(Math.max(-85, Math.min(85, lat)) * 1e4) / 1e4]);
  }
  ring.push(ring[0]);
  return { type: "Polygon", coordinates: [ring] };
}

function pickCenter(cells: Cells, bounds: Bounds, random: () => number): [number, number] | null {
  const [[minLng, minLat], [maxLng, maxLat]] = bounds;
  const idx: number[] = [];
  const cum: number[] = [];
  let total = 0;
  for (let k = 0; k < cells.pop.length; k++) {
    const lng = cells.lng[k], lat = cells.lat[k];
    if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) continue;
    total += Math.sqrt(cells.pop[k]);
    idx.push(k);
    cum.push(total);
  }
  if (!idx.length) return null;
  const r = random() * total;
  let lo = 0, hi = cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < r) lo = mid + 1;
    else hi = mid;
  }
  const k = idx[lo];
  // pequeño desplazamiento dentro de la celda de 10 km
  return [cells.lng[k] + (random() - 0.5) * 0.08, cells.lat[k] + (random() - 0.5) * 0.08];
}

function distanceKm(a: [number, number], b: [number, number]): number {
  const dLat = (b[1] - a[1]) * KM_PER_DEG;
  const dLng = (b[0] - a[0]) * KM_PER_DEG * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

const randRadius = (random: () => number) => Math.exp(Math.log(12) + random() * (Math.log(260) - Math.log(12)));

export async function sampleZone(
  est: PopulationEstimator,
  cells: Cells,
  bounds: Bounds,
  random: () => number = Math.random,
  minPopulation = 50_000,
): Promise<SampledZone> {
  for (let attempt = 0; attempt < 25; attempt++) {
    const center = pickCenter(cells, bounds, random);
    if (!center) break;
    const radiusKm = randRadius(random);
    const geometry = blob(center, radiusKm, random);
    const { totalPopulation } = await est.estimate(geometry);
    if (totalPopulation >= minPopulation) return { geometry, population: totalPopulation, center, radiusKm };
  }
  throw new Error("Couldn't find a populated zone. Try again.");
}

/**
 * Dos zonas que no se tocan, en la misma región y con poblaciones
 * comparables (una no más de 3 veces la otra) para que la pregunta tenga gracia.
 */
export async function sampleZonePair(
  est: PopulationEstimator,
  cells: Cells,
  bounds: Bounds,
  random: () => number = Math.random,
): Promise<[SampledZone, SampledZone]> {
  let fallback: [SampledZone, SampledZone] | null = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    const a = await sampleZone(est, cells, bounds, random);
    // B se busca cerca de A: así las dos zonas se ven grandes en el mismo encuadre.
    // El alcance escala con el tamaño de A: zonas pequeñas, vecinas cercanas.
    const reachKm = Math.max(60, a.radiusKm * 6);
    const dLat = reachKm / KM_PER_DEG;
    const dLng = reachKm / (KM_PER_DEG * Math.max(0.2, Math.cos((a.center[1] * Math.PI) / 180)));
    const near: Bounds = [
      [Math.max(bounds[0][0], a.center[0] - dLng), Math.max(bounds[0][1], a.center[1] - dLat)],
      [Math.min(bounds[1][0], a.center[0] + dLng), Math.min(bounds[1][1], a.center[1] + dLat)],
    ];
    for (let tries = 0; tries < 12; tries++) {
      const center = pickCenter(cells, near, random);
      if (!center) break;
      const radiusKm = Math.min(320, Math.max(10, a.radiusKm * Math.exp((random() - 0.5) * 1.2)));
      if (distanceKm(center, a.center) < (a.radiusKm + radiusKm) * 1.25) continue;
      const geometry = blob(center, radiusKm, random);
      const { totalPopulation } = await est.estimate(geometry);
      if (totalPopulation < 50_000 || totalPopulation === a.population) continue;
      const b: SampledZone = { geometry, population: totalPopulation, center, radiusKm };
      const ratio = Math.max(a.population, b.population) / Math.min(a.population, b.population);
      if (ratio <= 3) return [a, b];
      fallback ??= [a, b];
    }
  }
  if (fallback) return fallback;
  throw new Error("Couldn't build two zones. Try again.");
}

/** Caja que encuadra las zonas con margen, para el mapa. */
export function framingBounds(zones: Polygon[], pad = 0.35): Bounds {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const z of zones) for (const [x, y] of z.coordinates[0]) {
    if (x < a) a = x;
    if (y < b) b = y;
    if (x > c) c = x;
    if (y > d) d = y;
  }
  const w = (c - a) * pad, h = (d - b) * pad;
  return [[a - w, b - h], [c + w, d + h]];
}
