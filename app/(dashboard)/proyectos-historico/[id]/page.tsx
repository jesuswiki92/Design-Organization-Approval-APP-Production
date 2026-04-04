/**
 * ============================================================================
 * PAGINA SERVIDOR DE DETALLE DE UN PROYECTO HISTORICO
 * ============================================================================
 *
 * Esta pagina carga los datos de UN proyecto historico concreto desde la
 * base de datos y los pasa al componente visual (ProyectosHistoricoEntryClient)
 * para que se muestren como una "ficha" completa.
 *
 * QUE HACE:
 *   1. Lee el identificador del proyecto desde la URL (ej: /proyectos-historico/abc123)
 *   2. Busca ese proyecto en la tabla "doa_proyectos_historico" (incluye mdl_contenido)
 *   3. Si el proyecto existe, muestra la ficha completa
 *   4. Si no existe, muestra un mensaje de error
 *
 * NOTA TECNICA: La carpeta se llama [id] con corchetes porque en Next.js
 * eso significa que es una ruta DINAMICA — el valor de "id" cambia segun
 * el proyecto que el usuario haya seleccionado.
 * ============================================================================
 */

// Funcion para conectarse a la base de datos Supabase desde el servidor
import { createClient } from '@/lib/supabase/server'
// Barra superior de la pagina con titulo y subtitulo
import { TopBar } from '@/components/layout/TopBar'

// Componente visual interactivo que muestra toda la ficha del proyecto
import ProyectosHistoricoEntryClient from './ProyectosHistoricoEntryClient'

// Forzar que esta pagina se regenere en cada visita (no usar cache)
export const dynamic = 'force-dynamic'

/** Estructura de datos de un proyecto historico (tabla principal) */
interface ProyectoHistoricoRow {
  id: string                          // Identificador unico
  numero_proyecto: string             // Codigo del proyecto
  titulo: string                      // Nombre del proyecto
  descripcion: string | null          // Descripcion libre
  cliente_nombre: string | null       // Nombre del cliente
  anio: number | null                 // Anio del proyecto
  ruta_origen: string | null          // Ruta de la carpeta original
  nombre_carpeta_origen: string | null // Nombre corto de la carpeta
  mdl_contenido: import('@/types/database').MdlContenido | null // Master Document List (JSONB)
  created_at: string                  // Fecha de creacion
  updated_at: string                  // Fecha de ultima actualizacion
}

/** Estructura de datos de un documento/familia documental del proyecto historico */
interface ProyectoHistoricoDocumentoRow {
  id: string
  proyecto_historico_id: string
  orden_documental: number | null
  familia_documental: string
  carpeta_origen: string
  ruta_origen: string
  archivo_referencia: string | null
  total_archivos: number
  formatos_disponibles: string[]
  created_at: string
  updated_at: string
}

/**
 * Funcion principal de la pagina de detalle.
 * Se ejecuta en el servidor cuando alguien visita /proyectos-historico/[id].
 */
export default async function ProyectosHistoricoEntryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // Paso 1: Extraer el identificador del proyecto de la URL
  const { id } = await params

  // Paso 2: Conectar con Supabase y buscar el proyecto con ese ID
  const supabase = await createClient()
  const { data: project, error } = await supabase
    .from('doa_proyectos_historico')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  // Si hay error de base de datos, registrarlo en la consola
  if (error) {
    console.error('Error cargando proyecto historico desde doa_proyectos_historico:', error)
  }

  // Paso 3: Cargar las familias documentales del proyecto (tabla doa_proyectos_historico_documentos)
  let documentos: ProyectoHistoricoDocumentoRow[] = []
  if (project) {
    const { data: docs, error: docsError } = await supabase
      .from('doa_proyectos_historico_documentos')
      .select('*')
      .eq('proyecto_historico_id', project.id)
      .order('orden_documental')

    if (docsError) {
      console.error('Error cargando documentos del proyecto historico:', docsError)
    } else {
      documentos = (docs ?? []) as ProyectoHistoricoDocumentoRow[]
    }
  }

  // Si el proyecto no existe, mostrar mensaje de error al usuario
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

  // Paso 4: El proyecto existe — mostrar la ficha completa (mdl_contenido viene incluido en el registro)
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      {/* Barra superior con titulo de la pagina */}
      <TopBar
        title="Entrada de proyecto historico"
        subtitle="Ficha preparada para completar la informacion del proyecto"
      />
      {/* Componente visual interactivo con todos los datos del proyecto y sus documentos */}
      <ProyectosHistoricoEntryClient
        project={project as ProyectoHistoricoRow}
        documentos={documentos}
      />
    </div>
  )
}
