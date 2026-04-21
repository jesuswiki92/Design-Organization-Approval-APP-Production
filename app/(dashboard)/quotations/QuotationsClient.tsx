/**
 * ============================================================================
 * COMPONENTE CLIENTE DE QUOTATIONS (CONTENEDOR PRINCIPAL)
 * ============================================================================
 *
 * Este componente es un "puente" entre la page servidor de Quotations
 * y el tablero interactivo (QuotationStatesBoard). Su trabajo es simple:
 *   - Recibir los data cargados en el servidor (requests y configuracion)
 *   - Pasarlos al tablero interactivo que el user_label ve y usa
 *
 * Se necesita este componente separado porque la page servidor (page.tsx)
 * no puede usar interactividad directa, asi que delega al client.
 *
 * NOTA TECNICA: 'use client' marca la frontera entre servidor y client.
 * Todo lo que este dentro de este componente puede usar hooks de React
 * como useState, useEffect, etc.
 * ============================================================================
 */

'use client'

// Tipo de data para la configuracion de statuses del workflow
import type { WorkflowStateConfigRow } from '@/types/database'

// Tipo de data para las requests entrantes
import type { IncomingQuery } from './incoming-queries'
// Tablero primary que muestra las columnas de statuses con sus tarjetas
import { QuotationStatesBoard } from './QuotationStatesBoard'

/**
 * Componente contenedor que conecta los data del servidor con el tablero.
 * Recibe las requests entrantes y la configuracion de statuses,
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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-5 text-[color:var(--ink)]">
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {/* Tablero de statuses de quotations con toda la interactividad */}
        <QuotationStatesBoard
          initialIncomingQueries={initialIncomingQueries}
          initialStateConfigRows={initialStateConfigRows}
        />
      </div>
    </div>
  )
}
