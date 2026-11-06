"use client";

import { useState } from "react";
import { shareResult } from "@/lib/share";

type Props = {
  getText: () => string;
  getImage?: () => Promise<Blob | null>;
  className?: string;
};

/** Botón de compartir: hoja nativa en móvil, copiar al portapapeles en ordenador. */
export function ShareButton({ getText, getImage, className }: Props) {
  const [state, setState] = useState<"idle" | "busy" | "copied" | "failed">("idle");

  const onClick = async () => {
    if (state === "busy") return;
    setState("busy");
    const image = getImage ? await getImage().catch(() => null) : null;
    const res = await shareResult(getText(), image);
    setState(res === "copied" ? "copied" : res === "failed" ? "failed" : "idle");
    if (res !== "shared") window.setTimeout(() => setState("idle"), 2200);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="share-button"
      className={
        className ??
        "flex w-full items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
      }
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
        <path d="M10 13V3m0 0L6.5 6.5M10 3l3.5 3.5M4 11v4.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {state === "copied" ? "Copied to clipboard" : state === "failed" ? "Couldn't share" : state === "busy" ? "Sharing…" : "Share result"}
    </button>
  );
}
