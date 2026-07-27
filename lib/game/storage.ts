import type { AttemptResult } from "@/lib/population/types";
import { safeStorage, type StorageLike } from "@/lib/storage/safeStorage";

const KEY_PREFIX = "rodea:best:";
const ATTEMPTS_PREFIX = "rodea:attempts:";

export function loadBest(
  target: number,
  storage: StorageLike | null = safeStorage(),
): AttemptResult | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(KEY_PREFIX + target);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AttemptResult;
    if (typeof parsed?.score !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Guarda el intento si mejora el anterior. Devuelve true si hubo mejora. */
export function saveIfBest(
  result: AttemptResult,
  storage: StorageLike | null = safeStorage(),
): boolean {
  if (!storage) return false;
  const current = loadBest(result.targetPopulation, storage);
  if (current && current.score >= result.score) return false;
  try {
    storage.setItem(
      KEY_PREFIX + result.targetPopulation,
      JSON.stringify(result),
    );
    return true;
  } catch {
    return false;
  }
}

export function loadAttemptCount(
  target: number,
  storage: StorageLike | null = safeStorage(),
): number {
  if (!storage) return 0;
  const n = Number(storage.getItem(ATTEMPTS_PREFIX + target));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function incrementAttemptCount(
  target: number,
  storage: StorageLike | null = safeStorage(),
): number {
  const next = loadAttemptCount(target, storage) + 1;
  try {
    storage?.setItem(ATTEMPTS_PREFIX + target, String(next));
  } catch {
    /* almacenamiento lleno o bloqueado: seguimos sin persistir */
  }
  return next;
}
