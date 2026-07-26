"use client";

import { formatInt, formatPercent } from "@/lib/format";
import type { AttemptResult } from "@/lib/population/types";

type Props = {
  best: AttemptResult | null;
  attempts: number;
};

function ErrorIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="10" cy="10" r="1.6" fill="currentColor" />
    </svg>
  );
}

function AttemptsIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
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
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
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

function StatItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl border border-line px-2 py-2 text-center">
      <span className="text-accent">{icon}</span>
      <span className="tabular text-sm font-semibold text-ink">{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted">{label}</span>
    </div>
  );
}

export function AttemptHistory({ best, attempts }: Props) {
  if (!best && attempts === 0) return null;
  return (
    <div
      // En pantallas muy bajas (móvil con poco alto útil), esta barra es lo
      // primero que cede espacio: el objetivo y el botón Comprobar nunca
      // deben quedar fuera de la vista ni forzar scroll.
      className="grid grid-cols-3 gap-2 px-4 pb-3 sm:px-6 [@media(max-height:380px)]:hidden"
      role="group"
      aria-label="Estadísticas"
    >
      <StatItem
        icon={<ErrorIcon />}
        label="Mejor error"
        value={best ? formatPercent(best.percentageError) : "—"}
      />
      <StatItem icon={<AttemptsIcon />} label="Intentos" value={formatInt(attempts)} />
      <StatItem
        icon={<ScoreIcon />}
        label="Mejor puntuación"
        value={best ? formatInt(best.score) : "—"}
      />
    </div>
  );
}
