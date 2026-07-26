import Link from "next/link";

export function GameHeader() {
  return (
    <header className="flex items-center justify-between px-4 py-3 sm:px-6">
      <Link
        href="/"
        className="font-display text-lg font-extrabold tracking-tight text-ink"
        aria-label="Rodea, inicio"
      >
        rodea<span className="text-accent">.</span>
      </Link>
      <nav className="flex items-center gap-4 text-xs text-muted">
        <Link href="/como-se-calcula" className="hover:text-ink">
          Cómo se calcula
        </Link>
        <Link href="/acerca-de" className="hover:text-ink">
          Acerca de
        </Link>
      </nav>
    </header>
  );
}
