import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Fuentes autoalojadas (licencia OFL, ficheros en app/fonts):
// sin dependencia de Google Fonts en tiempo de build ni de ejecución.
const bricolage = localFont({
  src: [
    { path: "./fonts/BricolageGrotesque-Medium.woff2", weight: "500" },
    { path: "./fonts/BricolageGrotesque-Bold.woff2", weight: "700" },
    { path: "./fonts/BricolageGrotesque-ExtraBold.woff2", weight: "800" },
  ],
  variable: "--font-bricolage",
  display: "swap",
});

const inter = localFont({
  src: "./fonts/InterVariable.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rodea — el juego de rodear habitantes en el mapa de España",
  description:
    "Te damos una cifra de habitantes. Dibuja una zona en el mapa de España y trata de acercarte todo lo posible.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#fafaf8",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${bricolage.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
