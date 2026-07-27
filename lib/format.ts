const nf = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const pf = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 10000000 → "10.000.000" */
export function formatInt(n: number): string {
  return nf.format(Math.round(n));
}

/** 2.579 → "2,58 %" */
export function formatPercent(n: number): string {
  return `${pf.format(n)} %`;
}

/** 3_723_000 (ms) → "01:02:03" */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
