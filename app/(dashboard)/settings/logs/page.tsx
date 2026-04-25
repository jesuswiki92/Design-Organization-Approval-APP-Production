import Link from 'next/link'

import { TopBar } from '@/components/layout/TopBar'

export const dynamic = 'force-dynamic'

export default function SettingsLogsPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      <TopBar
        title="Settings / Logs"
        subtitle="Superficie operativa para revisar observabilidad reciente de la aplicacion"
      />

      <div className="flex-1 space-y-6 overflow-y-auto p-6 text-[color:var(--ink)]">
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
                Esta vista esta desconectada en el frame UI-only.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <Link
                href="/settings"
                className="inline-flex h-11 items-center rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-4 text-sm font-medium text-[color:var(--ink-2)] shadow-sm transition-colors hover:border-[color:var(--ink-4)] hover:text-[color:var(--ink-2)]"
              >
                Volver a Settings
              </Link>
            </div>
          </div>
        </section>

        <div className="text-center py-16 text-muted-foreground">Sin datos</div>
      </div>
    </div>
  )
}
