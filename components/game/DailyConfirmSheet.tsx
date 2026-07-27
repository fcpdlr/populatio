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
      aria-label="Confirmar el único intento de hoy"
      data-testid="daily-confirm-sheet"
      className="pointer-events-auto w-full rounded-t-2xl border border-line bg-white p-5 shadow-[0_-4px_24px_rgb(0_0_0/0.08)] sm:max-w-sm sm:rounded-2xl sm:shadow-lg"
    >
      <p className="text-sm font-semibold text-ink">Es tu único intento de hoy</p>
      <p className="mt-1.5 text-sm text-muted">
        En el modo Diario solo se comprueba una vez. Al confirmar, tu selección
        queda fija: no podrás volver a intentarlo hasta el próximo reto.
      </p>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onKeepAdjusting}
          className="flex-1 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
        >
          Seguir ajustando
        </button>
        <button
          type="button"
          onClick={onConfirm}
          data-testid="daily-confirm-button"
          className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-deep"
        >
          Confirmar intento
        </button>
      </div>
    </section>
  );
}
