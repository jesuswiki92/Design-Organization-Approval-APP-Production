/**
 * ============================================================================
 * PAGINA DE DETALLE DE CONSULTA ENTRANTE — leer desde Supabase (v2)
 * ============================================================================
 * Server component (async). Lee la fila correspondiente de
 * `doa_incoming_requests_v2` por id y, en paralelo, los catalogos de clientes
 * y contactos (con el mismo aliasing que `app/(dashboard)/quotations/page.tsx`).
 *
 * - Construye el lookup email -> known client con `buildIncomingClientLookup`.
 * - Mapea la fila a `IncomingQuery` via `toIncomingQuery`.
 * - Resuelve el `ClientWithContacts` completo del remitente para mostrar
 *   todos los contactos del cliente (no solo el matcheado).
 *
 * Si la fila no existe o cualquier fetch falla, renderiza un estado
 * "Solicitud no encontrada" en lugar de crashear.
 * ============================================================================
 */

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { TopBar } from '@/components/layout/TopBar'
import { supabaseServer } from '@/lib/supabase/server'
import type {
  Client,
  ClientContact,
  IncomingRequest,
} from '@/types/database'

import {
  buildIncomingClientLookup,
  resolveIncomingClientRecord,
  toIncomingQuery,
} from '../../incoming-queries'
import { IncomingRequestDetailClient } from './IncomingRequestDetailClient'

export const dynamic = 'force-dynamic'

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
    console.error('incoming detail: error fetching clients', error)
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
    console.error('incoming detail: error fetching client contacts', error)
    return []
  }

  return (data ?? []) as unknown as ClientContact[]
}

function NotFound({ id }: { id: string }) {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      <TopBar title="Solicitud no encontrada" subtitle={`id: ${id}`} />

      <div className="flex-1 space-y-6 overflow-y-auto p-6 text-[color:var(--ink)]">
        <Link
          href="/quotations"
          className="inline-flex items-center gap-1.5 text-sm text-[color:var(--ink-3)] transition-colors hover:text-[color:var(--ink-2)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Quotations
        </Link>

        <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper-2)] p-8 text-center">
          <h2 className="font-[family-name:var(--font-heading)] text-2xl text-[color:var(--ink)]">
            Solicitud no encontrada
          </h2>
          <p className="mt-2 text-sm text-[color:var(--ink-3)]">
            No existe ninguna solicitud con id {id}
          </p>
        </div>
      </div>
    </div>
  )
}

export default async function IncomingRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const { data, error } = await supabaseServer
    .from('doa_incoming_requests_v2')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    if (error) {
      console.error('incoming detail: error fetching incoming request', error)
    }
    return <NotFound id={id} />
  }

  const [clients, contacts] = await Promise.all([
    loadClients(),
    loadClientContacts(),
  ])

  const clientLookup = buildIncomingClientLookup(clients, contacts)
  const query = toIncomingQuery(data as unknown as IncomingRequest, clientLookup)
  const fullClient = resolveIncomingClientRecord(query.sender, clients, contacts)

  return (
    <IncomingRequestDetailClient
      query={query}
      fullClient={fullClient}
      rawRow={data as Record<string, unknown>}
    />
  )
}
