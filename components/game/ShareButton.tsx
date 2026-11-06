"use client";

import { useState } from "react";
import { shareResult } from "@/lib/share";
import { xIntentUrl } from "@/lib/shareLink";
import { track } from "@/lib/analytics/events";

type Props = {
  /** Modo de juego, para la analítica. */
  mode?: string;
  getText: () => string;
  getImage?: () => Promise<Blob | null>;
  className?: string;
};

/** Botón de compartir: hoja nativa en móvil, copiar al portapapeles en ordenador. */
export function ShareButton({ mode = "draw", getText, getImage, className }: Props) {
  const [state, setState] = useState<"idle" | "busy" | "copied" | "failed">("idle");

  const onClick = async () => {
    if (state === "busy") return;
    setState("busy");
    track({ name: "share_clicked", mode, channel: "native" });
    const image = getImage ? await getImage().catch(() => null) : null;
    const res = await shareResult(getText(), image);
    setState(res === "copied" ? "copied" : res === "failed" ? "failed" : "idle");
    if (res !== "shared") window.setTimeout(() => setState("idle"), 2200);
  };

  // X no admite imágenes desde la web: se publica el texto con el enlace, y
  // el enlace trae su propia tarjeta con imagen.
  const postOnX = () => {
    track({ name: "share_clicked", mode, channel: "x" });
    window.open(xIntentUrl(getText()), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex gap-2">
    <button
      type="button"
      onClick={onClick}
      data-testid="share-button"
      className={
        className ??
        "flex flex-1 items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
      }
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
        <path d="M10 13V3m0 0L6.5 6.5M10 3l3.5 3.5M4 11v4.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {state === "copied" ? "Copied!" : state === "failed" ? "Couldn't share" : state === "busy" ? "Sharing…" : "Share"}
    </button>
    <button
      type="button"
      onClick={postOnX}
      data-testid="post-on-x"
      aria-label="Post on X"
      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-paper transition-opacity hover:opacity-90"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
        <path d="M18.9 2H22l-7.6 8.7L23.3 22h-7l-5.5-7.2L4.5 22H1.4l8.1-9.3L1 2h7.2l5 6.6L18.9 2Zm-1.2 18h1.7L7.4 3.9H5.6L17.7 20Z" />
      </svg>
      Post on X
    </button>
    </div>
  );
}
