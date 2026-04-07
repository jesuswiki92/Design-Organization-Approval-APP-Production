/**
 * ============================================================================
 * PAGINA SERVIDOR DE DETALLE DE UNA QUOTATION
 * ============================================================================
 *
 * Esta pagina muestra la ficha completa de una quotation (oferta comercial)
 * individual. Se accede a ella cuando el usuario pulsa "Ver detalle" en
 * una tarjeta del tablero de Quotations.
 *
 * QUE HACE:
 *   1. Extrae el identificador de la quotation desde la URL
 *   2. Carga la configuracion de estados del tablero desde Supabase
 *   3. Pasa todo al componente visual QuotationDetailClient
 *
 * NOTA TECNICA: La URL es dinamica: /quotations/[id] donde [id] es el
 * identificador unico de la quotation. "force-dynamic" asegura que los
 * datos se cargan frescos en cada visita.
 * ============================================================================
 */

// Barra superior de la pagina
import { TopBar } from '@/components/layout/TopBar'
// Funciones para cargar la configuracion de estados del workflow
import { getWorkflowStateConfigRows } from '@/lib/workflow-state-config.server'
import { WORKFLOW_STATE_SCOPES } from '@/lib/workflow-state-config'

// Componente visual interactivo que muestra el detalle de la quotation
import { QuotationDetailClient } from './QuotationDetailClient'

// Forzar regeneracion en cada visita (sin cache)
export const dynamic = 'force-dynamic'

/**
 * Funcion principal de la pagina de detalle.
 * Se ejecuta en el servidor cuando alguien visita /quotations/[id].
 */
export default async function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // Extraer el ID de la quotation desde la URL
  const { id } = await params

  // Cargar la configuracion de estados del tablero de quotations
  const stateConfigRows = await getWorkflowStateConfigRows([
    WORKFLOW_STATE_SCOPES.QUOTATION_BOARD,
  ])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,#eff6ff_0%,#f8fbff_34%,#f8fafc_100%)]">
      {/* Barra superior con titulo */}
      <TopBar
        title="Detalle de quotation"
        subtitle="Vista preparada para alojar todo el detalle operativo de la oferta"
      />
      {/* Componente visual con toda la informacion de la quotation */}
      <QuotationDetailClient id={id} initialStateConfigRows={stateConfigRows} />
    </div>
  )
}
