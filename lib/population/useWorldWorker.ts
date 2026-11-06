"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Bounds } from "./zoneSampler";
import type { SampledZoneMessage, WorkerResponse } from "@/workers/population.worker";
import type { DensityRequest } from "./density";
import { makeDensityRequester } from "./densityClient";

type Pending = { resolve: (z: SampledZoneMessage[]) => void; reject: (e: Error) => void };

/**
 * Worker de población del mundo para los modos Guess y More or Less:
 * carga la rejilla una vez y genera zonas aleatorias con su población.
 */
export function useWorldWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef(new Map<number, Pending>());
  const idRef = useRef(0);
  const [ready, setReady] = useState(false);
  const densityRef = useRef<((req: DensityRequest) => Promise<Float32Array>) | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL("../../workers/population.worker.ts", import.meta.url));
    workerRef.current = worker;
    densityRef.current = makeDensityRequester(worker);
    const pending = pendingRef.current;
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      if (msg.type === "ready") setReady(true);
      else if (msg.type === "init-error") setError(msg.message);
      else if (msg.type === "sample-result") {
        pending.get(msg.id)?.resolve(msg.zones);
        pending.delete(msg.id);
      } else if (msg.type === "sample-error") {
        pending.get(msg.id)?.reject(new Error(msg.message));
        pending.delete(msg.id);
      }
    };
    worker.onerror = () => setError("The calculation engine couldn't start. Reload the page.");
    worker.postMessage({ type: "init", region: "world" });
    return () => {
      worker.terminate();
      workerRef.current = null;
      pending.clear();
    };
  }, []);

  const sample = useCallback(
    (kind: "single" | "pair", bounds: Bounds) =>
      new Promise<SampledZoneMessage[]>((resolve, reject) => {
        const worker = workerRef.current;
        if (!worker) return reject(new Error("The calculation engine isn't running."));
        idRef.current += 1;
        pendingRef.current.set(idRef.current, { resolve, reject });
        worker.postMessage({ type: "sample", id: idRef.current, kind, bounds });
      }),
    [],
  );

  const density = useCallback(
    (req: DensityRequest) =>
      densityRef.current ? densityRef.current(req) : Promise.reject(new Error("not ready")),
    [],
  );

  return { ready, error, sample, density };
}
