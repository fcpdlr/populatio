"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Polygon } from "geojson";
import { ModeShell, WorldMap } from "./ModeShell";
import { useWorldWorker } from "@/lib/population/useWorldWorker";
import { framingBounds } from "@/lib/population/zoneSampler";
import { REGIONS, type Region } from "@/lib/game/regions";
import { formatInt } from "@/lib/format";
import { safeStorage } from "@/lib/storage/safeStorage";
import type { AnyMode } from "@/lib/game/modeStorage";
import type { MapOverlay } from "./SpainMap";
import area from "@turf/area";
import { ShareButton } from "./ShareButton";
import { SITE } from "@/lib/share";
import { shareUrl } from "@/lib/shareLink";

/**
 * More or Less: dos zonas en el mapa, eliges la que tiene más gente.
 * Cada acierto suma a la racha; el primer fallo termina la partida.
 */

const BEST_KEY = "populatio:duel:best";

type Pair = { a: Polygon; b: Polygon; popA: number; popB: number; areaA: number; areaB: number; region: Region };

/** Superficie en km², redondeada a 2 cifras significativas para leerla de un vistazo. */
function km2(geometry: Polygon): number {
  const v = area({ type: "Feature", properties: {}, geometry }) / 1e6;
  const mag = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 1));
  return Math.round(v / mag) * mag;
}
type Pick = "a" | "b";

function loadBest(): number {
  const n = Number(safeStorage()?.getItem(BEST_KEY));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function DuelGame({ onMode }: { onMode: (m: AnyMode) => void }) {
  const { ready, error, sample, density } = useWorldWorker();
  const [pair, setPair] = useState<Pair | null>(null);
  const [pairKey, setPairKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Pick | null>(null);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const nextRef = useRef<Promise<Pair> | null>(null);

  const fetchPair = useCallback(async (): Promise<Pair> => {
    const region = REGIONS[Math.floor(Math.random() * REGIONS.length)];
    const [za, zb] = await sample("pair", region.bounds);
    return {
      a: za.geometry,
      b: zb.geometry,
      popA: za.population,
      popB: zb.population,
      areaA: km2(za.geometry),
      areaB: km2(zb.geometry),
      region,
    };
  }, [sample]);

  const showNext = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const p = await (nextRef.current ?? fetchPair());
      nextRef.current = fetchPair();
      nextRef.current.catch(() => (nextRef.current = null));
      setPair(p);
      setPairKey((k) => k + 1);
      setPicked(null);
    } catch (e) {
      nextRef.current = null;
      setLoadError(e instanceof Error ? e.message : "Couldn't build the zones.");
    } finally {
      setLoading(false);
    }
  }, [fetchPair]);

  useEffect(() => {
    setBest(loadBest());
  }, []);

  useEffect(() => {
    if (ready && !pair && !loading) void showNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const winner: Pick | null = pair ? (pair.popA > pair.popB ? "a" : "b") : null;
  const correct = picked !== null && picked === winner;
  const over = picked !== null && !correct;

  const choose = (p: Pick) => {
    if (!pair || picked) return;
    setPicked(p);
    if (p === winner) {
      const s = streak + 1;
      setStreak(s);
      if (s > best) {
        setBest(s);
        try {
          safeStorage()?.setItem(BEST_KEY, String(s));
        } catch {
          /* sin persistencia */
        }
      }
    }
  };

  const next = () => {
    if (over) setStreak(0);
    void showNext();
  };

  const overlays = useMemo<MapOverlay[]>(
    () =>
      pair
        ? [
            { geometry: pair.a, tone: "a", label: "A" },
            { geometry: pair.b, tone: "b", label: "B" },
          ]
        : [],
    [pair],
  );

  const btn = (p: Pick) => {
    const isWinner = picked && winner === p;
    const isWrongPick = picked === p && !correct;
    const color = p === "a" ? "var(--color-accent)" : "var(--color-zone-b)";
    const pop = pair ? (p === "a" ? pair.popA : pair.popB) : 0;
    const sq = pair ? (p === "a" ? pair.areaA : pair.areaB) : 0;
    return (
      <button
        key={p}
        type="button"
        onClick={() => choose(p)}
        disabled={!pair || loading || picked !== null}
        data-testid={`duel-${p}`}
        className="flex-1 rounded-[15px] border-2 px-3 py-3 text-center transition-opacity disabled:cursor-default"
        style={{
          borderColor: color,
          background: picked ? (isWinner ? color : "transparent") : color,
          color: picked && !isWinner ? color : "#ffffff",
          opacity: isWrongPick ? 0.85 : 1,
        }}
      >
        <span className="block font-display text-2xl font-extrabold leading-none">{p.toUpperCase()}</span>
        {pair && (
          <span className="mt-1 block tabular text-xs font-medium opacity-90" data-testid={`duel-${p}-area`}>
            {formatInt(sq)} km²
          </span>
        )}
        {picked && (
          <span className="mt-0.5 block tabular text-sm font-semibold">{formatInt(pop)} people</span>
        )}
      </button>
    );
  };

  return (
    <ModeShell mode="duel" onMode={onMode}>
      <div className="flex flex-col items-center px-4 pb-2 pt-2 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          Streak {streak} · Best {best}
        </p>
        <h1 className="mt-1 font-display text-xl font-extrabold leading-tight tracking-tight text-ink">
          Which zone has more people?
        </h1>
      </div>

      <main className="relative min-h-0 flex-1">
        <WorldMap
          region="world"
          onSelectionChange={() => {}}
          disabled
          overlays={overlays}
          densitySource={density}
          densityVisible={picked !== null}
          focusBounds={pair ? framingBounds([pair.a, pair.b], 0.8) : null}
          focusKey={pairKey}
          hideViewButtons
        />
        {(!ready || loading) && !error && !loadError && (
          <div
            className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-line bg-white/95 px-3 py-1.5 text-xs text-muted shadow-sm"
            role="status"
          >
            {ready ? "Finding two zones…" : "Loading population data…"}
          </div>
        )}
        {(error || loadError) && (
          <div className="absolute inset-x-4 top-4 mx-auto max-w-md rounded-xl border border-line bg-white p-4 text-sm shadow-lg">
            <p className="font-medium">Something went wrong</p>
            <p className="mt-1 text-muted">{error ?? loadError}</p>
            <button
              type="button"
              onClick={() => (error ? window.location.reload() : void showNext())}
              className="mt-3 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-deep"
            >
              Try again
            </button>
          </div>
        )}
      </main>

      <div className="flex justify-center">
        <section
          className="w-full max-w-md border-t border-line bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          aria-label="Pick a zone"
        >
          <div className="flex gap-3">{(["a", "b"] as Pick[]).map(btn)}</div>
          {over && (
            <div className="mt-3">
              <ShareButton
                getText={() =>
                  [
                    `${SITE} More or Less 🌍`,
                    `🔥 Streak ${streak} · Best ${best}`,
                    "",
                    shareUrl(window.location.origin, { m: "l", k: streak }),
                  ].join("\n")
                }
              />
            </div>
          )}
          {picked && (
            <div className="mt-3 flex items-center justify-between gap-3" data-testid="duel-result">
              <p className="text-sm font-semibold text-ink">
                {correct ? `Right! Streak ${streak}` : `Wrong. Final streak ${streak}`}
              </p>
              <button
                type="button"
                onClick={next}
                className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-paper"
              >
                {over ? "Play again" : "Next"}
              </button>
            </div>
          )}
        </section>
      </div>
    </ModeShell>
  );
}
