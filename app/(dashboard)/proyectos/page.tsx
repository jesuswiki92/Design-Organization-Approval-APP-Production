/**
 * ============================================================================
 * PAGINA SERVIDOR DE PROYECTOS ACTIVOS
 * ============================================================================
 *
 * Pagina principal del modulo de Proyectos activos. Se encarga de cargar
 * los proyectos desde la tabla proyectos y la configuracion de estados
 * del workflow en paralelo, y pasarlos al componente visual interactivo.
 *
 * Los proyectos cerrados se excluyen para mostrar solo los que estan en curso.
 *
 * NOTA TECNICA: Las consultas se ejecutan EN PARALELO con Promise.all
 * para que la pagina cargue mas rapido. Si una falla, las demas siguen.
 * ============================================================================
 */

import { TopBar } from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/server'
import { getWorkflowStateConfigRows } from '@/lib/workflow-state-config.server'
import { WORKFLOW_STATE_SCOPES } from '@/lib/workflow-state-config'
import type { Proyecto } from '@/types/database'
import { ProyectosClient } from './ProyectosClient'

// Forzar que la pagina se regenere en cada visita (sin cache)
export const dynamic = 'force-dynamic'

/**
 * Funcion principal de la pagina de Proyectos.
 * Se ejecuta en el servidor cada vez que alguien visita /proyectos.
 */
export default async function ProyectosPage() {
  const supabase = await createClient()

  // Paso 1: Cargar datos en paralelo (configuracion de estados + proyectos)
  const [stateConfigRows, proyectosResult] = await Promise.all([
    // Configuracion visual de los estados del tablero de proyectos
    getWorkflowStateConfigRows([
      WORKFLOW_STATE_SCOPES.PROJECT_BOARD,
    ]),
    // Proyectos activos (excluye cerrados), ordenados por fecha
    supabase
      .from('proyectos')
      .select('*')
      .not('estado', 'in', '("cerrado")')
      .order('created_at', { ascending: false }),
  ])

  // Paso 2: Verificar errores
  if (proyectosResult.error) {
    console.error(
      'Error cargando proyectos desde proyectos:',
      proyectosResult.error,
    )
  }

  const proyectos = (proyectosResult.data ?? []) as Proyecto[]

  // Paso 3: Renderizar la pagina con todos los datos cargados
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      {/* Barra superior con titulo de la seccion */}
      <TopBar title="Proyectos" subtitle="Proyectos activos de ingenieria" />

      {/* Componente interactivo con las vistas de tablero y lista */}
      <ProyectosClient
        initialProyectos={proyectos}
        initialStateConfigRows={stateConfigRows}
      />
    </div>
  )
}
