import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'

import ProyectosHistoricoEntryClient from './ProyectosHistoricoEntryClient'

export const dynamic = 'force-dynamic'

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

interface ProyectoHistoricoDocumentoRow {
  id: string
  familia_documento: string
  titulo: string
  codigo_documento: string | null
  edicion: string | null
  carpeta_documental: string | null
  ruta_relativa_pdf: string | null
  ruta_relativa_editable: string | null
  es_obsoleto: boolean
}

export default async function ProyectosHistoricoEntryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: project, error } = await supabase
    .from('doa_proyectos_historico')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  const { data: documentos, error: documentosError } = await supabase
    .from('doa_proyectos_historico_documentos')
    .select(
      'id, familia_documento, titulo, codigo_documento, edicion, carpeta_documental, ruta_relativa_pdf, ruta_relativa_editable, es_obsoleto',
    )
    .eq('proyecto_historico_id', id)
    .order('familia_documento', { ascending: true })
    .order('titulo', { ascending: true })

  if (error) {
    console.error('Error cargando proyecto historico desde doa_proyectos_historico:', error)
  }

  if (documentosError) {
    console.error(
      'Error cargando documentacion DOA desde doa_proyectos_historico_documentos:',
      documentosError,
    )
  }

  if (!project) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
        <TopBar
          title="Entrada de proyecto historico"
          subtitle="Ficha preparada para completar la informacion del proyecto"
        />
        <div className="flex min-h-0 flex-1 items-center justify-center px-5 py-8">
          <section className="w-full max-w-3xl rounded-[34px] border border-sky-100 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_52%,#f8fafc_100%)] p-6 shadow-[0_24px_50px_rgba(14,165,233,0.10)]">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              Proyecto historico no encontrado
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              No hemos podido cargar la ficha de entrada para este proyecto historico. Vuelve al
              listado y abre otra fila para continuar.
            </p>
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      <TopBar
        title="Entrada de proyecto historico"
        subtitle="Ficha preparada para completar la informacion del proyecto"
      />
      <ProyectosHistoricoEntryClient
        project={project as ProyectoHistoricoRow}
        documentos={(documentos ?? []) as ProyectoHistoricoDocumentoRow[]}
      />
    </div>
  )
}
