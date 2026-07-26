import { describe, it, expect } from "vitest";
import { formatInt, formatPercent } from "@/lib/format";

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
