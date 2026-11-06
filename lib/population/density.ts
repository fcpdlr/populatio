import { mollweide, inverseMollweide } from "./mollweide";
import type { WorldEstimator, WorldIndex } from "./worldEstimator";

/**
 * Densidad de población agregada en una rejilla de píxeles de la vista
 * actual del mapa. La calcula el worker para que el hilo principal solo
 * tenga que pintar puntos.
 */
export type DensityRequest = {
  centerLng: number;
  centerLat: number;
  /** píxeles por grado de latitud */
  scale: number;
  /** corrección de aspecto (cos de la latitud de referencia) */
  k: number;
  width: number;
  height: number;
  binPx: number;
};

/** Por debajo de este número de teselas en vista se usa la rejilla de 1 km. */
const MAX_FINE_TILES = 16;

export async function densityBins(
  est: WorldEstimator,
  index: WorldIndex,
  loadTile: (name: string) => Promise<Uint32Array>,
  req: DensityRequest,
): Promise<Float32Array> {
  const { centerLng, centerLat, scale, k, width, height, binPx } = req;
  const cols = Math.max(1, Math.ceil(width / binPx));
  const rows = Math.max(1, Math.ceil(height / binPx));
  const bins = new Float32Array(cols * rows);

  const lngAt = (x: number) => centerLng + (x - width / 2) / (scale * k);
  const latAt = (y: number) => centerLat - (y - height / 2) / scale;
  const minLng = lngAt(0), maxLng = lngAt(width);
  const maxLat = Math.min(85, latAt(0)), minLat = Math.max(-85, latAt(height));

  const add = (lng: number, lat: number, v: number) => {
    const x = width / 2 + (lng - centerLng) * scale * k;
    const y = height / 2 - (lat - centerLat) * scale;
    const c = Math.floor(x / binPx), r = Math.floor(y / binPx);
    if (c < 0 || c >= cols || r < 0 || r >= rows) return;
    bins[r * cols + c] += v;
  };

  // Caja de la vista en Mollweide (las esquinas y el centro de cada borde bastan).
  let mx0 = Infinity, mx1 = -Infinity, my0 = Infinity, my1 = -Infinity;
  for (const lng of [minLng, (minLng + maxLng) / 2, maxLng]) {
    for (const lat of [minLat, (minLat + maxLat) / 2, maxLat]) {
      const [x, y] = mollweide(Math.max(-180, Math.min(180, lng)), lat);
      if (x < mx0) mx0 = x;
      if (x > mx1) mx1 = x;
      if (y < my0) my0 = y;
      if (y > my1) my1 = y;
    }
  }
  const { x0, y0, cell_m: cell, tile: T, scale_1km } = index;
  const tc0 = Math.max(0, Math.floor((mx0 - x0) / cell / T));
  const tc1 = Math.floor((mx1 - x0) / cell / T);
  const tr0 = Math.max(0, Math.floor((y0 - my1) / cell / T));
  const tr1 = Math.floor((y0 - my0) / cell / T);

  if ((tc1 - tc0 + 1) * (tr1 - tr0 + 1) <= MAX_FINE_TILES) {
    const r0 = Math.max(0, Math.floor((y0 - my1) / cell));
    const r1 = Math.floor((y0 - my0) / cell);
    const c0 = Math.max(0, Math.floor((mx0 - x0) / cell));
    const c1 = Math.floor((mx1 - x0) / cell);
    for (let tr = tr0; tr <= tr1; tr++) {
      for (let tc = tc0; tc <= tc1; tc++) {
        const name = `${tr}_${tc}`;
        if (!index.tiles[name]) continue;
        const data = await loadTile(name);
        const rs = Math.max(r0, tr * T), re = Math.min(r1, tr * T + T - 1);
        const cs = Math.max(c0, tc * T), ce = Math.min(c1, tc * T + T - 1);
        for (let r = rs; r <= re; r++) {
          const base = (r - tr * T) * T - tc * T;
          const yc = y0 - (r + 0.5) * cell;
          for (let c = cs; c <= ce; c++) {
            const v = data[base + c];
            if (!v) continue;
            const [lng, lat] = inverseMollweide(x0 + (c + 0.5) * cell, yc);
            add(lng, lat, v / scale_1km);
          }
        }
      }
    }
  } else {
    const { lng, lat, pop } = est.populatedCells();
    for (let i = 0; i < pop.length; i++) {
      const a = lng[i], b = lat[i];
      if (a < minLng || a > maxLng || b < minLat || b > maxLat) continue;
      add(a, b, pop[i]);
    }
  }
  return bins;
}
