import type { AttemptResult } from "./types";

/**
 * Error porcentual absoluto respecto al objetivo.
 * Devuelve un valor >= 0 (100 = errar por el total del objetivo).
 */
export function percentageError(
  estimatedPopulation: number,
  targetPopulation: number,
): number {
  if (targetPopulation <= 0) {
    throw new Error("targetPopulation debe ser mayor que 0");
  }
  return (
    (Math.abs(estimatedPopulation - targetPopulation) / targetPopulation) * 100
  );
}

/**
 * Puntuación 0–1000. Decae exponencialmente con el error porcentual, con una
 * curva pensada para premiar acercarse (no solo clavarlo):
 * 0 % → 1000 · 5 % → 846 · 10 % → 717 · 20 % → 513 · 30 % → 368 · 50 % → 189 · 100 % → 36.
 *
 * Única fuente de verdad de la fórmula: modifícala solo aquí.
 */
export const SCORE_SCALE = 30;

export function score(percentageErrorValue: number): number {
  return Math.max(0, Math.round(1000 * Math.exp(-percentageErrorValue / SCORE_SCALE)));
}

/** Etiqueta corta para que se entienda el resultado de un vistazo. */
export function scoreLabel(points: number): string {
  if (points >= 950) return "Spot on!";
  if (points >= 800) return "Excellent";
  if (points >= 650) return "Great";
  if (points >= 450) return "Good";
  if (points >= 250) return "Not bad";
  if (points >= 100) return "Way off";
  return "Missed";
}

export function direction(
  estimatedPopulation: number,
  targetPopulation: number,
): AttemptResult["direction"] {
  if (estimatedPopulation === targetPopulation) return "exact";
  return estimatedPopulation > targetPopulation ? "over" : "under";
}

/** Construye el resultado completo de un intento. */
export function buildAttemptResult(
  estimatedPopulation: number,
  targetPopulation: number,
): AttemptResult {
  const err = percentageError(estimatedPopulation, targetPopulation);
  return {
    targetPopulation,
    estimatedPopulation,
    absoluteDifference: Math.abs(estimatedPopulation - targetPopulation),
    percentageError: err,
    direction: direction(estimatedPopulation, targetPopulation),
    score: score(err),
  };
}
