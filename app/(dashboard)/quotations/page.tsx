/**
 * ============================================================================
 * PAGINA SERVIDOR DE QUOTATIONS (PAGINA PRINCIPAL)
 * ============================================================================
 *
 * Esta es la page primary del modulo de Quotations (quotes comerciales).
 * Se encarga de cargar TODOS los data necesarios desde la base de data
 * y pasarlos al componente visual interactivo (QuotationsClient).
 *
 * QUE CARGA:
 *   1. Configuracion de statuses del workflow (colores, etiquetas, sort_order)
 *   2. Consultas entrantes que no estan archivadas
 *   3. Lista de clients registrados
 *   4. Contactos de esos clients
 *
 * DESPUES:
 *   - Empareja automaticamente cada request con su client (si lo tiene)
 *   - Transforma los data crudos en objetos "IncomingQuery" listos para mostrar
 *   - Pasa todo al componente visual QuotationsClient
 *
 * NOTA TECNICA: Las 4 requests a la base de data se ejecutan EN PARALELO
 * con Promise.all para que la page cargue mas rapido. Si una falla, las
 * demas siguen funcionando.
 * ============================================================================
 */

// Link: navegacion entre paginas
import Link from 'next/link'
// Icono de document para el boton de forms
import { FileText } from 'lucide-react'

// Barra superior de la page
import { TopBar } from '@/components/layout/TopBar'
// Conexion a la base de data Supabase desde el servidor
import { createClient } from '@/lib/supabase/server'
// Funciones para cargar la configuracion de statuses
import { getWorkflowStateConfigRows } from '@/lib/workflow-state-config.server'
import { WORKFLOW_STATE_SCOPES } from '@/lib/workflow-state-config'
// Constantes de statuses de las requests (ej: ARCHIVED)
import { INCOMING_REQUEST_STATUSES } from '@/lib/workflow-states'
// Tipos de data para clients, contacts y requests
import type {
  Client,
  ClientContact,
  IncomingRequest,
} from '@/types/database'

// Funciones para emparejar requests con clients
import { buildIncomingClientLookup, toIncomingQuery } from './incoming-queries'
// Componente visual interactivo con el tablero de quotations
import { QuotationsClient } from './QuotationsClient'

// Forzar que la page se regenere en cada visita (sin cache)
export const dynamic = 'force-dynamic'

/**
 * Funcion primary de la page de Quotations.
 * Se ejecuta en el servidor cada vez que alguien visita /quotations.
 */
export default async function QuotationsPage() {
  const supabase = await createClient()

  // Paso 1: Cargar data en paralelo (configuracion, requests, clients, contacts)
  const [stateConfigRows, queriesResult, clientsResult, contactsResult] =
    await Promise.all([
      // Configuracion visual de los statuses (colores, nombres, sort_order)
      getWorkflowStateConfigRows([
        WORKFLOW_STATE_SCOPES.QUOTATION_BOARD,
        WORKFLOW_STATE_SCOPES.INCOMING_QUERIES,
      ]),
      // Consultas entrantes (excluye las archivadas), ordenadas por date
      supabase
        .from('doa_incoming_requests')
        .select('*')
        .neq('status', INCOMING_REQUEST_STATUSES.ARCHIVED)
        .order('created_at', { ascending: false }),
      // Todos los clients registrados, ordenados alfabeticamente
      supabase
        .from('doa_clients')
        .select('*')
        .order('name', { ascending: true }),
      // Contactos de los clients, priorizando los principales y activos
      supabase
        .from('doa_client_contacts')
        .select('*')
        .order('is_primary', { ascending: false })
        .order('active', { ascending: false })
        .order('created_at', { ascending: true }),
    ])

  // Paso 2: Verificar errores de cada request a la base de data
  const { data, error } = queriesResult

  if (error) {
    console.error('Error cargando requests entrantes desde doa_incoming_requests:', error)
  }

  if (clientsResult.error) {
    console.error('Error cargando clients desde doa_clients:', clientsResult.error)
  }

  if (contactsResult.error) {
    console.error('Error cargando contacts desde doa_client_contacts:', contactsResult.error)
  }

  // Paso 3: Construir el mapa de search de clients por email
  // Esto permite emparejar cada request con el client que la send
  const clientLookup = buildIncomingClientLookup(
    (clientsResult.data ?? []) as Client[],
    (contactsResult.data ?? []) as ClientContact[],
  )
  // Transformar cada fila de la base de data en un objeto "IncomingQuery"
  const incomingQueries = (data ?? []).map((row) =>
    toIncomingQuery(row as IncomingRequest, clientLookup),
  )

  // Paso 4: Renderizar la page con todos los data cargados
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      {/* Barra superior con title de la seccion */}
      <TopBar title="Quotations" subtitle="Seguimiento commercial previo al project" />

      {/* Enlace al catalogo de forms generados por n8n */}
      <div className="px-5 pb-0 pt-5">
        <Link
          href="/quotations/forms"
          className="inline-flex items-center rounded-xl border border-[color:var(--line)] bg-transparent px-4 py-2 text-sm font-semibold text-[color:var(--ink-2)] transition-colors hover:bg-[color:var(--paper-3)]"
        >
          <FileText className="mr-2 h-4 w-4" />
          Forms
        </Link>
      </div>

      {/* Componente interactivo con el tablero de statuses de quotations */}
      <QuotationsClient
        initialIncomingQueries={incomingQueries}
        initialStateConfigRows={stateConfigRows}
      />
    </div>
  )
}
