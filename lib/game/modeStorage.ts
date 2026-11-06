import { safeStorage, type StorageLike } from "@/lib/storage/safeStorage";

/** Modos de dibujo (los gestiona Game). */
export type GameMode = "daily" | "practice";
/** Todos los modos del menú. */
export type AnyMode = GameMode | "guess" | "duel";

const MODE_KEY = "populatio:mode";
const ALL: AnyMode[] = ["daily", "practice", "guess", "duel"];

export function loadMode(storage: StorageLike | null = safeStorage()): AnyMode | null {
  if (!storage) return null;
  const raw = storage.getItem(MODE_KEY);
  return ALL.includes(raw as AnyMode) ? (raw as AnyMode) : null;
}

export function saveMode(
  mode: AnyMode,
  storage: StorageLike | null = safeStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(MODE_KEY, mode);
  } catch {
    /* almacenamiento lleno o bloqueado: seguimos sin persistir */
  }
}
