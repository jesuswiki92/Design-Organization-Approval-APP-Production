/**
 * ============================================================================
 * PAGINA SERVIDOR DE QUOTATIONS — UI ONLY (frame)
 * ============================================================================
 * Frame UI sin backend: pasamos arrays vacios y configuracion vacia al cliente.
 * ============================================================================
 */

import Link from 'next/link'
import { FileText } from 'lucide-react'

import { TopBar } from '@/components/layout/TopBar'
import { QuotationsClient } from './QuotationsClient'
import { RefreshInboundEmailsButton } from './RefreshInboundEmailsButton'

export const dynamic = 'force-dynamic'

export default function QuotationsPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      <TopBar title="Quotations" subtitle="Seguimiento commercial previo al project" />

      <div className="flex flex-row items-center gap-2 px-5 pb-0 pt-5">
        <Link
          href="/quotations/forms"
          className="inline-flex items-center rounded-xl border border-[color:var(--line)] bg-transparent px-4 py-2 text-sm font-semibold text-[color:var(--ink-2)] transition-colors hover:bg-[color:var(--paper-3)]"
        >
          <FileText className="mr-2 h-4 w-4" />
          Forms
        </Link>
        <RefreshInboundEmailsButton />
      </div>

      <QuotationsClient
        initialIncomingQueries={[]}
        initialStateConfigRows={[]}
      />
    </div>
  )
}
