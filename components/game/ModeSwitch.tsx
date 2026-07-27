"use client";

import type { GameMode } from "@/lib/game/modeStorage";

type Props = {
  mode: GameMode;
  onChange: (mode: GameMode) => void;
};

const OPTIONS: { key: GameMode; label: string }[] = [
  { key: "daily", label: "Diario" },
  { key: "practice", label: "Práctica" },
];

export function ModeSwitch({ mode, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Modo de juego"
      className="mx-auto flex w-fit items-center gap-0.5 rounded-full border border-line bg-paper p-0.5"
    >
      {OPTIONS.map((opt) => {
        const active = opt.key === mode;
        return (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.key)}
            className={
              active
                ? "rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white"
                : "rounded-full px-3 py-1 text-xs font-semibold text-muted transition-colors hover:text-ink"
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
