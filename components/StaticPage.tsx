import Link from "next/link";

export function StaticPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link href="/" className="text-sm text-accent hover:text-accent-deep">
        ← Volver al juego
      </Link>
      <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight">
        {title}
      </h1>
      <div className="prose-sm mt-6 space-y-4 text-[15px] leading-relaxed text-ink">
        {children}
      </div>
    </div>
  );
}
