import { notFound } from 'next/navigation'

import { ProjectWorkspaceClient } from '@/components/project/ProjectWorkspaceClient'
import { createClient } from '@/lib/supabase/server'
import type {
  AeronaveModelo,
  Cliente,
  Proyecto,
  ProyectoConRelaciones,
  ProyectoDocumento,
  ProyectoTarea,
  UsuarioDoa,
} from '@/types/database'

export default async function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: projectData, error: projectError } = await supabase
    .from('doa_proyectos_generales')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (projectError || !projectData) {
    notFound()
  }

  const baseProject = projectData as Proyecto

  const [
    { data: documentosData },
    { data: tareasData },
    { data: clienteData },
    { data: modeloData },
    { data: ownerData },
  ] = await Promise.all([
    supabase
      .from('doa_proyectos_documentos')
      .select('*')
      .eq('proyecto_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('doa_proyectos_tareas')
      .select('*')
      .eq('proyecto_id', id)
      .order('created_at', { ascending: true }),
    baseProject.cliente_id
      ? supabase
          .from('doa_clientes_datos_generales')
          .select('*')
          .eq('id', baseProject.cliente_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    baseProject.modelo_id
      ? supabase
          .from('doa_aeronaves_modelos')
          .select('*')
          .eq('id', baseProject.modelo_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    baseProject.owner_id
      ? supabase.from('doa_usuarios').select('*').eq('id', baseProject.owner_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  const project: ProyectoConRelaciones = {
    ...baseProject,
    cliente: (clienteData as Cliente | null) ?? null,
    modelo: (modeloData as AeronaveModelo | null) ?? null,
    owner: (ownerData as UsuarioDoa | null) ?? null,
  }

  const docs = (documentosData ?? []) as ProyectoDocumento[]
  const tasks = (tareasData ?? []) as ProyectoTarea[]

  return <ProjectWorkspaceClient project={project} docs={docs} tasks={tasks} />
}
