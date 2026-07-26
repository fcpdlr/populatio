import { describe, it, expect } from "vitest";
import { initialState, reducer } from "@/lib/game/state";
import { buildAttemptResult } from "@/lib/population/score";

describe("reducer del juego", () => {
  it("pasa a ready cuando los datos cargan", () => {
    const s = reducer(initialState(1_000_000), { type: "data-ready" });
    expect(s.phase).toBe("ready");
  });

  it("guarda el error de datos", () => {
    const s = reducer(initialState(1_000_000), {
      type: "data-error",
      message: "sin red",
    });
    expect(s.phase).toBe("data-error");
    expect(s.errorMessage).toBe("sin red");
  });

  it("ignora selecciones mientras cargan los datos", () => {
    const s = reducer(initialState(1_000_000), {
      type: "selection-changed",
      hasSelection: true,
    });
    expect(s.phase).toBe("loading-data");
  });

  it("registra un intento completo", () => {
    let s = reducer(initialState(5_000_000), { type: "data-ready" });
    s = reducer(s, { type: "selection-changed", hasSelection: true });
    s = reducer(s, { type: "check-started" });
    const result = buildAttemptResult(4_800_000, 5_000_000);
    s = reducer(s, {
      type: "check-finished",
      result,
      contributions: [],
      attempts: 1,
      best: result,
    });
    expect(s.phase).toBe("result");
    expect(s.result?.score).toBe(result.score);
    expect(s.attempts).toBe(1);
  });

  it("nuevo objetivo reinicia el estado conservando best/attempts del nuevo objetivo", () => {
    let s = reducer(initialState(5_000_000), { type: "data-ready" });
    s = reducer(s, {
      type: "new-target",
      target: 8_000_000,
      best: null,
      attempts: 0,
    });
    expect(s.target).toBe(8_000_000);
    expect(s.phase).toBe("ready");
    expect(s.result).toBeNull();
  });
});
