import { describe, it, expect } from "vitest";
import type { Polygon } from "geojson";
import area from "@turf/area";
import { cleanPolygon } from "@/lib/geo/clean";
import { validateSelection } from "@/lib/geo/validation";
import { square } from "./fixtures";

describe("cleanPolygon", () => {
  it("deshace una pajarita (bowtie) autointersectada en una geometría jugable", () => {
    const bowtie: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [-3.8, 40.3],
          [-3.5, 40.6],
          [-3.5, 40.3],
          [-3.8, 40.6],
          [-3.8, 40.3],
        ],
      ],
    };
    const cleaned = cleanPolygon(bowtie);
    const feature = { type: "Feature" as const, properties: {}, geometry: cleaned };
    // El área ya no se cancela (como pasaba con el trazo crudo autocruzado):
    // ahora es la suma de los dos lóbulos.
    expect(area(feature)).toBeGreaterThan(0);
    expect(validateSelection(cleaned).ok).toBe(true);
  });

  it("deja intacto (en área) un polígono ya válido", () => {
    const valid = square(-3.9, 40.2, 0.4);
    const cleaned = cleanPolygon(valid);
    const cleanedArea = area({ type: "Feature", properties: {}, geometry: cleaned });
    const originalArea = area({ type: "Feature", properties: {}, geometry: valid });
    expect(cleanedArea).toBeCloseTo(originalArea, -3);
    expect(validateSelection(cleaned).ok).toBe(true);
  });

  it("une un trazo en forma de ocho en el área total encerrada", () => {
    // Dos lóbulos que se cruzan en un punto central, como un "8".
    const figureEight: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [-3.9, 40.2],
          [-3.7, 40.2],
          [-3.7, 40.4],
          [-3.9, 40.4],
          [-3.9, 40.2],
          [-3.7, 40.2],
          [-3.7, 40.0],
          [-3.5, 40.0],
          [-3.5, 40.2],
          [-3.7, 40.2],
        ],
      ],
    };
    const cleaned = cleanPolygon(figureEight);
    const feature = { type: "Feature" as const, properties: {}, geometry: cleaned };
    expect(area(feature)).toBeGreaterThan(0);
    expect(validateSelection(cleaned).ok).toBe(true);
  });
});
