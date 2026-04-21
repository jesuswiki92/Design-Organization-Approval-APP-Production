/**
 * ============================================================================
 * PAGINA PRINCIPAL DE PROYECTOS (ENGINEERING)
 * ============================================================================
 *
 * Esta page es el punto de entrada al modulo de Projects (Engineering).
 * Muestra una vista operativa del equipo de projects con tablero type
 * Kanban y vista lista.
 *
 * NOTA: Actualmente los data son MOCK (simulados). Todavia no estan
 * conectados a la base de data real. La interfaz esta preparada para
 * cuando se conecte el backend.
 *
 * NOTA TECNICA: Es un Server Component que simplemente renderiza la
 * barra superior y delega al componente interactivo EngineeringClient.
 * ============================================================================
 */

// Barra superior de la page
import { TopBar } from '@/components/layout/TopBar'

// Componente visual interactivo con el tablero de projects
import { EngineeringClient } from './EngineeringClient'

/** Page primary del modulo de Projects */
export default function EngineeringIndexPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      {/* Barra superior con title */}
      <TopBar title="Projects" subtitle="Vista primary de projects" />
      {/* Tablero interactivo de projects */}
      <EngineeringClient />
    </div>
  )
}
