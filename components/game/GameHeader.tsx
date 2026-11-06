import Link from "next/link";

export function GameHeader() {
  return (
    <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
      <Link
        href="/"
        className="font-display text-lg font-extrabold tracking-tight text-ink"
        aria-label="populat.io, home"
      >
        populat<span className="text-accent">.io</span>
      </Link>
      <nav className="flex items-center gap-4 text-xs text-muted">
        <Link href="/how-it-works" className="hover:text-ink">
          How it works
        </Link>
        <Link href="/about" className="hover:text-ink">
          About
        </Link>
      </nav>
    </header>
  );
}
