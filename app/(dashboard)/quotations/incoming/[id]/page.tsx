/**
 * ============================================================================
 * PAGINA DE DETALLE DE CONSULTA ENTRANTE
 * ============================================================================
 *
 * Renderiza vistas diferentes segun el estado (data.estado) de la consulta.
 * Misma URL /quotations/incoming/[id], diferente layout por estado.
 *
 * VIEW 1 — estado "nuevo":
 *   Solo hilo de emails + compositor de respuesta. Limpio, enfocado en el email.
 *
 * VIEW 2 — estado "esperando_formulario":
 *   Banner de espera (amber) + resumen de cliente si se conoce + hilo de emails.
 *
 * VIEW 3 — estado "formulario_recibido" (y cualquier otro estado como default):
 *   1. Resumen de revision
 *   2. Comunicaciones — hilo de emails (colapsable)
 *   3. Datos del cliente (colapsable)
 *   4. Datos de aeronave / TCDS (colapsable)
 *   5. Datos tecnicos del proyecto (colapsable)
 *   6. Definir alcance preliminar
 *   7. Definir documentacion (colapsable)
 *   8. Oferta / Quotation (colapsable)
 *   9. Panel de decision (crear proyecto / solicitar info / rechazar)
 *
 * La barra lateral izquierda de navegacion NO se toca.
 * ============================================================================
 */

import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Building2, Calendar, CheckCircle2, ClipboardList, Clock, FileText, FolderOpen, LayoutGrid, Mail, MapPin, MessageSquarePlus, Plane, Plus, Receipt, Scale, ScanSearch, Search, Settings, Sparkles, UserRound, UserRoundX, XCircle, Zap } from 'lucide-react'

import { TopBar } from '@/components/layout/TopBar'
// import { buildPreliminaryScopeModel } from '@/lib/quotations/build-preliminary-scope-model'
import { ensureConsultaFolder } from '@/lib/quotations/ensure-consulta-folder'
import { syncConsultaEmails } from '@/lib/quotations/sync-consulta-emails'
import { createClient } from '@/lib/supabase/server'
import { escapeIlikePattern, escapeOrFilterLiteral } from '@/lib/supabase/escape-or-filter'
import { CONSULTA_ESTADOS } from '@/lib/workflow-states'
import {
  extractPhase4BaselineFromSummary,
} from '@/lib/project-summary-phase4'
import type { Cliente, ClienteContacto, ConsultaEntrante, DoaEmail } from '@/types/database'

import { ClientDetailPanel } from '../../../clients/ClientDetailPanel'
import {
  buildIncomingClientLookup,
  resolveIncomingClientRecord,
  toIncomingQuery,
} from '../../incoming-queries'
import { QuotationStateSelector } from '../../QuotationStateSelector'
import { codeToColumn, getPreselectedTemplates, type ComplianceTemplate } from '@/lib/compliance-templates'

import { CenterColumnCollapsible } from './CenterColumnCollapsible'
import { ComplianceDocumentsSection } from './ComplianceDocumentsSection'
import { ManualProjectSearch } from './ManualProjectSearch'
// import { PreliminaryScopeChatPanel } from './PreliminaryScopeChatPanel'
// import { PreliminaryScopePanel } from './PreliminaryScopePanel'
import { PreparaProyectoPanel } from './PreparaProyectoPanel'
import { QuotationInfoSection } from './QuotationInfoSection'
import PreliminaryScopeAnalyzer from './PreliminaryScopeAnalyzer'
import ClassificationWorkspaceClient from './ClassificationWorkspaceClient'
import { ReferenceProjectButton } from './ReferenceProjectButton'
import { TcdsStatusBanner } from './TcdsStatusBanner'

// ---------------------------------------------------------------------------
// Sub-componente: Panel de cliente desconocido
// ---------------------------------------------------------------------------

function UnknownClientPanel({ senderEmail }: { senderEmail: string | null }) {
  return (
    <section className="flex h-full min-h-0 flex-col rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
      <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#eef6ff_100%)] px-5 py-4">
        <h2 className="text-base font-semibold text-slate-950">Detalle del cliente</h2>
      </div>
      <div className="flex flex-1 flex-col gap-4 px-5 py-4">
        <div className="rounded-[20px] border border-dashed border-amber-200 bg-[linear-gradient(180deg,#fffaf0_0%,#fff7ed_100%)] px-4 py-5">
          <div className="flex items-start gap-3">
            <UserRoundX className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div>
              <p className="text-sm font-semibold text-slate-950">Cliente desconocido</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Esta consulta todavia no se ha podido vincular con un cliente registrado
                en la base de datos.
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Email remitente
          </p>
          <div className="mt-3 flex items-start gap-3">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <p className="break-all text-sm text-slate-900">
              {senderEmail ?? 'No disponible'}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

type ClientProjectHistoryItem = {
  id: string
  numero_proyecto: string | null
  titulo: string | null
  descripcion: string | null
  estado: string | null
  created_at: string | null
  source: 'active' | 'historic'
}

function formatProjectYear(createdAt: string | null) {
  if (!createdAt) return null
  return new Date(createdAt).getFullYear()
}

function getProjectHistoryHref(project: ClientProjectHistoryItem) {
  return project.source === 'active'
    ? `/engineering/projects/${project.id}`
    : `/proyectos-historico/${project.id}`
}

function ProjectHistoryGroup({
  title,
  source,
  projects,
}: {
  title: string
  source: ClientProjectHistoryItem['source']
  projects: ClientProjectHistoryItem[]
}) {
  if (projects.length === 0) {
    return null
  }

  const sourceBadgeClass =
    source === 'active'
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-slate-200 text-slate-500'
  const statusBadgeClass =
    source === 'active'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-slate-200 bg-white text-slate-600'

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          {title}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
          {projects.length}
        </span>
      </div>

      {projects.map((project) => (
        <div
          key={`${project.source}-${project.id}`}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {project.numero_proyecto && (
                  <span className="inline-block rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700">
                    {project.numero_proyecto}
                  </span>
                )}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${sourceBadgeClass}`}
                >
                  {source === 'active' ? 'Activo' : 'Historico'}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium leading-snug text-slate-900">
                {project.titulo ?? '—'}
              </p>
              {project.created_at && (
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {formatProjectYear(project.created_at)}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {project.estado && (
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass}`}
                >
                  {project.estado}
                </span>
              )}
              <Link
                href={getProjectHistoryHref(project)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700 transition-colors hover:bg-sky-100"
                title={source === 'active' ? 'Abrir proyecto activo' : 'Abrir ficha historica'}
                aria-label={`Abrir ficha de ${project.numero_proyecto}`}
              >
                <Plus className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ClientProjectsPanel({ projects }: { projects: ClientProjectHistoryItem[] }) {
  const activeProjects = projects.filter((project) => project.source === 'active')
  const historicProjects = projects.filter((project) => project.source === 'historic')

  return (
    <section className="rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
      <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f0f9ff_100%)] px-5 py-3">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-sky-600" />
          <h2 className="text-sm font-semibold text-slate-950">Proyectos del cliente</h2>
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
            {projects.length}
          </span>
        </div>
      </div>
      <details className="group">
        <summary className="flex cursor-pointer items-center gap-1 px-5 py-3 text-xs font-medium text-sky-600 hover:text-sky-700">
          <svg className="h-3.5 w-3.5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          Ver proyectos
        </summary>
        <div className="space-y-4 px-5 pb-4">
          {projects.length > 0 ? (
            <>
              <ProjectHistoryGroup title="Activos" source="active" projects={activeProjects} />
              <ProjectHistoryGroup title="Historico" source="historic" projects={historicProjects} />
            </>
          ) : (
            <p className="text-xs italic text-slate-400">
              No se encontraron proyectos para este cliente.
            </p>
          )}
        </div>
      </details>
    </section>
  )
}

function ReviewSummarySection({
  clientLabel,
  aircraftLabel,
  workTypeLabel,
  scheduleLabel,
  documentLabel,
  referencesLabel,
  scopeSummary,
}: {
  clientLabel: string
  aircraftLabel: string
  workTypeLabel: string
  scheduleLabel: string
  documentLabel: string
  referencesLabel: string
  scopeSummary: string
}) {
  const cards = [
    { label: 'Cliente', value: clientLabel },
    { label: 'Aeronave', value: aircraftLabel },
    { label: 'Tipo de trabajo', value: workTypeLabel },
    { label: 'Plazo y prioridad', value: scheduleLabel },
    { label: 'Soporte disponible', value: documentLabel },
    { label: 'Referencias', value: referencesLabel },
  ]

  return (
    <section className="rounded-[22px] border border-sky-200 bg-[linear-gradient(135deg,#ffffff_0%,#f0f9ff_100%)] shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
      <div className="border-b border-sky-200 px-5 py-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-sky-600" />
          <h2 className="text-sm font-semibold text-slate-950">Resumen de revision</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Vista rapida de los datos clave para decidir esta consulta en fase 3.
        </p>
      </div>
      <div className="space-y-4 px-5 py-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2.5"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {card.label}
              </p>
              <p className="mt-1 text-sm font-medium leading-6 text-slate-900">
                {card.value}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white/90 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Alcance enviado
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-700">{scopeSummary}</p>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Componente principal de la pagina
// ---------------------------------------------------------------------------

export default async function IncomingQuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // --- Cargar la consulta ---
  const { data, error } = await supabase
    .from('doa_consultas_entrantes')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,#eff6ff_0%,#f8fbff_34%,#f8fafc_100%)]">
        <TopBar
          title="Detalle de consulta"
          subtitle="Entrada comercial previa a quotation"
        />
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto bg-[radial-gradient(circle_at_top_left,#eff6ff_0%,#f8fbff_34%,#f8fafc_100%)] px-5 pb-8 pt-5">
          <Link
            href="/quotations"
            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a quotations
          </Link>
          <section className="rounded-[34px] border border-sky-100 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_52%,#f8fafc_100%)] p-6 shadow-[0_24px_50px_rgba(14,165,233,0.10)]">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                Consulta no encontrada
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-slate-600">
                {error ? `Error: ${error.message}` : 'No se encontro una consulta con este identificador.'}
              </p>
            </div>
          </section>
        </div>
      </div>
    )
  }

  // --- Crear carpeta de simulacion y sincronizar emails (side-effect, fire-and-forget) ---
  if (data.numero_entrada) {
    ensureConsultaFolder(data.numero_entrada)
      .then(() => syncConsultaEmails(data.numero_entrada!, id))
      .catch((err) => {
        console.error('Error asegurando carpeta / sincronizando emails:', err)
      })
  }

  // --- Cargar emails de doa_emails para esta consulta ---
  const { data: emailRows, error: emailError } = await supabase
    .from('doa_emails')
    .select('*')
    .eq('consulta_id', id)
    .order('fecha', { ascending: true })

  if (emailError) {
    console.error('Error cargando emails de doa_emails:', emailError)
  }

  const emails: DoaEmail[] = (emailRows ?? []) as DoaEmail[]

  // --- Cargar clientes y contactos ---
  const [{ data: clientRows, error: clientError }, { data: contactRows, error: contactError }] =
    await Promise.all([
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

  if (clientError) {
    console.error('Error cargando clientes para la consulta entrante:', clientError)
  }
  if (contactError) {
    console.error('Error cargando contactos para la consulta entrante:', contactError)
  }

  // --- Emparejamiento de cliente ---
  const clients: Cliente[] = clientRows ?? []
  const contacts: ClienteContacto[] = contactRows ?? []
  const clientLookup = buildIncomingClientLookup(clients, contacts)
  const query = toIncomingQuery(data as ConsultaEntrante, clientLookup)
  const matchedClient = resolveIncomingClientRecord(query.remitente, clients, contacts)

  // --- Verificar TCDS en doa_aeronaves ---
  let aeronaveVariants: {
    tcds_code: string
    tcds_code_short: string
    tcds_issue: string
    tcds_date: string
    fabricante: string
    pais: string
    tipo: string
    modelo: string
    motor: string
    mtow_kg: number | null
    mlw_kg: number | null
    regulacion_base: string
    categoria: string
    msn_elegibles: string
    notas: string
  }[] = []
  let tcdsFallbackUsed = false

  if (data.tcds_number) {
    const { data: aeronaveRows } = await supabase
      .from('doa_aeronaves')
      .select('tcds_code, tcds_code_short, tcds_issue, tcds_date, fabricante, pais, tipo, modelo, motor, mtow_kg, mlw_kg, regulacion_base, categoria, msn_elegibles, notas')
      .eq('tcds_code', data.tcds_number)

    if (aeronaveRows && aeronaveRows.length > 0) {
      aeronaveVariants = aeronaveRows
    }
  }

  if (aeronaveVariants.length === 0 && (data.aircraft_model || data.aircraft_manufacturer)) {
    tcdsFallbackUsed = true
    let fallbackQuery = supabase
      .from('doa_aeronaves')
      .select('tcds_code, tcds_code_short, tcds_issue, tcds_date, fabricante, pais, tipo, modelo, motor, mtow_kg, mlw_kg, regulacion_base, categoria, msn_elegibles, notas')

    if (data.aircraft_model) {
      fallbackQuery = fallbackQuery.ilike('modelo', `%${data.aircraft_model}%`)
    } else if (data.aircraft_manufacturer) {
      fallbackQuery = fallbackQuery.ilike('fabricante', `%${data.aircraft_manufacturer}%`)
    }

    const { data: fallbackRows } = await fallbackQuery
    if (fallbackRows && fallbackRows.length > 0) {
      aeronaveVariants = fallbackRows
    }
  }

  // --- Cargar historial de proyectos del cliente ---
  let projectHistory: ClientProjectHistoryItem[] = []
  if (matchedClient) {
    // Defense in depth: matchedClient.id is a UUID and matchedClient.nombre
    // comes from our DB, but the values land inside a PostgREST .or() clause
    // string, so any stray `,`, `(`, `)`, `*`, `%`, `_` would alter the
    // filter. Escape both before interpolation.
    const safeClientId = escapeOrFilterLiteral(matchedClient.id)
    const safeClientNombre = escapeOrFilterLiteral(matchedClient.nombre ?? '')
    const [
      { data: activeRows, error: activeError },
      { data: historyRows, error: historyError },
    ] = await Promise.all([
      supabase
        .from('doa_proyectos')
        .select('id, numero_proyecto, titulo, descripcion, estado, created_at')
        .or(`client_id.eq.${safeClientId},cliente_nombre.ilike.${safeClientNombre}`)
        .order('created_at', { ascending: false }),
      supabase
        .from('doa_proyectos_historico')
        .select('id, numero_proyecto, titulo, descripcion, estado, created_at')
        .eq('client_id', matchedClient.id)
        .order('created_at', { ascending: false }),
    ])

    if (activeError) {
      console.error('Error cargando proyectos activos del cliente:', activeError)
    }
    if (historyError) {
      console.error('Error cargando historial de proyectos del cliente:', historyError)
    }

    const activeProjects = (activeRows ?? []).map((p) => ({ ...p, source: 'active' as const }))
    const historicProjects = (historyRows ?? []).map((p) => ({ ...p, source: 'historic' as const }))

    const seen = new Set<string>()
    const combined: typeof projectHistory = []
    for (const p of [...activeProjects, ...historicProjects]) {
      const key = p.numero_proyecto ?? p.id
      if (!seen.has(key)) {
        seen.add(key)
        combined.push(p)
      }
    }

    combined.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
      return dateB - dateA
    })

    projectHistory = combined
  }

  // --- Proyectos marcados como referencia ---
  const currentRefs: string[] = Array.isArray(data.proyectos_referencia)
    ? data.proyectos_referencia
    : []

  // Cargar datos completos de los proyectos referencia para la comparacion
  type RefProject = {
    id: string
    baseline: ReturnType<typeof extractPhase4BaselineFromSummary>
    numero_proyecto: string | null
    titulo: string | null
    descripcion: string | null
    estado: string | null
    aeronave: string | null
    msn: string | null
    cliente_nombre: string | null
    anio: number | null
    created_at: string | null
    summary_md: string | null
  }
  let referenceProjects: RefProject[] = []
  if (currentRefs.length > 0) {
    const { data: refRows } = await supabase
      .from('doa_proyectos_historico')
      .select('id, numero_proyecto, titulo, descripcion, estado, aeronave, msn, cliente_nombre, anio, created_at, summary_md')
      .in('id', currentRefs)
    const refOrder = new Map(currentRefs.map((refId, index) => [refId, index]))
    referenceProjects =
      (refRows?.map((project) => ({
        ...project,
        baseline: extractPhase4BaselineFromSummary(project.summary_md, {
          aircraftLabel: project.aeronave,
          projectCode: project.numero_proyecto,
          projectTitle: project.titulo,
        }),
      })) ?? []).sort(
        (left, right) =>
          (refOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
          (refOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER),
      )
  }

  // --- Plantillas de compliance (desde BD) y pre-seleccion por referencia ---
  const { data: templateRows } = await supabase
    .from('doa_plantillas_compliance')
    .select('code, name, category')
    .eq('active', true)
    .order('category')
    .order('sort_order')

  const complianceTemplates: ComplianceTemplate[] = (templateRows ?? []).map((r) => ({
    code: r.code,
    name: r.name,
    category: r.category as ComplianceTemplate['category'],
  }))

  // Documentos del proyecto referencia → familias → codigos pre-seleccionados
  let preselectedComplianceCodes: string[] = []
  if (currentRefs.length > 0) {
    const { data: refDocRows } = await supabase
      .from('doa_proyectos_historico_documentos')
      .select('familia_documental')
      .in('proyecto_id', currentRefs)

    if (refDocRows && refDocRows.length > 0) {
      const familias = [...new Set(refDocRows.map((d) => d.familia_documental).filter(Boolean))]
      preselectedComplianceCodes = getPreselectedTemplates(familias)
    }
  }

  // Seleccion guardada previamente por el ingeniero (columnas booleanas doc_g12_xx)
  const savedComplianceCodes: string[] = complianceTemplates
    .filter((t) => {
      const col = codeToColumn(t.code)
      return (data as Record<string, unknown>)[col] === true
    })
    .map((t) => t.code)

  // --- Buscar proyectos similares basados en datos tecnicos ---
  // Solo busca en doa_proyectos_historico (cerrados). Filtra palabras genericas
  // del dominio aeronautico para buscar por terminos especificos (ej: "rack",
  // "antenna", "STC") y no por genericos (ej: "installation", "modification").
  let similarProjects: { id: string; numero_proyecto: string | null; titulo: string | null; descripcion: string | null; estado: string | null; created_at: string | null; source: 'active' | 'historic'; matchedKeywords: string[] }[] = []
  const hasTechnicalData = !!(data.modification_summary || data.subject)
  const senderEmail =
    query.clientIdentity.kind === 'unknown'
      ? query.clientIdentity.senderEmail
      : query.clientIdentity.email
  const activeProjectCount = projectHistory.filter((project) => project.source === 'active').length
  const historicProjectCount = projectHistory.filter((project) => project.source === 'historic').length
  const matchedAircraftVariant = data.aircraft_model
    ? aeronaveVariants.find(
        (variant) => variant.modelo.toLowerCase() === data.aircraft_model!.toLowerCase(),
      ) ?? null
    : null
  const primaryAircraftVariant = matchedAircraftVariant ?? aeronaveVariants[0] ?? null
  const hasAircraftData = Boolean(
    data.aircraft_manufacturer ||
      data.aircraft_model ||
      data.aircraft_count ||
      data.aircraft_msn ||
      data.tcds_number ||
      data.tcds_pdf_url ||
      aeronaveVariants.length > 0,
  )
  const shouldShowTcdsReview =
    Boolean(data.tcds_number) ||
    Boolean(data.tcds_pdf_url) ||
    aeronaveVariants.length > 0 ||
    tcdsFallbackUsed
  const reviewClientLabel = matchedClient?.nombre ?? senderEmail ?? 'Cliente no identificado'
  const reviewAircraftLabel =
    [data.aircraft_manufacturer, data.aircraft_model].filter(Boolean).join(' ') ||
    'Pendiente de validar'
  const reviewWorkTypeLabel =
    data.work_type === 'proyecto_nuevo'
      ? 'Proyecto nuevo'
      : data.work_type === 'modificacion_existente'
        ? `Modificacion de existente${data.existing_project_code ? ` (${data.existing_project_code})` : ''}`
        : 'Sin definir'
  const reviewScheduleLabel =
    data.is_aog === 'si'
      ? 'AOG / urgente'
      : data.target_date
        ? new Intl.DateTimeFormat('es-ES', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          }).format(new Date(data.target_date))
        : 'Sin fecha objetivo'
  const reviewDocumentLabel = [
    `Planos: ${data.has_drawings === 'si' ? 'si' : data.has_drawings === 'no' ? 'no' : 'sin dato'}`,
    `OEM: ${data.has_manufacturer_docs === 'si' ? 'si' : data.has_manufacturer_docs === 'no' ? 'no' : 'sin dato'}`,
  ].join(' | ')
  const reviewReferencesLabel = [
    `${activeProjectCount} activos`,
    `${historicProjectCount} historicos`,
    `${referenceProjects.length} referencias marcadas`,
  ].join(' | ')
  const reviewScopeSummary =
    data.modification_summary ??
    data.operational_goal ??
    data.subject ??
    query.asunto ??
    'Sin descripcion tecnica recibida.'
  // const preliminaryScopeModel = buildPreliminaryScopeModel({
  //   clientLabel: reviewClientLabel,
  //   consultation: data,
  //   primaryAircraftVariant,
  //   referenceProjects,
  // })

  if (hasTechnicalData) {
    // Palabras comunes en ingles/español que no aportan especificidad
    const generalStopWords = new Set([
      'in', 'of', 'a', 'the', 'and', 'for', 'to', 'on', 'is', 'it', 'at', 'by',
      'el', 'la', 'de', 'en', 'un', 'una', 'del', 'los', 'las', 'por', 'para',
      'con', 'que', 'se', 'no', 'es', 'al', 'lo', 'su', 'como', 'this', 'that',
      'with', 'from', 'are', 'was', 'will', 'be', 'has', 'have', 'been', 'which',
      'must', 'inside', 'outside', 'also', 'into', 'about', 'more', 'than', 'can',
      'new', 'per', 'its', 'but', 'not', 'all', 'any', 'may', 'other', 'each',
    ])

    // Palabras genericas del dominio aeronautico — demasiado comunes para filtrar
    const domainStopWords = new Set([
      'installation', 'install', 'installed', 'installing',
      'modification', 'modify', 'modified', 'modifying',
      'repair', 'repaired', 'repairing',
      'design', 'designed', 'designing',
      'project', 'proyecto', 'projects', 'proyectos',
      'provide', 'provided', 'providing',
      'equipment', 'system', 'systems', 'component', 'components',
      'aircraft', 'airplane', 'aeronave', 'avion',
      'approval', 'approved', 'certificate', 'certification',
      'compliance', 'compliant', 'requirement', 'requirements',
      'minor', 'major', 'mod', 'nuevo', 'nueva', 'new',
      'cabin', 'within', 'area', 'zone', 'section',
      'data', 'document', 'documentation', 'report',
      'part', 'parts', 'number', 'serial',
      'needs', 'need', 'necesita', 'required',
    ])

    const isStopWord = (w: string) => generalStopWords.has(w) || domainStopWords.has(w)

    const text = `${data.modification_summary ?? ''} ${data.subject ?? ''}`.toLowerCase()
    const allWords = text
      .split(/\s+/)
      .map((w) => w.replace(/[^a-záéíóúñü0-9-]/gi, ''))
      .filter((w) => w.length > 2)

    // Separar en especificos (no stop) y genericos (domain stop)
    const specificKeywords = [...new Set(allWords.filter((w) => !isStopWord(w)))].slice(0, 5)
    // Si no hay especificos, usar los genericos de dominio como fallback
    const fallbackKeywords = [...new Set(allWords.filter((w) => !generalStopWords.has(w) && domainStopWords.has(w)))].slice(0, 3)
    const searchKeywords = specificKeywords.length > 0 ? specificKeywords : fallbackKeywords

    // Defense in depth: keywords are already regex-sanitized above, but
    // pass them through escapeIlikePattern as well so any character that
    // would break PostgREST `.or()` parsing (`,`, `(`, `)`, `*`, `%`, `_`)
    // is dropped or escaped. Also cap each keyword length and the total
    // number of clauses to avoid runaway filters.
    const MAX_KEYWORD_LENGTH = 50
    const MAX_OR_CLAUSES = 20
    const safeKeywords = searchKeywords
      .map((kw) => escapeIlikePattern(kw).slice(0, MAX_KEYWORD_LENGTH))
      .filter((kw) => kw.length > 0)

    const orClauses = safeKeywords
      .flatMap((kw) => [`titulo.ilike.%${kw}%`, `descripcion.ilike.%${kw}%`])
      .slice(0, MAX_OR_CLAUSES)

    if (orClauses.length > 0) {
      const orFilters = orClauses.join(',')

      // Solo buscamos en proyectos historicos (cerrados)
      const { data: simHistRows, error: simHistError } = await supabase
        .from('doa_proyectos_historico')
        .select('id, numero_proyecto, titulo, descripcion, estado, created_at')
        .or(orFilters)
        .order('created_at', { ascending: false })
        .limit(10)

      if (simHistError) {
        console.error('Error buscando proyectos similares historicos:', simHistError)
      }

      const seenSimilar = new Set<string>()
      const combinedSimilar: typeof similarProjects = []

      for (const p of (simHistRows ?? [])) {
        const key = p.numero_proyecto ?? p.id
        if (seenSimilar.has(key)) continue
        seenSimilar.add(key)

        const titleLower = (p.titulo ?? '').toLowerCase()
        const descLower = (p.descripcion ?? '').toLowerCase()
        const matched = searchKeywords.filter(
          (kw) => titleLower.includes(kw) || descLower.includes(kw),
        )

        combinedSimilar.push({ ...p, source: 'historic' as const, matchedKeywords: matched })
      }

      // Ordenar por relevancia (mas keywords coinciden = primero), luego por fecha
      combinedSimilar.sort((a, b) => {
        const diff = b.matchedKeywords.length - a.matchedKeywords.length
        if (diff !== 0) return diff
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
        return dateB - dateA
      })

      similarProjects = combinedSimilar.slice(0, 10)
    }
  }

  // =========================================================================
  // RENDERIZADO — Layout de columna unica con 4 secciones apiladas
  // =========================================================================

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,#eff6ff_0%,#f8fbff_34%,#f8fafc_100%)]">
      <TopBar
        title="Detalle de consulta"
        subtitle="Entrada comercial previa a quotation"
      />

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto bg-[radial-gradient(circle_at_top_left,#eff6ff_0%,#f8fbff_34%,#f8fafc_100%)] px-5 pb-8 pt-5">
        {/* --- BARRA DE NAVEGACION --- */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/quotations"
            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a quotations
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/85 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 shadow-sm">
            <ScanSearch className="h-3.5 w-3.5" />
            Consulta entrante
          </div>
        </div>

        {/* --- CABECERA PRINCIPAL --- */}
        <section className="rounded-[34px] border border-sky-100 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_52%,#f8fafc_100%)] p-6 shadow-[0_24px_50px_rgba(14,165,233,0.10)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="font-mono text-xs text-slate-500">{query.codigo}</p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                {query.asunto}
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-slate-600">
                {data.estado === CONSULTA_ESTADOS.NUEVO
                  ? 'Consulta recien recibida. Revisa el email y prepara la respuesta al cliente.'
                  : data.estado === CONSULTA_ESTADOS.ESPERANDO_FORMULARIO
                    ? 'Formulario enviado al cliente. Esperando su respuesta.'
                    : 'Formulario recibido. Revisa toda la informacion para tomar una decision.'}
              </p>
            </div>
            <div className="shrink-0 pt-1">
              <QuotationStateSelector
                consultaId={query.id}
                consultaCodigo={query.codigo}
                currentEstado={data.estado ?? 'entrada_recibida'}
              />
            </div>
          </div>
        </section>

        {/* ================================================================
            VIEW 1: NUEVO — Email thread + reply composer + client info
            ================================================================ */}
        {data.estado === CONSULTA_ESTADOS.NUEVO && (
          <>
          <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
            <CenterColumnCollapsible
              emails={emails}
              query={{
                id: query.id,
                codigo: query.codigo,
                asunto: query.asunto,
                remitente: query.remitente,
                urlFormulario: query.urlFormulario,
                clasificacion: query.clasificacion,
                cuerpoOriginal: query.cuerpoOriginal,
                respuestaIa: query.respuestaIa,
                creadoEn: data.created_at,
                correoClienteEnviadoAt: data.correo_cliente_enviado_at ?? null,
                correoClienteEnviadoBy: data.correo_cliente_enviado_by ?? null,
                ultimoBorradorCliente: data.ultimo_borrador_cliente ?? null,
                replyBody: data.reply_body ?? null,
                replySentAt: data.reply_sent_at ?? null,
              }}
            />
          </section>

          {/* Cliente + Proyectos del cliente (50/50) */}
          {matchedClient ? (
            <div className="grid gap-5 lg:grid-cols-2">
              <ClientDetailPanel client={matchedClient} />
              <section className="rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
                <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f0f9ff_100%)] px-5 py-3">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-sky-600" />
                    <h2 className="text-sm font-semibold text-slate-950">Proyectos del cliente</h2>
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                      {projectHistory.length}
                    </span>
                  </div>
                </div>
                <details className="group">
                  <summary className="flex cursor-pointer items-center gap-1 px-5 py-3 text-xs font-medium text-sky-600 hover:text-sky-700">
                    <svg className="h-3.5 w-3.5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    Ver proyectos
                  </summary>
                  <div className="space-y-2 px-5 pb-4">
                    {projectHistory.length > 0 ? (
                      projectHistory.map((project) => (
                        <div key={`${project.source}-${project.id}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {project.numero_proyecto && (
                                  <span className="inline-block rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700">
                                    {project.numero_proyecto}
                                  </span>
                                )}
                                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                                  project.source === 'active'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-slate-200 text-slate-500'
                                }`}>
                                  Historico
                                </span>
                              </div>
                              <p className="mt-1 text-sm font-medium leading-snug text-slate-900">{project.titulo ?? '—'}</p>
                              {project.created_at && (
                                <p className="mt-0.5 text-[10px] text-slate-400">
                                  {new Date(project.created_at).getFullYear()}
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {project.estado && (
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                  project.source === 'active'
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border-slate-200 bg-white text-slate-600'
                                }`}>
                                  {project.estado}
                                </span>
                              )}
                              <Link
                                href={`/proyectos-historico/${project.id}`}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700 transition-colors hover:bg-sky-100"
                                title="Abrir ficha"
                                aria-label={`Abrir ficha de ${project.numero_proyecto}`}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </Link>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs italic text-slate-400">No se encontraron proyectos para este cliente.</p>
                    )}
                  </div>
                </details>
              </section>
            </div>
          ) : (
            <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
              <div className="flex items-start gap-3 rounded-xl border border-dashed border-amber-200 bg-amber-50/50 px-4 py-3">
                <UserRoundX className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-sm text-amber-800">
                  Cliente no identificado — se registrara con el formulario
                </p>
              </div>
            </section>
          )}
          </>
        )}

        {/* ================================================================
            VIEW 2: ESPERANDO FORMULARIO — Email thread + waiting banner
            ================================================================ */}
        {data.estado === CONSULTA_ESTADOS.ESPERANDO_FORMULARIO && (
          <>
            {/* Hilo de emails (con respuesta enviada visible, sin compositor) */}
            <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
              <CenterColumnCollapsible
                hideComposer
                emails={emails}
                query={{
                  id: query.id,
                  codigo: query.codigo,
                  asunto: query.asunto,
                  remitente: query.remitente,
                  urlFormulario: query.urlFormulario,
                  clasificacion: query.clasificacion,
                  cuerpoOriginal: query.cuerpoOriginal,
                  respuestaIa: query.respuestaIa,
                  creadoEn: data.created_at,
                  correoClienteEnviadoAt: data.correo_cliente_enviado_at ?? null,
                  correoClienteEnviadoBy: data.correo_cliente_enviado_by ?? null,
                  ultimoBorradorCliente: data.ultimo_borrador_cliente ?? null,
                  replyBody: data.reply_body ?? null,
                  replySentAt: data.reply_sent_at ?? null,
                }}
              />
            </section>

            {/* Banner de espera */}
            <section className="rounded-[22px] border-2 border-amber-300 bg-[linear-gradient(135deg,#fffbeb_0%,#fef3c7_50%,#fffbeb_100%)] p-5 shadow-[0_10px_24px_rgba(217,179,16,0.12)]">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-300 bg-amber-100">
                  <Clock className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-amber-900">
                    Esperando respuesta del formulario del cliente
                  </h2>
                  <p className="mt-0.5 text-sm text-amber-700">
                    Se envio el formulario de toma de datos. Cuando el cliente lo complete,
                    la consulta avanzara automaticamente al siguiente paso.
                  </p>
                  {data.correo_cliente_enviado_at && (
                    <p className="mt-1 text-xs text-amber-600">
                      Formulario enviado el{' '}
                      {new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(data.correo_cliente_enviado_at))}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Cliente + Proyectos del cliente (50/50) */}
            {matchedClient ? (
              <div className="grid gap-5 lg:grid-cols-2">
                <ClientDetailPanel client={matchedClient} />
                <section className="rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
                  <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f0f9ff_100%)] px-5 py-3">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-sky-600" />
                      <h2 className="text-sm font-semibold text-slate-950">Proyectos del cliente</h2>
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                        {projectHistory.length}
                      </span>
                    </div>
                  </div>
                  <details className="group">
                    <summary className="flex cursor-pointer items-center gap-1 px-5 py-3 text-xs font-medium text-sky-600 hover:text-sky-700">
                      <svg className="h-3.5 w-3.5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                      Ver proyectos
                    </summary>
                    <div className="space-y-2 px-5 pb-4">
                      {projectHistory.length > 0 ? (
                        projectHistory.map((project) => (
                          <div key={`${project.source}-${project.id}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {project.numero_proyecto && (
                                    <span className="inline-block rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700">
                                      {project.numero_proyecto}
                                    </span>
                                  )}
                                  <span className={"rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500"}>
                                    Historico
                                  </span>
                                </div>
                                <p className="mt-1 text-sm font-medium leading-snug text-slate-900">{project.titulo ?? '—'}</p>
                                {project.created_at && (
                                  <p className="mt-0.5 text-[10px] text-slate-400">
                                    {new Date(project.created_at).getFullYear()}
                                  </p>
                                )}
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                {project.estado && (
                                  <span className={"rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600"}>
                                    {project.estado}
                                  </span>
                                )}
                                <Link
                                  href={`/proyectos-historico/${project.id}`}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700 transition-colors hover:bg-sky-100"
                                  title="Abrir ficha"
                                  aria-label={`Abrir ficha de ${project.numero_proyecto}`}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </Link>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs italic text-slate-400">No se encontraron proyectos para este cliente.</p>
                      )}
                    </div>
                  </details>
                </section>
              </div>
            ) : (
              <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
                <div className="flex items-start gap-3 rounded-xl border border-dashed border-amber-200 bg-amber-50/50 px-4 py-3">
                  <UserRoundX className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <p className="text-sm text-amber-800">
                    Cliente no identificado — se registrara con el formulario
                  </p>
                </div>
              </section>
            )}
          </>
        )}

        {/* ================================================================
            VIEW 3: FORMULARIO RECIBIDO (+ default for any other estado)
            Full review layout with all sections
            ================================================================ */}
        {data.estado !== CONSULTA_ESTADOS.NUEVO && data.estado !== CONSULTA_ESTADOS.ESPERANDO_FORMULARIO && (
          <>
            <ReviewSummarySection
              clientLabel={reviewClientLabel}
              aircraftLabel={reviewAircraftLabel}
              workTypeLabel={reviewWorkTypeLabel}
              scheduleLabel={reviewScheduleLabel}
              documentLabel={reviewDocumentLabel}
              referencesLabel={reviewReferencesLabel}
              scopeSummary={reviewScopeSummary}
            />

            {/* --- Comunicaciones (ancho completo, colapsable) --- */}
            <section className="rounded-[22px] border border-indigo-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
              <div className="border-b border-indigo-200 bg-[linear-gradient(135deg,#ffffff_0%,#eef2ff_100%)] px-5 py-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-indigo-600" />
                  <h2 className="text-sm font-semibold text-slate-950">Comunicaciones</h2>
                </div>
              </div>
              <details className="group">
                <summary className="flex cursor-pointer items-center gap-1 px-5 py-3 text-xs font-medium text-indigo-600 hover:text-indigo-700">
                  <svg className="h-3.5 w-3.5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  Ver hilo de emails
                </summary>
                <div className="px-5 pb-4">
                  <CenterColumnCollapsible
                    hideComposer
                    emails={emails}
                    query={{
                      id: query.id,
                      codigo: query.codigo,
                      asunto: query.asunto,
                      remitente: query.remitente,
                      urlFormulario: query.urlFormulario,
                      clasificacion: query.clasificacion,
                      cuerpoOriginal: query.cuerpoOriginal,
                      respuestaIa: query.respuestaIa,
                      creadoEn: data.created_at,
                      correoClienteEnviadoAt: data.correo_cliente_enviado_at ?? null,
                      correoClienteEnviadoBy: data.correo_cliente_enviado_by ?? null,
                      ultimoBorradorCliente: data.ultimo_borrador_cliente ?? null,
                      replyBody: data.reply_body ?? null,
                      replySentAt: data.reply_sent_at ?? null,
                    }}
                  />
                </div>
              </details>
            </section>

            {/* --- Datos del cliente (ancho completo, colapsable) --- */}
            <section className="rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
              <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f0f9ff_100%)] px-5 py-3">
                <div className="flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-sky-600" />
                  <h2 className="text-sm font-semibold text-slate-950">Datos del cliente</h2>
                </div>
              </div>
              <details className="group">
                <summary className="flex cursor-pointer items-center gap-1 px-5 py-3 text-xs font-medium text-sky-600 hover:text-sky-700">
                  <svg className="h-3.5 w-3.5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  Ver datos del cliente
                </summary>
                <div className="space-y-5 px-5 pb-4">
            <div className="grid gap-5 lg:grid-cols-2">
              {matchedClient ? (
                <ClientDetailPanel client={matchedClient} />
              ) : (
                <UnknownClientPanel
                  senderEmail={senderEmail}
                />
              )}

              {matchedClient ? (
                <>
                  <ClientProjectsPanel projects={projectHistory} />
                  {false && (
                <section className="rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
                  <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f0f9ff_100%)] px-5 py-3">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-sky-600" />
                      <h2 className="text-sm font-semibold text-slate-950">Proyectos del cliente</h2>
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                        {projectHistory.length}
                      </span>
                    </div>
                  </div>
                  <details className="group">
                    <summary className="flex cursor-pointer items-center gap-1 px-5 py-3 text-xs font-medium text-sky-600 hover:text-sky-700">
                      <svg className="h-3.5 w-3.5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                      Ver proyectos
                    </summary>
                    <div className="space-y-2 px-5 pb-4">
                      {projectHistory.length > 0 ? (
                        projectHistory.map((project) => (
                          <div key={`${project.source}-${project.id}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {project.numero_proyecto && (
                                    <span className="inline-block rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700">
                                      {project.numero_proyecto}
                                    </span>
                                  )}
                                  <span className={"rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500"}>
                                    Historico
                                  </span>
                                </div>
                                <p className="mt-1 text-sm font-medium leading-snug text-slate-900">{project.titulo ?? '—'}</p>
                                {project.created_at && (
                                  <p className="mt-0.5 text-[10px] text-slate-400">
                                    {new Date(project.created_at).getFullYear()}
                                  </p>
                                )}
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                {project.estado && (
                                  <span className={"rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600"}>
                                    {project.estado}
                                  </span>
                                )}
                                <Link
                                  href={`/proyectos-historico/${project.id}`}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700 transition-colors hover:bg-sky-100"
                                  title="Abrir ficha"
                                  aria-label={`Abrir ficha de ${project.numero_proyecto}`}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </Link>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs italic text-slate-400">No se encontraron proyectos para este cliente.</p>
                      )}
                    </div>
                  </details>
                </section>
                  )}
                </>
              ) : (
                <section className="flex items-center justify-center rounded-[22px] border-2 border-dashed border-slate-200 bg-slate-50/50 p-8">
                  <div className="text-center">
                    <FolderOpen className="mx-auto h-6 w-6 text-slate-300" />
                    <p className="mt-2 text-sm font-medium text-slate-400">Proyectos del cliente</p>
                    <p className="mt-1 text-xs text-slate-300">
                      Se mostraran cuando se identifique al cliente
                    </p>
                  </div>
                </section>
              )}
            </div>
                </div>
              </details>
            </section>

            {/* --- Datos de aeronave / TCDS (ancho completo) --- */}
            <section className="rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
              <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f0f9ff_100%)] px-5 py-3">
                <div className="flex items-center gap-2">
                  <Plane className="h-4 w-4 text-sky-600" />
                  <h2 className="text-sm font-semibold text-slate-950">Datos de aeronave</h2>
                </div>
              </div>
              <details className="group">
                <summary className="flex cursor-pointer items-center gap-1 px-5 py-3 text-xs font-medium text-sky-600 hover:text-sky-700">
                  <svg className="h-3.5 w-3.5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  Ver datos de aeronave
                </summary>
                <div className="space-y-3 px-5 pb-4">
                  {hasAircraftData ? (
                    <>
                      {/* Datos enviados por el cliente */}
                      <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-slate-200 bg-white p-3 text-sm">
                        <div className="col-span-2 mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">Datos del formulario</div>
                        {data.aircraft_manufacturer && (
                          <div>
                            <span className="text-slate-500">Fabricante</span>
                            <p className="text-slate-900">{data.aircraft_manufacturer}</p>
                          </div>
                        )}
                        {data.aircraft_model && (
                          <div>
                            <span className="text-slate-500">Modelo</span>
                            <p className="text-slate-900">{data.aircraft_model}</p>
                          </div>
                        )}
                        {data.aircraft_count && (
                          <div>
                            <span className="text-slate-500">Cantidad de aeronaves</span>
                            <p className="text-slate-900">{data.aircraft_count}</p>
                          </div>
                        )}
                        {data.aircraft_msn && (
                          <div>
                            <span className="text-slate-500">MSN / Registro</span>
                            <p className="text-slate-900">{data.aircraft_msn}</p>
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Revision TCDS
                          </p>
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            {aeronaveVariants.length} variante{aeronaveVariants.length === 1 ? '' : 's'} encontrada{aeronaveVariants.length === 1 ? '' : 's'}
                          </span>
                        </div>

                        <div className="mt-3 space-y-3">
                          {shouldShowTcdsReview ? (
                            <TcdsStatusBanner
                              found={aeronaveVariants.length > 0}
                              tcdsNumber={data.tcds_number}
                              tcdsPdfUrl={data.tcds_pdf_url}
                              variants={aeronaveVariants}
                              fallbackUsed={tcdsFallbackUsed}
                              aircraftModel={data.aircraft_model ?? null}
                            />
                          ) : (
                            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3">
                              <p className="text-sm font-medium text-slate-700">
                                Sin revision TCDS disponible todavia.
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                El operador puede validar el TCDS mas adelante con los datos de aeronave ya recibidos.
                              </p>
                            </div>
                          )}

                          {(primaryAircraftVariant || data.tcds_pdf_url) && (
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Variante usada para revisar</p>
                                <p className="mt-0.5 text-sm font-medium text-slate-900">
                                  {primaryAircraftVariant?.modelo ?? 'Pendiente'}
                                </p>
                              </div>
                              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">MTOW</p>
                                <p className="mt-0.5 text-sm font-medium text-slate-900">
                                  {primaryAircraftVariant?.mtow_kg != null
                                    ? `${primaryAircraftVariant.mtow_kg.toLocaleString()} kg`
                                    : '—'}
                                </p>
                              </div>
                              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Referencia para revisar</p>
                                {data.tcds_pdf_url ? (
                                  <a
                                    href={data.tcds_pdf_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-0.5 inline-flex text-sm font-medium text-sky-700 underline hover:text-sky-800"
                                  >
                                    Abrir PDF enviado
                                  </a>
                                ) : (
                                  <p className="mt-0.5 text-sm font-medium text-slate-900">
                                    {primaryAircraftVariant?.tcds_code ?? '—'}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {false && (
                    <>
                      <TcdsStatusBanner
                        found={aeronaveVariants.length > 0}
                        tcdsNumber={data.tcds_number}
                        tcdsPdfUrl={data.tcds_pdf_url}
                        variants={aeronaveVariants}
                        fallbackUsed={tcdsFallbackUsed}
                        aircraftModel={data.aircraft_model ?? null}
                      />
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">TCDS Number</p>
                          <p className="mt-0.5 text-sm font-medium text-slate-900">{data.tcds_number}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Fabricante</p>
                          <p className="mt-0.5 text-sm font-medium text-slate-900">{data.aircraft_manufacturer ?? '—'}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Modelo</p>
                          <p className="mt-0.5 text-sm font-medium text-slate-900">{data.aircraft_model ?? '—'}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Cantidad de aeronaves</p>
                          <p className="mt-0.5 text-sm font-medium text-slate-900">{data.aircraft_count ?? '—'}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">MSN</p>
                          <p className="mt-0.5 text-sm font-medium text-slate-900">{data.aircraft_msn ?? '—'}</p>
                        </div>
                        {data.tcds_pdf_url && (
                          <a
                            href={data.tcds_pdf_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-100"
                          >
                            Descargar TCDS PDF
                          </a>
                        )}
                      </div>
                    </>
                      )}

                      {data.aircraft_location && (
                        <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                          <MapPin className="h-4 w-4 text-slate-400" />
                          <span>Ubicación: {data.aircraft_location}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs italic text-slate-400">No se han enviado datos de aeronave todavia.</p>
                  )}
                </div>
              </details>
            </section>

            {/* --- Datos tecnicos del Proyecto (ancho completo, colapsable) --- */}
            <section className="rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
              <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f0f9ff_100%)] px-5 py-3">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-sky-600" />
                  <h2 className="text-sm font-semibold text-slate-950">Datos técnicos del Proyecto</h2>
                </div>
              </div>
              <details className="group">
                <summary className="flex cursor-pointer items-center gap-1 px-5 py-3 text-xs font-medium text-sky-600 hover:text-sky-700">
                  <svg className="h-3.5 w-3.5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  Ver datos técnicos
                </summary>
                <div className="px-5 pb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">

                    {/* ── 1. General (full width) ── */}
                    <div className="md:col-span-2 rounded-xl border border-sky-200/60 border-l-4 border-l-sky-400 bg-sky-50/50 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <FileText className="h-5 w-5 text-sky-600" />
                        <h4 className="text-sm font-bold uppercase tracking-wider text-sky-700">General</h4>
                      </div>
                      {(data.work_type || data.modification_summary || data.operational_goal) ? (
                        <div className="space-y-2">
                          {data.work_type && (
                            <div>
                              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Tipo de trabajo</span>
                              <p className="mt-0.5 text-sm text-slate-900">
                                {data.work_type === 'proyecto_nuevo' ? 'Proyecto nuevo' : data.work_type === 'modificacion_existente' ? 'Modificación a proyecto existente' : data.work_type}
                                {data.existing_project_code && (
                                  <span className="ml-2 text-xs text-slate-500">({data.existing_project_code})</span>
                                )}
                              </p>
                            </div>
                          )}
                          {data.modification_summary && (
                            <div>
                              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Descripción</span>
                              <p className="mt-0.5 text-sm text-slate-900">{data.modification_summary}</p>
                            </div>
                          )}
                          {data.operational_goal && (
                            <div>
                              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Objetivo operativo</span>
                              <p className="mt-0.5 text-sm text-slate-900">{data.operational_goal}</p>
                            </div>
                          )}
                          {data.additional_notes && (
                            <div>
                              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Notas adicionales</span>
                              <p className="mt-0.5 text-sm text-slate-600">{data.additional_notes}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">Sin datos</p>
                      )}
                    </div>

                    {/* ── 2. Estructural ── */}
                    <div className="rounded-xl border border-orange-200/60 border-l-4 border-l-orange-400 bg-orange-50/50 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-orange-600" />
                        <h4 className="text-sm font-bold uppercase tracking-wider text-orange-700">Estructural</h4>
                      </div>
                      {(data.impact_location || data.fuselage_position || data.sta_location || data.impact_structural_attachment || data.impact_structural_interface || data.affects_primary_structure) ? (
                        <div className="space-y-1.5">
                          {data.impact_location && (
                            <div className="flex items-start justify-between gap-2 text-sm">
                              <span className="text-slate-500">Ubicación</span>
                              <span className="text-right text-slate-900">
                                {data.impact_location === 'interior_cabin' ? 'Interior / Cabina' : data.impact_location === 'exterior_fuselage' ? 'Exterior / Fuselaje' : data.impact_location === 'cockpit' ? 'Cockpit / Flight deck' : data.impact_location === 'cargo_hold' ? 'Cargo hold / Belly' : data.impact_location === 'wing' ? 'Wing' : data.impact_location === 'empennage' ? 'Empennage / Tail' : data.impact_location === 'engine_area' ? 'Engine / Nacelle area' : data.impact_location === 'landing_gear' ? 'Landing gear area' : data.impact_location === 'other' ? 'Other' : data.impact_location}
                              </span>
                            </div>
                          )}
                          {data.fuselage_position && (
                            <div className="flex items-start justify-between gap-2 text-sm">
                              <span className="text-slate-500">Posición fuselaje</span>
                              <span className="text-slate-900">
                                {data.fuselage_position === 'fwd' ? 'Forward (Fwd)' : data.fuselage_position === 'mid' ? 'Mid' : data.fuselage_position === 'aft' ? 'Aft (Posterior)' : data.fuselage_position}
                              </span>
                            </div>
                          )}
                          {data.sta_location && (
                            <div className="flex items-start justify-between gap-2 text-sm">
                              <span className="text-slate-500">STA</span>
                              <span className="text-slate-900">{data.sta_location}</span>
                            </div>
                          )}
                          {data.impact_structural_attachment && (
                            <div className="flex items-start justify-between gap-2 text-sm">
                              <span className="text-slate-500">Fijación estructural</span>
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${data.impact_structural_attachment === 'si' ? 'bg-emerald-500/20 text-emerald-400' : data.impact_structural_attachment === 'no_seguro' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                {data.impact_structural_attachment === 'si' ? 'Sí' : data.impact_structural_attachment === 'no' ? 'No' : data.impact_structural_attachment === 'no_seguro' ? 'No seguro' : data.impact_structural_attachment}
                              </span>
                            </div>
                          )}
                          {data.impact_structural_interface && (
                            <div className="text-sm">
                              <span className="text-slate-500">Interfaz estructural</span>
                              <p className="mt-0.5 text-xs text-slate-600">{data.impact_structural_interface}</p>
                            </div>
                          )}
                          {data.affects_primary_structure && (
                            <div className="flex items-start justify-between gap-2 text-sm">
                              <span className="text-slate-500">Afecta PSE</span>
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${data.affects_primary_structure === 'si' ? 'bg-red-500/20 text-red-400' : data.affects_primary_structure === 'no_seguro' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                {data.affects_primary_structure === 'si' ? 'Sí' : data.affects_primary_structure === 'no' ? 'No' : data.affects_primary_structure === 'no_seguro' ? 'No seguro' : data.affects_primary_structure}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">Sin datos</p>
                      )}
                    </div>

                    {/* ── 3. Eléctrico y Aviónica ── */}
                    <div className="rounded-xl border border-amber-200/60 border-l-4 border-l-amber-400 bg-amber-50/50 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Zap className="h-5 w-5 text-amber-600" />
                        <h4 className="text-sm font-bold uppercase tracking-wider text-amber-700">Eléctrico y Aviónica</h4>
                      </div>
                      {(data.impact_electrical || data.impact_avionics) ? (
                        <div className="space-y-1.5">
                          {data.impact_electrical && (
                            <div className="flex items-start justify-between gap-2 text-sm">
                              <span className="text-slate-500">Cableado eléctrico</span>
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${data.impact_electrical === 'si' ? 'bg-emerald-500/20 text-emerald-400' : data.impact_electrical === 'no_seguro' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                {data.impact_electrical === 'si' ? 'Sí' : data.impact_electrical === 'no' ? 'No' : data.impact_electrical === 'no_seguro' ? 'No seguro' : data.impact_electrical}
                              </span>
                            </div>
                          )}
                          {data.impact_avionics && (
                            <div className="flex items-start justify-between gap-2 text-sm">
                              <span className="text-slate-500">Aviónica / instrumentos</span>
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${data.impact_avionics === 'si' ? 'bg-emerald-500/20 text-emerald-400' : data.impact_avionics === 'no_seguro' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                {data.impact_avionics === 'si' ? 'Sí' : data.impact_avionics === 'no' ? 'No' : data.impact_avionics === 'no_seguro' ? 'No seguro' : data.impact_avionics}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">Sin datos</p>
                      )}
                    </div>

                    {/* ── 4. Peso y Balance ── */}
                    <div className="rounded-xl border border-violet-200/60 border-l-4 border-l-violet-400 bg-violet-50/50 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Scale className="h-5 w-5 text-violet-600" />
                        <h4 className="text-sm font-bold uppercase tracking-wider text-violet-700">Peso y Balance</h4>
                      </div>
                      {(data.estimated_weight_kg || (Array.isArray(data.items_weight_list) && (data.items_weight_list as { item: string; weight_added_kg: number; weight_removed_kg: number }[]).length > 0) || data.fuselage_position) ? (
                        <div className="space-y-2">
                          {data.estimated_weight_kg && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-500">Peso estimado total</span>
                              <span className="font-medium text-slate-900">{data.estimated_weight_kg} kg</span>
                            </div>
                          )}
                          {data.fuselage_position && (
                            <div className="flex items-start justify-between gap-2 text-sm">
                              <span className="text-slate-500">Posición CG ref.</span>
                              <span className="text-slate-900">
                                {data.fuselage_position === 'fwd' ? 'Forward (Fwd)' : data.fuselage_position === 'mid' ? 'Mid' : data.fuselage_position === 'aft' ? 'Aft (Posterior)' : data.fuselage_position}
                              </span>
                            </div>
                          )}
                          {Array.isArray(data.items_weight_list) && (data.items_weight_list as { item: string; weight_added_kg: number; weight_removed_kg: number }[]).length > 0 && (() => {
                            const items = data.items_weight_list as { item: string; weight_added_kg: number; weight_removed_kg: number }[]
                            const totalAdded = items.reduce((sum, i) => sum + (i.weight_added_kg ?? 0), 0)
                            const totalRemoved = items.reduce((sum, i) => sum + (i.weight_removed_kg ?? 0), 0)
                            const totalNet = totalAdded - totalRemoved
                            return (
                              <details className="group">
                                <summary className="flex cursor-pointer items-center gap-1 text-xs font-medium uppercase tracking-wider text-slate-400 hover:text-slate-600">
                                  <svg className="h-3 w-3 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                  Desglose de pesos
                                </summary>
                                <div className="mt-2">
                                  <div className="overflow-hidden rounded-lg border border-slate-200">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50">
                                          <th className="px-2.5 py-1.5 text-left font-semibold text-slate-500">Item</th>
                                          <th className="px-2.5 py-1.5 text-right font-semibold text-slate-500">Added (kg)</th>
                                          <th className="px-2.5 py-1.5 text-right font-semibold text-slate-500">Removed (kg)</th>
                                          <th className="px-2.5 py-1.5 text-right font-semibold text-slate-500">Net (kg)</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {items.map((row, idx) => (
                                          <tr key={idx} className="border-b border-slate-100 last:border-b-0">
                                            <td className="px-2.5 py-1.5 text-slate-900">{row.item}</td>
                                            <td className="px-2.5 py-1.5 text-right text-slate-700">{(row.weight_added_kg ?? 0).toFixed(1)}</td>
                                            <td className="px-2.5 py-1.5 text-right text-slate-700">{(row.weight_removed_kg ?? 0).toFixed(1)}</td>
                                            <td className={`px-2.5 py-1.5 text-right font-medium ${((row.weight_added_kg ?? 0) - (row.weight_removed_kg ?? 0)) > 0 ? 'text-amber-600' : ((row.weight_added_kg ?? 0) - (row.weight_removed_kg ?? 0)) < 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                                              {((row.weight_added_kg ?? 0) - (row.weight_removed_kg ?? 0)) > 0 ? '+' : ''}{((row.weight_added_kg ?? 0) - (row.weight_removed_kg ?? 0)).toFixed(1)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                      <tfoot>
                                        <tr className="border-t border-slate-200 bg-slate-50">
                                          <td className="px-2.5 py-1.5 font-semibold text-slate-700">Total</td>
                                          <td className="px-2.5 py-1.5 text-right font-semibold text-slate-700">{totalAdded.toFixed(1)}</td>
                                          <td className="px-2.5 py-1.5 text-right font-semibold text-slate-700">{totalRemoved.toFixed(1)}</td>
                                          <td className={`px-2.5 py-1.5 text-right font-semibold ${totalNet > 0 ? 'text-amber-600' : totalNet < 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                                            {totalNet > 0 ? '+' : ''}{totalNet.toFixed(1)}
                                          </td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                </div>
                              </details>
                            )
                          })()}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">Sin datos</p>
                      )}
                    </div>

                    {/* ── 5. Cabina y Presurización ── */}
                    <div className="rounded-xl border border-teal-200/60 border-l-4 border-l-teal-400 bg-teal-50/50 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <LayoutGrid className="h-5 w-5 text-teal-600" />
                        <h4 className="text-sm font-bold uppercase tracking-wider text-teal-700">Cabina y Presurización</h4>
                      </div>
                      {(data.impact_cabin_layout || data.impact_pressurized) ? (
                        <div className="space-y-1.5">
                          {data.impact_cabin_layout && (
                            <div className="flex items-start justify-between gap-2 text-sm">
                              <span className="text-slate-500">Layout cabina</span>
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${data.impact_cabin_layout === 'si' ? 'bg-emerald-500/20 text-emerald-400' : data.impact_cabin_layout === 'no_seguro' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                {data.impact_cabin_layout === 'si' ? 'Sí' : data.impact_cabin_layout === 'no' ? 'No' : data.impact_cabin_layout === 'no_seguro' ? 'No seguro' : data.impact_cabin_layout}
                              </span>
                            </div>
                          )}
                          {data.impact_pressurized && (
                            <div className="flex items-start justify-between gap-2 text-sm">
                              <span className="text-slate-500">Zona presurizada</span>
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${data.impact_pressurized === 'si' ? 'bg-emerald-500/20 text-emerald-400' : data.impact_pressurized === 'no_seguro' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                {data.impact_pressurized === 'si' ? 'Sí' : data.impact_pressurized === 'no' ? 'No' : data.impact_pressurized === 'no_seguro' ? 'No seguro' : data.impact_pressurized}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">Sin datos</p>
                      )}
                    </div>

                    {/* ── 6. Operacional ── */}
                    <div className="rounded-xl border border-slate-200/60 border-l-4 border-l-slate-400 bg-slate-50/50 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Settings className="h-5 w-5 text-slate-600" />
                        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700">Operacional</h4>
                      </div>
                      {data.impact_operational_change ? (
                        <div className="flex items-start justify-between gap-2 text-sm">
                          <span className="text-slate-500">Cambio operacional</span>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${data.impact_operational_change === 'si' ? 'bg-emerald-500/20 text-emerald-400' : data.impact_operational_change === 'no_seguro' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-500/20 text-slate-400'}`}>
                            {data.impact_operational_change === 'si' ? 'Sí' : data.impact_operational_change === 'no' ? 'No' : data.impact_operational_change === 'no_seguro' ? 'No seguro' : data.impact_operational_change}
                          </span>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">Sin datos</p>
                      )}
                    </div>

                    {/* ── 7. Directiva de Aeronavegabilidad ── */}
                    <div className="rounded-xl border border-yellow-200/60 border-l-4 border-l-yellow-500 bg-yellow-50/50 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                        <h4 className="text-sm font-bold uppercase tracking-wider text-yellow-700">Directiva de Aeronavegabilidad</h4>
                      </div>
                      {(data.related_to_ad || data.motivated_by_ad) ? (
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2 text-sm">
                            <span className="text-slate-500">Motivado por AD</span>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${(() => { const val = data.related_to_ad ?? data.motivated_by_ad; return val === 'si' ? 'bg-emerald-500/20 text-emerald-400' : val === 'no_seguro' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-500/20 text-slate-400' })()}`}>
                              {(() => { const val = data.related_to_ad ?? data.motivated_by_ad; return val === 'si' ? 'Sí' : val === 'no' ? 'No' : val === 'no_seguro' ? 'No seguro' : val })()}
                            </span>
                          </div>
                          {(data.related_to_ad ?? data.motivated_by_ad) === 'si' && data.ad_reference && (
                            <div className="flex items-start justify-between gap-2 text-sm">
                              <span className="text-slate-500">Referencia AD</span>
                              <span className="font-mono text-slate-900">{data.ad_reference}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">Sin datos</p>
                      )}
                    </div>

                    {/* ── 8. Recursos y Plazos ── */}
                    <div className="rounded-xl border border-indigo-200/60 border-l-4 border-l-indigo-400 bg-indigo-50/50 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-indigo-600" />
                        <h4 className="text-sm font-bold uppercase tracking-wider text-indigo-700">Recursos y Plazos</h4>
                      </div>
                      {(data.has_equipment || data.has_drawings || data.has_manufacturer_docs || data.has_previous_mod || data.target_date || data.is_aog) ? (
                        <div className="space-y-3">
                          {/* Recursos */}
                          {(data.has_equipment || data.has_drawings || data.has_manufacturer_docs || data.has_previous_mod) && (
                            <div>
                              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Recursos disponibles</span>
                              <div className="mt-2 grid grid-cols-2 gap-2">
                                {data.has_equipment && (
                                  <div className="flex items-center gap-1.5 text-sm">
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${data.has_equipment === 'si' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                      {data.has_equipment === 'si' ? 'Sí' : data.has_equipment === 'no' ? 'No' : '—'}
                                    </span>
                                    <span className="text-slate-500">Equipo</span>
                                  </div>
                                )}
                                {data.has_drawings && (
                                  <div className="flex items-center gap-1.5 text-sm">
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${data.has_drawings === 'si' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                      {data.has_drawings === 'si' ? 'Sí' : data.has_drawings === 'no' ? 'No' : '—'}
                                    </span>
                                    <span className="text-slate-500">Planos</span>
                                  </div>
                                )}
                                {data.has_manufacturer_docs && (
                                  <div className="flex items-center gap-1.5 text-sm">
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${data.has_manufacturer_docs === 'si' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                      {data.has_manufacturer_docs === 'si' ? 'Sí' : data.has_manufacturer_docs === 'no' ? 'No' : '—'}
                                    </span>
                                    <span className="text-slate-500">Doc. fabricante</span>
                                  </div>
                                )}
                                {data.has_previous_mod && (
                                  <div className="flex items-center gap-1.5 text-sm">
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${data.has_previous_mod === 'si' ? 'bg-emerald-500/20 text-emerald-400' : data.has_previous_mod === 'no_seguro' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                      {data.has_previous_mod === 'si' ? 'Sí' : data.has_previous_mod === 'no_seguro' ? '?' : 'No'}
                                    </span>
                                    <span className="text-slate-500">Mod. previa</span>
                                  </div>
                                )}
                              </div>
                              {data.equipment_details && data.has_equipment === 'si' && (
                                <p className="mt-1.5 text-xs text-slate-500">Equipo: {data.equipment_details}</p>
                              )}
                              {data.previous_mod_ref && data.has_previous_mod === 'si' && (
                                <p className="mt-1.5 text-xs text-slate-500">Ref. mod. previa: {data.previous_mod_ref}</p>
                              )}
                            </div>
                          )}
                          {/* Plazos */}
                          {(data.target_date || data.is_aog) && (
                            <div>
                              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Plazos</span>
                              <div className="mt-2 space-y-1.5">
                                {data.target_date && (
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500">Fecha deseada</span>
                                    <span className="text-slate-900">
                                      {new Date(data.target_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                  </div>
                                )}
                                {data.is_aog && (
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500">AOG</span>
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${data.is_aog === 'si' ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                      {data.is_aog === 'si' ? 'Sí — AOG' : 'No'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">Sin datos</p>
                      )}
                    </div>

                  </div>
                </div>
              </details>
            </section>

            {/* --- Definir alcance preliminar (ancho completo) --- */}
            <section className="rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
              <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f0f9ff_100%)] px-5 py-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-500" />
                  <h2 className="text-sm font-semibold text-slate-950">Definir alcance preliminar</h2>
                </div>
              </div>
              <div className="px-5 py-4 space-y-4">
                {/* Proyectos sugeridos + Busqueda manual (grid 50/50) */}
                <div className="grid gap-4 lg:grid-cols-2">
                  {/* Proyectos sugeridos automaticamente */}
                  <div>
                    {hasTechnicalData ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50/50">
                        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5">
                          <ScanSearch className="h-3.5 w-3.5 text-sky-600" />
                          <span className="text-xs font-semibold text-slate-800">Proyectos sugeridos</span>
                          <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-semibold text-sky-700">
                            {similarProjects.length}
                          </span>
                          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[8px] font-medium text-slate-500">
                            automatico
                          </span>
                        </div>
                        <details className="group">
                          <summary className="flex cursor-pointer items-center gap-1 px-4 py-2 text-[11px] font-medium text-sky-600 hover:text-sky-700">
                            <svg className="h-3 w-3 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                            Ver proyectos sugeridos
                          </summary>
                          <div className="space-y-1.5 px-4 pb-3">
                            {similarProjects.length > 0 ? (
                              similarProjects.map((project) => {
                                const isRef = currentRefs.includes(project.id)
                                return (
                                  <div
                                    key={`similar-${project.source}-${project.id}`}
                                    className={`rounded-lg border px-2.5 py-2 ${
                                      isRef
                                        ? 'border-amber-300 bg-amber-50/60'
                                        : 'border-slate-200 bg-white'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          {project.numero_proyecto && (
                                            <span className="inline-block rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700">
                                              {project.numero_proyecto}
                                            </span>
                                          )}
                                          {isRef && (
                                            <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700">
                                              Referencia
                                            </span>
                                          )}
                                        </div>
                                        <p className="mt-1 text-xs font-medium leading-snug text-slate-900">{project.titulo ?? '—'}</p>
                                        <div className="mt-0.5 flex flex-wrap items-center gap-1">
                                          {project.created_at && (
                                            <p className="text-[10px] text-slate-400">
                                              {new Date(project.created_at).getFullYear()}
                                            </p>
                                          )}
                                          {project.matchedKeywords.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                              {project.matchedKeywords.map((kw) => (
                                                <span
                                                  key={kw}
                                                  className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-medium text-amber-700"
                                                >
                                                  {kw}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex shrink-0 items-center gap-1.5">
                                        {project.estado && (
                                          <span className="rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">
                                            {project.estado}
                                          </span>
                                        )}
                                        <ReferenceProjectButton
                                          consultaId={id}
                                          proyectoId={project.id}
                                          isReferenced={isRef}
                                        />
                                        <Link
                                          href={`/proyectos-historico/${project.id}`}
                                          className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-sky-200 bg-sky-50 text-sky-700 transition-colors hover:bg-sky-100"
                                          title="Abrir ficha"
                                          aria-label={`Abrir ficha de ${project.numero_proyecto}`}
                                        >
                                          <Plus className="h-3 w-3" />
                                        </Link>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })
                            ) : (
                              <p className="text-xs italic text-slate-400">No se encontraron proyectos similares.</p>
                            )}
                          </div>
                        </details>
                      </div>
                    ) : (
                      <div className="flex h-24 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50">
                        <div className="text-center">
                          <ScanSearch className="mx-auto h-5 w-5 text-slate-300" />
                          <p className="mt-1 text-xs text-slate-400">Proyectos sugeridos</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Busqueda manual de proyectos */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50">
                    <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5">
                      <Search className="h-3.5 w-3.5 text-sky-600" />
                      <span className="text-xs font-semibold text-slate-800">Buscar proyectos</span>
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[8px] font-medium text-slate-500">
                        manual
                      </span>
                    </div>
                    <div className="px-4 py-3">
                      <ManualProjectSearch
                        consultaId={id}
                        currentRefs={currentRefs}
                      />
                    </div>
                  </div>
                </div>

                {/* Classification Workspace: AI Chat + Classification + Modification Description */}
                <ClassificationWorkspaceClient
                  consultaId={data.id}
                  referenceProjectId={referenceProjects.length > 0 ? referenceProjects[0].id : null}
                  classificationData={{
                    items_weight_list: data.items_weight_list as { item: string; weight_added_kg: number; weight_removed_kg: number }[] | null,
                    fuselage_position: data.fuselage_position as string | null,
                    sta_location: data.sta_location as string | null,
                    impact_location: data.impact_location as string | null,
                    affects_primary_structure: data.affects_primary_structure as string | null,
                    impact_structural_attachment: data.impact_structural_attachment as string | null,
                    estimated_weight_kg: data.estimated_weight_kg as string | null,
                    related_to_ad: (data.related_to_ad ?? data.motivated_by_ad) as string | null,
                    ad_reference: data.ad_reference as string | null,
                    mtow_kg: primaryAircraftVariant?.mtow_kg ?? null,
                  }}
                  consultationData={{
                    aircraft_manufacturer: data.aircraft_manufacturer as string | null,
                    aircraft_model: data.aircraft_model as string | null,
                    aircraft_msn: data.aircraft_msn as string | null,
                    tcds_number: data.tcds_number as string | null,
                    work_type: data.work_type as string | null,
                    modification_summary: data.modification_summary as string | null,
                    operational_goal: data.operational_goal as string | null,
                    impact_location: data.impact_location as string | null,
                    impact_structural_attachment: data.impact_structural_attachment as string | null,
                    impact_structural_interface: data.impact_structural_interface as string | null,
                    impact_electrical: data.impact_electrical as string | null,
                    impact_avionics: data.impact_avionics as string | null,
                    impact_cabin_layout: data.impact_cabin_layout as string | null,
                    impact_pressurized: data.impact_pressurized as string | null,
                    impact_operational_change: data.impact_operational_change as string | null,
                    estimated_weight_kg: data.estimated_weight_kg as string | null,
                    items_weight_list: data.items_weight_list as { item: string; weight_added_kg: number; weight_removed_kg: number }[] | null,
                    fuselage_position: data.fuselage_position as string | null,
                    sta_location: data.sta_location as string | null,
                    affects_primary_structure: data.affects_primary_structure as string | null,
                    related_to_ad: (data.related_to_ad ?? data.motivated_by_ad) as string | null,
                    ad_reference: data.ad_reference as string | null,
                    mtow_kg: primaryAircraftVariant?.mtow_kg ?? null,
                    additional_notes: data.additional_notes as string | null,
                  }}
                  clientEmail={senderEmail ?? undefined}
                  clientName={matchedClient?.nombre ?? undefined}
                  numeroEntrada={data.numero_entrada as string | undefined}
                  remitente={data.remitente as string | undefined}
                  asunto={data.asunto as string | undefined}
                />
              </div>
            </section>

            {/* --- Definir documentacion (ancho completo, colapsable) --- */}
            <section className="rounded-[22px] border border-violet-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
              <div className="border-b border-violet-200 bg-[linear-gradient(135deg,#ffffff_0%,#f5f3ff_100%)] px-5 py-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-violet-600" />
                  <h2 className="text-sm font-semibold text-slate-950">Definir documentacion</h2>
                </div>
              </div>
              <details className="group">
                <summary className="flex cursor-pointer items-center gap-1 px-5 py-3 text-xs font-medium text-violet-600 hover:text-violet-700">
                  <svg className="h-3.5 w-3.5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  Seleccionar documentos de compliance
                </summary>
                <div className="px-5 pb-5">
                  <ComplianceDocumentsSection
                    consultaId={id}
                    templates={complianceTemplates}
                    preselectedCodes={preselectedComplianceCodes}
                    savedCodes={savedComplianceCodes}
                    referenceProjectId={referenceProjects.length > 0 ? referenceProjects[0].id : null}
                  />
                </div>
              </details>
            </section>

            {/* --- Informacion de Quotation (ancho completo, colapsable) --- */}
            <section className="rounded-[22px] border border-orange-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
              <div className="border-b border-orange-200 bg-[linear-gradient(135deg,#ffffff_0%,#fff7ed_100%)] px-5 py-3">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-orange-600" />
                  <h2 className="text-sm font-semibold text-slate-950">Oferta / Quotation</h2>
                </div>
              </div>
              <details className="group">
                <summary className="flex cursor-pointer items-center gap-1 px-5 py-3 text-xs font-medium text-orange-600 hover:text-orange-700">
                  <svg className="h-3.5 w-3.5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  Preparar datos de oferta
                </summary>
                <div className="px-5 pb-5">
                  <QuotationInfoSection />
                </div>
              </details>
            </section>

            {/* --- Panel de decision (ancho completo) ---
                 Si la consulta esta en estado avanzado (oferta_aceptada /
                 revision_final) mostramos el panel "Abrir proyecto". En
                 caso contrario, mantenemos los botones originales. */}
            {data.estado === 'oferta_aceptada' || data.estado === 'revision_final' ? (
              <PreparaProyectoPanel
                consultaId={data.id}
                currentState={data.estado ?? ''}
              />
            ) : (
              <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
                <h2 className="text-sm font-semibold text-slate-950">Panel de decision</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Revisa toda la informacion y decide como proceder con esta consulta.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {/* TODO: implement crear proyecto action */}
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-100"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Crear proyecto
                  </button>
                  {/* TODO: implement solicitar mas informacion action */}
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-5 py-2.5 text-sm font-semibold text-amber-700 shadow-sm transition-colors hover:bg-amber-100"
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                    Solicitar mas informacion
                  </button>
                  {/* TODO: implement rechazar action */}
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-100"
                  >
                    <XCircle className="h-4 w-4" />
                    Rechazar
                  </button>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

