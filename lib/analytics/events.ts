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
    };

type Transport = (event: AnalyticsEvent) => void;

let transport: Transport = (event) => {
  if (process.env.NODE_ENV === "development") {
    console.debug("[analytics]", event.name, event);
  }
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
