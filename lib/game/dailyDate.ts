const MADRID_TIME_ZONE = "Europe/Madrid";
const DAY_MS = 24 * 60 * 60 * 1000;

/** Fecha del primer reto diario (reto #1). */
export const DAILY_LAUNCH_DATE = "2026-01-01";

/** Fecha (YYYY-MM-DD) del día actual en Europe/Madrid, no en la hora local del dispositivo. */
export function todayInMadrid(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MADRID_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Suma (o resta, con days negativo) días de calendario a una fecha YYYY-MM-DD. */
export function addDaysToDateString(dateString: string, days: number): string {
  const d = new Date(`${dateString}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function previousDateString(dateString: string): string {
  return addDaysToDateString(dateString, -1);
}

/** Instante UTC exacto de medianoche en Madrid para la fecha (YYYY-MM-DD) dada. */
function madridMidnightUtc(dateString: string): Date {
  const asIfUtc = new Date(`${dateString}T00:00:00Z`);
  // Trunco: comparo cómo se ve ese mismo instante en Madrid y en UTC para
  // deducir el offset real (incluye el ajuste de horario de verano), y lo
  // aplico para obtener el instante UTC que corresponde a esa medianoche.
  const tzWallClock = new Date(asIfUtc.toLocaleString("en-US", { timeZone: MADRID_TIME_ZONE }));
  const utcWallClock = new Date(asIfUtc.toLocaleString("en-US", { timeZone: "UTC" }));
  const offsetMs = utcWallClock.getTime() - tzWallClock.getTime();
  return new Date(asIfUtc.getTime() + offsetMs);
}

/** Milisegundos hasta la próxima medianoche en Madrid (siempre >= 0). */
export function msUntilNextMadridMidnight(now: Date = new Date()): number {
  const tomorrow = addDaysToDateString(todayInMadrid(now), 1);
  return Math.max(0, madridMidnightUtc(tomorrow).getTime() - now.getTime());
}

/** Número de reto diario (el reto #1 cae en DAILY_LAUNCH_DATE). */
export function challengeNumberForDate(dateString: string): number {
  const start = new Date(`${DAILY_LAUNCH_DATE}T00:00:00Z`).getTime();
  const current = new Date(`${dateString}T00:00:00Z`).getTime();
  const days = Math.round((current - start) / DAY_MS);
  return days + 1;
}
