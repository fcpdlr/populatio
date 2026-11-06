import type { AttemptResult } from "@/lib/population/types";
import { safeStorage, type StorageLike } from "@/lib/storage/safeStorage";

const KEY_PREFIX = "rodea:best:";
const ATTEMPTS_PREFIX = "rodea:attempts:";

export function loadBest(
  target: number,
  storage: StorageLike | null = safeStorage(),
  ns = "",
): AttemptResult | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(KEY_PREFIX + ns + target);
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
  ns = "",
): boolean {
  if (!storage) return false;
  const current = loadBest(result.targetPopulation, storage, ns);
  if (current && current.score >= result.score) return false;
  try {
    storage.setItem(
      KEY_PREFIX + ns + result.targetPopulation,
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
  ns = "",
): number {
  if (!storage) return 0;
  const n = Number(storage.getItem(ATTEMPTS_PREFIX + ns + target));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function incrementAttemptCount(
  target: number,
  storage: StorageLike | null = safeStorage(),
  ns = "",
): number {
  const next = loadAttemptCount(target, storage, ns) + 1;
  try {
    storage?.setItem(ATTEMPTS_PREFIX + ns + target, String(next));
  } catch {
    /* almacenamiento lleno o bloqueado: seguimos sin persistir */
  }
  return next;
}
