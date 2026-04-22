/**
 * ============================================================================
 * LAYOUT DEL DASHBOARD (ZONA PRINCIPAL DE TRABAJO)
 * ============================================================================
 *
 * Este archivo define la estructura visual que comparten TODAS las paginas
 * dentro de la zona de trabajo (dashboard). Es lo que el user_label ve una vez
 * que ha iniciado sesion: la barra lateral de navegacion a la izquierda
 * y el area de contenido primary a la derecha.
 *
 * ESTRUCTURA DE LA PANTALLA:
 *   +--------------------+------------------------------------+
 *   |                    |                                    |
 *   |   Barra lateral    |   Contenido de la page activa    |
 *   |   (Sidebar)        |   (children)                       |
 *   |                    |                                    |
 *   +--------------------+------------------------------------+
 *
 * NOTA TECNICA: La folder se llama "(dashboard)" con parentesis porque en
 * Next.js las carpetas con parentesis son "route groups" — sirven para
 * organizar el codigo sin afectar la URL. Es decir, /home en realidad
 * esta dentro de (dashboard)/home, pero la URL no incluye "dashboard".
 * ============================================================================
 */

// Componente de la barra lateral de navegacion (menu izquierdo)
import { Suspense } from 'react'

import { RouteViewTracker } from '@/components/observability/RouteViewTracker'
import { Sidebar } from '@/components/layout/Sidebar'

/**
 * Componente layout del dashboard.
 * Recibe "children" que es la page que el user_label tiene abierta en ese momento.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    /* Contenedor primary: ocupa toda la pantalla. Fondo papel cálido (Warm Executive). */
    <div className="flex h-screen overflow-hidden bg-[color:var(--paper)] text-[color:var(--ink)]">
      {/* RouteViewTracker usa useSearchParams(); en Next.js 16 eso requiere un
          Suspense boundary para no abortar la generacion estatica de paginas
          hijas (p.ej. /engineering/portfolio). El tracker no pinta nada, asi
          que el fallback es null. */}
      <Suspense fallback={null}>
        <RouteViewTracker scope="dashboard" />
      </Suspense>
      {/* Barra lateral izquierda con el menu de navegacion */}
      <Sidebar />
      {/* Area de contenido primary donde se muestra la page activa */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}
