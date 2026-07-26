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
  title: "populat.io — rodea la población de España",
  description:
    "Te damos una cifra de habitantes. Rodea una zona en el mapa y acércate todo lo posible.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#faf9f6",
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
