import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "fflate";
import { WorldEstimator, type WorldIndex } from "@/lib/population/worldEstimator";
import { sampleZone, sampleZonePair, framingBounds, blob } from "@/lib/population/zoneSampler";
import { inverseMollweide, mollweide } from "@/lib/population/mollweide";
import { randomFromSeed } from "@/lib/game/dailyTarget";
import { REGIONS } from "@/lib/game/regions";

const DIR = path.resolve(__dirname, "../../public/world/tiles");
const index = JSON.parse(readFileSync(path.join(DIR, "index.json"), "utf8")) as WorldIndex;
const load = async (p: string) => {
  const raw = gunzipSync(readFileSync(path.join(DIR, p)));
  return new Uint32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
};

describe("inverseMollweide", () => {
  it("deshace la proyección directa", () => {
    for (const [lng, lat] of [[0, 0], [-3.7, 40.4], [139.7, 35.7], [-58.4, -34.6], [170, 65]]) {
      const [x, y] = mollweide(lng, lat);
      const [a, b] = inverseMollweide(x, y);
      expect(a).toBeCloseTo(lng, 6);
      expect(b).toBeCloseTo(lat, 6);
    }
  });
});

describe("zoneSampler (datos reales)", () => {
  const est = new WorldEstimator(index, load);
  const ready = est.init();

  it("genera zonas pobladas dentro de cada región", async () => {
    await ready;
    const cells = est.populatedCells();
    const random = randomFromSeed("test-zones");
    for (const region of REGIONS) {
      const z = await sampleZone(est, cells, region.bounds, random);
      expect(z.population).toBeGreaterThanOrEqual(50_000);
      const [[a, b], [c, d]] = region.bounds;
      expect(z.center[0]).toBeGreaterThan(a - 0.1);
      expect(z.center[0]).toBeLessThan(c + 0.1);
      expect(z.center[1]).toBeGreaterThan(b - 0.1);
      expect(z.center[1]).toBeLessThan(d + 0.1);
    }
  });

  it("las parejas no se solapan y son comparables casi siempre", async () => {
    await ready;
    const cells = est.populatedCells();
    const random = randomFromSeed("test-pairs");
    let comparable = 0;
    for (let i = 0; i < 6; i++) {
      const region = REGIONS[i % REGIONS.length];
      const [a, b] = await sampleZonePair(est, cells, region.bounds, random);
      expect(a.population).not.toBe(b.population);
      if (Math.max(a.population, b.population) / Math.min(a.population, b.population) <= 3) comparable++;
      const fb = framingBounds([a.geometry, b.geometry]);
      expect(fb[0][0]).toBeLessThan(fb[1][0]);
    }
    expect(comparable).toBeGreaterThanOrEqual(5);
  });

  it("blob devuelve un anillo cerrado", () => {
    const g = blob([0, 0], 50, randomFromSeed("b"));
    const ring = g.coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });
});
