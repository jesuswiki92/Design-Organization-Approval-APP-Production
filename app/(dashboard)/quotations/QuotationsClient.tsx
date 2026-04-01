'use client'

import { QuotationStatesBoard } from './QuotationStatesBoard'

export function QuotationsClient() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-5 text-slate-900">
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <QuotationStatesBoard />
      </div>
    </div>
  )
}
