/** Rango razonable de objetivos para el MVP. */
export const MIN_TARGET = 1_000_000;
export const MAX_TARGET = 30_000_000;
export const TARGET_STEP = 100_000;

/**
 * Genera un objetivo aleatorio entre MIN_TARGET y MAX_TARGET,
 * redondeado a múltiplos de 100.000.
 * Acepta un generador aleatorio inyectable para tests deterministas.
 */
export function generateTarget(random: () => number = Math.random): number {
  const steps = Math.floor((MAX_TARGET - MIN_TARGET) / TARGET_STEP);
  const k = Math.floor(random() * (steps + 1));
  return MIN_TARGET + k * TARGET_STEP;
}

/** Valida un objetivo leído de la URL o del almacenamiento. */
export function isValidTarget(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= MIN_TARGET &&
    value <= MAX_TARGET &&
    value % TARGET_STEP === 0
  );
}

/** Lee el objetivo del parámetro ?objetivo= de la URL, si es válido. */
export function targetFromSearch(search: string): number | null {
  const params = new URLSearchParams(search);
  const raw = params.get("objetivo");
  if (!raw) return null;
  const n = Number(raw);
  return isValidTarget(n) ? n : null;
}

/** Serializa el objetivo en la URL sin recargar la página. */
export function targetToSearch(target: number): string {
  const params = new URLSearchParams();
  params.set("objetivo", String(target));
  return `?${params.toString()}`;
}
