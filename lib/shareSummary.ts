import type { SharePayload } from "./shareLink";
import { formatInt } from "./format";
import { signedPercent } from "./share";

/** Títulos y textos de un resultado compartido (tarjeta, página /r y metadatos). */
export function summarize(p: SharePayload): { kicker: string; headline: string; detail: string } {
  if (p.m === "d" || p.m === "p") {
    return {
      kicker: p.m === "d" ? `Daily #${p.n ?? ""}`.trim() : "Practice",
      headline: `${formatInt(p.s)} / 1000`,
      detail: `Target ${formatInt(p.t)} · drew ${formatInt(p.e)} (${signedPercent(p.e, p.t)})`,
    };
  }
  if (p.m === "g") {
    return { kicker: "Guess", headline: `${formatInt(p.s)} / 5,000`, detail: "Five zones, how many people live in each?" };
  }
  if (p.m === "l") {
    return { kicker: "More or Less", headline: `Streak ${p.k}`, detail: "Which zone has more people?" };
  }
  return { kicker: "", headline: "Draw the population", detail: "How many people live inside your zone?" };
}

/** Polígono SVG de la silueta dentro de una caja w×h, centrado. */
export function silhouettePoints(g: number[], a: number | undefined, w: number, h: number): string {
  const aspect = (a ?? 100) / 100;
  const side = Math.min(w / Math.max(1, aspect), h) * 0.98;
  // las coordenadas están normalizadas al lado mayor (0..99)
  const scale = side / 99;
  let maxX = 0, maxY = 0;
  for (let i = 0; i < g.length; i += 2) {
    if (g[i] > maxX) maxX = g[i];
    if (g[i + 1] > maxY) maxY = g[i + 1];
  }
  const ox = (w - maxX * scale) / 2, oy = (h - maxY * scale) / 2;
  const pts: string[] = [];
  for (let i = 0; i + 1 < g.length; i += 2) pts.push(`${(ox + g[i] * scale).toFixed(1)},${(oy + g[i + 1] * scale).toFixed(1)}`);
  return pts.join(" ");
}
