/**
 * ============================================================================
 * PAGINA DE DETALLE DE CONSULTA ENTRANTE — solo Comunicaciones
 * ============================================================================
 * Server component (async). Lee la solicitud entrante de
 * `doa_incoming_requests_v2` y los emails asociados de `doa_emails_v2`, y
 * renderiza UNICAMENTE la sección "Comunicaciones" con la estética antigua
 * (warm-executive palette: tarjeta redondeada, borde izquierdo umber, icono Mail).
 *
 * El resto de bloques antiguos (review summary, datos del cliente, aircraft,
 * técnico, alcance, documentación, quotation, panel de decisión) NO se
 * renderizan en esta versión: el usuario solo pidió reactivar Comunicaciones.
 *
 * Si la solicitud no existe o cualquier fetch falla, se renderiza un estado
 * "Solicitud no encontrada".
 * ============================================================================
 */

import Link from 'next/link'
import { ArrowLeft, Mail } from 'lucide-react'

import { TopBar } from '@/components/layout/TopBar'
import { supabaseServer } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import type {
  Client,
  ClientContact,
  DoaEmail,
  IncomingRequest,
} from '@/types/database'

import {
  buildIncomingClientLookup,
  resolveIncomingClientRecord,
  toIncomingQuery,
} from '../../incoming-queries'
import { CenterColumnCollapsible } from './CenterColumnCollapsible'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Estilos compartidos (mismas convenciones que el board y la lista)
// ---------------------------------------------------------------------------

const pillBaseClass =
  'inline-flex items-center rounded-full border border-[color:var(--line-strong)] bg-[color:var(--paper-2)] px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink)] shadow-[0_1px_0_rgba(255,255,255,0.65)_inset]'

// ---------------------------------------------------------------------------
// Loaders auxiliares
// ---------------------------------------------------------------------------

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

/**
 * Lee los emails asociados a una solicitud desde `doa_emails_v2`.
 * Aliasea `from_addr → from_email`, `to_addr → to_email`, `sent_at → date`
 * para encajar con el shape de `DoaEmail` definido en `types/database.ts`.
 */
async function loadEmails(incomingRequestId: string): Promise<DoaEmail[]> {
  const { data, error } = await supabaseServer
    .from('doa_emails_v2')
    .select(
      `
      id,
      incoming_request_id,
      direction,
      from_email:from_addr,
      to_email:to_addr,
      subject,
      body,
      date:sent_at,
      message_id,
      in_reply_to,
      created_at
    `,
    )
    .eq('incoming_request_id', incomingRequestId)
    .order('sent_at', { ascending: true })

  if (error) {
    console.error('incoming detail: error fetching emails', error)
    return []
  }

  return (data ?? []) as unknown as DoaEmail[]
}

// ---------------------------------------------------------------------------
// Estado "no encontrada"
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

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

  const [clients, contacts, emails] = await Promise.all([
    loadClients(),
    loadClientContacts(),
    loadEmails(id),
  ])

  const clientLookup = buildIncomingClientLookup(clients, contacts)
  const query = toIncomingQuery(data as unknown as IncomingRequest, clientLookup)
  const matchedClient = resolveIncomingClientRecord(query.sender, clients, contacts)

  const clientBadgeLabel =
    query.clientIdentity.kind === 'known'
      ? matchedClient?.name ?? query.clientIdentity.companyName
      : 'Cliente desconocido'

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      <TopBar title={query.codigo} subtitle={query.subject} />

      <div className="flex-1 space-y-6 overflow-y-auto p-6 text-[color:var(--ink)]">
        <Link
          href="/quotations"
          className="inline-flex items-center gap-1.5 text-sm text-[color:var(--ink-3)] transition-colors hover:text-[color:var(--ink-2)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Quotations
        </Link>

        {/* Status pill row: clasificación + estado backend + cliente */}
        <div className="flex flex-wrap items-center gap-2">
          {query.classification ? (
            <span className={cn(pillBaseClass, 'text-[color:var(--ink-3)]')}>
              {query.classification}
            </span>
          ) : null}
          <span className={cn(pillBaseClass, 'text-[color:var(--ink-2)]')}>
            {query.estadoBackend}
          </span>
          <span
            className={cn(
              pillBaseClass,
              query.clientIdentity.kind === 'known'
                ? 'border-emerald-300 bg-emerald-50 text-[color:var(--ok)]'
                : 'text-[color:var(--umber)]',
            )}
          >
            {clientBadgeLabel}
          </span>
        </div>

        {/*
          --- Comunicaciones (single section, warm-executive palette) ---
          Decisión: el compositor de respuestas se oculta (`hideComposer`).
          El componente actual depende solo de `doa_emails_v2`; el envío
          pertenecía a un webhook que ya no existe en este slice.
        */}
        <section className="rounded-[22px] border border-[color:var(--ink-4)] border-l-4 border-l-[color:var(--umber)] bg-[color:var(--paper-2)] shadow-[0_10px_24px_rgba(74,60,36,0.08)]">
          <div className="flex items-center gap-3 border-b border-[color:var(--ink-4)] px-5 py-3.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--umber)]/15">
              <Mail className="h-4 w-4 text-[color:var(--umber)]" />
            </span>
            <h2 className="font-[family-name:var(--font-heading)] text-[18px] font-semibold text-[color:var(--ink)]">
              Comunicaciones
            </h2>
          </div>
          <div className="px-5 py-4">
            <CenterColumnCollapsible
              hideComposer
              emails={emails}
              query={{
                id: query.id,
                codigo: query.codigo,
                subject: query.subject,
                sender: query.sender,
              }}
            />
          </div>
        </section>
      </div>
    </div>
  )
}
