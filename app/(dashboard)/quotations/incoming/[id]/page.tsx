import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ScanSearch } from 'lucide-react'

import { TopBar } from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/server'
import type { ConsultaEntrante } from '@/types/database'

import { toIncomingQuery } from '../../incoming-queries'
import { ClientReplyComposer } from './ClientReplyComposer'

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
    notFound()
  }

  const query = toIncomingQuery(data as ConsultaEntrante)

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
              Vista de detalle limpia para revisar la consulta, preparar la respuesta al
              cliente y consultar el correo original sin ruido visual.
            </p>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
          <ClientReplyComposer
            query={{
              id: query.id,
              codigo: query.codigo,
              asunto: query.asunto,
              remitente: query.remitente,
              clasificacion: query.clasificacion,
              cuerpoOriginal: query.cuerpoOriginal,
              respuestaIa: query.respuestaIa,
            }}
          />

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(148,163,184,0.12)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Correo original
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">
              Mensaje recibido
            </h2>
            <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="whitespace-pre-wrap text-sm leading-8 text-slate-700">
                {query.cuerpoOriginal}
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
