/**
 * ============================================================================
 * PAGINA SERVIDOR: TABLERO DE PROYECTOS — UI ONLY (frame)
 * ============================================================================
 */
import { TopBar } from '@/components/layout/TopBar'

import { TableroClient } from './TableroClient'

export const dynamic = 'force-dynamic'

export default function EngineeringPortfolioTableroPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      <TopBar title="Projects" subtitle="Tablero por fase y status" />
      <TableroClient projects={[]} />
    </div>
  )
}
