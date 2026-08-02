import { describe, it, expect, beforeEach } from "vitest";
import {
  loadDailyResult,
  saveDailyResult,
  loadStreak,
  recordPlayed,
  type DailyResult,
} from "@/lib/game/dailyStorage";
import { buildAttemptResult } from "@/lib/population/score";
import { square } from "./fixtures";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    get length() {
      return map.size;
    },
  };
}

function fakeResult(date: string): DailyResult {
  return {
    ...buildAttemptResult(9_800_000, 10_000_000),
    date,
    geometry: square(-3.9, 40.2, 0.4),
    contributions: [],
    completedAt: `${date}T12:00:00.000Z`,
  };
}

describe("resultado diario", () => {
  let storage: Storage;
  beforeEach(() => {
    storage = memoryStorage();
  });

  it("no hay resultado antes de guardar", () => {
    expect(loadDailyResult("2026-03-01", storage)).toBeNull();
  });

  it("guarda y recupera el resultado del día", () => {
    const result = fakeResult("2026-03-01");
    saveDailyResult(result, storage);
    expect(loadDailyResult("2026-03-01", storage)?.score).toBe(result.score);
  });

  it("no confunde el resultado de un día con el de otro", () => {
    saveDailyResult(fakeResult("2026-03-01"), storage);
    expect(loadDailyResult("2026-03-02", storage)).toBeNull();
  });
});

describe("racha", () => {
  let storage: Storage;
  beforeEach(() => {
    storage = memoryStorage();
  });

  it("empieza en 0 sin datos", () => {
    const streak = loadStreak(storage);
    expect(streak).toEqual({ current: 0, best: 0, lastPlayedDate: null });
  });

  it("primer día jugado -> racha 1", () => {
    const streak = recordPlayed("2026-03-01", storage);
    expect(streak).toEqual({ current: 1, best: 1, lastPlayedDate: "2026-03-01" });
  });

  it("día consecutivo -> racha +1", () => {
    recordPlayed("2026-03-01", storage);
    const streak = recordPlayed("2026-03-02", storage);
    expect(streak.current).toBe(2);
    expect(streak.best).toBe(2);
  });

  it("mismo día otra vez -> sin cambio (idempotente)", () => {
    recordPlayed("2026-03-01", storage);
    const streak = recordPlayed("2026-03-01", storage);
    expect(streak.current).toBe(1);
  });

  it("hueco de un día -> la racha vuelve a 1, pero se conserva la mejor", () => {
    recordPlayed("2026-03-01", storage);
    recordPlayed("2026-03-02", storage);
    recordPlayed("2026-03-03", storage); // racha de 3
    const streak = recordPlayed("2026-03-05", storage); // se saltó el día 4
    expect(streak.current).toBe(1);
    expect(streak.best).toBe(3);
  });
});
