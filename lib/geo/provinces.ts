import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";

export type ProvinceGeometries = (Polygon | MultiPolygon)[];

let cached: Promise<ProvinceGeometries> | null = null;

/**
 * Carga los contornos de provincia (public/provincias.geojson), generados
 * aparte disolviendo secciones censales por provincia. Es una capa opcional:
 * si el fichero no existe todavía, el fetch falla y la función se limita a
 * lanzar (el interruptor de la UI lo trata como "no disponible").
 */
export function loadProvinceLines(): Promise<ProvinceGeometries> {
  if (!cached) {
    cached = fetch("/provincias.geojson")
      .then((res) => {
        if (!res.ok) throw new Error("No se ha podido cargar el contorno de provincias.");
        return res.json();
      })
      .then((geojson: FeatureCollection<Polygon | MultiPolygon>) =>
        geojson.features.map((f) => f.geometry),
      )
      .catch((err) => {
        cached = null; // permite reintentar en el próximo toggle
        throw err;
      });
  }
  return cached;
}
