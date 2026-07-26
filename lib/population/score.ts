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
 * Puntuación 0–1000. Decae exponencialmente con el error porcentual.
 * error 0 % → 1000 · error 1 % → ~905 · error 5 % → ~607 · error 10 % → ~368.
 *
 * Única fuente de verdad de la fórmula: modifícala solo aquí.
 */
export function score(percentageErrorValue: number): number {
  return Math.max(0, Math.round(1000 * Math.exp(-percentageErrorValue / 10)));
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
