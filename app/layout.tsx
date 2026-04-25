/**
 * ============================================================================
 * LAYOUT RAIZ — DOA Operations Hub (Warm Executive)
 * ============================================================================
 *
 * Estructura HTML base. Carga fuentes de diseño (Instrument Serif, Geist,
 * Geist Mono) y aplica el tema "Warm Executive" definido en globals.css.
 * ============================================================================
 */

import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "DOA Operations Hub",
  description: "Design Organization Approval — Engineering Workspace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        {/* Design tokens → fuentes del prototipo DOA Redesign (Anthropic design file) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full antialiased bg-background text-foreground font-sans">
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
