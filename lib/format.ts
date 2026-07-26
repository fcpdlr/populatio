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
