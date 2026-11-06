import { randomFromSeed } from "./dailyTarget";

/**
 * Objetivos del modo Mundo. A escala planetaria un rango lineal no funciona
 * (casi todos los números saldrían por encima de 100 millones), así que se
 * reparten en escala logarítmica y se redondean a dos cifras significativas:
 * 1.200.000, 47.000.000, 230.000.000...
 */
export const WORLD_MIN_TARGET = 1_000_000;
export const WORLD_MAX_TARGET = 300_000_000;

function roundTo2Significant(n: number): number {
  const magnitude = Math.pow(10, Math.floor(Math.log10(n)) - 1);
  return Math.round(n / magnitude) * magnitude;
}

export function generateWorldTarget(random: () => number = Math.random): number {
  const lo = Math.log(WORLD_MIN_TARGET);
  const hi = Math.log(WORLD_MAX_TARGET);
  const value = Math.exp(lo + random() * (hi - lo));
  return Math.min(WORLD_MAX_TARGET, Math.max(WORLD_MIN_TARGET, roundTo2Significant(value)));
}

export function isValidWorldTarget(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= WORLD_MIN_TARGET &&
    value <= WORLD_MAX_TARGET &&
    roundTo2Significant(value) === value
  );
}

export function worldTargetFromSearch(search: string): number | null {
  const raw = new URLSearchParams(search).get("objetivo");
  if (!raw) return null;
  const n = Number(raw);
  return isValidWorldTarget(n) ? n : null;
}

/** Objetivo del reto diario mundial: el mismo para todos, distinto al de España. */
export function dailyWorldTargetForDate(dateString: string): number {
  return generateWorldTarget(randomFromSeed(`populatio-world-daily-${dateString}`));
}
