/**
 * ============================================================================
 * PAGINA SERVIDOR DE DETALLE DE UN PROYECTO
 * ============================================================================
 *
 * Carga el project desde doa_projects y sus entradas de conteo de horas
 * desde doa_project_time_entries, y pasa ambos al componente visual
 * ProjectDetailClient.
 *
 * Si el project no existe, redirige a /engineering/portfolio.
 * ============================================================================
 */

import { redirect } from 'next/navigation'

import { TopBar } from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/server'
import type { Project, ProjectTimeEntry } from '@/types/database'

import { ProjectDetailClient } from './ProjectDetailClient'

export const dynamic = 'force-dynamic'

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Cargar project y entradas de horas en paralelo
  const [proyectoResult, horasResult] = await Promise.all([
    supabase
      .from('doa_projects')
      .select('*')
      .eq('id', id)
      .single(),
    supabase
      .from('doa_project_time_entries')
      .select('*')
      .eq('project_id', id)
      .order('started_at', { ascending: false }),
  ])

  if (proyectoResult.error || !proyectoResult.data) {
    console.error('Project no encontrado o error:', proyectoResult.error)
    redirect('/engineering/portfolio')
  }

  if (horasResult.error) {
    console.error('Error cargando horas del project:', horasResult.error)
  }

  const project = proyectoResult.data as Project
  const timeEntries = (horasResult.data ?? []) as ProjectTimeEntry[]

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      <TopBar
        title={project.project_number}
        subtitle={project.title}
      />
      <ProjectDetailClient project={project} timeEntries={timeEntries} />
    </div>
  )
}
