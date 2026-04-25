/**
 * Cola de projects pendientes de validation — UI ONLY (frame).
 */
import { TopBar } from '@/components/layout/TopBar'

import { ValidationsClient } from './ValidationsClient'

export const dynamic = 'force-dynamic'

export default function ValidationsQueuePage() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      <TopBar
        title="Validaciones"
        subtitle="Projects pendientes de validation DOH/DOS"
      />
      <ValidationsClient items={[]} />
    </div>
  )
}
