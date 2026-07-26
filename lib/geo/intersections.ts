import type { Feature, Polygon, MultiPolygon } from "geojson";
import intersect from "@turf/intersect";
import area from "@turf/area";
import { featureCollection } from "@turf/helpers";

type Poly = Polygon | MultiPolygon;

/**
 * Fracción del área de `municipality` cubierta por `selection`, entre 0 y 1.
 *
 * `totalAreaM2` debe ser el área geodésica precalculada de la MISMA
 * geometría (la optimizada), para que numerador y denominador sean
 * consistentes y el prorrateo no quede sesgado por la simplificación.
 */
export function intersectionRatio(
  selection: Feature<Poly>,
  municipality: Feature<Poly>,
  totalAreaM2: number,
): number {
  if (totalAreaM2 <= 0) return 0;
  let clipped: Feature<Poly> | null = null;
  try {
    clipped = intersect(featureCollection([selection, municipality]));
  } catch {
    // Geometría problemática en el clipping: mejor 0 que un resultado inventado.
    return 0;
  }
  if (!clipped) return 0;
  const ratio = area(clipped) / totalAreaM2;
  // Las áreas geodésicas sobre geometrías simplificadas pueden desviarse
  // marginalmente; se acota a [0, 1].
  return Math.min(1, Math.max(0, ratio));
}
