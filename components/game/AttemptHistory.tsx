"use client";

import { formatInt, formatPercent } from "@/lib/format";
import type { AttemptResult } from "@/lib/population/types";

type Props = {
  best: AttemptResult | null;
  attempts: number;
};

function ErrorIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="10" cy="10" r="1.6" fill="currentColor" />
    </svg>
  );
}

function AttemptsIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" aria-hidden="true">
      <path
        d="M4 10a6 6 0 0 1 10.2-4.3M16 10a6 6 0 0 1-10.2 4.3M14 4v2.5h-2.5M6 16v-2.5h2.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ScoreIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" aria-hidden="true">
      <path
        d="M6 4h8v3.2a4 4 0 0 1-8 0V4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M10 11.2V14M7.5 16h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M6 5H4v1.5A2.5 2.5 0 0 0 6 9M14 5h2v1.5A2.5 2.5 0 0 1 14 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <span className="flex items-center gap-1 whitespace-nowrap">
      <span className="text-accent">{icon}</span>
      <span className="tabular font-semibold text-ink">{value}</span>
      <span>{label}</span>
    </span>
  );
}

/**
 * Barra de stats deliberadamente ligera: una sola línea de texto, no
 * tarjetas. El mapa es el protagonista de la pantalla; esto es un dato de
 * apoyo, no debe competirle altura.
 */
export function AttemptHistory({ best, attempts }: Props) {
  if (!best && attempts === 0) return null;
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 pb-2 text-[11px] text-muted sm:px-6 [@media(max-height:380px)]:hidden"
      role="group"
      aria-label="Estadísticas"
    >
      <Stat
        icon={<ErrorIcon />}
        label="Mejor error"
        value={best ? formatPercent(best.percentageError) : "—"}
      />
      <Stat icon={<AttemptsIcon />} label="Intentos" value={formatInt(attempts)} />
      <Stat
        icon={<ScoreIcon />}
        label="Mejor puntuación"
        value={best ? formatInt(best.score) : "—"}
      />
    </div>
  );
}
