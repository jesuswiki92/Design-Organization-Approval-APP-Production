import Link from 'next/link'

import { TopBar } from '@/components/layout/TopBar'
import { requireUserAction } from '@/lib/auth/require-user'
import {
  buildLogsAnalysis,
  normalizeAppEventRows,
  type AppEventLogRow,
} from '@/lib/observability/logs'
import { createAdminClient } from '@/lib/supabase/admin'

import { LogsPageClient } from './LogsPageClient'

export const dynamic = 'force-dynamic'

const RECENT_EVENTS_LIMIT = 200

const EVENT_SELECT_COLUMNS = [
  'id',
  'created_at',
  'event_name',
  'event_category',
  'event_source',
  'outcome',
  'actor_user_id',
  'request_id',
  'session_id',
  'route',
  'method',
  'entity_type',
  'entity_id',
  'entity_code',
  'metadata',
  'referrer',
].join(', ')

async function loadRecentEvents() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('doa_app_events' as never)
    .select(EVENT_SELECT_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(RECENT_EVENTS_LIMIT)

  if (error) {
    throw new Error(`No se pudieron cargar los eventos: ${error.message}`)
  }

  return normalizeAppEventRows((data ?? []) as unknown[])
}

export default async function SettingsLogsPage() {
  await requireUserAction()

  let events: AppEventLogRow[] = []
  let loadError: string | null = null

  try {
    events = await loadRecentEvents()
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : 'No se pudieron cargar los eventos de observabilidad.'
  }

  const analysis = buildLogsAnalysis(events)

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      <TopBar
        title="Settings / Logs"
        subtitle="Superficie operativa para revisar observabilidad reciente de la aplicacion"
      />

      <main className="flex-1 space-y-6 overflow-y-auto p-6 text-[color:var(--ink)]">
        <section className="rounded-[24px] border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-6 py-5 shadow-[0_18px_45px_rgba(148,163,184,0.16)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-2)]">
                Observabilidad
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                Logs operativos recientes
              </h2>
              <p className="mt-2 text-sm leading-7 text-[color:var(--ink-3)]">
                Esta vista lee <code>doa_app_events</code> en servidor con el patron
                autenticado y privilegiado ya usado por la app. El objetivo es soporte:
                detectar fallos recientes, entender que flujo esta activo y revisar el
                contexto redacted de cada evento sin exponer contenido sensible.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <div className="rounded-[18px] border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-4 py-3 text-right shadow-sm">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--ink-3)]">
                  Muestra cargada
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-950">
                  {analysis.sampleSize} eventos
                </p>
                <p className="text-xs text-[color:var(--ink-3)]">
                  Ultimos {RECENT_EVENTS_LIMIT} registros como maximo
                </p>
              </div>

              <Link
                href="/settings"
                className="inline-flex h-11 items-center rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-4 text-sm font-medium text-[color:var(--ink-2)] shadow-sm transition-colors hover:border-[color:var(--ink-4)] hover:text-[color:var(--ink-2)]"
              >
                Volver a Settings
              </Link>
            </div>
          </div>
        </section>

        <LogsPageClient events={events} analysis={analysis} loadError={loadError} />
      </main>
    </div>
  )
}
