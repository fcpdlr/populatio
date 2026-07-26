import { describe, it, expect } from "vitest";
import {
  percentageError,
  score,
  direction,
  buildAttemptResult,
} from "@/lib/population/score";

describe("percentageError", () => {
  it("es 0 cuando la estimación es exacta", () => {
    expect(percentageError(10_000_000, 10_000_000)).toBe(0);
  });
  it("calcula el error relativo al objetivo", () => {
    expect(percentageError(9_742_381, 10_000_000)).toBeCloseTo(2.57619, 4);
    expect(percentageError(11_000_000, 10_000_000)).toBeCloseTo(10, 8);
  });
  it("rechaza objetivos no positivos", () => {
    expect(() => percentageError(1, 0)).toThrow();
  });
});

describe("score", () => {
  it("da 1000 con error 0", () => {
    expect(score(0)).toBe(1000);
  });
  it("sigue la curva exponencial documentada", () => {
    expect(score(1)).toBe(905);
    expect(score(5)).toBe(607);
    expect(score(10)).toBe(368);
  });
  it("tiende a 0 con errores grandes y nunca es negativa", () => {
    expect(score(100)).toBe(0);
    expect(score(10_000)).toBe(0);
  });
});

describe("direction", () => {
  it("detecta over, under y exact", () => {
    expect(direction(11, 10)).toBe("over");
    expect(direction(9, 10)).toBe("under");
    expect(direction(10, 10)).toBe("exact");
  });
});

describe("buildAttemptResult", () => {
  it("compone el resultado completo", () => {
    const r = buildAttemptResult(9_742_381, 10_000_000);
    expect(r.direction).toBe("under");
    expect(r.absoluteDifference).toBe(257_619);
    expect(r.percentageError).toBeCloseTo(2.57619, 4);
    expect(r.score).toBe(score(r.percentageError));
  });
});
