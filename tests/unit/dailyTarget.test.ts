import { describe, it, expect } from "vitest";
import { dailyTargetForDate } from "@/lib/game/dailyTarget";
import { isValidTarget } from "@/lib/game/target";

describe("dailyTargetForDate", () => {
  it("es determinista: la misma fecha da siempre el mismo objetivo", () => {
    const a = dailyTargetForDate("2026-03-14");
    const b = dailyTargetForDate("2026-03-14");
    expect(a).toBe(b);
  });

  it("el objetivo cumple el rango y el múltiplo de práctica", () => {
    for (let i = 0; i < 30; i++) {
      const date = `2026-01-${String(i + 1).padStart(2, "0")}`;
      expect(isValidTarget(dailyTargetForDate(date))).toBe(true);
    }
  });

  it("fechas distintas producen objetivos variados (no siempre el mismo)", () => {
    const values = new Set(
      Array.from({ length: 20 }, (_, i) =>
        dailyTargetForDate(`2026-02-${String(i + 1).padStart(2, "0")}`),
      ),
    );
    expect(values.size).toBeGreaterThan(1);
  });
});
