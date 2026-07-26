import type { Polygon, MultiPolygon } from "geojson";
import area from "@turf/area";
import kinks from "@turf/kinks";

/** Bounding box amplio del territorio español (península, islas, Ceuta y Melilla). */
export const SPAIN_BBOX: [number, number, number, number] = [
  -18.6, 27.3, 4.7, 44.2,
];

export type ValidationError =
  | "empty"
  | "not-closed"
  | "too-small"
  | "self-intersecting"
  | "outside-spain";

export type ValidationResult =
  | { ok: true }
  | { ok: false; error: ValidationError; message: string };

const MIN_AREA_M2 = 1_000_000; // 1 km²: por debajo, la selección no es jugable.

export const VALIDATION_MESSAGES: Record<ValidationError, string> = {
  empty: "Dibuja primero una zona en el mapa.",
  "not-closed": "La zona debe ser un polígono cerrado.",
  "too-small": "La zona es demasiado pequeña. Amplíala e inténtalo de nuevo.",
  "self-intersecting":
    "La línea se cruza consigo misma. Ajusta los vértices para que no se corte.",
  "outside-spain": "La zona está fuera de España. Dibuja sobre el territorio español.",
};

function fail(error: ValidationError): ValidationResult {
  return { ok: false, error, message: VALIDATION_MESSAGES[error] };
}

export function validateSelection(
  geometry: Polygon | MultiPolygon | null | undefined,
): ValidationResult {
  if (!geometry) return fail("empty");

  const polygons: number[][][][] =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;

  if (polygons.length === 0 || polygons[0].length === 0) return fail("empty");

  for (const rings of polygons) {
    const outer = rings[0];
    if (!outer || outer.length < 4) return fail("not-closed");
    const first = outer[0];
    const last = outer[outer.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) return fail("not-closed");
  }

  const feature = { type: "Feature" as const, properties: {}, geometry };

  if (kinks(feature).features.length > 0) return fail("self-intersecting");

  if (area(feature) < MIN_AREA_M2) return fail("too-small");

  const [minLng, minLat, maxLng, maxLat] = SPAIN_BBOX;
  const intersectsSpainBbox = polygons.some((rings) =>
    rings[0].some(
      ([lng, lat]) =>
        lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat,
    ),
  );
  if (!intersectsSpainBbox) return fail("outside-spain");

  return { ok: true };
}
