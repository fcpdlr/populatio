import { describe, it, expect } from "vitest";
import {
  generateWorldTarget,
  isValidWorldTarget,
  dailyWorldTargetForDate,
  WORLD_MIN_TARGET,
  WORLD_MAX_TARGET,
} from "@/lib/game/worldTarget";

describe("objetivos del modo Mundo", () => {
  it("están en rango y con dos cifras significativas", () => {
    for (let i = 0; i <= 100; i++) {
      const t = generateWorldTarget(() => i / 100);
      expect(t).toBeGreaterThanOrEqual(WORLD_MIN_TARGET);
      expect(t).toBeLessThanOrEqual(WORLD_MAX_TARGET);
      expect(isValidWorldTarget(t)).toBe(true);
    }
  });

  it("el diario es determinista por fecha", () => {
    expect(dailyWorldTargetForDate("2026-11-06")).toBe(dailyWorldTargetForDate("2026-11-06"));
  });

  it("rechaza cifras que no son objetivos válidos", () => {
    expect(isValidWorldTarget(12_345_678)).toBe(false);
    expect(isValidWorldTarget(500)).toBe(false);
  });
});
