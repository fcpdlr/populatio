import {
  parseGridBinary,
  parseGridMeta,
  type GridCells,
  type RawGridMeta,
} from "./gridEstimator";

export type DensityGrid = GridCells;

let cached: Promise<DensityGrid> | null = null;

/**
 * Carga y decodifica la rejilla de población para pintarla como capa de
 * densidad (solo en el resultado). Reutiliza los mismos ficheros que ya
 * descarga el worker de cálculo; el navegador sirve la segunda petición
 * desde caché HTTP.
 */
export function loadDensityGrid(): Promise<DensityGrid> {
  if (!cached) {
    cached = (async () => {
      const [metaRes, dataRes] = await Promise.all([
        fetch("/rejilla_meta.json"),
        fetch("/rejilla.bin"),
      ]);
      if (!metaRes.ok || !dataRes.ok) {
        throw new Error("No se ha podido cargar la densidad de población.");
      }
      const raw = (await metaRes.json()) as RawGridMeta;
      const meta = parseGridMeta(raw);
      const buffer = await dataRes.arrayBuffer();
      return parseGridBinary(buffer, meta);
    })().catch((err) => {
      cached = null; // permite reintentar en el próximo toggle
      throw err;
    });
  }
  return cached;
}
