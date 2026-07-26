import { describe, it, expect, beforeEach } from "vitest";
import {
  loadBest,
  saveIfBest,
  loadAttemptCount,
  incrementAttemptCount,
} from "@/lib/game/storage";
import { buildAttemptResult } from "@/lib/population/score";

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

describe("almacenamiento del mejor intento", () => {
  let storage: Storage;
  beforeEach(() => {
    storage = memoryStorage();
  });

  it("devuelve null sin datos", () => {
    expect(loadBest(5_000_000, storage)).toBeNull();
  });

  it("guarda el primer intento y solo sobreescribe si mejora", () => {
    const worse = buildAttemptResult(4_000_000, 5_000_000); // 20 % error
    const better = buildAttemptResult(4_900_000, 5_000_000); // 2 % error
    expect(saveIfBest(worse, storage)).toBe(true);
    expect(saveIfBest(worse, storage)).toBe(false);
    expect(saveIfBest(better, storage)).toBe(true);
    expect(loadBest(5_000_000, storage)?.score).toBe(better.score);
    expect(saveIfBest(worse, storage)).toBe(false);
  });

  it("separa mejores intentos por objetivo", () => {
    const a = buildAttemptResult(1_000_000, 1_000_000);
    const b = buildAttemptResult(2_000_000, 3_000_000);
    saveIfBest(a, storage);
    saveIfBest(b, storage);
    expect(loadBest(1_000_000, storage)?.score).toBe(1000);
    expect(loadBest(3_000_000, storage)?.score).toBe(b.score);
  });

  it("cuenta intentos por objetivo", () => {
    expect(loadAttemptCount(1_000_000, storage)).toBe(0);
    expect(incrementAttemptCount(1_000_000, storage)).toBe(1);
    expect(incrementAttemptCount(1_000_000, storage)).toBe(2);
    expect(loadAttemptCount(1_000_000, storage)).toBe(2);
    expect(loadAttemptCount(2_000_000, storage)).toBe(0);
  });
});
