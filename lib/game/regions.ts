import { randomFromSeed } from "./dailyTarget";

/**
 * Grandes regiones del mundo. Cada ronda (diaria o de práctica) cae en una:
 * el mapa arranca encuadrado en ella y el objetivo se ajusta a su población.
 * El dibujo sigue siendo libre: la región es el punto de partida, no un límite.
 *
 * `population` (millones) se calculó sobre la rejilla GHS-POP 2025 a 10 km
 * con estas mismas cajas; solo sirve para acotar el objetivo máximo.
 */
export type Region = {
  id: string;
  name: string;
  /** [[minLng, minLat], [maxLng, maxLat]] */
  bounds: [[number, number], [number, number]];
  population: number;
};

export const REGIONS: Region[] = [
  { id: "europe", name: "Europe", bounds: [[-11, 35], [40, 62]], population: 784 },
  { id: "north-america", name: "North America", bounds: [[-128, 15], [-60, 55]], population: 563 },
  { id: "south-america", name: "South America", bounds: [[-82, -56], [-34, 13]], population: 452 },
  { id: "africa", name: "Africa", bounds: [[-18, -35], [52, 37]], population: 1774 },
  { id: "middle-east", name: "Middle East", bounds: [[25, 12], [75, 45]], population: 1178 },
  { id: "south-asia", name: "South Asia", bounds: [[60, 5], [98, 36]], population: 2030 },
  { id: "east-asia", name: "East Asia", bounds: [[95, 18], [146, 50]], population: 1715 },
  { id: "southeast-asia", name: "Southeast Asia", bounds: [[92, -11], [128, 24]], population: 871 },
];

export const REGION_MIN_TARGET = 1_000_000;
/** El objetivo nunca pasa del 35 % de la región ni de 300 millones. */
const MAX_SHARE = 0.35;
const ABS_MAX = 300_000_000;

export function regionById(id: string | null | undefined): Region | null {
  return REGIONS.find((r) => r.id === id) ?? null;
}

export function maxTargetFor(region: Region): number {
  return Math.min(ABS_MAX, Math.floor(region.population * 1e6 * MAX_SHARE));
}

function roundTo2Significant(n: number): number {
  const magnitude = Math.pow(10, Math.floor(Math.log10(n)) - 1);
  return Math.round(n / magnitude) * magnitude;
}

/** Objetivo en escala logarítmica entre 1 M y el máximo de la región, a 2 cifras significativas. */
export function targetForRegion(region: Region, random: () => number = Math.random): number {
  const lo = Math.log(REGION_MIN_TARGET);
  const hi = Math.log(maxTargetFor(region));
  const value = roundTo2Significant(Math.exp(lo + random() * (hi - lo)));
  return Math.min(maxTargetFor(region), Math.max(REGION_MIN_TARGET, value));
}

export type Round = { region: Region; target: number };

export function randomRound(random: () => number = Math.random): Round {
  const region = REGIONS[Math.floor(random() * REGIONS.length) % REGIONS.length];
  return { region, target: targetForRegion(region, random) };
}

/** Ronda diaria: misma región y cifra para todo el planeta ese día. */
export function dailyRound(dateString: string): Round {
  return randomRound(randomFromSeed(`populatio-world-round-${dateString}`));
}

export function isValidRoundTarget(region: Region, value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= REGION_MIN_TARGET &&
    value <= maxTargetFor(region) &&
    roundTo2Significant(value) === value
  );
}

/** Lee ?r=<región>&objetivo=<cifra> de un enlace compartido. */
export function roundFromSearch(search: string): Round | null {
  const params = new URLSearchParams(search);
  const region = regionById(params.get("r"));
  const target = Number(params.get("objetivo"));
  if (!region || !isValidRoundTarget(region, target)) return null;
  return { region, target };
}

export function roundToSearch(round: Round): string {
  const params = new URLSearchParams();
  params.set("r", round.region.id);
  params.set("objetivo", String(round.target));
  return `?${params.toString()}`;
}
