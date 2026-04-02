// ? Quotations board/list surface
import Link from 'next/link'
import { FileText } from 'lucide-react'

import { TopBar } from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/server'
import { getWorkflowStateConfigRows } from '@/lib/workflow-state-config.server'
import { WORKFLOW_STATE_SCOPES } from '@/lib/workflow-state-config'
import type {
  Cliente,
  ClienteContacto,
  ConsultaEntrante,
} from '@/types/database'

import { buildIncomingClientLookup, toIncomingQuery } from './incoming-queries'
import { QuotationsClient } from './QuotationsClient'

export const dynamic = 'force-dynamic'

export default async function QuotationsPage() {
  const supabase = await createClient()
  const [stateConfigRows, queriesResult, clientsResult, contactsResult] =
    await Promise.all([
      getWorkflowStateConfigRows([
        WORKFLOW_STATE_SCOPES.QUOTATION_BOARD,
        WORKFLOW_STATE_SCOPES.INCOMING_QUERIES,
      ]),
      supabase
        .from('doa_consultas_entrantes')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('doa_clientes_datos_generales')
        .select('*')
        .order('nombre', { ascending: true }),
      supabase
        .from('doa_clientes_contactos')
        .select('*')
        .order('es_principal', { ascending: false })
        .order('activo', { ascending: false })
        .order('created_at', { ascending: true }),
    ])

  const { data, error } = queriesResult

  if (error) {
    console.error('Error cargando consultas entrantes desde doa_consultas_entrantes:', error)
  }

  if (clientsResult.error) {
    console.error('Error cargando clientes desde doa_clientes_datos_generales:', clientsResult.error)
  }

  if (contactsResult.error) {
    console.error('Error cargando contactos desde doa_clientes_contactos:', contactsResult.error)
  }

  const clientLookup = buildIncomingClientLookup(
    (clientsResult.data ?? []) as Cliente[],
    (contactsResult.data ?? []) as ClienteContacto[],
  )
  const incomingQueries = (data ?? []).map((row) =>
    toIncomingQuery(row as ConsultaEntrante, clientLookup),
  )

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      <TopBar title="Quotations" subtitle="Seguimiento comercial previo al proyecto" />
      <div className="px-5 pb-0 pt-5">
        <Link
          href="/quotations/forms"
          className="inline-flex items-center rounded-xl border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-700 shadow-sm transition-colors hover:bg-sky-50"
        >
          <FileText className="mr-2 h-4 w-4" />
          Formularios
        </Link>
      </div>
      <QuotationsClient
        initialIncomingQueries={incomingQueries}
        initialStateConfigRows={stateConfigRows}
      />
    </div>
  )
}
