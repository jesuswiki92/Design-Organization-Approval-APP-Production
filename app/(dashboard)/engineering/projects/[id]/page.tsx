/**
 * ============================================================================
 * PAGINA SERVIDOR DE DETALLE DE UN PROYECTO
 * ============================================================================
 *
 * Carga el proyecto desde doa_proyectos y sus entradas de conteo de horas
 * desde doa_conteo_horas_proyectos, y pasa ambos al componente visual
 * ProjectDetailClient.
 *
 * Si el proyecto no existe, redirige a /engineering/portfolio.
 * ============================================================================
 */

import { redirect } from 'next/navigation'

import { TopBar } from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/server'
import type { Proyecto, ConteoHorasProyecto } from '@/types/database'

import { ProjectDetailClient } from './ProjectDetailClient'

export const dynamic = 'force-dynamic'

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Cargar proyecto y entradas de horas en paralelo
  const [proyectoResult, horasResult] = await Promise.all([
    supabase
      .from('doa_proyectos')
      .select('*')
      .eq('id', id)
      .single(),
    supabase
      .from('doa_conteo_horas_proyectos')
      .select('*')
      .eq('proyecto_id', id)
      .order('inicio', { ascending: false }),
  ])

  if (proyectoResult.error || !proyectoResult.data) {
    console.error('Proyecto no encontrado o error:', proyectoResult.error)
    redirect('/engineering/portfolio')
  }

  if (horasResult.error) {
    console.error('Error cargando horas del proyecto:', horasResult.error)
  }

  const project = proyectoResult.data as Proyecto
  const timeEntries = (horasResult.data ?? []) as ConteoHorasProyecto[]

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      <TopBar
        title={project.numero_proyecto}
        subtitle={project.titulo}
      />
      <ProjectDetailClient project={project} timeEntries={timeEntries} />
    </div>
  )
}
