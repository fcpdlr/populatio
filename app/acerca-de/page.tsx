import type { Metadata } from "next";
import { StaticPage } from "@/components/StaticPage";

export const metadata: Metadata = { title: "Acerca de — populat.io" };

export default function AcercaDePage() {
  return (
    <StaticPage title="Acerca de">
      <p>
        <strong>populat.io</strong> es un juego sencillo: te damos una cifra de
        habitantes, dibujas una zona sobre el mapa de España y comprobamos
        cuánta gente vive realmente dentro. Cuanto más te acerques, más puntos.
      </p>
      <p>
        No hay niveles, pistas ni relojes. Solo tu intuición geográfica y
        demográfica contra los datos oficiales de población.
      </p>
      <p>
        El cálculo se hace celda a celda sobre una rejilla de población real
        de ~1 km. Puedes leer el detalle en{" "}
        <a href="/como-se-calcula" className="text-accent underline">
          cómo se calcula
        </a>
        .
      </p>
    </StaticPage>
  );
}
