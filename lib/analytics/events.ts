import { track as vercelTrack } from "@vercel/analytics";
/**
 * Abstracción mínima de analítica.
 *
 * El MVP no conecta ningún servicio: el transporte por defecto es un
 * no-op (con log en desarrollo). Para conectar un proveedor respetuoso
 * con la privacidad (p. ej. Vercel Analytics o Plausible), sustituye
 * `transport` por su llamada correspondiente.
 */
export type AnalyticsEvent =
  | { name: "game_started"; target: number }
  | { name: "polygon_drawn" }
  | {
      name: "attempt_submitted";
      target: number;
      estimated: number;
      score: number;
    }
  | { name: "new_target"; target: number }
  | { name: "best_score_improved"; target: number; score: number }
  | { name: "mode_changed"; mode: "daily" | "practice" }
  | {
      name: "daily_attempt_confirmed";
      target: number;
      challengeNumber: number;
      score: number;
      streak: number;
    }
  | { name: "guess_finished"; score: number }
  | { name: "duel_over"; streak: number }
  | { name: "share_clicked"; mode: string; channel: "native" | "x" };

type Transport = (event: AnalyticsEvent) => void;

/** Por defecto, Vercel Web Analytics (sin cookies). En desarrollo, a la consola. */
let transport: Transport = (event) => {
  if (process.env.NODE_ENV === "development") {
    console.debug("[analytics]", event.name, event);
    return;
  }
  const { name, ...props } = event;
  vercelTrack(name, props as Record<string, string | number | boolean>);
};

export function setAnalyticsTransport(t: Transport): void {
  transport = t;
}

export function track(event: AnalyticsEvent): void {
  try {
    transport(event);
  } catch {
    /* la analítica nunca debe romper el juego */
  }
}
