import type { Polygon, MultiPolygon } from "geojson";

/** Propiedades de cada municipio en el GeoJSON optimizado. */
export type MunicipalityFeatureProperties = {
  /** Código INE de 5 dígitos (2 provincia + 3 municipio). */
  municipalityCode: string;
  municipalityName: string;
  provinceCode: string;
  /** Población oficial del padrón (habitantes). */
  population: number;
  /** Área total precalculada de la geometría optimizada, en m². */
  totalAreaM2: number;
  /** [minLng, minLat, maxLng, maxLat] */
  bbox: [number, number, number, number];
};

export type MunicipalityContribution = {
  municipalityCode: string;
  municipalityName: string;
  /** Fracción del área municipal incluida en la selección, entre 0 y 1. */
  intersectionRatio: number;
  /** Población prorrateada aportada por este municipio (redondeada). */
  estimatedPopulation: number;
};

export type PopulationEstimate = {
  totalPopulation: number;
  contributingMunicipalities: MunicipalityContribution[];
  calculationTimeMs: number;
};

export type AttemptResult = {
  targetPopulation: number;
  estimatedPopulation: number;
  absoluteDifference: number;
  percentageError: number;
  direction: "over" | "under" | "exact";
  score: number;
};

/**
 * Abstracción del estimador de población.
 *
 * El MVP usa un estimador municipal por prorrateo de superficie
 * (municipalEstimator). En el futuro puede sustituirse por una
 * implementación basada en rejilla de población (p. ej. la rejilla
 * de 1 km del INE o GHS-POP) sin tocar el resto de la aplicación.
 */
export interface PopulationEstimator {
  estimate(selection: Polygon | MultiPolygon): Promise<PopulationEstimate>;
}

/** metadata.json generado por el pipeline de datos. */
export type DatasetMetadata = {
  populationYear: number;
  populationSource: string;
  geometrySource: string;
  generatedAt: string;
  municipalityCount: number;
  totalPopulation: number;
  schemaVersion: number;
};
