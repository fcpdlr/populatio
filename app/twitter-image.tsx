import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "populat.io — draw a zone that holds exactly the target number of people";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#faf9f6";
const INK = "#16212e";
const ACCENT = "#0e5c54";
const MUTED = "#7c8896";

/** Tarjeta por defecto de la portada (X, WhatsApp, etc.). */
export default function TwitterImage() {
  // Una nube de puntos de "densidad" alrededor de una zona dibujada.
  const dots: { x: number; y: number; r: number; o: number }[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 220; i++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.pow(rnd(), 0.7) * 210;
    const r = 2 + 7 * Math.pow(1 - d / 210, 2) * rnd();
    dots.push({ x: 230 + Math.cos(a) * d * 1.15, y: 230 + Math.sin(a) * d, r, o: 0.15 + 0.6 * (1 - d / 210) });
  }
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: PAPER, padding: 64, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", fontSize: 52, color: INK }}>
            populat<span style={{ color: ACCENT }}>.io</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 30, letterSpacing: 4, color: MUTED, textTransform: "uppercase" }}>
              Draw a zone with exactly
            </div>
            <div style={{ display: "flex", fontSize: 108, color: INK, lineHeight: 1.05 }}>12,000,000</div>
            <div style={{ display: "flex", fontSize: 40, color: INK }}>people. Anywhere on Earth.</div>
          </div>
          <div style={{ display: "flex", fontSize: 28, color: MUTED }}>A new challenge every day · 4 game modes</div>
        </div>
        <svg width="460" height="460" viewBox="0 0 460 460" style={{ alignSelf: "center" }}>
          {dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={`rgba(44,55,66,${d.o.toFixed(2)})`} />
          ))}
          <ellipse cx="230" cy="230" rx="170" ry="140" fill="rgba(14,92,84,0.14)" stroke={ACCENT} strokeWidth="8" />
        </svg>
      </div>
    ),
    size,
  );
}
