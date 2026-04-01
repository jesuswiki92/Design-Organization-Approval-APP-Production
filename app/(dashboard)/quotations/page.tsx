// ? Quotations board/list surface
import { TopBar } from '@/components/layout/TopBar'
import { getWorkflowStateConfigRows } from '@/lib/workflow-state-config.server'
import { WORKFLOW_STATE_SCOPES } from '@/lib/workflow-state-config'

import { QuotationsClient } from './QuotationsClient'

export const dynamic = 'force-dynamic'

export default async function QuotationsPage() {
  const stateConfigRows = await getWorkflowStateConfigRows([
    WORKFLOW_STATE_SCOPES.QUOTATION_BOARD,
    WORKFLOW_STATE_SCOPES.INCOMING_QUERIES,
  ])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      <TopBar title="Quotations" subtitle="Seguimiento comercial previo al proyecto" />
      <QuotationsClient initialStateConfigRows={stateConfigRows} />
    </div>
  )
}
