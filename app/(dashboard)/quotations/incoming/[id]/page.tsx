/**
 * ============================================================================
 * PAGINA DE DETALLE DE CONSULTA ENTRANTE — layout completo (placeholders + Comunicaciones)
 * ============================================================================
 * Server component (async). Lee la solicitud entrante de
 * `doa_incoming_requests_v2` y los emails asociados de `doa_emails_v2`.
 *
 * Visualmente recupera el layout antiguo (warm-executive palette): 9 secciones
 * con tarjeta redondeada, borde lateral coloreado, icono e header en la fuente
 * heading. Solo "Comunicaciones" (sección 2) lee data real (`doa_emails_v2`)
 * y monta `<CenterColumnCollapsible>`. Las otras 8 secciones renderizan un
 * placeholder "Próximamente — se reactivará en una fase futura".
 *
 * Si la solicitud no existe o cualquier fetch falla, se renderiza un estado
 * "Solicitud no encontrada".
 * ============================================================================
 */

import Link from 'next/link'
import {
  ArrowLeft,
  ClipboardList,
  FileText,
  type LucideIcon,
  Mail,
  Plane,
  Receipt,
  ScanSearch,
  Settings,
  Sparkles,
  UserRound,
} from 'lucide-react'

import { TopBar } from '@/components/layout/TopBar'
import { supabaseServer } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import type {
  Aircraft,
  Client,
  ClientContact,
  DoaEmail,
  IncomingRequest,
} from '@/types/database'

import { ClientDetailPanel } from '../../../clients/ClientDetailPanel'
import {
  buildIncomingClientLookup,
  resolveIncomingClientRecord,
  toIncomingQuery,
} from '../../incoming-queries'
import { AircraftPanel } from './AircraftPanel'
import { CenterColumnCollapsible } from './CenterColumnCollapsible'
import { TechnicalProjectPanel } from './TechnicalProjectPanel'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Estilos compartidos (mismas convenciones que el board y la lista)
// ---------------------------------------------------------------------------

const pillBaseClass =
  'inline-flex items-center rounded-full border border-[color:var(--line-strong)] bg-[color:var(--paper-2)] px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink)] shadow-[0_1px_0_rgba(255,255,255,0.65)_inset]'

// ---------------------------------------------------------------------------
// Sección reutilizable (chrome de tarjeta + header coloreado + <details>)
// ---------------------------------------------------------------------------

/**
 * Tailwind v4 (JIT) analiza los archivos buscando strings literales de clases.
 * Por eso el mapa de color → clases concretas: si construyésemos los nombres con
 * template literals (p.e. `border-l-[color:var(--${color})]`), Tailwind no los
 * detectaría y el CSS no se emitiría.
 */
type SectionColor = 'umber' | 'cobalt' | 'terracotta' | 'ink-3'

const SECTION_COLOR_CLASSES: Record<SectionColor, { border: string; tint: string; icon: string }> = {
  umber: {
    border: 'border-l-[color:var(--umber)]',
    tint: 'bg-[color:var(--umber)]/15',
    icon: 'text-[color:var(--umber)]',
  },
  cobalt: {
    border: 'border-l-[color:var(--cobalt)]',
    tint: 'bg-[color:var(--cobalt)]/15',
    icon: 'text-[color:var(--cobalt)]',
  },
  terracotta: {
    border: 'border-l-[color:var(--terracotta)]',
    tint: 'bg-[color:var(--terracotta)]/15',
    icon: 'text-[color:var(--terracotta)]',
  },
  'ink-3': {
    border: 'border-l-[color:var(--ink-3)]',
    tint: 'bg-[color:var(--ink-3)]/15',
    icon: 'text-[color:var(--ink-3)]',
  },
}

type SectionProps = {
  title: string
  label: string
  icon: LucideIcon
  color: SectionColor
  defaultOpen?: boolean
  children: React.ReactNode
}

function Section({ title, label, icon: Icon, color, defaultOpen = false, children }: SectionProps) {
  const { border: borderClass, tint: tintClass, icon: iconClass } = SECTION_COLOR_CLASSES[color]

  return (
    <section
      className={cn(
        'rounded-[22px] border border-[color:var(--ink-4)] border-l-4 bg-[color:var(--paper-2)] shadow-[0_10px_24px_rgba(74,60,36,0.08)]',
        borderClass,
      )}
    >
      <div className="flex items-center gap-3 border-b border-[color:var(--ink-4)] px-5 py-3.5">
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-full', tintClass)}>
          <Icon className={cn('h-4 w-4', iconClass)} />
        </span>
        <h2 className="font-[family-name:var(--font-heading)] text-[18px] font-semibold text-[color:var(--ink)]">
          {title}
        </h2>
      </div>
      <details className="group" open={defaultOpen}>
        <summary className="flex cursor-pointer items-center gap-1 px-5 py-3 text-xs font-medium text-[color:var(--ink-3)] hover:text-[color:var(--ink-2)]">
          <svg
            className="h-3.5 w-3.5 transition-transform group-open:rotate-180"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          View {label}
        </summary>
        <div className="px-5 pb-4">{children}</div>
      </details>
    </section>
  )
}

function ComingSoonPlaceholder() {
  return (
    <div className="rounded-2xl border border-dashed border-[color:var(--ink-4)] bg-[color:var(--paper)] px-5 py-12 text-center">
      <p className="text-sm font-medium text-[color:var(--ink-2)]">Coming soon</p>
      <p className="mt-1.5 text-xs text-[color:var(--ink-3)]">
        This section will be reactivated in a future phase.
      </p>
    </div>
  )
}

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
 * Looks up the master TCDS catalog (`public.doa_aircraft`) for every variant
 * whose `tcds_code` matches the incoming request's `tcds_number`. Returns an
 * empty array when there is no `tcds_number` or when no row matches — the
 * panel handles both the "match" and "not found" UI states.
 *
 * Multiple variants of the same TCDS are returned (sorted by `model`) so the
 * panel can show key data of the simplest variant while keeping the rest
 * available for future drill-down.
 */
async function loadAircraftMatches(
  tcdsNumber: string | null | undefined,
): Promise<Aircraft[]> {
  if (!tcdsNumber || tcdsNumber.trim() === '') return []

  const { data, error } = await supabaseServer
    .from('doa_aircraft')
    .select(
      `
      id,
      tcds_code,
      tcds_code_short,
      tcds_issue,
      tcds_date,
      tcds_pdf_url,
      manufacturer,
      country,
      type,
      model,
      engine,
      mtow_kg,
      mlw_kg,
      base_regulation,
      category,
      eligible_msn,
      notes,
      created_at,
      updated_at
      `,
    )
    .eq('tcds_code', tcdsNumber.trim())
    .order('model', { ascending: true })

  if (error) {
    console.error('incoming detail: error fetching aircraft catalog match', error)
    return []
  }

  return (data ?? []) as unknown as Aircraft[]
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
      <TopBar title="Request not found" subtitle={`id: ${id}`} />

      <div className="flex-1 space-y-6 overflow-y-auto p-6 text-[color:var(--ink)]">
        <Link
          href="/quotations"
          className="inline-flex items-center gap-1.5 text-sm text-[color:var(--ink-3)] transition-colors hover:text-[color:var(--ink-2)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Quotations
        </Link>

        <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper-2)] p-8 text-center">
          <h2 className="font-[family-name:var(--font-heading)] text-2xl text-[color:var(--ink)]">
            Request not found
          </h2>
          <p className="mt-2 text-sm text-[color:var(--ink-3)]">
            No request exists with id {id}
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

  const incoming = data as unknown as IncomingRequest

  const [clients, contacts, emails, aircraftMatches] = await Promise.all([
    loadClients(),
    loadClientContacts(),
    loadEmails(id),
    loadAircraftMatches(incoming.tcds_number),
  ])

  const clientLookup = buildIncomingClientLookup(clients, contacts)
  const query = toIncomingQuery(incoming, clientLookup)

  // Resolve linked client. Two pathways:
  //   1) explicit FK `client_id` on the incoming row → trusted link.
  //   2) heuristic from `sender` email → suggested match (legacy / pre-FK rows).
  // We prefer the explicit FK, falling back to the heuristic for legacy rows.
  const linkedClientById = incoming.client_id
    ? clients.find((client) => client.id === incoming.client_id) ?? null
    : null
  const linkedClientWithContacts = linkedClientById
    ? {
        ...linkedClientById,
        contacts: contacts.filter((contact) => contact.client_id === linkedClientById.id),
      }
    : null
  const heuristicClient = resolveIncomingClientRecord(query.sender, clients, contacts)
  const matchedClient = linkedClientWithContacts ?? heuristicClient
  const clientLinkSource: 'fk' | 'heuristic' | null = linkedClientWithContacts
    ? 'fk'
    : heuristicClient
      ? 'heuristic'
      : null
  const senderEmail =
    query.clientIdentity.kind === 'known'
      ? query.clientIdentity.email
      : query.clientIdentity.senderEmail

  const clientBadgeLabel =
    query.clientIdentity.kind === 'known'
      ? matchedClient?.name ?? query.clientIdentity.companyName
      : 'Unknown client'

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      <TopBar title={query.codigo} subtitle={query.subject} />

      <div className="flex-1 space-y-6 overflow-y-auto p-6 text-[color:var(--ink)]">
        <Link
          href="/quotations"
          className="inline-flex items-center gap-1.5 text-sm text-[color:var(--ink-3)] transition-colors hover:text-[color:var(--ink-2)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Quotations
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

        {/* 1. Resumen de revisión — placeholder */}
        <Section
          title="Review summary"
          label="review summary"
          icon={ClipboardList}
          color="cobalt"
          defaultOpen
        >
          <ComingSoonPlaceholder />
        </Section>

        {/* 2. Comunicaciones — REAL DATA (incluye borrador IA en la columna izquierda) */}
        <Section
          title="Communications"
          label="email thread"
          icon={Mail}
          color="umber"
          defaultOpen
        >
          <CenterColumnCollapsible
            emails={emails}
            query={{
              id: query.id,
              codigo: query.codigo,
              subject: query.subject,
              sender: query.sender,
            }}
            aiReply={query.respuestaIa}
            incomingId={query.id}
            clientKind={matchedClient ? 'known' : 'unknown'}
            incomingStatus={(data as { status?: string | null }).status ?? 'new'}
          />
        </Section>

        {/* 3. Datos del cliente — REAL DATA (ClientDetailPanel + suggested-match banner) */}
        <Section title="Client details" label="client details" icon={UserRound} color="cobalt">
          {matchedClient ? (
            <div className="space-y-3">
              {clientLinkSource === 'heuristic' ? (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
                  <span className="font-semibold uppercase tracking-[0.12em]">Possible client:</span>{' '}
                  heuristic match based on sender email. Review and link manually to confirm.
                </div>
              ) : null}
              <ClientDetailPanel client={matchedClient} defaultOpen />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[color:var(--ink-4)] bg-[color:var(--paper)] px-5 py-8 text-center">
              <p className="text-sm font-medium text-[color:var(--ink-2)]">
                No linked client
              </p>
              <p className="mt-1.5 text-xs text-[color:var(--ink-3)]">
                This incoming request has no linked client yet.
              </p>
              {senderEmail ? (
                <p className="mt-3 text-xs text-[color:var(--ink-3)]">
                  Sender: <span className="font-mono">{senderEmail}</span>
                </p>
              ) : null}
            </div>
          )}
        </Section>

        {/* 4. Datos de aircraft — REAL DATA + catalog match */}
        <Section title="Aircraft data" label="aircraft data" icon={Plane} color="terracotta">
          <AircraftPanel incoming={incoming} catalogMatches={aircraftMatches} />
        </Section>

        {/* 5. Datos técnicos del proyecto — REAL DATA */}
        <Section
          title="Project technical data"
          label="technical data"
          icon={Settings}
          color="ink-3"
        >
          <TechnicalProjectPanel incoming={incoming} />
        </Section>

        {/* 6. Alcance preliminar — placeholder */}
        <Section title="Preliminary scope" label="preliminary scope" icon={ScanSearch} color="umber">
          <ComingSoonPlaceholder />
        </Section>

        {/* 7. Documentación — placeholder */}
        <Section title="Documentation" label="documentation" icon={FileText} color="cobalt">
          <ComingSoonPlaceholder />
        </Section>

        {/* 8. Oferta / Quotation — placeholder */}
        <Section title="Quotation" label="quotation" icon={Receipt} color="terracotta">
          <ComingSoonPlaceholder />
        </Section>

        {/* 9. Decisión — placeholder */}
        <Section title="Decision" label="decision panel" icon={Sparkles} color="umber">
          <ComingSoonPlaceholder />
        </Section>
      </div>
    </div>
  )
}
