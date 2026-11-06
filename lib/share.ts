import type { Polygon, MultiPolygon } from "geojson";
import { formatInt } from "./format";

/**
 * Resultados para compartir: texto estilo Wordle (siempre) y una imagen con
 * la silueta dibujada (si el navegador permite compartir archivos).
 */

export const SITE = "populat.io";

/** Cinco cuadros según la puntuación sobre 1.000. */
export function scoreBar(score: number): string {
  const full = Math.round(Math.max(0, Math.min(1000, score)) / 200);
  return "🟩".repeat(full) + "⬜".repeat(5 - full);
}

/** Un cuadro por ronda (Guess): verde ≥700, amarillo ≥300, blanco el resto. */
export function roundSquares(scores: number[]): string {
  return scores.map((s) => (s >= 700 ? "🟩" : s >= 300 ? "🟨" : "⬜")).join("");
}

export function signedPercent(estimated: number, target: number): string {
  const p = ((estimated - target) / target) * 100;
  const sign = p > 0 ? "+" : p < 0 ? "−" : "±";
  return `${sign}${Math.abs(p).toFixed(1)}%`;
}

export type DrawShare = {
  label: string; // "Daily #310" o "Practice"
  target: number;
  estimated: number;
  score: number;
  url: string;
};

export function drawShareText(s: DrawShare): string {
  return [
    `${SITE} ${s.label} 🌍`,
    `🎯 ${formatInt(s.target)}`,
    `✏️ ${formatInt(s.estimated)} (${signedPercent(s.estimated, s.target)})`,
    `${scoreBar(s.score)} ${formatInt(s.score)}/1000`,
    "",
    s.url,
  ].join("\n");
}

/** Imagen cuadrada con la silueta de la zona y el resultado. */
export async function drawShareImage(
  geometry: Polygon | MultiPolygon,
  s: DrawShare,
  colors = { paper: "#faf9f6", ink: "#16212e", accent: "#0e5c54", muted: "#7c8896" },
): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const size = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = colors.paper;
  ctx.fillRect(0, 0, size, size);

  const rings = geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const ring of rings) for (const [x, y] of ring) {
    if (x < a) a = x;
    if (y < b) b = y;
    if (x > c) c = x;
    if (y > d) d = y;
  }
  const k = Math.cos((((b + d) / 2) * Math.PI) / 180);
  const w = Math.max(1e-6, (c - a) * k), h = Math.max(1e-6, d - b);
  const box = { x: 140, y: 250, w: 800, h: 520 };
  const scale = Math.min(box.w / w, box.h / h);
  const ox = box.x + (box.w - w * scale) / 2;
  const oy = box.y + (box.h - h * scale) / 2;
  ctx.beginPath();
  for (const ring of rings) {
    ring.forEach(([x, y], i) => {
      const px = ox + (x - a) * k * scale;
      const py = oy + (d - y) * scale;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
  }
  ctx.fillStyle = colors.accent + "33";
  ctx.fill("evenodd");
  ctx.lineWidth = 8;
  ctx.lineJoin = "round";
  ctx.strokeStyle = colors.accent;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = colors.muted;
  ctx.font = "600 34px system-ui, -apple-system, sans-serif";
  ctx.fillText(`${SITE.toUpperCase()} · ${s.label.toUpperCase()}`, size / 2, 110);
  ctx.fillStyle = colors.ink;
  ctx.font = "800 76px system-ui, -apple-system, sans-serif";
  ctx.fillText(formatInt(s.target), size / 2, 200);

  ctx.font = "600 40px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = colors.ink;
  ctx.fillText(`${formatInt(s.estimated)} people (${signedPercent(s.estimated, s.target)})`, size / 2, 880);
  ctx.fillStyle = colors.accent;
  ctx.font = "800 64px system-ui, -apple-system, sans-serif";
  ctx.fillText(`${formatInt(s.score)} / 1000`, size / 2, 970);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

/**
 * Comparte con la hoja nativa del móvil (con imagen si se puede) o, si no,
 * copia el texto. Devuelve qué ha pasado para dar feedback al jugador.
 */
export async function shareResult(text: string, image?: Blob | null): Promise<"shared" | "copied" | "failed"> {
  const nav = typeof navigator !== "undefined" ? navigator : null;
  if (nav?.share) {
    try {
      if (image) {
        const file = new File([image], "populatio.png", { type: "image/png" });
        if (nav.canShare?.({ files: [file] })) {
          await nav.share({ text, files: [file] });
          return "shared";
        }
      }
      await nav.share({ text });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "failed";
      // otros errores: probamos a copiar
    }
  }
  try {
    await nav?.clipboard?.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
