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
 *   1. Hilo de emails (colapsable, cerrado por defecto)
 *   2. Cliente + Proyectos del cliente (50/50 grid)
 *   3. Datos aeronave + TCDS (ancho completo)
 *   4. Datos tecnicos + Proyectos similares (50/50 grid)
 *   5. Panel de decision (crear proyecto / solicitar info / rechazar)
 *
 * La barra lateral izquierda de navegacion NO se toca.
 * ============================================================================
 */

import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Clock, FolderOpen, Mail, MessageSquarePlus, Plane, Plus, ScanSearch, Search, UserRoundX, XCircle } from 'lucide-react'

import { TopBar } from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/server'
import { CONSULTA_ESTADOS } from '@/lib/workflow-states'
import type { Cliente, ClienteContacto, ConsultaEntrante, DoaEmail } from '@/types/database'

import { ClientDetailPanel } from '../../../clients/ClientDetailPanel'
import {
  buildIncomingClientLookup,
  resolveIncomingClientRecord,
  toIncomingQuery,
} from '../../incoming-queries'
import { CenterColumnCollapsible } from './CenterColumnCollapsible'
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
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-5 pb-8 pt-5">
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
  let projectHistory: { id: string; numero_proyecto: string | null; titulo: string | null; descripcion: string | null; estado: string | null; created_at: string | null; source: 'active' | 'historic' }[] = []
  if (matchedClient) {
    const [
      { data: activeRows, error: activeError },
      { data: historyRows, error: historyError },
    ] = await Promise.all([
      supabase
        .from('doa_proyectos')
        .select('id, numero_proyecto, titulo, descripcion, estado, created_at')
        .or(`client_id.eq.${matchedClient.id},cliente_nombre.ilike.${matchedClient.nombre}`)
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

  // --- Buscar proyectos similares basados en datos tecnicos ---
  let similarProjects: { id: string; numero_proyecto: string | null; titulo: string | null; descripcion: string | null; estado: string | null; created_at: string | null; source: 'active' | 'historic'; matchedKeywords: string[] }[] = []
  const hasTechnicalData = !!(data.modification_summary || data.subject)

  if (hasTechnicalData) {
    const stopWords = new Set([
      'in', 'of', 'a', 'the', 'and', 'for', 'to', 'on', 'is', 'it', 'at', 'by',
      'el', 'la', 'de', 'en', 'un', 'una', 'del', 'los', 'las', 'por', 'para',
      'con', 'que', 'se', 'no', 'es', 'al', 'lo', 'su', 'como', 'this', 'that',
      'with', 'from', 'are', 'was', 'will', 'be', 'has', 'have', 'been', 'which',
      'must', 'inside', 'outside', 'also', 'into', 'about', 'more', 'than', 'can',
    ])

    const text = `${data.modification_summary ?? ''} ${data.subject ?? ''}`.toLowerCase()
    const keywords = text
      .split(/\s+/)
      .map((w) => w.replace(/[^a-záéíóúñü0-9-]/gi, ''))
      .filter((w) => w.length > 2 && !stopWords.has(w))
    const uniqueKeywords = [...new Set(keywords)].slice(0, 5)

    if (uniqueKeywords.length > 0) {
      const orFilters = uniqueKeywords
        .flatMap((kw) => [`titulo.ilike.%${kw}%`, `descripcion.ilike.%${kw}%`])
        .join(',')

      const [{ data: simActiveRows, error: simActiveError }, { data: simHistRows, error: simHistError }] =
        await Promise.all([
          supabase
            .from('doa_proyectos')
            .select('id, numero_proyecto, titulo, descripcion, estado, created_at')
            .or(orFilters)
            .order('created_at', { ascending: false })
            .limit(10),
          supabase
            .from('doa_proyectos_historico')
            .select('id, numero_proyecto, titulo, descripcion, estado, created_at')
            .or(orFilters)
            .order('created_at', { ascending: false })
            .limit(10),
        ])

      if (simActiveError) {
        console.error('Error buscando proyectos similares activos:', simActiveError)
      }
      if (simHistError) {
        console.error('Error buscando proyectos similares historicos:', simHistError)
      }

      // Combine and deduplicate
      const activeWithSource = (simActiveRows ?? []).map((p) => ({ ...p, source: 'active' as const }))
      const histWithSource = (simHistRows ?? []).map((p) => ({ ...p, source: 'historic' as const }))

      const seenSimilar = new Set<string>()
      const combinedSimilar: typeof similarProjects = []

      for (const p of [...activeWithSource, ...histWithSource]) {
        const key = p.numero_proyecto ?? p.id
        if (seenSimilar.has(key)) continue
        seenSimilar.add(key)

        // Calculate matched keywords for relevance sorting
        const titleLower = (p.titulo ?? '').toLowerCase()
        const descLower = (p.descripcion ?? '').toLowerCase()
        const matched = uniqueKeywords.filter(
          (kw) => titleLower.includes(kw) || descLower.includes(kw),
        )

        combinedSimilar.push({ ...p, matchedKeywords: matched })
      }

      // Sort by relevance (number of keyword matches desc), then by date
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

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-5 pb-8 pt-5">
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
                <details className="group" open>
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
                                  {project.source === 'active' ? 'Activo' : 'Historico'}
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
                                href={project.source === 'active' ? `/engineering/${project.id}` : `/proyectos-historico/${project.id}`}
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
                  <details className="group" open>
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
                                    {project.source === 'active' ? 'Activo' : 'Historico'}
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
                                  href={project.source === 'active' ? `/engineering/${project.id}` : `/proyectos-historico/${project.id}`}
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
            {/* --- Hilo de emails (colapsable, cerrado por defecto) --- */}
            <details className="group">
              <summary className="flex cursor-pointer items-center gap-2 rounded-[22px] border border-slate-200 bg-white px-5 py-4 shadow-[0_10px_24px_rgba(148,163,184,0.12)] transition-colors hover:bg-slate-50">
                <Mail className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-700">Hilo de emails</span>
                <svg className="ml-auto h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </summary>
              <div className="mt-2 rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
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

            {/* --- Cliente (50%) + Proyectos del cliente (50%) --- */}
            <div className="grid gap-5 lg:grid-cols-2">
              {matchedClient ? (
                <ClientDetailPanel client={matchedClient} />
              ) : (
                <UnknownClientPanel
                  senderEmail={
                    query.clientIdentity.kind === 'unknown'
                      ? query.clientIdentity.senderEmail
                      : query.clientIdentity.email
                  }
                />
              )}

              {matchedClient ? (
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
                  <details className="group" open>
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
                                    {project.source === 'active' ? 'Activo' : 'Historico'}
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
                                  href={project.source === 'active' ? `/engineering/${project.id}` : `/proyectos-historico/${project.id}`}
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

            {/* --- Datos de aeronave / TCDS (ancho completo) --- */}
            <section className="rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
              <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f0f9ff_100%)] px-5 py-3">
                <div className="flex items-center gap-2">
                  <Plane className="h-4 w-4 text-sky-600" />
                  <h2 className="text-sm font-semibold text-slate-950">Datos de aeronave</h2>
                </div>
              </div>
              <details className="group" open>
                <summary className="flex cursor-pointer items-center gap-1 px-5 py-3 text-xs font-medium text-sky-600 hover:text-sky-700">
                  <svg className="h-3.5 w-3.5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  Ver datos de aeronave
                </summary>
                <div className="space-y-3 px-5 pb-4">
                  {data.tcds_number ? (
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
                  ) : (
                    <p className="text-xs italic text-slate-400">No se han enviado datos de aeronave todavia.</p>
                  )}
                </div>
              </details>
            </section>

            {/* --- Datos tecnicos (50%) + Proyectos similares (50%) --- */}
            <div className="grid gap-5 lg:grid-cols-2">
              {(data.work_type || data.modification_summary) ? (
                <section className="rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
                  <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f0f9ff_100%)] px-5 py-3">
                    <h2 className="text-sm font-semibold text-slate-950">Datos tecnicos del proyecto</h2>
                  </div>
                  <details className="group" open>
                    <summary className="flex cursor-pointer items-center gap-1 px-5 py-3 text-xs font-medium text-sky-600 hover:text-sky-700">
                      <svg className="h-3.5 w-3.5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                      Ver datos tecnicos
                    </summary>
                    <div className="space-y-3 px-5 pb-4">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Tipo de trabajo</p>
                        <p className="mt-0.5 text-sm font-medium text-slate-900">
                          {data.work_type === 'proyecto_nuevo'
                            ? 'Proyecto nuevo'
                            : data.work_type === 'modificacion_existente'
                              ? `Modificacion a proyecto existente${data.existing_project_code ? ` (${data.existing_project_code})` : ''}`
                              : '—'}
                        </p>
                      </div>
                      {data.modification_summary && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Descripcion de la modificacion</p>
                          <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-900">{data.modification_summary}</p>
                        </div>
                      )}
                      {data.operational_goal && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Objetivo operativo</p>
                          <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-900">{data.operational_goal}</p>
                        </div>
                      )}
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Equipo disponible</p>
                        <p className="mt-0.5 text-sm font-medium text-slate-900">
                          {data.has_equipment === 'si'
                            ? 'Si'
                            : data.has_equipment === 'no'
                              ? 'No, necesita asesoramiento'
                              : data.has_equipment === 'no_aplica'
                                ? 'No aplica'
                                : '—'}
                        </p>
                        {data.has_equipment === 'si' && data.equipment_details && (
                          <p className="mt-1 text-xs text-slate-600">{data.equipment_details}</p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Planos / documentacion</p>
                          <p className="mt-0.5 text-sm font-medium text-slate-900">
                            {data.has_drawings === 'si' ? 'Si' : data.has_drawings === 'no' ? 'No' : '—'}
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Doc. del fabricante</p>
                          <p className="mt-0.5 text-sm font-medium text-slate-900">
                            {data.has_manufacturer_docs === 'si' ? 'Si' : data.has_manufacturer_docs === 'no' ? 'No' : '—'}
                          </p>
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Modificacion similar previa</p>
                        <p className="mt-0.5 text-sm font-medium text-slate-900">
                          {data.has_previous_mod === 'si'
                            ? 'Si'
                            : data.has_previous_mod === 'no'
                              ? 'No'
                              : data.has_previous_mod === 'no_seguro'
                                ? 'No esta seguro'
                                : '—'}
                        </p>
                        {data.has_previous_mod === 'si' && data.previous_mod_ref && (
                          <p className="mt-1 text-xs text-slate-600">{data.previous_mod_ref}</p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Fecha deseada</p>
                          <p className="mt-0.5 text-sm font-medium text-slate-900">
                            {data.target_date
                              ? new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(data.target_date))
                              : '—'}
                          </p>
                        </div>
                        <div className={`rounded-xl border px-3 py-2.5 ${data.is_aog === 'si' ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">AOG</p>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            {data.is_aog === 'si' ? (
                              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                                Si — URGENTE
                              </span>
                            ) : (
                              <p className="text-sm font-medium text-slate-900">
                                {data.is_aog === 'no' ? 'No' : '—'}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      {data.aircraft_location && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Ubicacion aeronave</p>
                          <p className="mt-0.5 text-sm text-slate-900">{data.aircraft_location}</p>
                        </div>
                      )}
                      {data.additional_notes && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Notas adicionales</p>
                          <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-900">{data.additional_notes}</p>
                        </div>
                      )}
                    </div>
                  </details>
                </section>
              ) : (
                <section className="flex items-center justify-center rounded-[22px] border-2 border-dashed border-slate-200 bg-slate-50/50 p-8">
                  <div className="text-center">
                    <ScanSearch className="mx-auto h-6 w-6 text-slate-300" />
                    <p className="mt-2 text-sm font-medium text-slate-400">Sin datos tecnicos</p>
                    <p className="mt-1 text-xs text-slate-300">
                      Se mostraran cuando el cliente complete el formulario tecnico
                    </p>
                  </div>
                </section>
              )}

              {hasTechnicalData ? (
                <section className="rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
                  <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f0f9ff_100%)] px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-sky-600" />
                      <h2 className="text-sm font-semibold text-slate-950">Proyectos similares</h2>
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                        {similarProjects.length}
                      </span>
                    </div>
                  </div>
                  <details className="group" open>
                    <summary className="flex cursor-pointer items-center gap-1 px-5 py-3 text-xs font-medium text-sky-600 hover:text-sky-700">
                      <svg className="h-3.5 w-3.5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                      Ver proyectos similares
                    </summary>
                    <div className="space-y-2 px-5 pb-4">
                      {similarProjects.length > 0 ? (
                        similarProjects.map((project) => (
                          <div key={`similar-${project.source}-${project.id}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
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
                                    {project.source === 'active' ? 'Activo' : 'Historico'}
                                  </span>
                                </div>
                                <p className="mt-1 text-sm font-medium leading-snug text-slate-900">{project.titulo ?? '—'}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-1">
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
                                  href={project.source === 'active' ? `/engineering/${project.id}` : `/proyectos-historico/${project.id}`}
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
                        <p className="text-xs italic text-slate-400">No se encontraron proyectos similares.</p>
                      )}
                    </div>
                  </details>
                </section>
              ) : (
                <section className="flex items-center justify-center rounded-[22px] border-2 border-dashed border-slate-200 bg-slate-50/50 p-8">
                  <div className="text-center">
                    <Search className="mx-auto h-6 w-6 text-slate-300" />
                    <p className="mt-2 text-sm font-medium text-slate-400">Proyectos similares</p>
                    <p className="mt-1 text-xs text-slate-300">
                      Complete el formulario tecnico para buscar proyectos similares
                    </p>
                  </div>
                </section>
              )}
            </div>

            {/* --- Panel de decision (ancho completo) --- */}
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
          </>
        )}
      </div>
    </div>
  )
}
