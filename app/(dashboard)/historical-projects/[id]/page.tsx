/**
 * ============================================================================
 * PAGINA SERVIDOR DE DETALLE DE UN PROYECTO HISTORICO — UI ONLY (frame)
 * ============================================================================
 */

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { TopBar } from '@/components/layout/TopBar'

export const dynamic = 'force-dynamic'

export default async function ProyectosHistoricoEntryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      <TopBar
        title="Entrada de project historical"
        subtitle={`Detalle del project historical ${id}`}
      />
      <div className="flex-1 space-y-6 overflow-y-auto p-6 text-[color:var(--ink)]">
        <Link
          href="/historical-projects"
          className="inline-flex items-center gap-1.5 text-sm text-[color:var(--ink-3)] transition-colors hover:text-[color:var(--ink-2)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Projects historicos
        </Link>

        <div className="text-center py-16 text-muted-foreground">Sin datos</div>
      </div>
    </div>
  )
}
