import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "fflate";
import type { Polygon } from "geojson";
import { mollweide, MOLLWEIDE_R } from "@/lib/population/mollweide";
import { WorldEstimator, MAX_FINE_TILES, type WorldIndex } from "@/lib/population/worldEstimator";

const DIR = path.resolve(__dirname, "../../public/world/tiles");
const index = JSON.parse(readFileSync(path.join(DIR, "index.json"), "utf8")) as WorldIndex;
const load = async (p: string) => {
  const raw = gunzipSync(readFileSync(path.join(DIR, p)));
  return new Uint32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
};

function box(minLng: number, minLat: number, maxLng: number, maxLat: number): Polygon {
  return {
    type: "Polygon",
    coordinates: [[[minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat], [minLng, minLat]]],
  };
}

describe("mollweide", () => {
  it("coincide con los extremos de ESRI:54009", () => {
    const [x] = mollweide(180, 0);
    expect(x).toBeCloseTo(2 * Math.SQRT2 * MOLLWEIDE_R, 0);
    const [, y] = mollweide(0, 90);
    expect(y).toBeCloseTo(Math.SQRT2 * MOLLWEIDE_R, 0);
    expect(mollweide(0, 0)).toEqual([0, 0]);
  });
});

describe("WorldEstimator (datos reales GHS-POP 2025)", () => {
  const est = new WorldEstimator(index, load);
  const ready = est.init();

  it("el planeta entero suma ~8.200 millones", async () => {
    await ready;
    const r = await est.estimate(box(-179.9, -89, 179.9, 89));
    expect(r.totalPopulation / 1e9).toBeGreaterThan(8.0);
    expect(r.totalPopulation / 1e9).toBeLessThan(8.4);
  });

  it("la Comunidad de Madrid (caja aproximada) ronda los 7 millones", async () => {
    await ready;
    const r = await est.estimate(box(-4.6, 39.9, -3.05, 41.17));
    expect(r.totalPopulation).toBeGreaterThan(6_000_000);
    expect(r.totalPopulation).toBeLessThan(8_500_000);
  });

  it("1 km y 10 km dan casi lo mismo en una zona mediana", async () => {
    await ready;
    const coarseOnly = new WorldEstimator(index, load, 0);
    await coarseOnly.init();
    const sel = box(138.5, 34.8, 141, 36.6); // Kanto
    const fine = await est.estimate(sel);
    const coarse = await coarseOnly.estimate(sel);
    expect(MAX_FINE_TILES).toBeGreaterThan(0);
    expect(Math.abs(fine.totalPopulation - coarse.totalPopulation) / fine.totalPopulation).toBeLessThan(0.02);
  });

  it("una zona sobre el océano da 0", async () => {
    await ready;
    const r = await est.estimate(box(-30, -20, -20, -10));
    expect(r.totalPopulation).toBe(0);
  });
});
