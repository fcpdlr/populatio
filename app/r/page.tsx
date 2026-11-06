import type { Metadata } from "next";
import Link from "next/link";
import { decodePayload } from "@/lib/shareLink";
import { summarize, silhouettePoints } from "@/lib/shareSummary";

type Props = { searchParams: Promise<{ d?: string }> };

/** Metadatos con la tarjeta de imagen del resultado (X, WhatsApp, etc.). */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { d } = await searchParams;
  const p = decodePayload(d);
  const s = p ? summarize(p) : null;
  const title = s ? `populat.io · ${s.kicker}: ${s.headline}` : "populat.io";
  const description = s ? `${s.detail}. Can you beat it?` : "Draw a zone that holds exactly the target number of people.";
  const image = `/api/og${p && d ? `?d=${encodeURIComponent(d)}` : ""}`;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

/** Página de un resultado compartido: lo enseña y te manda a jugar. */
export default async function SharedResultPage({ searchParams }: Props) {
  const { d } = await searchParams;
  const p = decodePayload(d);
  const s = p ? summarize(p) : null;
  const playHref =
    p && p.m === "p" && p.r ? `/?r=${p.r}&objetivo=${p.t}` : "/";
  const g = p && (p.m === "d" || p.m === "p") ? p.g : undefined;
  const a = p && (p.m === "d" || p.m === "p") ? p.a : undefined;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-10">
      <Link href="/" className="font-display text-lg font-extrabold tracking-tight text-ink">
        populat<span className="text-accent">.io</span>
      </Link>
      {s ? (
        <section className="flex flex-col gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{s.kicker}</p>
          <h1 className="font-display text-5xl font-extrabold tracking-tight text-accent">{s.headline}</h1>
          <p className="text-sm text-ink">{s.detail}</p>
          {g && (
            <svg viewBox="0 0 300 220" className="mt-2 w-full max-w-xs" aria-hidden="true">
              <polygon
                points={silhouettePoints(g, a, 300, 220)}
                fill="rgba(14,92,84,0.15)"
                stroke="currentColor"
                className="text-accent"
                strokeWidth="4"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </section>
      ) : (
        <h1 className="font-display text-3xl font-extrabold text-ink">Draw a zone with exactly the right number of people.</h1>
      )}
      <Link
        href={playHref}
        className="rounded-[15px] bg-accent px-6 py-3.5 text-center font-display text-base font-bold uppercase tracking-wide text-white shadow-btn hover:bg-accent-deep"
      >
        {p?.m === "p" ? "Play this round" : "Play now"}
      </Link>
    </main>
  );
}
