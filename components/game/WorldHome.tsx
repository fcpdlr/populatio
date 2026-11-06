"use client";

import { useCallback, useEffect, useState } from "react";
import { Game } from "./Game";
import { GuessGame } from "./GuessGame";
import { DuelGame } from "./DuelGame";
import { loadMode, saveMode, type AnyMode } from "@/lib/game/modeStorage";
import { roundFromSearch } from "@/lib/game/regions";

/**
 * Página principal: elige qué juego mostrar según el modo.
 * Daily y Practice son el juego de dibujar (Game); Guess y More or Less
 * tienen su propio componente. El modo se recuerda entre visitas.
 */
export function WorldHome() {
  const [mode, setMode] = useState<AnyMode | null>(null);

  useEffect(() => {
    const shared = roundFromSearch(window.location.search);
    setMode(shared ? "practice" : loadMode() ?? "daily");
  }, []);

  const change = useCallback((next: AnyMode) => {
    saveMode(next);
    if (next === "guess" || next === "duel") {
      window.history.replaceState(null, "", window.location.pathname);
    }
    setMode(next);
  }, []);

  if (!mode) return <div className="h-dvh" />;
  if (mode === "guess") return <GuessGame onMode={change} />;
  if (mode === "duel") return <DuelGame onMode={change} />;
  return <Game key="draw" region="world" initialMode={mode} onOtherMode={change} />;
}
