import { ImageResponse } from "next/og";
import { decodePayload } from "@/lib/shareLink";
import { summarize, silhouettePoints } from "@/lib/shareSummary";

export const runtime = "edge";

const PAPER = "#faf9f6";
const INK = "#16212e";
const ACCENT = "#0e5c54";
const MUTED = "#7c8896";

/** Tarjeta 1200×630 para X y demás redes: silueta dibujada + resultado. */
export async function GET(req: Request) {
  const p = decodePayload(new URL(req.url).searchParams.get("d"));
  const s = p ? summarize(p) : { kicker: "", headline: "Draw the population", detail: "How many people live inside your zone?" };
  const g = p && (p.m === "d" || p.m === "p") ? p.g : undefined;
  const a = p && (p.m === "d" || p.m === "p") ? p.a : undefined;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: PAPER, padding: 64, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 800, color: INK }}>
            populat<span style={{ color: ACCENT }}>.io</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {s.kicker ? (
              <div style={{ display: "flex", fontSize: 30, letterSpacing: 4, color: MUTED, textTransform: "uppercase" }}>{s.kicker}</div>
            ) : null}
            <div style={{ display: "flex", fontSize: 104, fontWeight: 800, color: ACCENT, lineHeight: 1.05 }}>{s.headline}</div>
            <div style={{ display: "flex", fontSize: 32, color: INK, marginTop: 12, maxWidth: 640 }}>{s.detail}</div>
          </div>
          <div style={{ display: "flex", fontSize: 28, color: MUTED }}>Can you beat it? Play at populat.io</div>
        </div>
        {g ? (
          <svg width="420" height="460" viewBox="0 0 420 460" style={{ alignSelf: "center" }}>
            <polygon
              points={silhouettePoints(g, a, 420, 460)}
              fill="rgba(14,92,84,0.18)"
              stroke={ACCENT}
              strokeWidth="8"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
