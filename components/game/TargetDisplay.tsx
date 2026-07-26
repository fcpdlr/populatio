"use client";

import { formatInt } from "@/lib/format";

type Props = {
  target: number;
  onNewTarget?: () => void;
};

export function TargetDisplay({ target, onNewTarget }: Props) {
  return (
    <div className="flex flex-col items-center px-4 pb-4 pt-1 text-center sm:pb-6 [@media(max-height:380px)]:pb-1 [@media(max-height:380px)]:pt-0.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        Rodea exactamente
      </p>
      <h1 className="font-display tabular font-extrabold leading-none tracking-tight text-ink [font-size:clamp(2.75rem,15vw,4.5rem)] [@media(max-height:380px)]:[font-size:2rem]">
        {formatInt(target)}
      </h1>
      <p className="mt-1.5 text-sm text-muted [@media(max-height:380px)]:mt-0.5 [@media(max-height:380px)]:text-xs">
        habitantes
      </p>
      {onNewTarget && (
        <button
          type="button"
          onClick={onNewTarget}
          className="mt-3 shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent [@media(max-height:380px)]:mt-1 [@media(max-height:380px)]:px-2.5 [@media(max-height:380px)]:py-1"
        >
          Nuevo objetivo
        </button>
      )}
    </div>
  );
}
