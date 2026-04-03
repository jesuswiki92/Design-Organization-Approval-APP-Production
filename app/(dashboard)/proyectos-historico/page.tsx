import { createClient } from '@/lib/supabase/server'

import ProyectosHistoricoPageClient from './ProyectosHistoricoPageClient'

interface ProyectoHistoricoRow {
  id: string
  numero_proyecto: string
  titulo: string
  descripcion: string | null
  cliente_nombre: string | null
  anio: number | null
  ruta_origen: string | null
  nombre_carpeta_origen: string | null
  created_at: string
  updated_at: string
}

export default async function ProyectosHistoricoPage() {
  const supabase = await createClient()
  const { data: projectRows, error } = await supabase
    .from('doa_proyectos_historico')
    .select('*')
    .order('numero_proyecto', { ascending: true })

  if (error) {
    console.error('Error cargando proyectos historicos desde doa_proyectos_historico:', error)
  }

  const projects: ProyectoHistoricoRow[] = projectRows ?? []

  return <ProyectosHistoricoPageClient projects={projects} />
}
