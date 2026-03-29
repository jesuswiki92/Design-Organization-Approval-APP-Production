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

  let proyectosData: Proyecto[] | null = null
  let clientesData: Cliente[] | null = null
  let modelosData: AeronaveModelo[] | null = null
  let usuariosData: UsuarioDoa[] | null = null

  try {
    const [
      { data: pData, error: proyectosError },
      { data: cData, error: clientesError },
      { data: mData, error: modelosError },
      { data: uData, error: usuariosError },
    ] = await Promise.all([
      supabase
        .from('doa_proyectos_generales')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase.from('doa_clientes_datos_generales').select('*'),
      supabase.from('doa_aeronaves_modelos').select('*'),
      supabase.from('doa_usuarios').select('*'),
    ])

    if (proyectosError) console.error('Error fetching doa_proyectos_generales:', proyectosError)
    if (clientesError) console.error('Error fetching doa_clientes_datos_generales:', clientesError)
    if (modelosError) console.error('Error fetching doa_aeronaves_modelos:', modelosError)
    if (usuariosError) console.error('Error fetching doa_usuarios:', usuariosError)

    proyectosData = pData as Proyecto[] | null
    clientesData = cData as Cliente[] | null
    modelosData = mData as AeronaveModelo[] | null
    usuariosData = uData as UsuarioDoa[] | null
  } catch (err) {
    console.error('Unexpected error fetching portfolio data:', err)
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
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      <TopBar title="Engineering" subtitle="Portfolio de proyectos" />
      <PortfolioClient projects={projects} />
    </div>
  )
}
