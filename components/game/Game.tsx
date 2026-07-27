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
import { ModeSwitch } from "./ModeSwitch";
import { TargetDisplay } from "./TargetDisplay";
import { AttemptHistory } from "./AttemptHistory";
import { DailyStreakBar } from "./DailyStreakBar";
import { DailyConfirmSheet } from "./DailyConfirmSheet";
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
import { loadMode, saveMode, type GameMode } from "@/lib/game/modeStorage";
import {
  todayInMadrid,
  msUntilNextMadridMidnight,
  challengeNumberForDate,
} from "@/lib/game/dailyDate";
import { dailyTargetForDate } from "@/lib/game/dailyTarget";
import {
  loadDailyResult,
  saveDailyResult,
  loadStreak,
  recordPlayed,
  type DailyResult,
  type StreakData,
} from "@/lib/game/dailyStorage";
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

type DailyInfo = { date: string; challengeNumber: number };

export function Game() {
  const [state, dispatch] = useReducer(reducer, initialState(0));
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<GameMode>("daily");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [dataReady, setDataReady] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [dailyInfo, setDailyInfo] = useState<DailyInfo | null>(null);
  const [dailyLocked, setDailyLocked] = useState(false);
  const [dailyGeometry, setDailyGeometry] = useState<Polygon | MultiPolygon | null>(null);
  const [dailyCountdown, setDailyCountdown] = useState(0);
  const [showDailyConfirm, setShowDailyConfirm] = useState(false);
  const [streak, setStreak] = useState<StreakData>({
    current: 0,
    best: 0,
    lastPlayedDate: null,
  });

  const workerRef = useRef<Worker | null>(null);
  const selectionRef = useRef<Polygon | MultiPolygon | null>(null);
  const requestIdRef = useRef(0);
  const dataReadyRef = useRef(false);
  const targetRef = useRef(0);
  const modeRef = useRef<GameMode>("daily");
  const dailyInfoRef = useRef<DailyInfo | null>(null);
  const dailyLockedRef = useRef(false);

  useEffect(() => {
    targetRef.current = state.target;
  }, [state.target]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    dailyInfoRef.current = dailyInfo;
  }, [dailyInfo]);

  useEffect(() => {
    dailyLockedRef.current = dailyLocked;
  }, [dailyLocked]);

  // SpainMap puede disparar clearSelection (por el resetSignal que ponemos
  // al cargar una sesión) en el mismo commit en que fijamos dailyLocked, y
  // el efecto de arriba (padre) se ejecuta DESPUÉS que el de SpainMap
  // (hijo): si solo dependiéramos de ese efecto, handleSelectionChange vería
  // todavía dailyLockedRef.current = false y podría borrar el resultado ya
  // restaurado. Por eso el ref se fija aquí también, en el mismo tick que
  // el estado.
  const setDailyLockedSynced = useCallback((value: boolean) => {
    dailyLockedRef.current = value;
    setDailyLocked(value);
  }, []);

  const loadPracticeSession = useCallback((urlTarget: number | null) => {
    const target = urlTarget ?? generateTarget();
    if (!urlTarget) {
      window.history.replaceState(null, "", targetToSearch(target));
    }
    selectionRef.current = null;
    setResetSignal((n) => n + 1);
    setDailyLockedSynced(false);
    setDailyGeometry(null);
    dispatch({
      type: "new-target",
      target,
      best: loadBest(target),
      attempts: loadAttemptCount(target),
    });
    track({ name: "game_started", target });
  }, [setDailyLockedSynced]);

  const loadDailySession = useCallback(() => {
    const date = todayInMadrid();
    const challengeNumber = challengeNumberForDate(date);
    const target = dailyTargetForDate(date);
    const saved = loadDailyResult(date);

    setDailyInfo({ date, challengeNumber });
    setStreak(loadStreak());
    selectionRef.current = null;
    setResetSignal((n) => n + 1);

    if (saved) {
      setDailyLockedSynced(true);
      setDailyGeometry(saved.geometry);
      setDailyCountdown(msUntilNextMadridMidnight());
      dispatch({
        type: "new-target",
        target,
        best: null,
        attempts: 0,
      });
      dispatch({
        type: "check-finished",
        result: saved,
        contributions: saved.contributions,
        attempts: 0,
        best: null,
      });
    } else {
      setDailyLockedSynced(false);
      setDailyGeometry(null);
      dispatch({
        type: "new-target",
        target,
        best: null,
        attempts: 0,
      });
    }
    track({ name: "game_started", target });
  }, [setDailyLockedSynced]);

  // Modo y objetivo iniciales: un enlace con ?objetivo= implica Práctica
  // (enlace compartido); si no, se respeta el modo guardado o Diario por
  // defecto. Se fija en el cliente.
  useEffect(() => {
    const urlTarget = targetFromSearch(window.location.search);
    const initialMode: GameMode = urlTarget != null ? "practice" : loadMode() ?? "daily";
    setMode(initialMode);
    if (initialMode === "practice") {
      loadPracticeSession(urlTarget);
    } else {
      loadDailySession();
    }
    setMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEstimate = useCallback((estimate: PopulationEstimate) => {
    const target = targetRef.current;
    const result = buildAttemptResult(estimate.totalPopulation, target);

    if (modeRef.current === "daily") {
      const info = dailyInfoRef.current;
      const geometry = selectionRef.current as Polygon | MultiPolygon;
      if (!info) return; // no debería ocurrir
      const dailyResult: DailyResult = {
        ...result,
        date: info.date,
        geometry,
        contributions: estimate.contributingMunicipalities,
        completedAt: new Date().toISOString(),
      };
      saveDailyResult(dailyResult);
      const nextStreak = recordPlayed(info.date);
      setStreak(nextStreak);
      setDailyGeometry(geometry);
      setDailyLockedSynced(true);
      setDailyCountdown(msUntilNextMadridMidnight());
      track({
        name: "daily_attempt_confirmed",
        target,
        challengeNumber: info.challengeNumber,
        score: result.score,
        streak: nextStreak.current,
      });
      dispatch({
        type: "check-finished",
        result,
        contributions: estimate.contributingMunicipalities,
        attempts: 0,
        best: null,
      });
      return;
    }

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
  }, [setDailyLockedSynced]);

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
      if (dailyLockedRef.current) return; // el mapa está bloqueado; ignorar
      const hadSelection = selectionRef.current !== null;
      selectionRef.current = geometry;
      setValidationMessage(null);
      if (geometry && !hadSelection) track({ name: "polygon_drawn" });
      dispatch({ type: "selection-changed", hasSelection: geometry !== null });
    },
    [],
  );

  const runCheck = useCallback((geometry: Polygon | MultiPolygon) => {
    dispatch({ type: "check-started" });
    requestIdRef.current += 1;
    workerRef.current?.postMessage({
      type: "estimate",
      id: requestIdRef.current,
      geometry,
    });
  }, []);

  const handleCheck = useCallback(() => {
    if (state.phase === "checking") return; // evita doble envío
    const geometry = selectionRef.current;
    const validation = validateSelection(geometry);
    if (!validation.ok) {
      setValidationMessage(validation.message);
      return;
    }
    setValidationMessage(null);

    if (mode === "daily") {
      setShowDailyConfirm(true);
      return;
    }

    runCheck(geometry as Polygon | MultiPolygon);
  }, [state.phase, mode, runCheck]);

  const handleDailyConfirm = useCallback(() => {
    setShowDailyConfirm(false);
    const geometry = selectionRef.current;
    if (!geometry) return;
    runCheck(geometry);
  }, [runCheck]);

  const handleDailyKeepAdjusting = useCallback(() => {
    setShowDailyConfirm(false);
  }, []);

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

  const handleModeChange = useCallback(
    (next: GameMode) => {
      if (next === mode || state.phase === "checking") return;
      setMode(next);
      saveMode(next);
      setShowDailyConfirm(false);
      track({ name: "mode_changed", mode: next });
      if (next === "practice") {
        window.history.replaceState(null, "", window.location.pathname);
        loadPracticeSession(null);
      } else {
        loadDailySession();
      }
    },
    [mode, state.phase, loadPracticeSession, loadDailySession],
  );

  const checking = state.phase === "checking";
  const showResult = state.phase === "result" && state.result;
  const isDaily = mode === "daily";

  return (
    <div className="flex h-dvh flex-col">
      <GameHeader />
      <div className="px-4 pt-1 [@media(max-height:380px)]:pt-0.5">
        <ModeSwitch mode={mode} onChange={handleModeChange} />
      </div>
      {mounted && state.target > 0 ? (
        <TargetDisplay
          target={state.target}
          onNewTarget={isDaily ? undefined : handleNewTarget}
          dailyChallengeNumber={isDaily ? dailyInfo?.challengeNumber : undefined}
        />
      ) : (
        <div className="flex flex-col items-center px-4 pb-2 pt-1 [@media(max-height:380px)]:pb-1 [@media(max-height:380px)]:pt-0.5">
          <div className="h-[clamp(2.75rem,15vw,4.5rem)] w-56 animate-pulse rounded-2xl bg-line [@media(max-height:380px)]:h-8" />
        </div>
      )}
      {isDaily ? (
        <DailyStreakBar current={streak.current} best={streak.best} />
      ) : (
        <AttemptHistory best={state.best} attempts={state.attempts} />
      )}

      <main className="relative min-h-0 flex-1">
        <SpainMap
          onSelectionChange={handleSelectionChange}
          resetSignal={resetSignal}
          disabled={checking || state.phase === "data-error" || (isDaily && dailyLocked)}
          showDensityToggle={Boolean(showResult)}
          lockedGeometry={isDaily && dailyLocked ? dailyGeometry : null}
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
        {!showResult && !showDailyConfirm && state.phase !== "data-error" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
            <button
              type="button"
              onClick={handleCheck}
              disabled={!dataReady || checking}
              data-testid="check-button"
              className="pointer-events-auto w-full max-w-sm rounded-[15px] bg-accent px-6 py-3.5 font-display text-base font-bold uppercase tracking-wide text-white shadow-btn transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-50"
            >
              {checking ? "Calculando…" : "Comprobar"}
            </button>
          </div>
        )}

        {/* Confirmación de intento único (Diario) */}
        {showDailyConfirm && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center sm:justify-start sm:p-4">
            <DailyConfirmSheet
              onConfirm={handleDailyConfirm}
              onKeepAdjusting={handleDailyKeepAdjusting}
            />
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
              daily={
                isDaily && dailyInfo
                  ? {
                      challengeNumber: dailyInfo.challengeNumber,
                      nextChallengeNumber: dailyInfo.challengeNumber + 1,
                      msUntilNext: dailyCountdown,
                      streak: { current: streak.current, best: streak.best },
                    }
                  : undefined
              }
            />
          </div>
        )}
      </main>
    </div>
  );
}
