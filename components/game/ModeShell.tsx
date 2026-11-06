"use client";

import dynamic from "next/dynamic";
import { GameHeader } from "./GameHeader";
import { ModeSwitch, ALL_MODE_OPTIONS } from "./ModeSwitch";
import type { AnyMode } from "@/lib/game/modeStorage";

/** Mapa del mundo cargado solo en el cliente (canvas). */
export const WorldMap = dynamic(() => import("./SpainMap").then((m) => m.SpainMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted">Loading map…</div>
  ),
});

/** Estructura común de los modos Guess y More or Less: cabecera, selector y zona de juego. */
export function ModeShell({
  mode,
  onMode,
  children,
}: {
  mode: AnyMode;
  onMode: (m: AnyMode) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col">
      <GameHeader />
      <div className="px-4 pt-1 [@media(max-height:380px)]:pt-0.5">
        <ModeSwitch<AnyMode> mode={mode} onChange={onMode} options={ALL_MODE_OPTIONS} />
      </div>
      {children}
    </div>
  );
}

/** Puntuación 0-1000 de una estimación según el error relativo en escala logarítmica. */
export function guessScore(guess: number, actual: number): number {
  if (guess <= 0 || actual <= 0) return 0;
  return Math.round(1000 * Math.exp(-Math.abs(Math.log(guess / actual)) / 0.35));
}
