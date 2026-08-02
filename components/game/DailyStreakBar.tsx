"use client";

type Props = {
  current: number;
  best: number;
};

/**
 * Línea compacta de racha para el modo Diario, en el mismo estilo ligero que
 * la barra de stats de Práctica (una sola línea, no debe robar altura al mapa).
 */
export function DailyStreakBar({ current, best }: Props) {
  if (current === 0 && best === 0) return null;
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 pb-2 text-[11px] text-muted sm:px-6 [@media(max-height:380px)]:hidden"
      role="group"
      aria-label="Racha diaria"
    >
      <span className="flex items-center gap-1 whitespace-nowrap">
        <span aria-hidden="true">🔥</span>
        <span className="tabular font-semibold text-ink">{current}</span>
        <span>{current === 1 ? "día seguido" : "días seguidos"}</span>
      </span>
      <span className="flex items-center gap-1 whitespace-nowrap">
        <span>Mejor racha</span>
        <span className="tabular font-semibold text-ink">{best}</span>
      </span>
    </div>
  );
}
