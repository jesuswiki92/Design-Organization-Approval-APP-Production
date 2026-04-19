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
 *   2. Carga la configuracion de estados y las consultas entrantes desde Supabase
 *   3. Pasa todo al componente visual QuotationDetailClient
 *
 * NOTA TECNICA: La URL es dinamica: /quotations/[id] donde [id] es el
 * identificador unico de la quotation. "force-dynamic" asegura que los
 * datos se cargan frescos en cada visita.
 * ============================================================================
 */

// Barra superior de la pagina
import { TopBar } from '@/components/layout/TopBar'
// Conexion a la base de datos Supabase desde el servidor
import { createClient } from '@/lib/supabase/server'
// Funciones para cargar la configuracion de estados del workflow
import { getWorkflowStateConfigRows } from '@/lib/workflow-state-config.server'
import { WORKFLOW_STATE_SCOPES } from '@/lib/workflow-state-config'
// Constantes de estados de las consultas
import { CONSULTA_ESTADOS } from '@/lib/workflow-states'
// Tipos de datos para clientes, contactos y consultas
import type {
  Cliente,
  ClienteContacto,
  ConsultaEntrante,
} from '@/types/database'

// Funciones para emparejar consultas con clientes
import {
  buildIncomingClientLookup,
  toIncomingQuery,
} from '../incoming-queries'
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

  const supabase = await createClient()

  // Cargar en paralelo la configuracion de estados y las consultas entrantes
  // (las mismas que alimentan el tablero principal), para que las tarjetas
  // reales esten disponibles al buscar por ID en el detalle.
  const [stateConfigRows, queriesResult, clientsResult, contactsResult] =
    await Promise.all([
      getWorkflowStateConfigRows([
        WORKFLOW_STATE_SCOPES.QUOTATION_BOARD,
        WORKFLOW_STATE_SCOPES.INCOMING_QUERIES,
      ]),
      supabase
        .from('consultas_entrantes')
        .select('*')
        .neq('estado', CONSULTA_ESTADOS.ARCHIVADO)
        .order('created_at', { ascending: false }),
      supabase
        .from('clientes_datos_generales')
        .select('*')
        .order('nombre', { ascending: true }),
      supabase
        .from('clientes_contactos')
        .select('*')
        .order('es_principal', { ascending: false })
        .order('activo', { ascending: false })
        .order('created_at', { ascending: true }),
    ])

  if (queriesResult.error) {
    console.error(
      'Error cargando consultas entrantes desde consultas_entrantes:',
      queriesResult.error,
    )
  }
  if (clientsResult.error) {
    console.error(
      'Error cargando clientes desde clientes_datos_generales:',
      clientsResult.error,
    )
  }
  if (contactsResult.error) {
    console.error(
      'Error cargando contactos desde clientes_contactos:',
      contactsResult.error,
    )
  }

  const clientLookup = buildIncomingClientLookup(
    (clientsResult.data ?? []) as Cliente[],
    (contactsResult.data ?? []) as ClienteContacto[],
  )
  const incomingQueries = (queriesResult.data ?? []).map((row) =>
    toIncomingQuery(row as ConsultaEntrante, clientLookup),
  )

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,#eff6ff_0%,#f8fbff_34%,#f8fafc_100%)]">
      {/* Barra superior con titulo */}
      <TopBar
        title="Detalle de quotation"
        subtitle="Vista preparada para alojar todo el detalle operativo de la oferta"
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
