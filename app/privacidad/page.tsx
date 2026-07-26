import type { Metadata } from "next";
import { StaticPage } from "@/components/StaticPage";

export const metadata: Metadata = { title: "Privacidad — Rodea" };

export default function PrivacidadPage() {
  return (
    <StaticPage title="Privacidad">
      <p>
        Este juego no requiere cuenta y no recoge información personal. No
        pedimos correo, nombre, ubicación ni permisos del dispositivo.
      </p>
      <p>
        Tu mejor puntuación y el número de intentos se guardan únicamente en el
        almacenamiento local de tu navegador; nunca salen de tu dispositivo y
        puedes borrarlos limpiando los datos del sitio.
      </p>
      <p>
        No usamos cookies no esenciales. Si en el futuro se conecta una
        herramienta de analítica, será respetuosa con la privacidad, se
        limitará a eventos de juego agregados y esta página se actualizará para
        reflejarlo.
      </p>
    </StaticPage>
  );
}
