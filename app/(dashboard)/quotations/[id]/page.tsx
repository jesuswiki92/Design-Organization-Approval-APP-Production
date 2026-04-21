/**
 * ============================================================================
 * PAGINA SERVIDOR DE DETALLE DE UNA QUOTATION
 * ============================================================================
 *
 * Esta page muestra la ficha completa de una quotation (quote commercial)
 * individual. Se accede a ella cuando el user_label pulsa "Ver detalle" en
 * una tarjeta del tablero de Quotations.
 *
 * QUE HACE:
 *   1. Extrae el identificador de la quotation desde la URL
 *   2. Carga la configuracion de statuses y las requests entrantes desde Supabase
 *   3. Pasa todo al componente visual QuotationDetailClient
 *
 * NOTA TECNICA: La URL es dinamica: /quotations/[id] donde [id] es el
 * identificador unico de la quotation. "force-dynamic" asegura que los
 * data se cargan frescos en cada visita.
 * ============================================================================
 */

// Barra superior de la page
import { TopBar } from '@/components/layout/TopBar'
// Conexion a la base de data Supabase desde el servidor
import { createClient } from '@/lib/supabase/server'
// Funciones para cargar la configuracion de statuses del workflow
import { getWorkflowStateConfigRows } from '@/lib/workflow-state-config.server'
import { WORKFLOW_STATE_SCOPES } from '@/lib/workflow-state-config'
// Constantes de statuses de las requests
import { INCOMING_REQUEST_STATUSES } from '@/lib/workflow-states'
// Tipos de data para clients, contacts y requests
import type {
  Client,
  ClientContact,
  IncomingRequest,
} from '@/types/database'

// Funciones para emparejar requests con clients
import {
  buildIncomingClientLookup,
  toIncomingQuery,
} from '../incoming-queries'
// Componente visual interactivo que muestra el detalle de la quotation
import { QuotationDetailClient } from './QuotationDetailClient'

// Forzar regeneracion en cada visita (sin cache)
export const dynamic = 'force-dynamic'

/**
 * Funcion primary de la page de detalle.
 * Se ejecuta en el servidor cuando alguien visita /quotations/[id].
 */
export default async function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // Extraer el ID de la quotation desde la URL
  const { id } = await params

  const supabase = await createClient()

  // Cargar en paralelo la configuracion de statuses y las requests entrantes
  // (las mismas que alimentan el tablero primary), para que las tarjetas
  // reales esten disponibles al buscar por ID en el detalle.
  const [stateConfigRows, queriesResult, clientsResult, contactsResult] =
    await Promise.all([
      getWorkflowStateConfigRows([
        WORKFLOW_STATE_SCOPES.QUOTATION_BOARD,
        WORKFLOW_STATE_SCOPES.INCOMING_QUERIES,
      ]),
      supabase
        .from('doa_incoming_requests')
        .select('*')
        .neq('status', INCOMING_REQUEST_STATUSES.ARCHIVED)
        .order('created_at', { ascending: false }),
      supabase
        .from('doa_clients')
        .select('*')
        .order('name', { ascending: true }),
      supabase
        .from('doa_client_contacts')
        .select('*')
        .order('is_primary', { ascending: false })
        .order('active', { ascending: false })
        .order('created_at', { ascending: true }),
    ])

  if (queriesResult.error) {
    console.error(
      'Error cargando requests entrantes desde doa_incoming_requests:',
      queriesResult.error,
    )
  }
  if (clientsResult.error) {
    console.error(
      'Error cargando clients desde doa_clients:',
      clientsResult.error,
    )
  }
  if (contactsResult.error) {
    console.error(
      'Error cargando contacts desde doa_client_contacts:',
      contactsResult.error,
    )
  }

  const clientLookup = buildIncomingClientLookup(
    (clientsResult.data ?? []) as Client[],
    (contactsResult.data ?? []) as ClientContact[],
  )
  const incomingQueries = (queriesResult.data ?? []).map((row) =>
    toIncomingQuery(row as IncomingRequest, clientLookup),
  )

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,#eff6ff_0%,#f8fbff_34%,#f8fafc_100%)]">
      {/* Barra superior con title */}
      <TopBar
        title="Detalle de quotation"
        subtitle="Vista preparada para alojar todo el detalle operativo de la quote"
      />
      {/* Componente visual con toda la informacion de la quotation */}
      <QuotationDetailClient
        id={id}
        initialStateConfigRows={stateConfigRows}
        initialIncomingQueries={incomingQueries}
      />
    </div>
  )
}
