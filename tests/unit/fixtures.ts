/**
 * Fixtures geográficos ARTIFICIALES, solo para tests.
 * Cuadrados de ~0,1° cerca del ecuador de coordenadas españolas ficticias.
 * Los datos de producción son reales; estos no.
 */
import type { Feature, Polygon } from "geojson";
import areaFn from "@turf/area";
import type { MunicipalityFeatureProperties } from "@/lib/population/types";

export function square(
  minLng: number,
  minLat: number,
  size: number,
): Polygon {
  return {
    type: "Polygon",
    coordinates: [
      [
        [minLng, minLat],
        [minLng + size, minLat],
        [minLng + size, minLat + size],
        [minLng, minLat + size],
        [minLng, minLat],
      ],
    ],
  };
}

export function municipality(
  code: string,
  name: string,
  population: number,
  minLng: number,
  minLat: number,
  size = 0.1,
): Feature<Polygon, MunicipalityFeatureProperties> {
  const geometry = square(minLng, minLat, size);
  const feature: Feature<Polygon, MunicipalityFeatureProperties> = {
    type: "Feature",
    geometry,
    properties: {
      municipalityCode: code,
      municipalityName: name,
      provinceCode: code.slice(0, 2),
      population,
      totalAreaM2: 0,
      bbox: [minLng, minLat, minLng + size, minLat + size],
    },
  };
  feature.properties.totalAreaM2 = areaFn(feature);
  return feature;
}
