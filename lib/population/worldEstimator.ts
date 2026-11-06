import type { Polygon, MultiPolygon } from "geojson";
import { mollweide, inverseMollweide } from "./mollweide";
import type { PopulationEstimate, PopulationEstimator } from "./types";

/**
 * Estimador mundial sobre la rejilla GHS-POP 2025 (Comisión Europea, JRC).
 *
 * Datos (public/world/tiles, generados en fcpdlr/populatio-data):
 *   index.json            metadatos de la rejilla y población de cada tesela
 *   1km/<fila>_<col>.bin.gz  teselas de 250×250 celdas de 1 km, uint32 LE,
 *                         valor = habitantes × 10 (solo teselas con población)
 *   world_10km.bin.gz     el planeta a 10 km, uint32 LE, valor = habitantes
 *
 * Igual que el estimador de España: suma la población de cada celda cuyo
 * centro cae dentro del polígono, sin prorrateo de bordes. Las zonas pequeñas
 * usan la rejilla de 1 km (descargando solo las teselas que tocan); las
 * grandes, la de 10 km, donde el error de borde es despreciable frente al
 * total.
 */

export type WorldIndex = {
  cell_m: number;
  x0: number; // borde izquierdo de la columna 0 (m)
  y0: number; // borde superior de la fila 0 (m)
  width: number;
  height: number;
  tile: number;
  scale_1km: number;
  coarse: { factor: number; width: number; height: number };
  tiles: Record<string, number>;
  total: number;
};

/** Descarga y descomprime un recurso binario; inyectable para los tests. */
export type BinaryLoader = (path: string) => Promise<Uint32Array>;

/** Por encima de este número de teselas de 1 km en el encuadre se usa la rejilla de 10 km. */
export const MAX_FINE_TILES = 40;
/** Densificado de los lados del polígono antes de proyectar (grados). */
const DENSIFY_DEG = 0.2;

type Ring = [number, number][];

/** Anillos del polígono, densificados y proyectados a Mollweide. */
export function projectRings(selection: Polygon | MultiPolygon): Ring[] {
  const rings =
    selection.type === "Polygon" ? selection.coordinates : selection.coordinates.flat();
  return rings.map((ring) => {
    const out: Ring = [];
    for (let k = 0; k < ring.length - 1; k++) {
      const [lng1, lat1] = ring[k];
      const [lng2, lat2] = ring[k + 1];
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(lng2 - lng1), Math.abs(lat2 - lat1)) / DENSIFY_DEG));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        out.push(mollweide(lng1 + (lng2 - lng1) * t, lat1 + (lat2 - lat1) * t));
      }
    }
    if (out.length) out.push(out[0]);
    return out;
  });
}

/**
 * Recorre por filas las celdas (de tamaño `cell`) cuyo centro está dentro de
 * los anillos (regla par-impar) y llama a `addSpan(fila, colIni, colFin)`.
 */
export function scanCells(
  rings: Ring[],
  x0: number,
  y0: number,
  cell: number,
  maxRow: number,
  maxCol: number,
  addSpan: (row: number, c0: number, c1: number) => void,
): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const ring of rings) for (const [, y] of ring) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minY)) return;
  const r0 = Math.max(0, Math.floor((y0 - maxY) / cell));
  const r1 = Math.min(maxRow - 1, Math.floor((y0 - minY) / cell));
  const xs: number[] = [];
  for (let r = r0; r <= r1; r++) {
    const yc = y0 - (r + 0.5) * cell;
    xs.length = 0;
    for (const ring of rings) {
      for (let k = 0; k < ring.length - 1; k++) {
        const [xa, ya] = ring[k];
        const [xb, yb] = ring[k + 1];
        if (ya > yc !== yb > yc) xs.push(xa + ((yc - ya) * (xb - xa)) / (yb - ya));
      }
    }
    if (xs.length < 2) continue;
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.max(0, Math.ceil((xs[k] - x0) / cell - 0.5));
      const c1 = Math.min(maxCol - 1, Math.floor((xs[k + 1] - x0) / cell - 0.5));
      if (c1 >= c0) addSpan(r, c0, c1);
    }
  }
}

export class WorldEstimator implements PopulationEstimator {
  private coarse: Uint32Array | null = null;
  private readonly tileCache = new Map<string, Promise<Uint32Array>>();

  constructor(
    private readonly index: WorldIndex,
    private readonly load: BinaryLoader,
    private readonly maxFineTiles: number = MAX_FINE_TILES,
  ) {}

  get totalPopulation(): number {
    return this.index.total;
  }

  /** Carga la rejilla de 10 km (2 MB): se hace al iniciar el worker. */
  async init(): Promise<void> {
    this.coarse = await this.load("world_10km.bin.gz");
    const { width, height } = this.index.coarse;
    if (this.coarse.length !== width * height) {
      throw new Error("The 10 km world grid is incomplete.");
    }
  }

  private populated: { lng: Float32Array; lat: Float32Array; pop: Float32Array } | null = null;

  /**
   * Celdas pobladas de la rejilla de 10 km con su posición en grados.
   * Se calcula una vez, la primera vez que se generan zonas aleatorias.
   */
  populatedCells(): { lng: Float32Array; lat: Float32Array; pop: Float32Array } {
    if (this.populated) return this.populated;
    const coarse = this.coarse;
    if (!coarse) throw new Error("The data isn't ready yet.");
    const { factor, width: cw } = this.index.coarse;
    const cell = this.index.cell_m * factor;
    let n = 0;
    for (let k = 0; k < coarse.length; k++) if (coarse[k] > 0) n++;
    const lng = new Float32Array(n), lat = new Float32Array(n), pop = new Float32Array(n);
    let j = 0;
    for (let k = 0; k < coarse.length; k++) {
      const v = coarse[k];
      if (v <= 0) continue;
      const row = Math.floor(k / cw), col = k - row * cw;
      const [a, b] = inverseMollweide(
        this.index.x0 + (col + 0.5) * cell,
        this.index.y0 - (row + 0.5) * cell,
      );
      lng[j] = a; lat[j] = b; pop[j] = v; j++;
    }
    this.populated = { lng, lat, pop };
    return this.populated;
  }

  private tile(name: string): Promise<Uint32Array> {
    let p = this.tileCache.get(name);
    if (!p) {
      p = this.load(`1km/${name}.bin.gz`).catch((err) => {
        this.tileCache.delete(name);
        throw err;
      });
      this.tileCache.set(name, p);
    }
    return p;
  }

  async estimate(selection: Polygon | MultiPolygon): Promise<PopulationEstimate> {
    const started = performance.now();
    const rings = projectRings(selection);
    const { x0, y0, cell_m: cell, width, height, tile: T, scale_1km } = this.index;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const ring of rings) for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const tc0 = Math.max(0, Math.floor((minX - x0) / cell / T));
    const tc1 = Math.floor((maxX - x0) / cell / T);
    const tr0 = Math.max(0, Math.floor((y0 - maxY) / cell / T));
    const tr1 = Math.floor((y0 - minY) / cell / T);
    const tileCount = (tc1 - tc0 + 1) * (tr1 - tr0 + 1);

    let total = 0;
    if (tileCount <= this.maxFineTiles) {
      const names: string[] = [];
      for (let r = tr0; r <= tr1; r++) for (let c = tc0; c <= tc1; c++) {
        const name = `${r}_${c}`;
        if (this.index.tiles[name]) names.push(name);
      }
      const loaded = new Map<string, Uint32Array>();
      await Promise.all(names.map(async (n) => loaded.set(n, await this.tile(n))));

      let sum = 0;
      scanCells(rings, x0, y0, cell, height, width, (row, c0, c1) => {
        const tr = Math.floor(row / T);
        const rowInTile = row - tr * T;
        let c = c0;
        while (c <= c1) {
          const tcol = Math.floor(c / T);
          const end = Math.min(c1, (tcol + 1) * T - 1);
          const data = loaded.get(`${tr}_${tcol}`);
          if (data) {
            const base = rowInTile * T - tcol * T;
            for (let k = c; k <= end; k++) sum += data[base + k];
          }
          c = end + 1;
        }
      });
      total = sum / scale_1km;
    } else {
      const coarse = this.coarse;
      if (!coarse) throw new Error("The data isn't ready yet.");
      const { factor, width: cw, height: ch } = this.index.coarse;
      scanCells(rings, x0, y0, cell * factor, ch, cw, (row, c0, c1) => {
        const base = row * cw;
        for (let k = c0; k <= c1; k++) total += coarse[base + k];
      });
    }

    return {
      totalPopulation: Math.round(total),
      contributingMunicipalities: [],
      calculationTimeMs: performance.now() - started,
    };
  }
}
