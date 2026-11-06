/// <reference lib="webworker" />
import type { Polygon, MultiPolygon } from "geojson";
import {
  GridEstimator,
  parseGridMeta,
  type RawGridMeta,
} from "@/lib/population/gridEstimator";
import { WorldEstimator, type WorldIndex } from "@/lib/population/worldEstimator";
import type { PopulationEstimate, PopulationEstimator } from "@/lib/population/types";
import { gunzipSync } from "fflate";

export type WorkerRequest =
  | { type: "init"; region?: "es" | "world" }
  | { type: "estimate"; id: number; geometry: Polygon | MultiPolygon };

export type WorkerResponse =
  | { type: "ready"; cellCount: number; totalPopulation: number }
  | { type: "init-error"; message: string }
  | { type: "estimate-result"; id: number; estimate: PopulationEstimate }
  | { type: "estimate-error"; id: number; message: string };

let estimator: PopulationEstimator | null = null;

const WORLD_BASE = "/world/tiles/";

async function fetchGzipU32(path: string): Promise<Uint32Array> {
  const res = await fetch(WORLD_BASE + path);
  if (!res.ok) throw new Error("No se han podido descargar los datos de población.");
  const raw = gunzipSync(new Uint8Array(await res.arrayBuffer()));
  return new Uint32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
}

async function initWorld(): Promise<void> {
  try {
    const res = await fetch(WORLD_BASE + "index.json");
    if (!res.ok) throw new Error("No se han podido descargar los datos de población.");
    const index = (await res.json()) as WorldIndex;
    const world = new WorldEstimator(index, fetchGzipU32);
    await world.init();
    estimator = world;
    post({ type: "ready", cellCount: Object.keys(index.tiles).length, totalPopulation: index.total });
  } catch (err) {
    post({
      type: "init-error",
      message: err instanceof Error ? err.message : "Error al cargar los datos.",
    });
  }
}

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

    const grid = new GridEstimator(buffer, meta);
    estimator = grid;
    post({
      type: "ready",
      cellCount: grid.cellCount,
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
    if (msg.region === "world") await initWorld();
    else await init();
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
