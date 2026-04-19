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
import type {
  MdlContenido,
  MdlDocumento,
  ProyectoHistoricoArchivo,
  ProyectoHistoricoRow,
} from '@/types/database'
// Barra superior de la pagina con titulo y subtitulo
import { TopBar } from '@/components/layout/TopBar'

// Componente visual interactivo que muestra toda la ficha del proyecto
import ProyectosHistoricoEntryClient from './ProyectosHistoricoEntryClient'

// Forzar que esta pagina se regenere en cada visita (no usar cache)
export const dynamic = 'force-dynamic'

/** Estructura de datos de un documento/familia documental del proyecto historico,
 *  con sus archivos asociados (join con doa_proyectos_historico_archivos). */
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
  archivos: ProyectoHistoricoArchivo[]
}

/** Tipo del row enriquecido que pasa el server al client: mdl_contenido y
 *  compliance_docs_md siempre llegan con shape canonico (o null). */
type ProyectoHistoricoDetailRow = Omit<
  ProyectoHistoricoRow,
  'mdl_contenido' | 'compliance_docs_md'
> & {
  mdl_contenido: MdlContenido | null
  compliance_docs_md:
    | Record<string, { title: string; familia: string; content_md: string }>
    | null
}

/**
 * Normaliza el campo mdl_contenido al shape canonico que espera el cliente:
 *   { entregables: MdlDocumento[], no_entregables: MdlDocumento[] }
 *
 * La base de datos puede devolver cualquiera de estos casos:
 *   - null                                        -> null
 *   - { estado: "pendiente_parseo", ... }         -> null (MDL sin parsear)
 *   - { entregables: [...], no_entregables: [...]} -> se devuelve tal cual
 *   - cualquier otro objeto sin las claves esperadas -> null
 */
function normalizeMdlContenido(raw: unknown): MdlContenido | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const entregables = Array.isArray(obj.entregables) ? (obj.entregables as MdlDocumento[]) : null
  const noEntregables = Array.isArray(obj.no_entregables)
    ? (obj.no_entregables as MdlDocumento[])
    : null
  if (!entregables && !noEntregables) return null
  return {
    entregables: entregables ?? [],
    no_entregables: noEntregables ?? [],
  }
}

/**
 * Normaliza compliance_docs_md al shape Record<codigo, {title, familia, content_md}>.
 *
 * La base de datos puede devolver:
 *   - null                                         -> null
 *   - Array<{codigo, titulo, edicion, ...}>        -> se convierte a Record por codigo
 *   - Record<string, {title, familia, content_md}> -> se devuelve tal cual
 */
function normalizeComplianceDocsMd(
  raw: unknown,
): Record<string, { title: string; familia: string; content_md: string }> | null {
  if (!raw) return null
  if (Array.isArray(raw)) {
    const result: Record<string, { title: string; familia: string; content_md: string }> = {}
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue
      const entry = item as Record<string, unknown>
      const codigo = typeof entry.codigo === 'string' ? entry.codigo : null
      if (!codigo) continue
      result[codigo] = {
        title:
          (typeof entry.title === 'string' && entry.title) ||
          (typeof entry.titulo === 'string' && entry.titulo) ||
          codigo,
        familia: typeof entry.familia === 'string' ? entry.familia : '',
        content_md: typeof entry.content_md === 'string' ? entry.content_md : '',
      }
    }
    return Object.keys(result).length > 0 ? result : null
  }
  if (typeof raw === 'object') {
    return raw as Record<string, { title: string; familia: string; content_md: string }>
  }
  return null
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
  //         + sus archivos asociados (join con doa_proyectos_historico_archivos)
  let documentos: ProyectoHistoricoDocumentoRow[] = []
  if (project) {
    const { data: docs, error: docsError } = await supabase
      .from('doa_proyectos_historico_documentos')
      .select('*, archivos:doa_proyectos_historico_archivos(*)')
      .eq('proyecto_historico_id', project.id)
      .order('orden_documental')

    if (docsError) {
      console.error('Error cargando documentos del proyecto historico:', docsError)
    } else {
      documentos = ((docs ?? []) as ProyectoHistoricoDocumentoRow[]).map((d) => ({
        ...d,
        archivos: Array.isArray(d.archivos) ? d.archivos : [],
      }))
    }
  }

  // Si el proyecto no existe, mostrar mensaje de error al usuario
  if (!project) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
        <TopBar
          title="Entrada de proyecto historico"
          subtitle="Ficha preparada para completar la informacion del proyecto"
        />
        <div className="flex min-h-0 flex-1 items-center justify-center px-5 py-8">
          <section className="w-full max-w-3xl rounded-[34px] border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-6 shadow-[0_24px_50px_rgba(14,165,233,0.10)]">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              Proyecto historico no encontrado
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--ink-3)]">
              No hemos podido cargar la ficha de entrada para este proyecto historico. Vuelve al
              listado y abre otra fila para continuar.
            </p>
          </section>
        </div>
      </div>
    )
  }

  // Paso 4: Normalizar campos JSONB antes de pasar al cliente. La BBDD puede
  //         devolver shapes inesperados (p.ej. mdl_contenido sin parsear como
  //         objeto sin las claves entregables/no_entregables, o compliance_docs_md
  //         como array en vez de Record). El cliente espera shape canonico.
  const projectSafe: ProyectoHistoricoDetailRow = {
    ...(project as ProyectoHistoricoRow),
    mdl_contenido: normalizeMdlContenido((project as ProyectoHistoricoRow).mdl_contenido),
    compliance_docs_md: normalizeComplianceDocsMd(
      (project as ProyectoHistoricoRow).compliance_docs_md,
    ),
  }

  // Paso 5: El proyecto existe — mostrar la ficha completa (mdl_contenido viene incluido en el registro)
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      {/* Barra superior con titulo de la pagina */}
      <TopBar
        title="Entrada de proyecto historico"
        subtitle="Ficha preparada para completar la informacion del proyecto"
      />
      {/* Componente visual interactivo con todos los datos del proyecto y sus documentos */}
      <ProyectosHistoricoEntryClient project={projectSafe} documentos={documentos} />
    </div>
  )
}
