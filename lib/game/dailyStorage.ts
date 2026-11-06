import type { Polygon, MultiPolygon } from "geojson";
import type { AttemptResult, MunicipalityContribution } from "@/lib/population/types";
import { safeStorage, type StorageLike } from "@/lib/storage/safeStorage";
import { previousDateString } from "./dailyDate";

export type DailyResult = AttemptResult & {
  /** Fecha (YYYY-MM-DD) en Europe/Madrid a la que corresponde el reto. */
  date: string;
  geometry: Polygon | MultiPolygon;
  contributions: MunicipalityContribution[];
  completedAt: string;
};

export type StreakData = {
  current: number;
  best: number;
  lastPlayedDate: string | null;
};

const RESULT_PREFIX = "populatio:daily:result:";
const STREAK_KEY = "populatio:daily:streak";
const DEFAULT_STREAK: StreakData = { current: 0, best: 0, lastPlayedDate: null };

/** Resultado guardado del reto de `date`, o null si ese día no se ha jugado. */
export function loadDailyResult(
  date: string,
  storage: StorageLike | null = safeStorage(),
  ns = "",
): DailyResult | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(RESULT_PREFIX + ns + date);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DailyResult;
    if (typeof parsed?.score !== "number" || parsed.date !== date) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDailyResult(
  result: DailyResult,
  storage: StorageLike | null = safeStorage(),
  ns = "",
): void {
  if (!storage) return;
  try {
    storage.setItem(RESULT_PREFIX + ns + result.date, JSON.stringify(result));
  } catch {
    /* almacenamiento lleno o bloqueado: seguimos sin persistir */
  }
}

export function loadStreak(
  storage: StorageLike | null = safeStorage(),
  ns = "",
): StreakData {
  if (!storage) return DEFAULT_STREAK;
  try {
    const raw = storage.getItem(STREAK_KEY + (ns ? ":" + ns : ""));
    if (!raw) return DEFAULT_STREAK;
    const parsed = JSON.parse(raw) as Partial<StreakData>;
    return {
      current: typeof parsed.current === "number" ? parsed.current : 0,
      best: typeof parsed.best === "number" ? parsed.best : 0,
      lastPlayedDate:
        typeof parsed.lastPlayedDate === "string" ? parsed.lastPlayedDate : null,
    };
  } catch {
    return DEFAULT_STREAK;
  }
}

function saveStreak(streak: StreakData, storage: StorageLike | null, ns = ""): void {
  if (!storage) return;
  try {
    storage.setItem(STREAK_KEY + (ns ? ":" + ns : ""), JSON.stringify(streak));
  } catch {
    /* almacenamiento lleno o bloqueado: seguimos sin persistir */
  }
}

/**
 * Registra que se ha jugado el reto de `date` (cuenta por jugar, no por
 * acertar). Consecutivo respecto al día anterior -> racha +1; hueco -> racha
 * vuelve a 1; mismo día ya registrado -> sin cambios (idempotente).
 */
export function recordPlayed(
  date: string,
  storage: StorageLike | null = safeStorage(),
  ns = "",
): StreakData {
  const streak = loadStreak(storage, ns);
  if (streak.lastPlayedDate === date) return streak;

  const playedYesterday = streak.lastPlayedDate === previousDateString(date);
  const current = playedYesterday ? streak.current + 1 : 1;
  const next: StreakData = {
    current,
    best: Math.max(streak.best, current),
    lastPlayedDate: date,
  };
  saveStreak(next, storage, ns);
  return next;
}
