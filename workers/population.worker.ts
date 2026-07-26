/// <reference lib="webworker" />
import type { Polygon, MultiPolygon } from "geojson";
import {
  GridEstimator,
  parseGridMeta,
  type RawGridMeta,
} from "@/lib/population/gridEstimator";
import type { PopulationEstimate } from "@/lib/population/types";

export type WorkerRequest =
  | { type: "init" }
  | { type: "estimate"; id: number; geometry: Polygon | MultiPolygon };

export type WorkerResponse =
  | { type: "ready"; cellCount: number; totalPopulation: number }
  | { type: "init-error"; message: string }
  | { type: "estimate-result"; id: number; estimate: PopulationEstimate }
  | { type: "estimate-error"; id: number; message: string };

let estimator: GridEstimator | null = null;

async function init(): Promise<void> {
  try {
    const [metaRes, dataRes] = await Promise.all([
      fetch("/rejilla_meta.json"),
      fetch("/rejilla.bin"),
    ]);
    if (!metaRes.ok || !dataRes.ok) {
      throw new Error("No se han podido descargar los datos de población.");
    }
    const raw = (await metaRes.json()) as RawGridMeta;
    const meta = parseGridMeta(raw);
    const buffer = await dataRes.arrayBuffer();

    estimator = new GridEstimator(buffer, meta);
    post({
      type: "ready",
      cellCount: estimator.cellCount,
      totalPopulation: meta.totalPopulation,
    });
  } catch (err) {
    post({
      type: "init-error",
      message: err instanceof Error ? err.message : "Error al cargar los datos.",
    });
  }
}

function post(message: WorkerResponse): void {
  (self as unknown as Worker).postMessage(message);
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  if (msg.type === "init") {
    await init();
    return;
  }
  if (msg.type === "estimate") {
    if (!estimator) {
      post({
        type: "estimate-error",
        id: msg.id,
        message: "Los datos todavía no están listos.",
      });
      return;
    }
    try {
      const estimate = await estimator.estimate(msg.geometry);
      post({ type: "estimate-result", id: msg.id, estimate });
    } catch (err) {
      post({
        type: "estimate-error",
        id: msg.id,
        message:
          err instanceof Error ? err.message : "Error durante el cálculo.",
      });
    }
  }
};
