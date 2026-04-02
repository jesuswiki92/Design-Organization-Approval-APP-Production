'use client'

import type { WorkflowStateConfigRow } from '@/types/database'

import type { IncomingQuery } from './incoming-queries'
import { QuotationStatesBoard } from './QuotationStatesBoard'

export function QuotationsClient({
  initialIncomingQueries,
  initialStateConfigRows,
}: {
  initialIncomingQueries: IncomingQuery[]
  initialStateConfigRows: WorkflowStateConfigRow[]
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-5 text-slate-900">
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <QuotationStatesBoard
          initialIncomingQueries={initialIncomingQueries}
          initialStateConfigRows={initialStateConfigRows}
        />
      </div>
    </div>
  )
}
