"use client";

type Props = {
  onConfirm: () => void;
  onKeepAdjusting: () => void;
};

export function DailyConfirmSheet({ onConfirm, onKeepAdjusting }: Props) {
  return (
    <section
      role="alertdialog"
      aria-modal="true"
      aria-label="Confirm today’s only attempt"
      data-testid="daily-confirm-sheet"
      className="pointer-events-auto w-full rounded-t-2xl border border-line bg-white p-5 shadow-[0_-4px_24px_rgb(0_0_0/0.08)] sm:max-w-sm sm:rounded-2xl sm:shadow-lg"
    >
      <p className="text-sm font-semibold text-ink">This is your only attempt today</p>
      <p className="mt-1.5 text-sm text-muted">
        The daily challenge is checked once. When you confirm, your zone is
        locked and you can&apos;t try again until the next challenge.
      </p>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onKeepAdjusting}
          className="flex-1 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
        >
          Keep adjusting
        </button>
        <button
          type="button"
          onClick={onConfirm}
          data-testid="daily-confirm-button"
          className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-deep"
        >
          Confirm
        </button>
      </div>
    </section>
  );
}
