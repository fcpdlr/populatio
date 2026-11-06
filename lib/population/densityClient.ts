import type { DensityRequest } from "./density";
import type { WorkerResponse } from "@/workers/population.worker";

/** Pide densidades al worker de población y devuelve una promesa por petición. */
export function makeDensityRequester(worker: Worker) {
  let id = 0;
  const pending = new Map<number, { resolve: (b: Float32Array) => void; reject: (e: Error) => void }>();
  worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
    const msg = event.data;
    if (msg.type === "density-result") {
      pending.get(msg.id)?.resolve(msg.bins);
      pending.delete(msg.id);
    } else if (msg.type === "density-error") {
      pending.get(msg.id)?.reject(new Error(msg.message));
      pending.delete(msg.id);
    }
  });
  return (req: DensityRequest) =>
    new Promise<Float32Array>((resolve, reject) => {
      id += 1;
      pending.set(id, { resolve, reject });
      worker.postMessage({ type: "density", id, req });
    });
}
