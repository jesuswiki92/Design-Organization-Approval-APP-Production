/**
 * ============================================================================
 * COMPONENTE CLIENTE DE QUOTATIONS (CONTENEDOR PRINCIPAL)
 * ============================================================================
 *
 * Este componente es un "puente" entre la pagina servidor de Quotations
 * y el tablero interactivo (QuotationStatesBoard). Su trabajo es simple:
 *   - Recibir los datos cargados en el servidor (consultas y configuracion)
 *   - Pasarlos al tablero interactivo que el usuario ve y usa
 *
 * Se necesita este componente separado porque la pagina servidor (page.tsx)
 * no puede usar interactividad directa, asi que delega al cliente.
 *
 * NOTA TECNICA: 'use client' marca la frontera entre servidor y cliente.
 * Todo lo que este dentro de este componente puede usar hooks de React
 * como useState, useEffect, etc.
 * ============================================================================
 */

'use client'

// Tipo de datos para la configuracion de estados del workflow
import type { WorkflowStateConfigRow } from '@/types/database'

// Tipo de datos para las consultas entrantes
import type { IncomingQuery } from './incoming-queries'
// Tablero principal que muestra las columnas de estados con sus tarjetas
import { QuotationStatesBoard } from './QuotationStatesBoard'

/**
 * Componente contenedor que conecta los datos del servidor con el tablero.
 * Recibe las consultas entrantes y la configuracion de estados,
 * y los pasa directamente al tablero interactivo.
 */
export function QuotationsClient({
  initialIncomingQueries,
  initialStateConfigRows,
}: {
  initialIncomingQueries: IncomingQuery[]
  initialStateConfigRows: WorkflowStateConfigRow[]
}) {
  return (
    /* Contenedor con scroll vertical para el area de trabajo */
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-5 text-slate-900">
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {/* Tablero de estados de quotations con toda la interactividad */}
        <QuotationStatesBoard
          initialIncomingQueries={initialIncomingQueries}
          initialStateConfigRows={initialStateConfigRows}
        />
      </div>
    </div>
  )
}
