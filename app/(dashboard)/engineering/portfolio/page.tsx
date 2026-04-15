/**
 * Portfolio de proyectos (engineering). Server component.
 *
 * Sprint 1: lectura real de `doa_proyectos` via el cliente Supabase SSR.
 * Los estados se muestran en el cliente usando `getProjectExecutionStateMeta`
 * (maquina v2) cuando `estado_v2` esta presente, y como fallback legacy
 * cuando no.
 */
import { TopBar } from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/server'
import type { Proyecto } from '@/types/database'

import { PortfolioClient } from './PortfolioClient'

export const dynamic = 'force-dynamic'

export default async function EngineeringPortfolioPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('doa_proyectos')
    .select(
      'id, numero_proyecto, titulo, descripcion, aeronave, modelo, cliente_nombre, ' +
        'estado, estado_v2, fase_actual, estado_updated_at, ruta_proyecto, consulta_id, ' +
        'owner, checker, approval, cve, fecha_inicio, fecha_entrega_estimada, fecha_cierre, ' +
        'prioridad, anio, notas, tcds_code, tcds_code_short, msn, client_id, created_at, updated_at',
    )
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Portfolio: error leyendo doa_proyectos:', error)
  }

  const projects = (data ?? []) as Proyecto[]

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      <TopBar title="Proyectos" subtitle="Portfolio de proyectos" />
      <PortfolioClient projects={projects} />
    </div>
  )
}
