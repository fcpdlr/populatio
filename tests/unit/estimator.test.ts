import { describe, it, expect } from "vitest";
import type { FeatureCollection, Polygon } from "geojson";
import { MunicipalEstimator } from "@/lib/population/municipalEstimator";
import type { MunicipalityFeatureProperties } from "@/lib/population/types";
import { municipality, square } from "./fixtures";

// Tres municipios artificiales de 0,1° de lado, separados entre sí:
// A [0.00–0.10], B [0.15–0.25], C [0.30–0.40]
const A = municipality("99001", "Alfa", 100_000, 0.0, 0.0);
const B = municipality("99002", "Beta", 50_000, 0.15, 0.0);
const C = municipality("99003", "Gamma", 20_000, 0.3, 0.0);

const collection: FeatureCollection<Polygon, MunicipalityFeatureProperties> = {
  type: "FeatureCollection",
  features: [A, B, C],
};

describe("MunicipalEstimator", () => {
  const estimator = new MunicipalEstimator(collection);

  it("municipio completamente incluido aporta toda su población", async () => {
    // Selección que cubre A por completo y nada más (termina en lng 0,13)
    const selection = square(-0.05, -0.05, 0.18);
    const r = await estimator.estimate(selection);
    expect(r.contributingMunicipalities).toHaveLength(1);
    const a = r.contributingMunicipalities[0];
    expect(a.municipalityCode).toBe("99001");
    expect(a.intersectionRatio).toBeCloseTo(1, 3);
    expect(r.totalPopulation).toBeCloseTo(100_000, -2);
  });

  it("municipio parcialmente incluido se prorratea por área", async () => {
    // Cubre A entero y la mitad izquierda de B (hasta lng 0,20 = mitad de B)
    const selection = square(-0.05, -0.05, 0.25);
    const r = await estimator.estimate(selection);
    const b = r.contributingMunicipalities.find(
      (m) => m.municipalityCode === "99002",
    );
    expect(b).toBeDefined();
    expect(b!.intersectionRatio).toBeCloseTo(0.5, 2);
    expect(r.totalPopulation).toBeCloseTo(100_000 + 25_000, -3);
  });

  it("suma las contribuciones de varios municipios", async () => {
    // Cubre los tres por completo
    const selection = square(-0.05, -0.05, 0.5);
    const r = await estimator.estimate(selection);
    expect(r.contributingMunicipalities).toHaveLength(3);
    expect(r.totalPopulation).toBeCloseTo(170_000, -2);
    // Ordenadas de mayor a menor aportación
    expect(
      r.contributingMunicipalities.map((m) => m.municipalityCode),
    ).toEqual(["99001", "99002", "99003"]);
  });

  it("municipio sin intersección no aparece", async () => {
    const selection = square(1.0, 1.0, 0.1); // lejos de todos
    const r = await estimator.estimate(selection);
    expect(r.contributingMunicipalities).toHaveLength(0);
    expect(r.totalPopulation).toBe(0);
  });

  it("informa del tiempo de cálculo", async () => {
    const r = await estimator.estimate(square(0, 0, 0.05));
    expect(r.calculationTimeMs).toBeGreaterThanOrEqual(0);
  });
});
