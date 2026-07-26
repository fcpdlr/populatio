import type { Polygon, MultiPolygon } from "geojson";
import bbox from "@turf/bbox";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type { PopulationEstimate, PopulationEstimator } from "./types";

const CELL_BYTES = 8; // uint16 i, uint16 j, uint32 población (little-endian)

/** Metadatos de la rejilla, ya normalizados a camelCase (ver rejilla_meta.json). */
export type GridMeta = {
  minLng: number;
  minLat: number;
  stepLng: number;
  stepLat: number;
  count: number;
  totalPopulation: number;
};

/**
 * Estimador por rejilla de población.
 *
 * población estimada = Σ población_celda para cada celda cuyo centro cae
 * dentro del polígono.
 *
 * Cada celda del binario ocupa 8 bytes: i (uint16 LE), j (uint16 LE),
 * población (uint32 LE). La posición real es
 * lng = minLng + i·stepLng, lat = minLat + j·stepLat.
 *
 * No hay prorrateo de bordes: al ser celdas de ~1 km, el error queda
 * acotado por el tamaño de celda y desaparece al promediar sobre selecciones
 * de tamaño jugable.
 */
export class GridEstimator implements PopulationEstimator {
  private readonly lngs: Float64Array;
  private readonly lats: Float64Array;
  private readonly pops: Uint32Array;

  constructor(buffer: ArrayBuffer, meta: GridMeta) {
    const expectedBytes = meta.count * CELL_BYTES;
    if (buffer.byteLength !== expectedBytes) {
      throw new Error(
        `Rejilla incoherente: se esperaban ${meta.count} celdas ` +
          `(${expectedBytes} bytes) y el fichero tiene ${buffer.byteLength} bytes.`,
      );
    }

    const view = new DataView(buffer);
    const n = meta.count;
    this.lngs = new Float64Array(n);
    this.lats = new Float64Array(n);
    this.pops = new Uint32Array(n);

    for (let k = 0; k < n; k++) {
      const offset = k * CELL_BYTES;
      const i = view.getUint16(offset, true);
      const j = view.getUint16(offset + 2, true);
      this.lngs[k] = meta.minLng + i * meta.stepLng;
      this.lats[k] = meta.minLat + j * meta.stepLat;
      this.pops[k] = view.getUint32(offset + 4, true);
    }
  }

  get cellCount(): number {
    return this.pops.length;
  }

  async estimate(
    selection: Polygon | MultiPolygon,
  ): Promise<PopulationEstimate> {
    const started = performance.now();
    const [minLng, minLat, maxLng, maxLat] = bbox({
      type: "Feature",
      properties: {},
      geometry: selection,
    });

    let total = 0;
    const { lngs, lats, pops } = this;
    for (let k = 0; k < pops.length; k++) {
      const pop = pops[k];
      if (pop === 0) continue;
      const lng = lngs[k];
      if (lng < minLng || lng > maxLng) continue;
      const lat = lats[k];
      if (lat < minLat || lat > maxLat) continue;
      if (booleanPointInPolygon([lng, lat], selection)) {
        total += pop;
      }
    }

    return {
      totalPopulation: total,
      contributingMunicipalities: [],
      calculationTimeMs: performance.now() - started,
    };
  }
}
