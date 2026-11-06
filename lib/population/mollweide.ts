/**
 * Proyección Mollweide esférica, la misma que usa la rejilla GHS-POP
 * (ESRI:54009: esfera de radio 6.378.137 m, meridiano central 0).
 * Es de áreas iguales: todas las celdas de 1 km miden lo mismo en el planeta.
 */
export const MOLLWEIDE_R = 6_378_137;

const SQRT2 = Math.SQRT2;
const DEG = Math.PI / 180;

/** [lng, lat] en grados -> [x, y] en metros Mollweide. */
export function mollweide(lng: number, lat: number): [number, number] {
  const phi = Math.max(-89.9999, Math.min(89.9999, lat)) * DEG;
  const lambda = lng * DEG;
  const target = Math.PI * Math.sin(phi);
  // Newton sobre 2θ + sin 2θ = π sin φ
  let theta = phi;
  for (let i = 0; i < 30; i++) {
    const f = 2 * theta + Math.sin(2 * theta) - target;
    const d = 2 + 2 * Math.cos(2 * theta);
    if (d < 1e-12) break;
    const step = f / d;
    theta -= step;
    if (Math.abs(step) < 1e-12) break;
  }
  const x = ((2 * SQRT2) / Math.PI) * MOLLWEIDE_R * lambda * Math.cos(theta);
  const y = SQRT2 * MOLLWEIDE_R * Math.sin(theta);
  return [x, y];
}
