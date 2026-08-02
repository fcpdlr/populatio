import { describe, it, expect } from "vitest";
import {
  generateTarget,
  isValidTarget,
  targetFromSearch,
  targetToSearch,
  MIN_TARGET,
  MAX_TARGET,
  TARGET_STEP,
} from "@/lib/game/target";

describe("generateTarget", () => {
  it("genera dentro del rango y en múltiplos de 50.000", () => {
    for (let i = 0; i < 500; i++) {
      const t = generateTarget();
      expect(t).toBeGreaterThanOrEqual(MIN_TARGET);
      expect(t).toBeLessThanOrEqual(MAX_TARGET);
      expect(t % TARGET_STEP).toBe(0);
    }
  });
  it("cubre los extremos con un RNG inyectado", () => {
    expect(generateTarget(() => 0)).toBe(MIN_TARGET);
    expect(generateTarget(() => 0.999999)).toBe(MAX_TARGET);
  });
});

describe("persistencia del objetivo en la URL", () => {
  it("serializa y recupera el objetivo", () => {
    const search = targetToSearch(10_000_000);
    expect(search).toBe("?objetivo=10000000");
    expect(targetFromSearch(search)).toBe(10_000_000);
  });
  it("rechaza valores inválidos", () => {
    expect(targetFromSearch("?objetivo=abc")).toBeNull();
    expect(targetFromSearch("?objetivo=123")).toBeNull(); // no múltiplo
    expect(targetFromSearch("?objetivo=999999999")).toBeNull(); // fuera de rango
    expect(targetFromSearch("?objetivo=10010000")).toBeNull(); // no múltiplo de 50.000
    expect(targetFromSearch("")).toBeNull();
  });
  it("isValidTarget valida tipo, rango y múltiplo", () => {
    expect(isValidTarget(10_000_000)).toBe(true);
    expect(isValidTarget(10_050_000)).toBe(true);
    expect(isValidTarget(10_010_000)).toBe(false);
    expect(isValidTarget("10000000")).toBe(false);
    expect(isValidTarget(NaN)).toBe(false);
  });
});
