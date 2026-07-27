import { safeStorage, type StorageLike } from "@/lib/storage/safeStorage";

export type GameMode = "daily" | "practice";

const MODE_KEY = "populatio:mode";

export function loadMode(storage: StorageLike | null = safeStorage()): GameMode | null {
  if (!storage) return null;
  const raw = storage.getItem(MODE_KEY);
  return raw === "daily" || raw === "practice" ? raw : null;
}

export function saveMode(
  mode: GameMode,
  storage: StorageLike | null = safeStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(MODE_KEY, mode);
  } catch {
    /* almacenamiento lleno o bloqueado: seguimos sin persistir */
  }
}
