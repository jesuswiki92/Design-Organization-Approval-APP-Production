'use client'

import { useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Clock3,
  Filter,
  Search,
  ShieldCheck,
} from 'lucide-react'

import {
  describeEventEntity,
  shortIdentifier,
  summarizeEventMetadata,
  type AppEventLogRow,
  type LogsAnalysis,
} from '@/lib/observability/logs'
import { cn } from '@/lib/utils'

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function outcomeBadge(outcome: AppEventLogRow['outcome']) {
  switch (outcome) {
    case 'success':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'failure':
      return 'border-rose-200 bg-rose-50 text-rose-700'
    case 'attempt':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    default:
      return 'border-[color:var(--ink-4)] bg-[color:var(--paper-2)] text-[color:var(--ink-3)]'
  }
}

function sourceBadge(source: AppEventLogRow['eventSource']) {
  return source === 'client'
    ? 'border-[color:var(--ink-4)] bg-[color:var(--paper-2)] text-[color:var(--ink-2)]'
    : 'border-[color:var(--ink-4)] bg-[color:var(--paper-2)] text-[color:var(--ink-2)]'
}

function describeContext(event: AppEventLogRow) {
  return [
    event.method?.toUpperCase(),
    event.requestId ? `req ${shortIdentifier(event.requestId, 5, 4)}` : null,
    event.actorUserId ? `user ${shortIdentifier(event.actorUserId, 4, 4)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

function formatList(items: Array<{ label: string; count: number }>, fallback: string) {
  if (items.length === 0) return fallback
  return items.map((item) => `${item.label} (${item.count})`).join(', ')
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone = 'default',
  detail,
}: {
  icon: typeof Activity
  label: string
  value: string
  tone?: 'default' | 'danger' | 'success'
  detail: string
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : tone === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-[color:var(--ink-4)] bg-[color:var(--paper-2)] text-[color:var(--ink-3)]'

  return (
    <div className="rounded-[22px] border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-3)]">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
        </div>
        <div className={cn('rounded-2xl border p-2.5', toneClass)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-[color:var(--ink-3)]">{detail}</p>
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
        {label}
      </p>
      <p className="mt-1 text-sm text-slate-950">{value}</p>
    </div>
  )
}

export function LogsPageClient({
  events,
  analysis,
  loadError,
}: {
  events: AppEventLogRow[]
  analysis: LogsAnalysis
  loadError: string | null
}) {
  const [query, setQuery] = useState('')
  const [outcome, setOutcome] = useState<'all' | AppEventLogRow['outcome']>('all')
  const [selectedEventId, setSelectedEventId] = useState<string | null>(events[0]?.id ?? null)

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return events.filter((event) => {
      const matchesOutcome = outcome === 'all' || event.outcome === outcome
      if (!matchesOutcome) return false

      if (!normalizedQuery) return true

      const haystack = [
        event.eventName,
        event.eventCategory,
        event.route,
        event.entityType,
        event.entityCode,
        event.requestId,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedQuery)
    })
  }, [events, outcome, query])

  const resolvedSelectedEventId = filteredEvents.some((event) => event.id === selectedEventId)
    ? selectedEventId
    : filteredEvents[0]?.id ?? null

  const selectedEvent =
    filteredEvents.find((event) => event.id === resolvedSelectedEventId) ??
    events.find((event) => event.id === resolvedSelectedEventId) ??
    filteredEvents[0] ??
    events[0] ??
    null

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <SummaryCard
          icon={Activity}
          label="Actividad visible"
          value={`${analysis.sampleSize}`}
          detail={
            analysis.sampleWindowHours
              ? `Cobertura aproximada de ${analysis.sampleWindowHours}h en la muestra cargada.`
              : 'Sin rango temporal suficiente para estimar cobertura.'
          }
        />
        <SummaryCard
          icon={analysis.failuresLast24h > 0 ? AlertTriangle : ShieldCheck}
          label="Failures 24h"
          value={`${analysis.failuresLast24h}`}
          tone={analysis.failuresLast24h > 0 ? 'danger' : 'success'}
          detail={
            analysis.latestFailure
              ? `Ultimo failure: ${analysis.latestFailure.eventName} el ${formatTimestamp(analysis.latestFailure.createdAt)}.`
              : 'No hay failures visibles en la ventana actual.'
          }
        />
        <SummaryCard
          icon={Clock3}
          label="Ultima accion"
          value={analysis.latestOperationalEvent?.eventName ?? 'Sin mutacion'}
          detail={
            analysis.latestOperationalEvent
              ? `${describeEventEntity(analysis.latestOperationalEvent)} · ${formatTimestamp(analysis.latestOperationalEvent.createdAt)}`
              : 'La muestra actual solo contiene navegacion u eventos informativos.'
          }
        />
        <SummaryCard
          icon={Filter}
          label="Tipos mas comunes"
          value={analysis.topEvents[0]?.label ?? 'Sin datos'}
          detail={formatList(analysis.topEvents, 'No hay eventos suficientes para resumir tipos.')}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
        <div className="rounded-[24px] border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
          <div className="flex flex-col gap-4 border-b border-[color:var(--ink-4)] pb-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Analisis rapido</h2>
              <p className="mt-1 text-sm leading-6 text-[color:var(--ink-3)]">
                Lectura operativa de la muestra visible. El detalle mantiene metadata ya redacted.
              </p>
            </div>

            <div className="rounded-[18px] border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-4 py-3 text-sm text-[color:var(--ink-3)]">
              <p>
                Categorias dominantes:{' '}
                <span className="font-medium text-slate-950">
                  {formatList(analysis.topCategories, 'sin datos')}
                </span>
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {analysis.healthHints.map((hint) => (
              <div
                key={hint}
                className="rounded-[18px] border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-4 py-3 text-sm leading-6 text-[color:var(--ink-3)]"
              >
                {hint}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
          <h2 className="text-lg font-semibold text-slate-950">Cobertura y limites</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-[color:var(--ink-3)]">
            <p>
              Esta pagina muestra una muestra reciente, no un SIEM completo. Sirve para soporte operativo rapido y triage inicial.
            </p>
            <p>
              Los eventos se leen en servidor y no exponen cuerpos de correo, payloads ni campos sensibles.
            </p>
            <p>
              Si necesitas investigar correlacion profunda, usa <span className="font-mono text-slate-950">request_id</span> y el resto de logs del entorno.
            </p>
          </div>
        </div>
      </section>

      {loadError ? (
        <section className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 shadow-[0_10px_24px_rgba(251,113,133,0.12)]">
          <p className="font-semibold">No se pudo cargar la tabla de eventos.</p>
          <p className="mt-1">{loadError}</p>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.85fr)]">
        <div className="min-h-0 overflow-hidden rounded-[24px] border border-[color:var(--ink-4)] bg-[color:var(--paper)] shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
          <div className="border-b border-[color:var(--ink-4)] px-5 py-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Eventos recientes</h2>
                <p className="mt-1 text-sm text-[color:var(--ink-3)]">
                  {filteredEvents.length} visibles de {events.length} cargados
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="relative min-w-[240px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ink-3)]" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar evento, ruta o request..."
                    className="h-10 w-full rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] pl-9 pr-3 text-sm text-slate-950 placeholder:text-[color:var(--ink-3)] focus:border-[color:var(--ink-4)] focus:outline-none"
                  />
                </label>

                <label className="relative min-w-[180px]">
                  <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ink-3)]" />
                  <select
                    value={outcome}
                    onChange={(event) =>
                      setOutcome(event.target.value as 'all' | AppEventLogRow['outcome'])
                    }
                    className="h-10 w-full appearance-none rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] pl-9 pr-3 text-sm text-slate-950 focus:border-[color:var(--ink-4)] focus:outline-none"
                  >
                    <option value="all">Todos los outcomes</option>
                    <option value="failure">Failure</option>
                    <option value="success">Success</option>
                    <option value="attempt">Attempt</option>
                    <option value="info">Info</option>
                  </select>
                </label>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1120px] w-full text-left text-sm">
              <thead className="bg-[color:var(--paper-2)]">
                <tr className="border-b border-[color:var(--ink-4)]">
                  {['Hora', 'Evento', 'Outcome', 'Ruta', 'Entidad', 'Contexto'].map((heading) => (
                    <th
                      key={heading}
                      className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-3)]"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-sm text-[color:var(--ink-3)]">
                      No hay eventos que coincidan con los filtros actuales.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((event) => {
                    const metadataSummary = summarizeEventMetadata(event.metadata)
                    const isSelected = selectedEvent?.id === event.id

                    return (
                      <tr
                        key={event.id}
                        onClick={() => setSelectedEventId(event.id)}
                        className={cn(
                          'cursor-pointer border-b border-[color:var(--ink-4)]/80 align-top transition-colors',
                          isSelected ? 'bg-[color:var(--paper-2)]' : 'hover:bg-[color:var(--paper-3)]/45',
                        )}
                      >
                        <td className="px-4 py-3 align-top text-[color:var(--ink-3)]">
                          <div className="font-medium text-slate-950">
                            {new Date(event.createdAt).toLocaleTimeString('es-ES', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                          <div className="mt-1 text-xs text-[color:var(--ink-3)]">
                            {new Date(event.createdAt).toLocaleDateString('es-ES')}
                          </div>
                        </td>

                        <td className="px-4 py-3 align-top">
                          <div className="font-medium text-slate-950">{event.eventName}</div>
                          <div className="mt-1 text-xs text-[color:var(--ink-3)]">
                            {event.eventCategory} · {event.eventSource}
                          </div>
                          {metadataSummary.length > 0 ? (
                            <div className="mt-2 text-xs text-[color:var(--ink-3)]">
                              {metadataSummary
                                .map((entry) => `${entry.label}: ${entry.value}`)
                                .join(' · ')}
                            </div>
                          ) : null}
                        </td>

                        <td className="px-4 py-3 align-top">
                          <span
                            className={cn(
                              'inline-flex rounded-full border px-3 py-1 text-xs font-medium',
                              outcomeBadge(event.outcome),
                            )}
                          >
                            {event.outcome}
                          </span>
                        </td>

                        <td className="px-4 py-3 align-top text-[color:var(--ink-3)]">
                          <div className="font-medium text-slate-950">
                            {event.route ?? 'Sin ruta'}
                          </div>
                          <div className="mt-1 text-xs text-[color:var(--ink-3)]">
                            {event.method?.toUpperCase() ?? 'Sin metodo'}
                          </div>
                        </td>

                        <td className="px-4 py-3 align-top text-[color:var(--ink-3)]">
                          <div className="font-medium text-slate-950">
                            {describeEventEntity(event)}
                          </div>
                          <div className="mt-1 text-xs text-[color:var(--ink-3)]">
                            {event.entityType ?? 'Sin tipo'} ·{' '}
                            {shortIdentifier(event.entityId, 4, 4) ?? 'sin id'}
                          </div>
                        </td>

                        <td className="px-4 py-3 align-top text-[color:var(--ink-3)]">
                          {describeContext(event) || 'Sin contexto adicional'}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="min-h-0 rounded-[24px] border border-[color:var(--ink-4)] bg-[color:var(--paper)] shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
          <div className="border-b border-[color:var(--ink-4)] px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-950">Detalle del evento</h2>
            <p className="mt-1 text-sm text-[color:var(--ink-3)]">
              Selecciona una fila para ampliar su contexto operativo.
            </p>
          </div>

          <div className="space-y-4 p-5">
            {selectedEvent ? (
              <>
                <div className="rounded-[20px] border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex rounded-full border px-3 py-1 text-xs font-medium',
                        outcomeBadge(selectedEvent.outcome),
                      )}
                    >
                      {selectedEvent.outcome}
                    </span>
                    <span
                      className={cn(
                        'inline-flex rounded-full border px-3 py-1 text-xs font-medium',
                        sourceBadge(selectedEvent.eventSource),
                      )}
                    >
                      {selectedEvent.eventSource}
                    </span>
                  </div>

                  <h3 className="mt-3 text-base font-semibold text-slate-950">
                    {selectedEvent.eventName}
                  </h3>
                  <p className="mt-1 text-sm text-[color:var(--ink-3)]">{selectedEvent.eventCategory}</p>
                </div>

                <div className="grid gap-3">
                  <DetailField label="Fecha" value={formatTimestamp(selectedEvent.createdAt)} />
                  <DetailField label="Ruta" value={selectedEvent.route ?? 'Sin ruta'} />
                  <DetailField label="Entidad" value={describeEventEntity(selectedEvent)} />
                  <DetailField
                    label="Request ID"
                    value={shortIdentifier(selectedEvent.requestId, 8, 6) ?? 'Sin request id'}
                  />
                  <DetailField
                    label="Session ID"
                    value={shortIdentifier(selectedEvent.sessionId, 8, 6) ?? 'Sin session id'}
                  />
                  <DetailField
                    label="Actor"
                    value={shortIdentifier(selectedEvent.actorUserId, 8, 6) ?? 'Sin actor'}
                  />
                </div>

                <div className="rounded-[20px] border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-3)]">
                    Metadata resumida
                  </p>

                  {summarizeEventMetadata(selectedEvent.metadata).length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {summarizeEventMetadata(selectedEvent.metadata).map((entry) => (
                        <span
                          key={`${entry.label}-${entry.value}`}
                          className="rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-3 py-1 text-xs text-[color:var(--ink-3)]"
                        >
                          <span className="font-medium text-slate-950">{entry.label}:</span>{' '}
                          {entry.value}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-[color:var(--ink-3)]">
                      No hay claves primitivas relevantes para resumir en este evento.
                    </p>
                  )}

                  <pre className="mt-4 overflow-x-auto rounded-[16px] border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-3 text-xs leading-6 text-[color:var(--ink-3)]">
                    {JSON.stringify(selectedEvent.metadata, null, 2)}
                  </pre>
                </div>
              </>
            ) : (
              <div className="rounded-[20px] border border-dashed border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-4 py-6 text-sm leading-6 text-[color:var(--ink-3)]">
                No hay evento seleccionado. Ajusta los filtros o espera a que la tabla cargue nuevos registros.
              </div>
            )}
          </div>
        </aside>
      </section>
    </div>
  )
}
