"use client";

import { useEffect, useState } from "react";
import { safeStorage } from "@/lib/storage/safeStorage";

const KEY = "populatio:onboarded";

const STEPS = [
  {
    title: "Find your spot",
    body: "Drag to move the map. Pinch, or scroll on a computer, to zoom in and out.",
  },
  {
    title: "Draw your zone",
    body: "Tap Draw, then drag a loop around the area you think holds exactly the target number of people.",
  },
  {
    title: "Check it",
    body: "We count everyone who lives inside your zone. The closer you get, the more points: up to 1,000.",
  },
];

/** Guía de tres pasos que solo aparece la primera vez. */
export function Onboarding() {
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    let seen = false;
    try {
      seen = safeStorage()?.getItem(KEY) === "1";
    } catch {
      seen = false;
    }
    if (!seen) setStep(0);
  }, []);

  const finish = () => {
    try {
      safeStorage()?.setItem(KEY, "1");
    } catch {
      /* sin persistencia: se volverá a mostrar */
    }
    setStep(null);
  };

  if (step === null) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div className="absolute inset-0 z-20 flex items-end justify-center bg-ink/30 p-4 sm:items-center" data-testid="onboarding">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="w-full max-w-sm rounded-2xl border border-line bg-white p-5 shadow-lg"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          How to play · {step + 1}/{STEPS.length}
        </p>
        <h2 id="onboarding-title" className="mt-1 font-display text-xl font-extrabold text-ink">
          {s.title}
        </h2>
        <p className="mt-1.5 text-sm text-muted">{s.body}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <button type="button" onClick={finish} className="text-sm font-medium text-muted hover:text-ink">
            Skip
          </button>
          <button
            type="button"
            onClick={() => (last ? finish() : setStep(step + 1))}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-deep"
          >
            {last ? "Let’s play" : "Next"}
          </button>
        </div>
      </section>
    </div>
  );
}
