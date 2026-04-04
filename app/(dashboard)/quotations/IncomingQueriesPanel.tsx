/**
 * ============================================================================
 * PANEL DE CONSULTAS ENTRANTES (NUEVAS ENTRADAS)
 * ============================================================================
 *
 * Este componente muestra las consultas comerciales que han llegado
 * recientemente y todavia estan en estado "nuevo" (pendientes de triage).
 * Se usa dentro de la pagina de Quotations como un panel tipo "bandeja
 * de entrada" con tarjetas individuales para cada consulta.
 *
 * QUE MUESTRA:
 *   - Una cabecera con titulo, descripcion y contadores (pendientes / fuente)
 *   - Tarjetas tipo "card" para cada consulta nueva, mostrando:
 *     * Codigo y asunto de la consulta
 *     * Email del remitente
 *     * Resumen del contenido
 *     * Clasificacion (tipo de consulta)
 *     * Fecha de recepcion
 *     * Enlace "Mas detalle" para ir a la pagina de detalle
 *   - Si no hay consultas nuevas, muestra un mensaje informativo
 *
 * NOTA TECNICA: Solo muestra consultas con estado "nuevo". Las consultas
 * en otros estados se ven en el tablero principal (QuotationStatesBoard).
 * ============================================================================
 */

'use client'

// Link: para navegar a la pagina de detalle de cada consulta
import Link from 'next/link'
// useMemo: optimizacion para no recalcular el filtro en cada render
import { useMemo } from 'react'
// Iconos decorativos para la interfaz
import { Inbox, Mail, Sparkles } from 'lucide-react'

// Funcion que resuelve los metadatos visuales (color, etiqueta) de cada estado
import { getResolvedIncomingQueryStatusMeta } from '@/lib/workflow-state-config'
// Utilidad para combinar clases CSS condicionalmente
import { cn } from '@/lib/utils'
// Tipo de datos para la configuracion de estados del workflow
import type { WorkflowStateConfigRow } from '@/types/database'

// Tipos de datos para las consultas entrantes y sus estados
import type { IncomingQuery, IncomingQueryStatus } from './incoming-queries'

/**
 * Insignia visual que muestra el estado de una consulta con color y texto.
 * Por ejemplo: "Nuevo" en azul, "En proceso" en amarillo, etc.
 */
function IncomingStatusBadge({
  status,
  stateConfigRows,
}: {
  status: IncomingQueryStatus
  stateConfigRows?: WorkflowStateConfigRow[]
}) {
  const meta = getResolvedIncomingQueryStatusMeta(status, stateConfigRows)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        meta.color,
      )}
    >
      {meta.label}
    </span>
  )
}

/**
 * Componente principal del panel de consultas entrantes.
 * Recibe todas las consultas y filtra solo las que estan en estado "nuevo".
 */
export function IncomingQueriesPanel({
  queries,
  stateConfigRows = [],
}: {
  queries: IncomingQuery[]
  stateConfigRows?: WorkflowStateConfigRow[]
}) {
  // Filtrar solo las consultas en estado "nuevo" (pendientes de revision)
  const incoming = useMemo(
    () => queries.filter((query) => query.estado === 'nuevo'),
    [queries],
  )

  return (
    <>
      <section className="overflow-hidden rounded-[24px] border border-sky-200 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_46%,#f8fafc_100%)] shadow-[0_12px_28px_rgba(125,211,252,0.12)]">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-sky-100 px-5 py-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
              <Inbox className="h-3.5 w-3.5" />
              Nuevas Entradas
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Consultas entrantes pendientes de triage
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">
                Entradas reales de la tabla de consultas, previas a convertir una consulta
                en quotation.
              </p>
            </div>
          </div>

          <div className="grid min-w-[220px] grid-cols-2 gap-3">
            <div className="rounded-2xl border border-sky-200 bg-white/85 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Pendientes
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{incoming.length}</p>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-white/85 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Preparadas
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">Fuente: Supabase</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 xl:grid-cols-3">
          {incoming.length === 0 ? (
            <div className="xl:col-span-3">
              <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed border-sky-200 bg-white/80 px-6 text-center">
                <Inbox className="h-8 w-8 text-sky-400" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-950">
                    No hay nuevas entradas ahora mismo
                  </p>
                  <p className="max-w-xl text-sm text-slate-500">
                    La bandeja ya esta conectada a la tabla real de consultas entrantes.
                    Cuando lleguen nuevas entradas apareceran aqui antes de convertirse en
                    quotation.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            incoming.map((query) => (
              <article
                key={query.id}
                className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-[0_16px_28px_rgba(148,163,184,0.16)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-mono text-[11px] text-slate-500">{query.codigo}</p>
                    <h3 className="text-sm font-semibold text-slate-950">{query.asunto}</h3>
                  </div>
                  <IncomingStatusBadge status={query.estado} stateConfigRows={stateConfigRows} />
                </div>

                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <div className="inline-flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    <span className="truncate">{query.remitente}</span>
                  </div>
                  <p className="line-clamp-3">{query.resumen}</p>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {query.clasificacion ? (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
                      {query.clasificacion}
                    </span>
                  ) : null}
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
                    Entrada email
                  </span>
                </div>

                <div className="mt-5 flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 text-xs text-slate-500">
                    <Sparkles className="h-3.5 w-3.5 text-sky-600" />
                    {query.recibidoEn}
                  </div>
                  <Link
                    href={`/quotations/incoming/${query.id}`}
                    className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
                  >
                    Más detalle
                  </Link>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </>
  )
}
