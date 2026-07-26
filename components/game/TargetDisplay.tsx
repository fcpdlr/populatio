"use client";

import { formatInt } from "@/lib/format";

type Props = {
  target: number;
  onNewTarget?: () => void;
};

export function TargetDisplay({ target, onNewTarget }: Props) {
  return (
    <div className="px-4 pb-3 sm:px-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Rodea exactamente
          </p>
          <h1 className="font-display tabular text-4xl font-extrabold leading-none tracking-tight text-ink sm:text-5xl">
            {formatInt(target)}
          </h1>
          <p className="mt-1 text-sm text-muted">habitantes</p>
        </div>
        {onNewTarget && (
          <button
            type="button"
            onClick={onNewTarget}
            className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
          >
            Nuevo objetivo
          </button>
        )}
      </div>
    </div>
  );
}
