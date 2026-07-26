import { describe, it, expect } from "vitest";
import type { Polygon } from "geojson";
import { validateSelection } from "@/lib/geo/validation";
import { square } from "./fixtures";

describe("validateSelection", () => {
  it("rechaza selección vacía", () => {
    const r = validateSelection(null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("empty");
  });

  it("rechaza anillos no cerrados", () => {
    const open: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [-3.8, 40.3],
          [-3.5, 40.3],
          [-3.5, 40.6],
          [-3.8, 40.61], // no coincide con el primero
        ],
      ],
    };
    const r = validateSelection(open);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("not-closed");
  });

  it("rechaza polígonos demasiado pequeños", () => {
    // ~0,0001° ≈ 11 m de lado, muy por debajo de 1 km²
    const tiny = square(-3.7, 40.4, 0.0001);
    const r = validateSelection(tiny);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("too-small");
  });

  it("rechaza polígonos autointersectados (pajarita)", () => {
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
    const r = validateSelection(bowtie);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("self-intersecting");
  });

  it("rechaza selecciones fuera de España", () => {
    const atlanticoNorte = square(-40, 50, 1);
    const r = validateSelection(atlanticoNorte);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("outside-spain");
  });

  it("acepta un polígono válido sobre España", () => {
    const madrid = square(-3.9, 40.2, 0.4);
    expect(validateSelection(madrid).ok).toBe(true);
  });

  it("acepta MultiPolygon válido", () => {
    const multi = {
      type: "MultiPolygon" as const,
      coordinates: [
        square(-3.9, 40.2, 0.3).coordinates,
        square(2.5, 39.3, 0.3).coordinates, // Mallorca aprox
      ],
    };
    expect(validateSelection(multi).ok).toBe(true);
  });
});
