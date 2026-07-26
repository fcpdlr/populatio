import { describe, it, expect } from "vitest";
import { GridEstimator, type GridMeta } from "@/lib/population/gridEstimator";
import { square } from "./fixtures";

/** Codifica celdas [i, j, población] como el binario 8 bytes/celda de rejilla.bin. */
function encodeCells(cells: [number, number, number][]): ArrayBuffer {
  const buffer = new ArrayBuffer(cells.length * 8);
  const view = new DataView(buffer);
  cells.forEach(([i, j, pop], k) => {
    const offset = k * 8;
    view.setUint16(offset, i, true);
    view.setUint16(offset + 2, j, true);
    view.setUint32(offset + 4, pop, true);
  });
  return buffer;
}

const META: GridMeta = {
  minLng: 0,
  minLat: 0,
  stepLng: 0.1,
  stepLat: 0.1,
  count: 0,
  totalPopulation: 0,
};

describe("GridEstimator", () => {
  it("suma la población de las celdas cuyo centro cae dentro del polígono", async () => {
    // i,j -> lng,lat: (0,0)->(0,0) dentro; (1,0)->(0.1,0) dentro; (5,5)->(0.5,0.5) fuera
    const cells: [number, number, number][] = [
      [0, 0, 1000],
      [1, 0, 2000],
      [5, 5, 9999],
    ];
    const estimator = new GridEstimator(encodeCells(cells), {
      ...META,
      count: cells.length,
    });
    const selection = square(-0.05, -0.05, 0.2); // cubre (0,0) y (0.1,0)
    const r = await estimator.estimate(selection);
    expect(r.totalPopulation).toBe(3000);
  });

  it("ignora las celdas con población 0", async () => {
    const cells: [number, number, number][] = [[0, 0, 0]];
    const estimator = new GridEstimator(encodeCells(cells), {
      ...META,
      count: cells.length,
    });
    const r = await estimator.estimate(square(-0.05, -0.05, 0.1));
    expect(r.totalPopulation).toBe(0);
  });

  it("selección sin celdas dentro da población 0", async () => {
    const cells: [number, number, number][] = [[50, 50, 12345]];
    const estimator = new GridEstimator(encodeCells(cells), {
      ...META,
      count: cells.length,
    });
    const r = await estimator.estimate(square(-1, -1, 0.1));
    expect(r.totalPopulation).toBe(0);
  });

  it("respeta minLng/minLat y el paso al ubicar las celdas", async () => {
    // i=2, j=3 con min y paso no triviales -> lng = -18.1582 + 2*0.013, lat = 27.636 + 3*0.009
    const meta: GridMeta = {
      minLng: -18.1582,
      minLat: 27.636,
      stepLng: 0.013,
      stepLat: 0.009,
      count: 1,
      totalPopulation: 500,
    };
    const estimator = new GridEstimator(encodeCells([[2, 3, 500]]), meta);
    const lng = meta.minLng + 2 * meta.stepLng;
    const lat = meta.minLat + 3 * meta.stepLat;
    const r = await estimator.estimate(
      square(lng - 0.01, lat - 0.01, 0.02),
    );
    expect(r.totalPopulation).toBe(500);
  });

  it("lanza si el tamaño del buffer no coincide con el conteo declarado", () => {
    expect(
      () => new GridEstimator(encodeCells([[0, 0, 1]]), { ...META, count: 2 }),
    ).toThrow(/incoherente/);
  });
});
