import { describe, it, expect } from "vitest";
import { formatInt, formatPercent, formatCountdown } from "@/lib/format";

describe("formato numérico es-ES", () => {
  it("usa punto como separador de miles", () => {
    // Intl puede usar espacio fino o punto según ICU; normalizamos
    const s = formatInt(10_000_000).replace(/\u00a0|\u202f/g, ".");
    expect(s).toBe("10.000.000");
  });
  it("redondea al entero más cercano", () => {
    expect(formatInt(1.6)).toBe("2");
  });
  it("formatea porcentajes con coma y dos decimales", () => {
    expect(formatPercent(2.576).replace(/\u00a0|\u202f/g, " ")).toBe("2,58 %");
    expect(formatPercent(0).replace(/\u00a0|\u202f/g, " ")).toBe("0,00 %");
  });
});

describe("formatCountdown", () => {
  it("formatea HH:MM:SS con ceros a la izquierda", () => {
    expect(formatCountdown(3_723_000)).toBe("01:02:03");
    expect(formatCountdown(0)).toBe("00:00:00");
    expect(formatCountdown(59_000)).toBe("00:00:59");
  });
  it("nunca da negativo", () => {
    expect(formatCountdown(-5000)).toBe("00:00:00");
  });
});
