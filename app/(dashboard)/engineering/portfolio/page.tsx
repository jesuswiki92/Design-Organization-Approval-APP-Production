import { TopBar } from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/server'
import type {
  AeronaveModelo,
  Cliente,
  Proyecto,
  ProyectoConRelaciones,
  UsuarioDoa,
} from '@/types/database'
import { PortfolioClient } from './PortfolioClient'

export default async function EngineeringPortfolioPage() {
  const supabase = await createClient()

  const [
    { data: proyectosData, error: proyectosError },
    { data: clientesData, error: clientesError },
    { data: modelosData, error: modelosError },
    { data: usuariosData, error: usuariosError },
  ] = await Promise.all([
    supabase
      .from('doa_proyectos_generales')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase.from('doa_clientes_datos_generales').select('*'),
    supabase.from('doa_aeronaves_modelos').select('*'),
    supabase.from('doa_usuarios').select('*'),
  ])

  if (proyectosError) {
    console.error('Error fetching doa_proyectos_generales:', proyectosError)
  }
  if (clientesError) {
    console.error('Error fetching doa_clientes_datos_generales:', clientesError)
  }
  if (modelosError) {
    console.error('Error fetching doa_aeronaves_modelos:', modelosError)
  }
  if (usuariosError) {
    console.error('Error fetching doa_usuarios:', usuariosError)
  }

  const clientes = new Map(
    ((clientesData ?? []) as Cliente[]).map((cliente) => [cliente.id, cliente]),
  )
  const modelos = new Map(
    ((modelosData ?? []) as AeronaveModelo[]).map((modelo) => [modelo.id, modelo]),
  )
  const usuarios = new Map(
    ((usuariosData ?? []) as UsuarioDoa[]).map((usuario) => [usuario.id, usuario]),
  )

  const projects: ProyectoConRelaciones[] = ((proyectosData ?? []) as Proyecto[]).map(
    (project) => ({
      ...project,
      cliente: project.cliente_id ? clientes.get(project.cliente_id) ?? null : null,
      modelo: project.modelo_id ? modelos.get(project.modelo_id) ?? null : null,
      owner: project.owner_id ? usuarios.get(project.owner_id) ?? null : null,
    }),
  )

  return (
    <div className="flex flex-col h-full bg-[#0F1117]">
      <TopBar title="Engineering" subtitle="Portfolio de proyectos" />
      <PortfolioClient projects={projects} />
    </div>
  )
}
