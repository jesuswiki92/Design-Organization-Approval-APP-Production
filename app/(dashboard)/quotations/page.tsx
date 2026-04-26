/**
 * ============================================================================
 * PAGINA SERVIDOR DE QUOTATIONS — leer requests entrantes de Supabase
 * ============================================================================
 * Server component (async). Carga:
 *   - doa_incoming_requests_v2 (las requests recibidas, ordenadas DESC)
 *   - doa_clients_v2 (con alias para mapear al shape Client de la app)
 *   - doa_client_contacts_v2 (con alias para mapear al shape ClientContact)
 *
 * Construye el lookup `email -> known client` con `buildIncomingClientLookup`
 * y mapea cada fila a `IncomingQuery` via `toIncomingQuery`. Si alguna lectura
 * falla, degradamos a arrays vacios (no crasheamos la pagina).
 *
 * Workflow state config sigue desconectado: pasamos initialStateConfigRows=[].
 * ============================================================================
 */

import Link from 'next/link'
import { FileText } from 'lucide-react'

import { TopBar } from '@/components/layout/TopBar'
import { supabaseServer } from '@/lib/supabase/server'
import type {
  Client,
  ClientContact,
  IncomingRequest,
} from '@/types/database'

import { QuotationsClient } from './QuotationsClient'
import { RefreshInboundEmailsButton } from './RefreshInboundEmailsButton'
import {
  buildIncomingClientLookup,
  toIncomingQuery,
  type IncomingQuery,
} from './incoming-queries'

export const dynamic = 'force-dynamic'

async function loadIncomingRequests(): Promise<IncomingRequest[]> {
  const { data, error } = await supabaseServer
    .from('doa_incoming_requests_v2')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('quotations page: error fetching incoming requests', error)
    return []
  }

  return (data ?? []) as unknown as IncomingRequest[]
}

async function loadClients(): Promise<Client[]> {
  const { data, error } = await supabaseServer
    .from('doa_clients_v2')
    .select(
      `
      id,
      name,
      vat_tax_id:cif_vat,
      country,
      city,
      address,
      phone,
      website,
      is_active:active,
      notes,
      created_at,
      email_domain,
      client_type
    `,
    )
    .order('name', { ascending: true })

  if (error) {
    console.error('quotations page: error fetching clients', error)
    return []
  }

  return (data ?? []) as unknown as Client[]
}

async function loadClientContacts(): Promise<ClientContact[]> {
  const { data, error } = await supabaseServer
    .from('doa_client_contacts_v2')
    .select(
      `
      id,
      client_id,
      name:first_name,
      last_name,
      email,
      phone,
      job_title:role,
      is_primary,
      is_active:active,
      created_at
    `,
    )

  if (error) {
    console.error('quotations page: error fetching client contacts', error)
    return []
  }

  return (data ?? []) as unknown as ClientContact[]
}

export default async function QuotationsPage() {
  const [incomingRequests, clients, contacts] = await Promise.all([
    loadIncomingRequests(),
    loadClients(),
    loadClientContacts(),
  ])

  const clientLookup = buildIncomingClientLookup(clients, contacts)
  const initialIncomingQueries: IncomingQuery[] = incomingRequests.map((row) =>
    toIncomingQuery(row, clientLookup),
  )

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      <TopBar title="Quotations" subtitle="Seguimiento commercial previo al project" />

      <div className="flex flex-row items-center gap-2 px-5 pb-0 pt-5">
        <Link
          href="/quotations/forms"
          className="inline-flex items-center rounded-xl border border-[color:var(--line)] bg-transparent px-4 py-2 text-sm font-semibold text-[color:var(--ink-2)] transition-colors hover:bg-[color:var(--paper-3)]"
        >
          <FileText className="mr-2 h-4 w-4" />
          Forms
        </Link>
        <RefreshInboundEmailsButton />
      </div>

      <QuotationsClient
        initialIncomingQueries={initialIncomingQueries}
        initialStateConfigRows={[]}
      />
    </div>
  )
}
