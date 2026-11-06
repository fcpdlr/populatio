"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Polygon } from "geojson";
import { ModeShell, WorldMap, guessScore } from "./ModeShell";
import { useWorldWorker } from "@/lib/population/useWorldWorker";
import { framingBounds } from "@/lib/population/zoneSampler";
import { REGIONS, type Region } from "@/lib/game/regions";
import { formatInt } from "@/lib/format";
import { safeStorage } from "@/lib/storage/safeStorage";
import type { AnyMode } from "@/lib/game/modeStorage";
import type { MapOverlay } from "./SpainMap";

/**
 * Guess: ves una zona dibujada en el mapa y estimas cuánta gente vive dentro.
 * Partidas de 5 rondas, hasta 1.000 puntos por ronda.
 */

const ROUNDS = 5;
const MIN = 10_000;
const MAX = 500_000_000;
const STEPS = 1000;
const BEST_KEY = "populatio:guess:best";

type Zone = { geometry: Polygon; population: number; region: Region };
type Answer = { guess: number; score: number };

const toValue = (step: number) => {
  const v = Math.exp(Math.log(MIN) + (step / STEPS) * (Math.log(MAX) - Math.log(MIN)));
  const mag = Math.pow(10, Math.floor(Math.log10(v)) - 1);
  return Math.round(v / mag) * mag;
};

function loadBest(): number {
  const n = Number(safeStorage()?.getItem(BEST_KEY));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function saveBest(n: number) {
  try {
    safeStorage()?.setItem(BEST_KEY, String(n));
  } catch {
    /* sin persistencia */
  }
}

export function GuessGame({ onMode }: { onMode: (m: AnyMode) => void }) {
  const { ready, error, sample } = useWorldWorker();
  const [round, setRound] = useState(1);
  const [zone, setZone] = useState<Zone | null>(null);
  const [zoneKey, setZoneKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState(STEPS / 2);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [answered, setAnswered] = useState(false);
  const [best, setBest] = useState(0);
  const nextRef = useRef<Promise<Zone> | null>(null);

  const fetchZone = useCallback(async (): Promise<Zone> => {
    const region = REGIONS[Math.floor(Math.random() * REGIONS.length)];
    const [z] = await sample("single", region.bounds);
    return { geometry: z.geometry, population: z.population, region };
  }, [sample]);

  const showNext = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const z = await (nextRef.current ?? fetchZone());
      nextRef.current = fetchZone(); // la siguiente se prepara mientras juegas
      nextRef.current.catch(() => (nextRef.current = null));
      setZone(z);
      setZoneKey((k) => k + 1);
      setStep(STEPS / 2);
      setAnswered(false);
    } catch (e) {
      nextRef.current = null;
      setLoadError(e instanceof Error ? e.message : "Couldn't build a zone.");
    } finally {
      setLoading(false);
    }
  }, [fetchZone]);

  useEffect(() => {
    setBest(loadBest());
  }, []);

  useEffect(() => {
    if (ready && !zone && !loading) void showNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const guess = toValue(step);
  const total = answers.reduce((s, a) => s + a.score, 0);
  const finished = answered && round === ROUNDS;

  const submit = () => {
    if (!zone || answered) return;
    const score = guessScore(guess, zone.population);
    const next = [...answers, { guess, score }];
    setAnswers(next);
    setAnswered(true);
    if (round === ROUNDS) {
      const sum = next.reduce((s, a) => s + a.score, 0);
      if (sum > best) {
        saveBest(sum);
        setBest(sum);
      }
    }
  };

  const nextRound = () => {
    setRound((r) => r + 1);
    void showNext();
  };

  const restart = () => {
    setRound(1);
    setAnswers([]);
    void showNext();
  };

  const overlays = useMemo<MapOverlay[]>(
    () => (zone ? [{ geometry: zone.geometry, tone: "a" }] : []),
    [zone],
  );
  const last = answers[answers.length - 1];

  return (
    <ModeShell mode="guess" onMode={onMode}>
      <div className="flex flex-col items-center px-4 pb-2 pt-2 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          Round {round}/{ROUNDS} · {formatInt(total)} pts
        </p>
        <h1 className="mt-1 font-display text-xl font-extrabold leading-tight tracking-tight text-ink">
          How many people live in this zone?
        </h1>
      </div>

      <main className="relative min-h-0 flex-1">
        <WorldMap
          region="world"
          onSelectionChange={() => {}}
          disabled
          overlays={overlays}
          focusBounds={zone ? framingBounds([zone.geometry], 1.4) : null}
          focusKey={zoneKey}
          hideViewButtons
        />

        {(!ready || loading) && !error && !loadError && (
          <div
            className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-line bg-white/95 px-3 py-1.5 text-xs text-muted shadow-sm"
            role="status"
          >
            {ready ? "Finding a zone…" : "Loading population data…"}
          </div>
        )}

        {(error || loadError) && (
          <div className="absolute inset-x-4 top-4 mx-auto max-w-md rounded-xl border border-line bg-white p-4 text-sm shadow-lg">
            <p className="font-medium">Something went wrong</p>
            <p className="mt-1 text-muted">{error ?? loadError}</p>
            <button
              type="button"
              onClick={() => (error ? window.location.reload() : void showNext())}
              className="mt-3 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-deep"
            >
              Try again
            </button>
          </div>
        )}

      </main>

        <div className="flex justify-center">
          <section
            className="w-full max-w-md border-t border-line bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            aria-label="Your guess"
          >
            {!answered ? (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <label htmlFor="guess-slider" className="text-xs font-medium uppercase tracking-wide text-muted">
                    Your guess
                  </label>
                  <output
                    htmlFor="guess-slider"
                    className="font-display tabular text-2xl font-extrabold text-ink"
                    data-testid="guess-value"
                  >
                    {formatInt(guess)}
                  </output>
                </div>
                <input
                  id="guess-slider"
                  type="range"
                  min={0}
                  max={STEPS}
                  value={step}
                  onChange={(e) => setStep(Number(e.target.value))}
                  className="mt-3 w-full accent-[var(--color-accent)]"
                  disabled={!zone || loading}
                />
                <div className="mt-1 flex justify-between text-[10px] text-muted">
                  <span>10K</span>
                  <span>1M</span>
                  <span>100M</span>
                  <span>500M</span>
                </div>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!zone || loading}
                  data-testid="guess-submit"
                  className="mt-3 w-full rounded-[15px] bg-accent px-6 py-3 font-display text-base font-bold uppercase tracking-wide text-white shadow-btn transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Guess
                </button>
              </>
            ) : (
              zone &&
              last && (
                <div data-testid="guess-result">
                  <dl className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted">Actual</dt>
                      <dd className="tabular font-semibold">{formatInt(zone.population)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">Your guess</dt>
                      <dd className="tabular font-medium">{formatInt(last.guess)}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex items-end justify-between rounded-xl bg-paper p-3">
                    <p className="text-sm text-muted">
                      {finished ? "Final score" : "This round"}
                    </p>
                    <p className="font-display tabular text-3xl font-extrabold text-accent">
                      {formatInt(finished ? total : last.score)}
                      {finished && <span className="text-base text-muted"> / {formatInt(ROUNDS * 1000)}</span>}
                    </p>
                  </div>
                  {finished && (
                    <p className="mt-2 text-xs text-muted">Best game: {formatInt(Math.max(best, total))} points</p>
                  )}
                  <button
                    type="button"
                    onClick={finished ? restart : nextRound}
                    className="mt-3 w-full rounded-[15px] bg-accent px-6 py-3 font-display text-base font-bold uppercase tracking-wide text-white shadow-btn transition-colors hover:bg-accent-deep"
                  >
                    {finished ? "Play again" : "Next zone"}
                  </button>
                </div>
              )
            )}
          </section>
        </div>
    </ModeShell>
  );
}
