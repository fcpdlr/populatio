import type {
  Feature,
  FeatureCollection,
  Polygon,
  MultiPolygon,
} from "geojson";
import bbox from "@turf/bbox";
import { BBoxIndex, type BBox } from "@/lib/geo/spatialIndex";
import { intersectionRatio } from "@/lib/geo/intersections";
import type {
  MunicipalityContribution,
  MunicipalityFeatureProperties,
  PopulationEstimate,
  PopulationEstimator,
} from "./types";

type MunicipalityFeature = Feature<
  Polygon | MultiPolygon,
  MunicipalityFeatureProperties
>;

/**
 * Estimador municipal por prorrateo de superficie.
 *
 * población estimada = Σ (población_municipio × área_intersección / área_total_municipio)
 *
 * Supone distribución uniforme de población dentro de cada municipio.
 * Para sustituirlo por una rejilla de población, implementa
 * PopulationEstimator con otra fuente y cambia la instancia en el worker.
 */
export class MunicipalEstimator implements PopulationEstimator {
  private index: BBoxIndex<MunicipalityFeature>;

  constructor(
    collection: FeatureCollection<
      Polygon | MultiPolygon,
      MunicipalityFeatureProperties
    >,
  ) {
    this.index = new BBoxIndex(
      collection.features.map((f) => ({
        bbox: f.properties.bbox,
        item: f,
      })),
    );
  }

  get municipalityCount(): number {
    return this.index.size;
  }

  async estimate(
    selection: Polygon | MultiPolygon,
  ): Promise<PopulationEstimate> {
    const started = performance.now();
    const selectionFeature: Feature<Polygon | MultiPolygon> = {
      type: "Feature",
      properties: {},
      geometry: selection,
    };

    const selectionBBox = bbox(selectionFeature) as BBox;
    const candidates = this.index.search(selectionBBox);

    const contributions: MunicipalityContribution[] = [];
    let total = 0;

    for (const municipality of candidates) {
      const ratio = intersectionRatio(
        selectionFeature,
        municipality,
        municipality.properties.totalAreaM2,
      );
      if (ratio <= 0) continue;
      const estimated = municipality.properties.population * ratio;
      total += estimated;
      contributions.push({
        municipalityCode: municipality.properties.municipalityCode,
        municipalityName: municipality.properties.municipalityName,
        intersectionRatio: ratio,
        estimatedPopulation: Math.round(estimated),
      });
    }

    contributions.sort((a, b) => b.estimatedPopulation - a.estimatedPopulation);

    return {
      totalPopulation: Math.round(total),
      contributingMunicipalities: contributions,
      calculationTimeMs: performance.now() - started,
    };
  }
}
