export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** localStorage si está disponible y utilizable; null si no (SSR, privado, lleno...). */
export function safeStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    const s = window.localStorage;
    const probe = "__populatio_probe__";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}
