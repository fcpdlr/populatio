import type {
  AttemptResult,
  MunicipalityContribution,
} from "@/lib/population/types";

export type GamePhase =
  | "loading-data" // descargando geometrías y población
  | "ready" // datos listos, sin selección
  | "drawn" // hay una selección válida dibujada
  | "checking" // cálculo en curso
  | "result" // resultado visible
  | "data-error"; // los datos no han podido cargarse

export type GameState = {
  phase: GamePhase;
  target: number;
  attempts: number;
  best: AttemptResult | null;
  result: AttemptResult | null;
  contributions: MunicipalityContribution[];
  errorMessage: string | null;
};

export type GameAction =
  | { type: "data-ready" }
  | { type: "data-error"; message: string }
  | { type: "selection-changed"; hasSelection: boolean }
  | { type: "check-started" }
  | {
      type: "check-finished";
      result: AttemptResult;
      contributions: MunicipalityContribution[];
      attempts: number;
      best: AttemptResult | null;
    }
  | { type: "check-failed"; message: string }
  | { type: "retry" }
  | { type: "new-target"; target: number; best: AttemptResult | null; attempts: number }
  | { type: "dismiss-error" };

export function initialState(target: number): GameState {
  return {
    phase: "loading-data",
    target,
    attempts: 0,
    best: null,
    result: null,
    contributions: [],
    errorMessage: null,
  };
}

export function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "data-ready":
      // Si ya se avanzó de fase (p. ej. el resultado bloqueado del reto
      // diario, mostrado antes de que el worker termine de cargar), no hay
      // que retroceder a "ready": solo aplica durante la carga inicial.
      return {
        ...state,
        phase: state.phase === "loading-data" ? "ready" : state.phase,
        errorMessage: null,
      };
    case "data-error":
      // Igual que arriba: un fallo de carga tardío no debe tapar un
      // resultado (o cualquier otra fase) ya mostrado.
      if (state.phase !== "loading-data") return state;
      return { ...state, phase: "data-error", errorMessage: action.message };
    case "selection-changed":
      if (state.phase === "loading-data" || state.phase === "data-error") {
        return state;
      }
      return {
        ...state,
        phase: action.hasSelection ? "drawn" : "ready",
        result: state.phase === "result" ? null : state.result,
        errorMessage: null,
      };
    case "check-started":
      return { ...state, phase: "checking", errorMessage: null };
    case "check-finished":
      return {
        ...state,
        phase: "result",
        result: action.result,
        contributions: action.contributions,
        attempts: action.attempts,
        best: action.best,
      };
    case "check-failed":
      return { ...state, phase: "drawn", errorMessage: action.message };
    case "retry":
      return { ...state, phase: "ready", result: null, contributions: [], errorMessage: null };
    case "new-target":
      return {
        ...initialState(action.target),
        phase: "ready",
        best: action.best,
        attempts: action.attempts,
      };
    case "dismiss-error":
      return { ...state, errorMessage: null };
    default:
      return state;
  }
}
