/**
 * Punto de entrada del estimador de población.
 *
 * La aplicación (a través del Web Worker) depende únicamente de la
 * interfaz PopulationEstimator. La implementación del MVP es
 * MunicipalEstimator (prorrateo por superficie municipal).
 *
 * Futuro: una implementación GridEstimator sobre una rejilla real de
 * población (rejilla de 1 km del INE / Eurostat GEOSTAT / GHS-POP)
 * puede sustituir a MunicipalEstimator aquí sin cambiar nada más.
 */
export type {
  PopulationEstimator,
  PopulationEstimate,
  MunicipalityContribution,
} from "./types";
export { MunicipalEstimator } from "./municipalEstimator";
