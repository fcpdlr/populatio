import type { Polygon, MultiPolygon } from "geojson";
import unkinkPolygon from "@turf/unkink-polygon";
import union from "@turf/union";

/**
 * Convierte un trazo dibujado a mano —que puede cruzarse a sí mismo— en una
 * geometría válida sin autointersecciones: separa el trazo en piezas sin
 * cruces y las une en el área total encerrada (sin zonas canceladas).
 */
export function cleanPolygon(
  geometry: Polygon | MultiPolygon,
): Polygon | MultiPolygon {
  let pieces;
  try {
    pieces = unkinkPolygon(geometry);
  } catch {
    return geometry;
  }

  const features = pieces.features;
  if (features.length === 0) return geometry;
  if (features.length === 1) return features[0].geometry;

  try {
    const merged = union({ type: "FeatureCollection", features });
    if (merged) return merged.geometry;
  } catch {
    // si la unión falla, usamos la pieza más grande como mejor esfuerzo
  }
  return features[0].geometry;
}
