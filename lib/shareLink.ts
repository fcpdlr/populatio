import type { Polygon, MultiPolygon } from "geojson";

/**
 * Enlaces de resultado compartibles: /r?d=<datos>. Los datos viajan en la
 * propia URL (sin base de datos): modo, cifras y una silueta muy comprimida
 * de la zona dibujada, para que X, WhatsApp, etc. muestren una tarjeta con
 * imagen generada al vuelo.
 */

export type SharePayload =
  | {
      m: "d" | "p"; // Daily / Practice
      n?: number; // número de reto (Daily)
      t: number; // objetivo
      e: number; // población de la zona dibujada
      s: number; // puntuación 0-1000
      r?: string; // región (Practice), para reabrir la misma ronda
      g?: number[]; // silueta: pares x,y en 0..99 dentro de su caja
      a?: number; // proporción ancho/alto de la silueta × 100
    }
  | { m: "g"; s: number; q: string } // Guess: total y puntuaciones por ronda ("9,5,1,7,8" en décimas de 1.000)
  | { m: "l"; k: number }; // More or Less: racha

const MAX_POINTS = 36;

/** Silueta del anillo exterior mayor, reducida y cuantizada a 0..99. */
export function packSilhouette(geometry: Polygon | MultiPolygon): { g: number[]; a: number } | null {
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  let ring: number[][] | null = null;
  for (const p of polys) if (!ring || p[0].length > ring.length) ring = p[0];
  if (!ring || ring.length < 4) return null;
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, y] of ring) {
    if (x < a) a = x;
    if (y < b) b = y;
    if (x > c) c = x;
    if (y > d) d = y;
  }
  const k = Math.cos((((b + d) / 2) * Math.PI) / 180);
  const w = Math.max(1e-9, (c - a) * k), h = Math.max(1e-9, d - b);
  const side = Math.max(w, h);
  const pts = ring.slice(0, -1);
  const step = Math.max(1, pts.length / MAX_POINTS);
  const g: number[] = [];
  for (let i = 0; i < pts.length; i += step) {
    const [x, y] = pts[Math.floor(i)];
    g.push(Math.round((((x - a) * k) / side) * 99), Math.round(((d - y) / side) * 99));
  }
  return { g, a: Math.round((w / h) * 100) };
}

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodePayload(p: SharePayload): string {
  return toBase64Url(JSON.stringify(p));
}

const isInt = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** Decodifica y valida: cualquier cosa rara devuelve null (la URL la escribe cualquiera). */
export function decodePayload(d: string | null | undefined): SharePayload | null {
  if (!d || d.length > 1500) return null;
  try {
    const p = JSON.parse(fromBase64Url(d)) as Record<string, unknown>;
    if (p.m === "d" || p.m === "p") {
      if (!isInt(p.t, 1, 1e10) || !isInt(p.e, 0, 1e10) || !isInt(p.s, 0, 1000)) return null;
      if (p.n !== undefined && !isInt(p.n, 1, 100000)) return null;
      if (p.r !== undefined && (typeof p.r !== "string" || !/^[a-z-]{2,20}$/.test(p.r))) return null;
      let g: number[] | undefined;
      if (Array.isArray(p.g) && p.g.length >= 6 && p.g.length <= 200 && p.g.every((v) => isInt(v, 0, 99))) {
        g = p.g as number[];
      }
      const a = isInt(p.a, 1, 100000) ? (p.a as number) : undefined;
      return { m: p.m, n: p.n as number | undefined, t: p.t as number, e: p.e as number, s: p.s as number, r: p.r as string | undefined, g, a };
    }
    if (p.m === "g") {
      if (!isInt(p.s, 0, 5000) || typeof p.q !== "string" || !/^(\d,?){1,10}$/.test(p.q)) return null;
      return { m: "g", s: p.s as number, q: p.q };
    }
    if (p.m === "l") {
      if (!isInt(p.k, 0, 100000)) return null;
      return { m: "l", k: p.k as number };
    }
  } catch {
    return null;
  }
  return null;
}

export function shareUrl(origin: string, p: SharePayload): string {
  return `${origin}/r?d=${encodePayload(p)}`;
}

/** Texto para publicar en X (abre la app o la web con el texto escrito). */
export function xIntentUrl(text: string): string {
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
}
