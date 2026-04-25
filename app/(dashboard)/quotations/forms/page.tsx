/**
 * ============================================================================
 * PAGINA DEL CATALOGO DE FORMULARIOS DE QUOTATIONS — UI ONLY (frame)
 * ============================================================================
 */

import Link from 'next/link'
import { ArrowLeft, FileText } from 'lucide-react'

import { TopBar } from '@/components/layout/TopBar'

export const dynamic = 'force-dynamic'

export default function QuotationsFormsCatalogPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      <TopBar title="Forms" subtitle="Catalogo internal de forms de quotations" />

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-5 pb-8 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/quotations"
            className="inline-flex items-center rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-4 py-2 text-sm font-medium text-[color:var(--ink)] shadow-sm transition-colors hover:bg-[color:var(--paper-3)]"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a quotations
          </Link>

          <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper)]/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-2)] shadow-sm">
            <FileText className="h-3.5 w-3.5" />
            n8n generated URLs
          </div>
        </div>

        <section className="rounded-[34px] border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-6 shadow-[0_24px_50px_rgba(14,165,233,0.10)]">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              Forms disponibles
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-[color:var(--ink-3)]">
              Catalogo de forms vinculados a solicitudes entrantes.
            </p>
          </div>
        </section>

        <div className="text-center py-16 text-muted-foreground">Sin datos</div>
      </div>
    </div>
  )
}
