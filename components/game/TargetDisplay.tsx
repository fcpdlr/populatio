"use client";

import { formatInt } from "@/lib/format";

export function TargetDisplay({ target }: { target: number }) {
  return (
    <div className="px-4 pb-3 sm:px-6">
      <h1 className="font-display text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">
        Rodea{" "}
        <span className="tabular text-accent">{formatInt(target)}</span>{" "}
        habitantes
      </h1>
      <p className="mt-1 text-sm text-muted">
        Dibuja una zona en el mapa y trata de acercarte todo lo posible.
      </p>
    </div>
  );
}
