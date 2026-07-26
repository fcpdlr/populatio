"use client";

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import type { Polygon, MultiPolygon } from "geojson";
import { GameHeader } from "./GameHeader";
import { TargetDisplay } from "./TargetDisplay";
import { AttemptHistory } from "./AttemptHistory";
import { ResultPanel } from "./ResultPanel";
import { initialState, reducer } from "@/lib/game/state";
import {
  generateTarget,
  targetFromSearch,
  targetToSearch,
} from "@/lib/game/target";
import {
  incrementAttemptCount,
  loadAttemptCount,
  loadBest,
  saveIfBest,
} from "@/lib/game/storage";
import { validateSelection } from "@/lib/geo/validation";
import { buildAttemptResult } from "@/lib/population/score";
import { track } from "@/lib/analytics/events";
import type { PopulationEstimate } from "@/lib/population/types";
import type { WorkerResponse } from "@/workers/population.worker";

const SpainMap = dynamic(
  () => import("./SpainMap").then((m) => m.SpainMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-muted">
        Cargando mapa…
      </div>
    ),
  },
);

export function Game() {
  const [state, dispatch] = useReducer(reducer, initialState(0));
  const [mounted, setMounted] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [dataReady, setDataReady] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);

  const workerRef = useRef<Worker | null>(null);
  const selectionRef = useRef<Polygon | MultiPolygon | null>(null);
  const requestIdRef = useRef(0);
  const dataReadyRef = useRef(false);
  const targetRef = useRef(0);

  useEffect(() => {
    targetRef.current = state.target;
  }, [state.target]);

  // Objetivo inicial: URL → si no, aleatorio. Se fija en el cliente.
  useEffect(() => {
    const fromUrl = targetFromSearch(window.location.search);
    const target = fromUrl ?? generateTarget();
    if (!fromUrl) {
      window.history.replaceState(null, "", targetToSearch(target));
    }
    dispatch({
      type: "new-target",
      target,
      best: loadBest(target),
      attempts: loadAttemptCount(target),
    });
    track({ name: "game_started", target });
    setMounted(true);
  }, []);

  const handleEstimate = useCallback((estimate: PopulationEstimate) => {
    const target = targetRef.current;
    const result = buildAttemptResult(estimate.totalPopulation, target);
    const attempts = incrementAttemptCount(target);
    const improved = saveIfBest(result);
    setIsNewBest(improved);
    if (improved) {
      track({ name: "best_score_improved", target, score: result.score });
    }
    track({
      name: "attempt_submitted",
      target,
      estimated: result.estimatedPopulation,
      score: result.score,
    });
    dispatch({
      type: "check-finished",
      result,
      contributions: estimate.contributingMunicipalities,
      attempts,
      best: loadBest(target),
    });
  }, []);

  // Web Worker de cálculo
  useEffect(() => {
    const worker = new Worker(
      new URL("../../workers/population.worker.ts", import.meta.url),
    );
    workerRef.current = worker;

    const timeout = window.setTimeout(() => {
      if (!dataReadyRef.current) {
        dispatch({
          type: "data-error",
          message:
            "Los datos de población están tardando demasiado. Revisa tu conexión y recarga la página.",
        });
      }
    }, 45_000);

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      if (msg.type === "ready") {
        dataReadyRef.current = true;
        setDataReady(true);
        window.clearTimeout(timeout);
        dispatch({ type: "data-ready" });
      } else if (msg.type === "init-error") {
        window.clearTimeout(timeout);
        dispatch({ type: "data-error", message: msg.message });
      } else if (msg.type === "estimate-result") {
        handleEstimate(msg.estimate);
      } else if (msg.type === "estimate-error") {
        dispatch({ type: "check-failed", message: msg.message });
      }
    };

    worker.onerror = () => {
      window.clearTimeout(timeout);
      dispatch({
        type: "data-error",
        message: "El módulo de cálculo no ha podido iniciarse.",
      });
    };

    worker.postMessage({ type: "init" });

    return () => {
      window.clearTimeout(timeout);
      worker.terminate();
      workerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectionChange = useCallback(
    (geometry: Polygon | MultiPolygon | null) => {
      const hadSelection = selectionRef.current !== null;
      selectionRef.current = geometry;
      setValidationMessage(null);
      if (geometry && !hadSelection) track({ name: "polygon_drawn" });
      dispatch({ type: "selection-changed", hasSelection: geometry !== null });
    },
    [],
  );

  const handleCheck = useCallback(() => {
    if (state.phase === "checking") return; // evita doble envío
    const geometry = selectionRef.current;
    const validation = validateSelection(geometry);
    if (!validation.ok) {
      setValidationMessage(validation.message);
      return;
    }
    setValidationMessage(null);
    dispatch({ type: "check-started" });
    requestIdRef.current += 1;
    workerRef.current?.postMessage({
      type: "estimate",
      id: requestIdRef.current,
      geometry: geometry as Polygon | MultiPolygon,
    });
  }, [state.phase]);

  const handleRetry = useCallback(() => {
    selectionRef.current = null;
    setResetSignal((n) => n + 1);
    dispatch({ type: "retry" });
  }, []);

  const handleNewTarget = useCallback(() => {
    const target = generateTarget();
    window.history.replaceState(null, "", targetToSearch(target));
    selectionRef.current = null;
    setResetSignal((n) => n + 1);
    dispatch({
      type: "new-target",
      target,
      best: loadBest(target),
      attempts: loadAttemptCount(target),
    });
    track({ name: "new_target", target });
  }, []);

  const checking = state.phase === "checking";
  const showResult = state.phase === "result" && state.result;

  return (
    <div className="flex h-dvh flex-col">
      <GameHeader />
      {mounted && state.target > 0 ? (
        <TargetDisplay target={state.target} />
      ) : (
        <div className="px-4 pb-3 sm:px-6">
          <div className="h-8 w-72 animate-pulse rounded bg-line sm:h-10" />
        </div>
      )}
      <AttemptHistory best={state.best} attempts={state.attempts} />

      <main className="relative min-h-0 flex-1">
        <SpainMap
          onSelectionChange={handleSelectionChange}
          resetSignal={resetSignal}
          disabled={checking || state.phase === "data-error"}
        />

        {/* Estado de carga de datos */}
        {!dataReady && state.phase !== "data-error" && (
          <div
            className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-line bg-white/95 px-3 py-1.5 text-xs text-muted shadow-sm"
            role="status"
          >
            Cargando datos de población…
          </div>
        )}

        {/* Error de datos */}
        {state.phase === "data-error" && (
          <div className="absolute inset-x-4 top-4 mx-auto max-w-md rounded-xl border border-line bg-white p-4 text-sm shadow-lg">
            <p className="font-medium">No se han podido cargar los datos</p>
            <p className="mt-1 text-muted">{state.errorMessage}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-deep"
            >
              Recargar
            </button>
          </div>
        )}

        {/* Mensajes de validación */}
        {validationMessage && (
          <div
            className="absolute inset-x-4 bottom-24 mx-auto max-w-sm rounded-xl border border-line bg-white p-3 text-center text-sm shadow-lg"
            role="alert"
          >
            {validationMessage}
          </div>
        )}

        {/* Botón principal */}
        {!showResult && state.phase !== "data-error" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
            <button
              type="button"
              onClick={handleCheck}
              disabled={!dataReady || checking}
              data-testid="check-button"
              className="pointer-events-auto w-full max-w-sm rounded-2xl bg-accent px-6 py-3.5 font-display text-base font-bold text-white shadow-lg transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-50"
            >
              {checking ? "Calculando…" : "Comprobar"}
            </button>
          </div>
        )}

        {/* Resultado */}
        {showResult && state.result && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center sm:justify-start sm:p-4">
            <ResultPanel
              result={state.result}
              contributions={state.contributions}
              attempts={state.attempts}
              best={state.best}
              isNewBest={isNewBest}
              onRetry={handleRetry}
              onNewTarget={handleNewTarget}
            />
          </div>
        )}
      </main>
    </div>
  );
}
