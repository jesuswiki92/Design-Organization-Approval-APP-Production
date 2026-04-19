/**
 * ============================================================================
 * PAGINA SERVIDOR DE QUOTATIONS (PAGINA PRINCIPAL)
 * ============================================================================
 *
 * Esta es la pagina principal del modulo de Quotations (ofertas comerciales).
 * Se encarga de cargar TODOS los datos necesarios desde la base de datos
 * y pasarlos al componente visual interactivo (QuotationsClient).
 *
 * QUE CARGA:
 *   1. Configuracion de estados del workflow (colores, etiquetas, orden)
 *   2. Consultas entrantes que no estan archivadas
 *   3. Lista de clientes registrados
 *   4. Contactos de esos clientes
 *
 * DESPUES:
 *   - Empareja automaticamente cada consulta con su cliente (si lo tiene)
 *   - Transforma los datos crudos en objetos "IncomingQuery" listos para mostrar
 *   - Pasa todo al componente visual QuotationsClient
 *
 * NOTA TECNICA: Las 4 consultas a la base de datos se ejecutan EN PARALELO
 * con Promise.all para que la pagina cargue mas rapido. Si una falla, las
 * demas siguen funcionando.
 * ============================================================================
 */

// Link: navegacion entre paginas
import Link from 'next/link'
// Icono de documento para el boton de formularios
import { FileText } from 'lucide-react'

// Barra superior de la pagina
import { TopBar } from '@/components/layout/TopBar'
// Conexion a la base de datos Supabase desde el servidor
import { createClient } from '@/lib/supabase/server'
// Funciones para cargar la configuracion de estados
import { getWorkflowStateConfigRows } from '@/lib/workflow-state-config.server'
import { WORKFLOW_STATE_SCOPES } from '@/lib/workflow-state-config'
// Constantes de estados de las consultas (ej: ARCHIVADO)
import { CONSULTA_ESTADOS } from '@/lib/workflow-states'
// Tipos de datos para clientes, contactos y consultas
import type {
  Cliente,
  ClienteContacto,
  ConsultaEntrante,
} from '@/types/database'

// Funciones para emparejar consultas con clientes
import { buildIncomingClientLookup, toIncomingQuery } from './incoming-queries'
// Componente visual interactivo con el tablero de quotations
import { QuotationsClient } from './QuotationsClient'

// Forzar que la pagina se regenere en cada visita (sin cache)
export const dynamic = 'force-dynamic'

/**
 * Funcion principal de la pagina de Quotations.
 * Se ejecuta en el servidor cada vez que alguien visita /quotations.
 */
export default async function QuotationsPage() {
  const supabase = await createClient()

  // Paso 1: Cargar datos en paralelo (configuracion, consultas, clientes, contactos)
  const [stateConfigRows, queriesResult, clientsResult, contactsResult] =
    await Promise.all([
      // Configuracion visual de los estados (colores, nombres, orden)
      getWorkflowStateConfigRows([
        WORKFLOW_STATE_SCOPES.QUOTATION_BOARD,
        WORKFLOW_STATE_SCOPES.INCOMING_QUERIES,
      ]),
      // Consultas entrantes (excluye las archivadas), ordenadas por fecha
      supabase
        .from('consultas_entrantes')
        .select('*')
        .neq('estado', CONSULTA_ESTADOS.ARCHIVADO)
        .order('created_at', { ascending: false }),
      // Todos los clientes registrados, ordenados alfabeticamente
      supabase
        .from('clientes_datos_generales')
        .select('*')
        .order('nombre', { ascending: true }),
      // Contactos de los clientes, priorizando los principales y activos
      supabase
        .from('clientes_contactos')
        .select('*')
        .order('es_principal', { ascending: false })
        .order('activo', { ascending: false })
        .order('created_at', { ascending: true }),
    ])

  // Paso 2: Verificar errores de cada consulta a la base de datos
  const { data, error } = queriesResult

  if (error) {
    console.error('Error cargando consultas entrantes desde consultas_entrantes:', error)
  }

  if (clientsResult.error) {
    console.error('Error cargando clientes desde clientes_datos_generales:', clientsResult.error)
  }

  if (contactsResult.error) {
    console.error('Error cargando contactos desde clientes_contactos:', contactsResult.error)
  }

  // Paso 3: Construir el mapa de busqueda de clientes por email
  // Esto permite emparejar cada consulta con el cliente que la envio
  const clientLookup = buildIncomingClientLookup(
    (clientsResult.data ?? []) as Cliente[],
    (contactsResult.data ?? []) as ClienteContacto[],
  )
  // Transformar cada fila de la base de datos en un objeto "IncomingQuery"
  const incomingQueries = (data ?? []).map((row) =>
    toIncomingQuery(row as ConsultaEntrante, clientLookup),
  )

  // Paso 4: Renderizar la pagina con todos los datos cargados
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      {/* Barra superior con titulo de la seccion */}
      <TopBar title="Quotations" subtitle="Seguimiento comercial previo al proyecto" />

      {/* Enlace al catalogo de formularios generados por n8n */}
      <div className="px-5 pb-0 pt-5">
        <Link
          href="/quotations/forms"
          className="inline-flex items-center rounded-xl border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-700 shadow-sm transition-colors hover:bg-sky-50"
        >
          <FileText className="mr-2 h-4 w-4" />
          Formularios
        </Link>
      </div>

      {/* Componente interactivo con el tablero de estados de quotations */}
      <QuotationsClient
        initialIncomingQueries={incomingQueries}
        initialStateConfigRows={stateConfigRows}
      />
    </div>
  )
}
