"use client";

type Props = {
  hasSelection: boolean;
  disabled?: boolean;
  onClear: () => void;
};

/**
 * El mapa se dibuja arrastrando: no hay modos de herramienta que elegir.
 * El único control adicional es borrar la selección actual para volver a
 * empezar.
 */
export function DrawingControls({ hasSelection, disabled, onClear }: Props) {
  if (!hasSelection) return null;

  return (
    <div
      className="absolute right-3 top-3 overflow-hidden rounded-xl border border-line bg-white shadow-sm"
      role="toolbar"
      aria-label="Herramientas de dibujo"
    >
      <button
        type="button"
        aria-label="Borrar selección"
        title="Borrar selección"
        disabled={disabled}
        onClick={onClear}
        className="flex h-10 w-10 items-center justify-center text-ink transition-colors hover:bg-accent-soft disabled:opacity-35 disabled:hover:bg-white"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
          <path
            d="M5 6h10M8 6V4.5h4V6m-5.5 0 .5 9h6l.5-9"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
