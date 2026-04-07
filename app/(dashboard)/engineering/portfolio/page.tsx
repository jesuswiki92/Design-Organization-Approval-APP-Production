// ⏸️ BASE DE DATOS DESCONECTADA - ver BASES-DE-DATOS.md para reconectar
import { TopBar } from '@/components/layout/TopBar'
import type { Proyecto } from '@/types/database'
import { PortfolioClient } from './PortfolioClient'

export default async function EngineeringPortfolioPage() {
  const projects: Proyecto[] = []

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      <TopBar title="Proyectos" subtitle="Portfolio de proyectos" />
      <PortfolioClient projects={projects} />
    </div>
  )
}
