import type { Metadata } from "next";
import { JetBrains_Mono, Titillium_Web } from "next/font/google";
import "./globals.css";

// Broadcast-style display/body face and a monospaced face for times and numbers.
const titillium = Titillium_Web({
  variable: "--font-sans",
  weight: ["400", "600", "700", "900"],
  subsets: ["latin", "latin-ext"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "F1 Race Strategist",
  description: "Armá una estrategia de neumáticos para una carrera de F1 y simulá el resultado.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${titillium.variable} ${jetBrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
