/**
 * ============================================================================
 * LAYOUT DEL DASHBOARD (ZONA PRINCIPAL DE TRABAJO)
 * ============================================================================
 *
 * Este archivo define la estructura visual que comparten TODAS las paginas
 * dentro de la zona de trabajo (dashboard). Es lo que el usuario ve una vez
 * que ha iniciado sesion: la barra lateral de navegacion a la izquierda
 * y el area de contenido principal a la derecha.
 *
 * ESTRUCTURA DE LA PANTALLA:
 *   +--------------------+------------------------------------+
 *   |                    |                                    |
 *   |   Barra lateral    |   Contenido de la pagina activa    |
 *   |   (Sidebar)        |   (children)                       |
 *   |                    |                                    |
 *   +--------------------+------------------------------------+
 *
 * NOTA TECNICA: La carpeta se llama "(dashboard)" con parentesis porque en
 * Next.js las carpetas con parentesis son "route groups" — sirven para
 * organizar el codigo sin afectar la URL. Es decir, /home en realidad
 * esta dentro de (dashboard)/home, pero la URL no incluye "dashboard".
 * ============================================================================
 */

// Componente de la barra lateral de navegacion (menu izquierdo)
import { Sidebar } from '@/components/layout/Sidebar'

/**
 * Componente layout del dashboard.
 * Recibe "children" que es la pagina que el usuario tiene abierta en ese momento.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    /* Contenedor principal: ocupa toda la pantalla, con fondo degradado azul claro */
    <div className="flex h-screen overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      {/* Barra lateral izquierda con el menu de navegacion */}
      <Sidebar />
      {/* Area de contenido principal donde se muestra la pagina activa */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}
