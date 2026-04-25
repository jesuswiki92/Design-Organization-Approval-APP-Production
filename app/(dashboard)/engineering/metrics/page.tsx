/**
 * Panel de metricas operativas — UI ONLY (frame).
 */

import { TopBar } from '@/components/layout/TopBar'

import { MetricsClient } from './MetricsClient'

export const dynamic = 'force-dynamic'

export default function EngineeringMetricsPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      <TopBar
        title="Metricas operativas"
        subtitle="Panel agregado de projects, validaciones y deliveries"
      />
      <MetricsClient
        rows={[]}
        fallbackMode={false}
        fallbackReason={null}
      />
    </div>
  )
}
