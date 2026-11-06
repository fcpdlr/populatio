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
import { sampleZone, sampleZonePair, type Bounds } from "@/lib/population/zoneSampler";
import { densityBins, type DensityRequest } from "@/lib/population/density";

export type WorkerRequest =
  | { type: "init"; region?: "es" | "world" }
  | { type: "estimate"; id: number; geometry: Polygon | MultiPolygon }
  | { type: "sample"; id: number; kind: "single" | "pair"; bounds: Bounds }
  | { type: "density"; id: number; req: DensityRequest };

export type SampledZoneMessage = { geometry: Polygon; population: number };

export type WorkerResponse =
  | { type: "ready"; cellCount: number; totalPopulation: number }
  | { type: "init-error"; message: string }
  | { type: "estimate-result"; id: number; estimate: PopulationEstimate }
  | { type: "estimate-error"; id: number; message: string }
  | { type: "sample-result"; id: number; zones: SampledZoneMessage[] }
  | { type: "sample-error"; id: number; message: string }
  | { type: "density-result"; id: number; bins: Float32Array }
  | { type: "density-error"; id: number; message: string };

let estimator: PopulationEstimator | null = null;
let worldEstimator: WorldEstimator | null = null;

const WORLD_BASE = "/world/tiles/";

async function fetchGzipU32(path: string): Promise<Uint32Array> {
  const res = await fetch(WORLD_BASE + path);
  if (!res.ok) throw new Error("Couldn't download the population data.");
  const raw = gunzipSync(new Uint8Array(await res.arrayBuffer()));
  return new Uint32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
}

async function initWorld(): Promise<void> {
  try {
    const res = await fetch(WORLD_BASE + "index.json");
    if (!res.ok) throw new Error("Couldn't download the population data.");
    const index = (await res.json()) as WorldIndex;
    const world = new WorldEstimator(index, fetchGzipU32);
    await world.init();
    estimator = world;
    worldEstimator = world;
    post({ type: "ready", cellCount: Object.keys(index.tiles).length, totalPopulation: index.total });
  } catch (err) {
    post({
      type: "init-error",
      message: err instanceof Error ? err.message : "Couldn't load the data.",
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
      throw new Error("Couldn't download the population data.");
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
      message: err instanceof Error ? err.message : "Couldn't load the data.",
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
  if (msg.type === "density") {
    if (!worldEstimator) {
      post({ type: "density-error", id: msg.id, message: "The data isn't ready yet." });
      return;
    }
    try {
      const w = worldEstimator;
      const bins = await densityBins(w, w.index, (n) => w.tile(n), msg.req);
      (self as unknown as Worker).postMessage(
        { type: "density-result", id: msg.id, bins } satisfies WorkerResponse,
        [bins.buffer],
      );
    } catch (err) {
      post({
        type: "density-error",
        id: msg.id,
        message: err instanceof Error ? err.message : "Couldn't compute the density.",
      });
    }
    return;
  }
  if (msg.type === "sample") {
    if (!worldEstimator) {
      post({ type: "sample-error", id: msg.id, message: "The data isn't ready yet." });
      return;
    }
    try {
      const cells = worldEstimator.populatedCells();
      const zones =
        msg.kind === "pair"
          ? await sampleZonePair(worldEstimator, cells, msg.bounds)
          : [await sampleZone(worldEstimator, cells, msg.bounds)];
      post({
        type: "sample-result",
        id: msg.id,
        zones: zones.map((z) => ({ geometry: z.geometry, population: z.population })),
      });
    } catch (err) {
      post({
        type: "sample-error",
        id: msg.id,
        message: err instanceof Error ? err.message : "Couldn't build a zone.",
      });
    }
    return;
  }
  if (msg.type === "estimate") {
    if (!estimator) {
      post({
        type: "estimate-error",
        id: msg.id,
        message: "The data isn't ready yet.",
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
          err instanceof Error ? err.message : "Something went wrong while counting.",
      });
    }
  }
};
