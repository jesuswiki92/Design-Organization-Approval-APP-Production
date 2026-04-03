import Link from 'next/link'
import { ArrowLeft, Mail, Plus, ScanSearch, UserRoundX } from 'lucide-react'

import { TopBar } from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/server'
import type { Cliente, ClienteContacto, ConsultaEntrante } from '@/types/database'

import { ClientDetailPanel } from '../../../clients/ClientDetailPanel'
import {
  buildIncomingClientLookup,
  resolveIncomingClientRecord,
  toIncomingQuery,
} from '../../incoming-queries'
import { ClientReplyComposer } from './ClientReplyComposer'

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
                Esta consulta todavía no se ha podido vincular con un cliente registrado
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

export default async function IncomingQuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

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
                {error ? `Error: ${error.message}` : 'No se encontró una consulta con este identificador.'}
              </p>
            </div>
          </section>
        </div>
      </div>
    )
  }

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

  const clients: Cliente[] = clientRows ?? []
  const contacts: ClienteContacto[] = contactRows ?? []
  const clientLookup = buildIncomingClientLookup(clients, contacts)
  const query = toIncomingQuery(data as ConsultaEntrante, clientLookup)
  const matchedClient = resolveIncomingClientRecord(query.remitente, clients, contacts)

  let projectHistory: { id: string; numero_proyecto: string | null; titulo: string | null; descripcion: string | null; estado: string | null; created_at: string | null }[] = []
  if (matchedClient) {
    const { data: historyRows, error: historyError } = await supabase
      .from('doa_proyectos_historico')
      .select('id, numero_proyecto, titulo, descripcion, estado, created_at')
      .eq('client_id', matchedClient.id)
      .order('created_at', { ascending: false })

    if (historyError) {
      console.error('Error cargando historial de proyectos del cliente:', historyError)
    } else {
      projectHistory = historyRows ?? []
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,#eff6ff_0%,#f8fbff_34%,#f8fafc_100%)]">
      <TopBar
        title="Detalle de consulta"
        subtitle="Entrada comercial previa a quotation"
      />

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-5 pb-8 pt-5">
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

        <section className="rounded-[34px] border border-sky-100 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_52%,#f8fafc_100%)] p-6 shadow-[0_24px_50px_rgba(14,165,233,0.10)]">
          <div className="space-y-2">
            <p className="font-mono text-xs text-slate-500">{query.codigo}</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              {query.asunto}
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-600">
              Vista preparada para revisar la consulta, trabajar la comunicación con el
              cliente y seguir incorporando contexto operativo a medida que el workflow avance.
            </p>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
          <div className="grid grid-cols-2 gap-4">
            <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Correo original
              </p>
              <h3 className="mt-1.5 text-sm font-semibold text-slate-950">
                Mensaje recibido
              </h3>
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {query.cuerpoOriginal}
                </p>
              </div>
            </section>

            <ClientReplyComposer
              compact
              query={{
                id: query.id,
                codigo: query.codigo,
                asunto: query.asunto,
                remitente: query.remitente,
                urlFormulario: query.urlFormulario,
                clasificacion: query.clasificacion,
                cuerpoOriginal: query.cuerpoOriginal,
                respuestaIa: query.respuestaIa,
              }}
            />
          </div>

          <div className="grid min-h-0 gap-5">
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

            <section className="rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
              <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f0f9ff_100%)] px-5 py-3">
                <h2 className="text-sm font-semibold text-slate-950">Aircraft Data</h2>
              </div>
              <details className="group">
                <summary className="flex cursor-pointer items-center gap-1 px-5 py-3 text-xs font-medium text-sky-600 hover:text-sky-700">
                  <svg className="h-3.5 w-3.5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  Ver datos de aeronave
                </summary>
                <div className="space-y-3 px-5 pb-4">
                  {data.tcds_number ? (
                    <>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">TCDS Number</p>
                        <p className="mt-0.5 text-sm font-medium text-slate-900">{data.tcds_number}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Manufacturer</p>
                        <p className="mt-0.5 text-sm font-medium text-slate-900">{data.aircraft_manufacturer ?? '—'}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Model</p>
                        <p className="mt-0.5 text-sm font-medium text-slate-900">{data.aircraft_model ?? '—'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Aircraft count</p>
                          <p className="mt-0.5 text-sm font-medium text-slate-900">{data.aircraft_count ?? '—'}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">MSN</p>
                          <p className="mt-0.5 text-sm font-medium text-slate-900">{data.aircraft_msn ?? '—'}</p>
                        </div>
                      </div>
                      {data.tcds_pdf_url ? (
                        <a
                          href={data.tcds_pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-100"
                        >
                          Download TCDS PDF
                        </a>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-xs italic text-slate-400">No aircraft data submitted yet.</p>
                  )}
                </div>
              </details>
            </section>

            {matchedClient && (
              <section className="rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
                <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f0f9ff_100%)] px-5 py-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-950">Project History</h2>
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                      {projectHistory.length} {projectHistory.length === 1 ? 'project' : 'projects'}
                    </span>
                  </div>
                </div>
                <details className="group">
                  <summary className="flex cursor-pointer items-center gap-1 px-5 py-3 text-xs font-medium text-sky-600 hover:text-sky-700">
                    <svg className="h-3.5 w-3.5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    Ver historial de proyectos
                  </summary>
                  <div className="space-y-3 px-5 pb-4">
                    {projectHistory.length > 0 ? (
                      projectHistory.map((project) => (
                        <div key={project.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              {project.numero_proyecto && (
                                <span className="inline-block rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700">
                                  {project.numero_proyecto}
                                </span>
                              )}
                              <p className="mt-1 text-sm font-medium text-slate-900">{project.titulo ?? '—'}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {project.estado && (
                                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">
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
                      <p className="text-xs italic text-slate-400">No previous projects found for this client.</p>
                    )}
                  </div>
                </details>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
