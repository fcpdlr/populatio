"use client";

import type { AnyMode } from "@/lib/game/modeStorage";

type Props<M extends string> = {
  mode: M;
  onChange: (mode: M) => void;
  options?: { key: M; label: string }[];
};

export const DRAW_MODE_OPTIONS = [
  { key: "daily", label: "Daily" },
  { key: "practice", label: "Practice" },
] as const;

export const ALL_MODE_OPTIONS: { key: AnyMode; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "practice", label: "Practice" },
  { key: "guess", label: "Guess" },
  { key: "duel", label: "More or Less" },
];

export function ModeSwitch<M extends string>({ mode, onChange, options }: Props<M>) {
  const opts = (options ?? (DRAW_MODE_OPTIONS as unknown as { key: M; label: string }[]));
  return (
    <div
      role="tablist"
      aria-label="Game mode"
      className="mx-auto flex w-fit items-center gap-0.5 rounded-full border border-line bg-paper p-0.5"
    >
      {opts.map((opt) => {
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
                ? "whitespace-nowrap rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white"
                : "whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold text-muted transition-colors hover:text-ink"
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
