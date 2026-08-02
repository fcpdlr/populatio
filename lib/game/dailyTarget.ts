import { generateTarget } from "./target";

/** Hash de 32 bits determinista de una cadena (xmur3 simplificado). */
function hashStringToSeed(value: string): number {
  let h = 1779033703 ^ value.length;
  for (let i = 0; i < value.length; i++) {
    h = Math.imul(h ^ value.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/** PRNG determinista (mulberry32): misma seed -> misma secuencia siempre. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generador aleatorio determinista a partir de cualquier cadena semilla. */
export function randomFromSeed(seed: string): () => number {
  return mulberry32(hashStringToSeed(seed));
}

/**
 * Objetivo del reto diario: determinista a partir de la fecha (YYYY-MM-DD en
 * Europe/Madrid), igual para todos los jugadores. Mismo rango y paso que el
 * objetivo de Práctica (múltiplos de 50.000, 1M-30M).
 */
export function dailyTargetForDate(dateString: string): number {
  return generateTarget(randomFromSeed(`populatio-daily-${dateString}`));
}
