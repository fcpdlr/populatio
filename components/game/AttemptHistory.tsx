"use client";

import { formatInt, formatPercent } from "@/lib/format";
import type { AttemptResult } from "@/lib/population/types";

type Props = {
  best: AttemptResult | null;
  attempts: number;
};

export function AttemptHistory({ best, attempts }: Props) {
  if (!best && attempts === 0) return null;
  return (
    <p className="px-4 pb-2 text-xs text-muted sm:px-6">
      {attempts > 0 && (
        <span>
          {attempts} {attempts === 1 ? "intento" : "intentos"}
        </span>
      )}
      {best && (
        <span>
          {attempts > 0 && " · "}mejor: {formatInt(best.score)} puntos (
          {formatPercent(best.percentageError)})
        </span>
      )}
    </p>
  );
}
