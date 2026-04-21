/**
 * ============================================================================
 * PAGINA SERVIDOR DE PROYECTOS ACTIVOS
 * ============================================================================
 *
 * Page primary del modulo de Projects activos. Se encarga de cargar
 * los projects desde la table doa_projects y la configuracion de statuses
 * del workflow en paralelo, y pasarlos al componente visual interactivo.
 *
 * Los projects cerrados se excluyen para mostrar solo los que estan en curso.
 *
 * NOTA TECNICA: Las requests se ejecutan EN PARALELO con Promise.all
 * para que la page cargue mas rapido. Si una falla, las demas siguen.
 * ============================================================================
 */

import { TopBar } from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/server'
import { getWorkflowStateConfigRows } from '@/lib/workflow-state-config.server'
import { WORKFLOW_STATE_SCOPES } from '@/lib/workflow-state-config'
import type { Project } from '@/types/database'
import { ProjectsClient } from './ProjectsClient'

// Forzar que la page se regenere en cada visita (sin cache)
export const dynamic = 'force-dynamic'

/**
 * Funcion primary de la page de Projects.
 * Se ejecuta en el servidor cada vez que alguien visita /projects.
 */
export default async function ProyectosPage() {
  const supabase = await createClient()

  // Paso 1: Cargar data en paralelo (configuracion de statuses + projects)
  const [stateConfigRows, proyectosResult] = await Promise.all([
    // Configuracion visual de los statuses del tablero de projects
    getWorkflowStateConfigRows([
      WORKFLOW_STATE_SCOPES.PROJECT_BOARD,
    ]),
    // Projects activos (excluye cerrados), ordenados por date
    supabase
      .from('doa_projects')
      .select('*')
      .not('status', 'in', '("closed")')
      .order('created_at', { ascending: false }),
  ])

  // Paso 2: Verificar errores
  if (proyectosResult.error) {
    console.error(
      'Error cargando projects desde doa_projects:',
      proyectosResult.error,
    )
  }

  const projects = (proyectosResult.data ?? []) as Project[]

  // Paso 3: Renderizar la page con todos los data cargados
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      {/* Barra superior con title de la seccion */}
      <TopBar title="Projects" subtitle="Projects activos de ingenieria" />

      {/* Componente interactivo con las vistas de tablero y lista */}
      <ProjectsClient
        initialProyectos={projects}
        initialStateConfigRows={stateConfigRows}
      />
    </div>
  )
}
