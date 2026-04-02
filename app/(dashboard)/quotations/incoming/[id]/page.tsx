import Link from 'next/link'
import { ArrowLeft, Mail, ScanSearch, UserRoundX } from 'lucide-react'

import { TopBar } from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/server'
import type { Cliente, ClienteContacto, ConsultaEntrante } from '@/types/database'

import { ClientDetailPanel } from '../../../clients/ClientDetailPanel'
import {
  buildIncomingClientLookup,
  resolveIncomingClientRecord,
  toIncomingQuery,
} from '../../incoming-queries'
import { ConsultaFormPreview } from './ConsultaFormPreview'
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
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(148,163,184,0.12)]">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Comunicación
              </p>
              <h2 className="text-lg font-semibold text-slate-950">
                Respuesta y correo original
              </h2>
              <p className="text-sm leading-6 text-slate-600">
                Este bloque concentra la redacción actual y el mensaje de origen para
                dejar hueco a futuras secciones del proceso.
              </p>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
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

              <section className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Correo original
                </p>
                <h3 className="mt-2 text-base font-semibold text-slate-950">
                  Mensaje recibido
                </h3>
                <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4">
                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                    {query.cuerpoOriginal}
                  </p>
                </div>
              </section>
            </div>
          </section>

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

            <ConsultaFormPreview
              consultaId={query.id}
              consultaCode={query.codigo}
              senderEmail={
                query.clientIdentity.kind === 'unknown'
                  ? query.clientIdentity.senderEmail
                  : query.clientIdentity.email
              }
              publicFormUrl={query.urlFormulario}
              matchedClient={matchedClient}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
