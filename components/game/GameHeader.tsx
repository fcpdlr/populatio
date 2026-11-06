import Link from "next/link";

type Props = {
  /** Territorio activo: resalta España o Mundo en el selector. */
  region?: "es" | "world";
};

export function GameHeader({ region = "es" }: Props) {
  const tab = (active: boolean) =>
    `rounded-full px-2.5 py-1 font-semibold transition-colors ${
      active ? "bg-ink text-paper" : "text-muted hover:text-ink"
    }`;
  return (
    <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
      <Link
        href="/"
        className="font-display text-lg font-extrabold tracking-tight text-ink"
        aria-label="populat.io, inicio"
      >
        populat<span className="text-accent">.io</span>
      </Link>
      <nav className="flex items-center gap-3 text-xs text-muted">
        <div className="flex items-center rounded-full border border-line p-0.5" aria-label="Territorio">
          <Link href="/" className={tab(region === "es")} aria-current={region === "es" ? "page" : undefined}>
            España
          </Link>
          <Link href="/mundo" className={tab(region === "world")} aria-current={region === "world" ? "page" : undefined}>
            Mundo
          </Link>
        </div>
        <Link href="/como-se-calcula" className="hidden hover:text-ink sm:inline">
          Cómo se calcula
        </Link>
        <Link href="/acerca-de" className="hidden hover:text-ink sm:inline">
          Acerca de
        </Link>
      </nav>
    </header>
  );
}
