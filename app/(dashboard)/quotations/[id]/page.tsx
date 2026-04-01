import { TopBar } from '@/components/layout/TopBar'
import { getWorkflowStateConfigRows } from '@/lib/workflow-state-config.server'
import { WORKFLOW_STATE_SCOPES } from '@/lib/workflow-state-config'

import { QuotationDetailClient } from './QuotationDetailClient'

export const dynamic = 'force-dynamic'

export default async function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const stateConfigRows = await getWorkflowStateConfigRows([
    WORKFLOW_STATE_SCOPES.QUOTATION_BOARD,
  ])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,#eff6ff_0%,#f8fbff_34%,#f8fafc_100%)]">
      <TopBar
        title="Detalle de quotation"
        subtitle="Vista preparada para alojar todo el detalle operativo de la oferta"
      />
      <QuotationDetailClient id={id} initialStateConfigRows={stateConfigRows} />
    </div>
  )
}
