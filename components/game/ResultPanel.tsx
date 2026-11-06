"use client";

import { useEffect, useState } from "react";
import { formatInt, formatPercent, formatCountdown } from "@/lib/format";
import { ShareButton } from "./ShareButton";
import type {
  AttemptResult,
  MunicipalityContribution,
} from "@/lib/population/types";

type DailyPanelInfo = {
  challengeNumber: number;
  nextChallengeNumber: number;
  msUntilNext: number;
  streak: { current: number; best: number };
};

type Props = {
  result: AttemptResult;
  contributions: MunicipalityContribution[];
  attempts: number;
  best: AttemptResult | null;
  isNewBest: boolean;
  onRetry: () => void;
  onNewTarget: () => void;
  /** Cuando se indica, el panel se muestra en modo Diario: sin reintentos, con cuenta atrás. */
  daily?: DailyPanelInfo;
  /** Si se indica, aparece el botón de compartir el resultado. */
  share?: { getText: () => string; getImage?: () => Promise<Blob | null> };
};

function directionText(result: AttemptResult): string {
  if (result.direction === "exact") return "Exact!";
  const amount = formatInt(result.absoluteDifference);
  return result.direction === "over"
    ? `${amount} people too many`
    : `${amount} people short`;
}

/** Cuenta atrás hasta el próximo reto, actualizada cada segundo a partir del snapshot recibido. */
function useCountdown(msUntilNext: number | undefined): number {
  const [remaining, setRemaining] = useState(msUntilNext ?? 0);
  useEffect(() => {
    if (msUntilNext == null) return;
    setRemaining(msUntilNext);
    const interval = setInterval(() => {
      setRemaining((ms) => Math.max(0, ms - 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [msUntilNext]);
  return remaining;
}

export function ResultPanel({
  result,
  contributions,
  attempts,
  best,
  isNewBest,
  onRetry,
  onNewTarget,
  daily,
  share,
}: Props) {
  const top = contributions.slice(0, 5);
  const remainingMs = useCountdown(daily?.msUntilNext);
  // Plegado: deja ver el mapa (y dónde vive la gente) sin perder el resultado.
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <section
        aria-label="Attempt result"
        data-testid="result-panel"
        className="pointer-events-auto flex w-full items-center justify-between gap-3 rounded-t-2xl border border-line bg-white px-5 py-3 shadow-[0_-4px_24px_rgb(0_0_0/0.08)] sm:max-w-sm sm:rounded-2xl"
      >
        <p className="text-sm text-ink">
          <span className="font-display tabular text-lg font-extrabold text-accent">{formatInt(result.score)}</span>
          <span className="text-muted"> pts · {formatPercent(result.percentageError)} error</span>
        </p>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent hover:text-accent"
        >
          Show result
        </button>
      </section>
    );
  }

  return (
    <section
      aria-label="Attempt result"
      data-testid="result-panel"
      className="pointer-events-auto w-full rounded-t-2xl border border-line bg-white p-5 shadow-[0_-4px_24px_rgb(0_0_0/0.08)] sm:max-w-sm sm:rounded-2xl sm:shadow-lg"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          {daily
            ? `Result · Daily challenge #${daily.challengeNumber}`
            : `Result · attempt ${attempts}`}
        </p>
        <div className="flex items-center gap-2">
          {!daily && isNewBest && (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-deep">
              New best
            </span>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            data-testid="result-collapse"
            className="rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-ink hover:border-accent hover:text-accent"
          >
            See map
          </button>
        </div>
      </div>

      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex items-baseline justify-between">
          <dt className="text-muted">Target</dt>
          <dd className="tabular font-medium">{formatInt(result.targetPopulation)}</dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt className="text-muted">Your zone</dt>
          <dd className="tabular font-medium" data-testid="estimated-population">
            {formatInt(result.estimatedPopulation)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm font-medium text-ink">{directionText(result)}</p>

      <div className="mt-3 flex items-end justify-between rounded-xl bg-paper p-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted">Error</p>
          <p className="tabular text-lg font-semibold">
            {formatPercent(result.percentageError)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-muted">Score</p>
          <p
            className="font-display tabular text-3xl font-extrabold text-accent"
            data-testid="score"
          >
            {formatInt(result.score)}
          </p>
        </div>
      </div>

      {!daily && best && (
        <p className="mt-2 text-xs text-muted">
          Best attempt: {formatInt(best.score)} points (
          {formatPercent(best.percentageError)} error)
        </p>
      )}

      {daily && (
        <p className="mt-2 text-xs text-muted">
          🔥 Streak: {daily.streak.current}{" "}
          {daily.streak.current === 1 ? "day" : "days"} · Best streak:{" "}
          {daily.streak.best}
        </p>
      )}

      {top.length > 0 && (
        <details className="mt-3 text-xs text-muted">
          <summary className="cursor-pointer select-none hover:text-ink">
            Top municipalities
          </summary>
          <ul className="mt-2 space-y-1">
            {top.map((m) => (
              <li key={m.municipalityCode} className="flex justify-between gap-2">
                <span className="truncate">{m.municipalityName}</span>
                <span className="tabular shrink-0">
                  {formatInt(m.estimatedPopulation)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {daily ? (
        <div className="mt-4 rounded-xl bg-paper p-3 text-center">
          <p className="text-xs text-muted">
            Next challenge <strong className="text-ink">#{daily.nextChallengeNumber}</strong> in
          </p>
          <p
            className="tabular mt-0.5 text-lg font-semibold text-ink"
            data-testid="daily-countdown"
          >
            {formatCountdown(remainingMs)}
          </p>
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-deep"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={onNewTarget}
            className="flex-1 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
          >
            New target
          </button>
        </div>
      )}

      {share && (
        <div className="mt-2">
          <ShareButton mode={daily ? "daily" : "practice"} getText={share.getText} getImage={share.getImage} />
        </div>
      )}


    </section>
  );
}
