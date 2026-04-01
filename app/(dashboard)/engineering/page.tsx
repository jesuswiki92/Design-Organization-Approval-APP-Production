import { TopBar } from '@/components/layout/TopBar'

import { EngineeringClient } from './EngineeringClient'

export default function EngineeringIndexPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f7fbff_0%,#eef6ff_44%,#f8fafc_100%)]">
      <TopBar title="Proyectos" subtitle="Vista principal de proyectos" />
      <EngineeringClient />
    </div>
  )
}
