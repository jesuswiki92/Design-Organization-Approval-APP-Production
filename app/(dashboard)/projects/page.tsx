/**
 * ============================================================================
 * PAGINA SERVIDOR DE PROYECTOS ACTIVOS — UI ONLY (frame)
 * ============================================================================
 */

import { TopBar } from '@/components/layout/TopBar'
import { ProjectsClient } from './ProjectsClient'

export const dynamic = 'force-dynamic'

export default function ProyectosPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      <TopBar title="Projects" subtitle="Projects activos de ingenieria" />

      <ProjectsClient
        initialProyectos={[]}
        initialStateConfigRows={[]}
      />
    </div>
  )
}
