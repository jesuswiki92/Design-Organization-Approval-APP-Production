/**
 * ============================================================================
 * PAGINA PRINCIPAL DE PROYECTOS (ENGINEERING)
 * ============================================================================
 *
 * Esta pagina es el punto de entrada al modulo de Proyectos (Engineering).
 * Muestra una vista operativa del equipo de proyectos con tablero tipo
 * Kanban y vista lista.
 *
 * NOTA: Actualmente los datos son MOCK (simulados). Todavia no estan
 * conectados a la base de datos real. La interfaz esta preparada para
 * cuando se conecte el backend.
 *
 * NOTA TECNICA: Es un Server Component que simplemente renderiza la
 * barra superior y delega al componente interactivo EngineeringClient.
 * ============================================================================
 */

// Barra superior de la pagina
import { TopBar } from '@/components/layout/TopBar'

// Componente visual interactivo con el tablero de proyectos
import { EngineeringClient } from './EngineeringClient'

/** Pagina principal del modulo de Proyectos */
export default function EngineeringIndexPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      {/* Barra superior con titulo */}
      <TopBar title="Proyectos" subtitle="Vista principal de proyectos" />
      {/* Tablero interactivo de proyectos */}
      <EngineeringClient />
    </div>
  )
}
