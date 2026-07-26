"use client";

import { formatInt, formatPercent } from "@/lib/format";
import type {
  AttemptResult,
  MunicipalityContribution,
} from "@/lib/population/types";

type Props = {
  result: AttemptResult;
  contributions: MunicipalityContribution[];
  attempts: number;
  best: AttemptResult | null;
  isNewBest: boolean;
  onRetry: () => void;
  onNewTarget: () => void;
};

function directionText(result: AttemptResult): string {
  if (result.direction === "exact") return "Exacto";
  const amount = formatInt(result.absoluteDifference);
  return result.direction === "over"
    ? `Te has pasado por ${amount} habitantes`
    : `Te has quedado corto por ${amount} habitantes`;
}

export function ResultPanel({
  result,
  contributions,
  attempts,
  best,
  isNewBest,
  onRetry,
  onNewTarget,
}: Props) {
  const top = contributions.slice(0, 5);
  return (
    <section
      aria-label="Resultado del intento"
      data-testid="result-panel"
      className="pointer-events-auto w-full rounded-t-2xl border border-line bg-white p-5 shadow-[0_-4px_24px_rgb(0_0_0/0.08)] sm:max-w-sm sm:rounded-2xl sm:shadow-lg"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Resultado · intento {attempts}
        </p>
        {isNewBest && (
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-deep">
            Mejor intento
          </span>
        )}
      </div>

      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex items-baseline justify-between">
          <dt className="text-muted">Objetivo</dt>
          <dd className="tabular font-medium">{formatInt(result.targetPopulation)}</dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt className="text-muted">Tu selección</dt>
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
          <p className="text-[11px] uppercase tracking-wide text-muted">Puntuación</p>
          <p
            className="font-display tabular text-3xl font-extrabold text-accent"
            data-testid="score"
          >
            {formatInt(result.score)}
          </p>
        </div>
      </div>

      {best && (
        <p className="mt-2 text-xs text-muted">
          Mejor intento: {formatInt(best.score)} puntos (
          {formatPercent(best.percentageError)} de error)
        </p>
      )}

      {top.length > 0 && (
        <details className="mt-3 text-xs text-muted">
          <summary className="cursor-pointer select-none hover:text-ink">
            Municipios que más aportan
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

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-deep"
        >
          Intentar de nuevo
        </button>
        <button
          type="button"
          onClick={onNewTarget}
          className="flex-1 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
        >
          Nuevo objetivo
        </button>
      </div>
    </section>
  );
}
