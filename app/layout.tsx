/**
 * ============================================================================
 * LAYOUT RAIZ DE TODA LA APLICACION
 * ============================================================================
 *
 * Este archivo define la estructura HTML base que envuelve TODAS las paginas
 * de la aplicacion. Es como el "esqueleto" o "marco" general.
 *
 * QUE HACE:
 *   - Define el titulo de la pestana del navegador ("DOA Operations Hub")
 *   - Carga los estilos globales (globals.css con Tailwind)
 *   - Configura el idioma, el modo oscuro y la tipografia base
 *   - Renderiza dentro del <body> cualquier pagina que el usuario visite
 *
 * NOTA TECNICA: En Next.js App Router, el layout raiz SIEMPRE debe incluir
 * las etiquetas <html> y <body>. Todo lo que se coloque aqui se aplicara
 * a todas las paginas sin excepcion.
 * ============================================================================
 */

import type { Metadata } from "next";
import "./globals.css";

/** Metadatos de la aplicacion: titulo y descripcion para navegadores y buscadores */
export const metadata: Metadata = {
  title: "DOA Operations Hub",
  description: "Design Organization Approval — Engineering Workspace",
};

/**
 * Componente layout raiz.
 * Recibe como "children" el contenido de la pagina activa en cada momento.
 * Ejemplo: si el usuario esta en /home, "children" sera la pagina de inicio.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /* Configuracion del HTML: idioma ingles, modo oscuro activo, altura completa */
    <html lang="en" className="dark h-full">
      {/* Cuerpo de la pagina: fondo oscuro (#0F1117), texto claro, tipografia del sistema */}
      <body className="h-full antialiased bg-[#0F1117] text-[#E8E9F0]" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
