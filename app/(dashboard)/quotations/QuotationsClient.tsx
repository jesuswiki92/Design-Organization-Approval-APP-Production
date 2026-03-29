'use client'

import Link from 'next/link'
import { Columns3, FileText, List, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { WorkflowStateChanger } from '@/components/workflow/WorkflowStateChanger'
import { QUOTATION_STATES, getQuotationStatusMeta } from '@/lib/workflow-states'
import { cn } from '@/lib/utils'
import type { OfertaConRelaciones } from '@/types/database'

import type { IncomingQuery } from './incoming-queries'
import { IncomingQueriesPanel } from './IncomingQueriesPanel'

function StateBadge({ state }: { state: string }) {
  const meta = getQuotationStatusMeta(state)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        meta.color,
        meta.bg,
        meta.border,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  )
}

export function QuotationsClient({
  quotations,
  incomingQueries,
  incomingQueriesBanner,
}: {
  quotations: OfertaConRelaciones[]
  incomingQueries: IncomingQuery[]
  incomingQueriesBanner?: {
    tone: 'warning' | 'error'
    title: string
    message: string
  } | null
}) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [view, setView] = useState<'list' | 'kanban'>('list')

  const filtered = useMemo(() => {
    return quotations.filter((quotation) => {
      const haystack = [
        quotation.numero_oferta ?? '',
        quotation.descripcion ?? '',
        quotation.cliente?.nombre ?? '',
      ]
        .join(' ')
        .toLowerCase()

      const matchesQuery = query === '' || haystack.includes(query.toLowerCase())
      const matchesStatus = statusFilter === 'all' || quotation.estado === statusFilter
      return matchesQuery && matchesStatus
    })
  }, [query, quotations, statusFilter])

  const kanbanColumns = useMemo(
    () =>
      QUOTATION_STATES.map((state) => ({
        state,
        meta: getQuotationStatusMeta(state),
        items: filtered.filter((quotation) => quotation.estado === state),
      })),
    [filtered],
  )

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-5 text-slate-900">
      {incomingQueriesBanner ? (
        <section
          className={cn(
            'rounded-[22px] border px-5 py-4 shadow-sm',
            incomingQueriesBanner.tone === 'error'
              ? 'border-red-200 bg-red-50 text-red-950'
              : 'border-amber-200 bg-amber-50 text-amber-950',
          )}
        >
          <p className="text-sm font-semibold">{incomingQueriesBanner.title}</p>
          <p className="mt-1 text-sm leading-6 opacity-90">{incomingQueriesBanner.message}</p>
        </section>
      ) : null}

      <IncomingQueriesPanel queries={incomingQueries} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs min-w-[240px] flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar quotation..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-950 placeholder-slate-400 focus:border-sky-300 focus:outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-950 focus:border-sky-300 focus:outline-none"
        >
          <option value="all">Todos los estados</option>
          <option value="new_entry">New entry</option>
          <option value="new">New</option>
          <option value="unassigned">Unassigned</option>
          <option value="ongoing">On going</option>
          <option value="pending_customer">Pending customer</option>
          <option value="pending_internal">Pending internal</option>
          <option value="rfi_sent">RFI sent</option>
          <option value="quotation_sent">Quotation sent</option>
          <option value="won">Won</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setView('list')}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              view === 'list'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            <List size={14} />
            Lista
          </button>
          <button
            type="button"
            onClick={() => setView('kanban')}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              view === 'kanban'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            <Columns3 size={14} />
            Kanban
          </button>
        </div>
      </div>

      <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-500">
          <span className="font-semibold text-slate-950">{filtered.length}</span> quotations
        </div>

        <div className="min-h-0 overflow-auto">
          {filtered.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-400">
              <FileText className="h-8 w-8" />
              <p className="text-sm">No hay quotations cargadas todavia</p>
            </div>
          ) : view === 'list' ? (
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  {['Numero', 'Cliente', 'Estado', 'Descripcion', 'Proyecto', 'Ultimo cambio', 'Accion'].map(
                    (column) => (
                      <th
                        key={column}
                        className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                      >
                        {column}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((quotation) => (
                  <tr
                    key={quotation.id}
                    className="border-b border-slate-200/60 align-top transition-colors hover:bg-sky-50/40"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500">
                      {quotation.numero_oferta ?? 'Sin numero'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {quotation.cliente?.nombre ?? 'Sin cliente'}
                    </td>
                    <td className="px-4 py-3">
                      <StateBadge state={quotation.estado} />
                    </td>
                    <td className="max-w-[340px] px-4 py-3 text-slate-700">
                      {quotation.descripcion ?? 'Sin descripcion'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {quotation.proyecto_relacionado ? (
                        <Link
                          href={`/engineering/projects/${quotation.proyecto_relacionado.id}`}
                          className="text-sky-700 hover:text-sky-900"
                        >
                          {quotation.proyecto_relacionado.numero_proyecto}
                        </Link>
                      ) : quotation.estado === 'won' ? (
                        <span className="text-emerald-700">Lista para activar proyecto</span>
                      ) : (
                        <span className="text-slate-400">Sin proyecto</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                      {quotation.estado_updated_at ?? quotation.updated_at ?? quotation.created_at}
                    </td>
                    <td className="px-4 py-3">
                      <WorkflowStateChanger
                        entity="quotation"
                        entityId={quotation.id}
                        currentState={quotation.estado}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="grid min-w-max grid-flow-col gap-4 overflow-x-auto p-4">
              {kanbanColumns.map((column) => (
                <section
                  key={column.state}
                  className="flex w-[320px] shrink-0 flex-col rounded-2xl border border-slate-200 bg-slate-50/80"
                >
                  <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">
                        {column.meta.label}
                      </p>
                      <p className="text-xs text-slate-500">
                        {column.items.length} quotation{column.items.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'inline-flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-xs font-semibold',
                        column.meta.color,
                        column.meta.bg,
                        column.meta.border,
                      )}
                    >
                      {column.items.length}
                    </span>
                  </header>

                  <div className="flex min-h-[240px] flex-1 flex-col gap-3 p-3">
                    {column.items.length === 0 ? (
                      <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 text-center text-xs text-slate-400">
                        Sin quotations en esta fase
                      </div>
                    ) : (
                      column.items.map((quotation) => (
                        <article
                          key={quotation.id}
                          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <p className="font-mono text-xs text-slate-500">
                                {quotation.numero_oferta ?? 'Sin numero'}
                              </p>
                              <p className="line-clamp-2 text-sm font-semibold text-slate-950">
                                {quotation.descripcion ?? 'Sin descripcion'}
                              </p>
                            </div>
                            <StateBadge state={quotation.estado} />
                          </div>

                          <div className="mt-3 space-y-2 text-sm text-slate-600">
                            <p>{quotation.cliente?.nombre ?? 'Sin cliente'}</p>
                            <p className="text-xs text-slate-500">
                              Ultimo cambio:{' '}
                              {quotation.estado_updated_at ??
                                quotation.updated_at ??
                                quotation.created_at}
                            </p>
                            {quotation.proyecto_relacionado ? (
                              <Link
                                href={`/engineering/projects/${quotation.proyecto_relacionado.id}`}
                                className="inline-flex text-xs font-medium text-sky-700 hover:text-sky-900"
                              >
                                {quotation.proyecto_relacionado.numero_proyecto}
                              </Link>
                            ) : quotation.estado === 'won' ? (
                              <p className="text-xs font-medium text-emerald-700">
                                Lista para activar proyecto
                              </p>
                            ) : null}
                          </div>

                          <div className="mt-4">
                            <WorkflowStateChanger
                              entity="quotation"
                              entityId={quotation.id}
                              currentState={quotation.estado}
                            />
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
