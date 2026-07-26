import type { Metadata } from "next";
import { StaticPage } from "@/components/StaticPage";

export const metadata: Metadata = { title: "Cómo se calcula — Rodea" };

export default function ComoSeCalculaPage() {
  return (
    <StaticPage title="Cómo se calcula">
      <p>
        La estimación de población trabaja sobre una <strong>rejilla de
        celdas</strong> de aproximadamente 1 km de lado que cubre todo el
        territorio español, no sobre municipios ni provincias.
      </p>
      <h2 className="font-display text-xl font-bold">La rejilla de población</h2>
      <p>
        Cada celda de la rejilla tiene una posición (longitud, latitud) y una
        población asociada. Al comprobar tu selección, sumamos la población de
        todas las celdas cuyo centro cae dentro del polígono que has dibujado.
      </p>
      <p className="rounded-xl bg-accent-soft p-4 font-mono text-sm">
        población estimada = Σ población de la celda, para cada celda dentro
        del polígono
      </p>
      <p>
        El cálculo corre en un <strong>Web Worker</strong> para no bloquear la
        interfaz mientras se recorren las celdas.
      </p>
      <h2 className="font-display text-xl font-bold">Limitaciones</h2>
      <p>
        No se prorratean las celdas que quedan a caballo del borde de tu
        selección: una celda cuenta entera si su centro cae dentro, y no
        cuenta si cae fuera. El error que esto introduce queda acotado por el
        tamaño de celda (~1 km) y es pequeño frente a selecciones de tamaño
        jugable.
      </p>
    </StaticPage>
  );
}
