/**
 * ============================================================================
 * PAGINA SERVIDOR DE DETALLE DE UN PROYECTO HISTORICO
 * ============================================================================
 *
 * Esta page carga los data de UN project historical concreto desde la
 * base de data y los pasa al componente visual (HistoricalProjectEntryClient)
 * para que se muestren como una "ficha" completa.
 *
 * QUE HACE:
 *   1. Lee el identificador del project desde la URL (ej: /historical-projects/abc123)
 *   2. Busca ese project en la table "doa_historical_projects" (incluye mdl_content)
 *   3. Si el project existe, muestra la ficha completa
 *   4. Si no existe, muestra un mensaje de error
 *
 * NOTA TECNICA: La folder se llama [id] con corchetes porque en Next.js
 * eso significa que es una path DINAMICA — el valor de "id" cambia segun
 * el project que el user_label haya seleccionado.
 * ============================================================================
 */

// Funcion para conectarse a la base de data Supabase desde el servidor
import { createClient } from '@/lib/supabase/server'
import type {
  MdlContent,
  MdlDocument,
  HistoricalProjectFile,
  HistoricalProjectRow,
} from '@/types/database'
// Barra superior de la page con title y subtitulo
import { TopBar } from '@/components/layout/TopBar'

// Componente visual interactivo que muestra toda la ficha del project
import HistoricalProjectEntryClient from './HistoricalProjectEntryClient'

// Forzar que esta page se regenere en cada visita (no usar cache)
export const dynamic = 'force-dynamic'

/** Estructura de data de un document/family documental del project historical,
 *  con sus archivos asociados (join con doa_historical_projects_archivos). */
interface ProyectoHistoricoDocumentoRow {
  id: string
  historical_project_id: string
  orden_documental: number | null
  familia_documental: string
  carpeta_origen: string
  source_path: string
  archivo_referencia: string | null
  total_archivos: number
  formatos_disponibles: string[]
  created_at: string
  updated_at: string
  archivos: HistoricalProjectFile[]
}

/** Tipo del row enriquecido que pasa el server al client: mdl_content y
 *  compliance_docs_md siempre llegan con shape canonico (o null). */
type ProyectoHistoricoDetailRow = Omit<
  HistoricalProjectRow,
  'mdl_content' | 'compliance_docs_md'
> & {
  mdl_content: MdlContent | null
  compliance_docs_md:
    | Record<string, { title: string; family: string; content_md: string }>
    | null
}

/**
 * Normaliza el campo mdl_content al shape canonico que espera el client:
 *   { entregables: MdlDocument[], no_entregables: MdlDocument[] }
 *
 * La base de data puede devolver cualquiera de estos casos:
 *   - null                                        -> null
 *   - { status: "pendiente_parseo", ... }         -> null (MDL sin parsear)
 *   - { entregables: [...], no_entregables: [...]} -> se devuelve tal cual
 *   - cualquier other objeto sin las claves esperadas -> null
 */
function normalizeMdlContenido(raw: unknown): MdlContent | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const entregables = Array.isArray(obj.entregables) ? (obj.entregables as MdlDocument[]) : null
  const noEntregables = Array.isArray(obj.no_entregables)
    ? (obj.no_entregables as MdlDocument[])
    : null
  if (!entregables && !noEntregables) return null
  return {
    entregables: entregables ?? [],
    no_entregables: noEntregables ?? [],
  }
}

/**
 * Normaliza compliance_docs_md al shape Record<codigo, {title, family, content_md}>.
 *
 * La base de data puede devolver:
 *   - null                                         -> null
 *   - Array<{codigo, title, edicion, ...}>        -> se convierte a Record por codigo
 *   - Record<string, {title, family, content_md}> -> se devuelve tal cual
 */
function normalizeComplianceDocsMd(
  raw: unknown,
): Record<string, { title: string; family: string; content_md: string }> | null {
  if (!raw) return null
  if (Array.isArray(raw)) {
    const result: Record<string, { title: string; family: string; content_md: string }> = {}
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue
      const entry = item as Record<string, unknown>
      const codigo = typeof entry.codigo === 'string' ? entry.codigo : null
      if (!codigo) continue
      result[codigo] = {
        title:
          (typeof entry.title === 'string' && entry.title) ||
          (typeof entry.title === 'string' && entry.title) ||
          codigo,
        family: typeof entry.family === 'string' ? entry.family : '',
        content_md: typeof entry.content_md === 'string' ? entry.content_md : '',
      }
    }
    return Object.keys(result).length > 0 ? result : null
  }
  if (typeof raw === 'object') {
    return raw as Record<string, { title: string; family: string; content_md: string }>
  }
  return null
}

/**
 * Funcion primary de la page de detalle.
 * Se ejecuta en el servidor cuando alguien visita /historical-projects/[id].
 */
export default async function ProyectosHistoricoEntryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // Paso 1: Extraer el identificador del project de la URL
  const { id } = await params

  // Paso 2: Conectar con Supabase y buscar el project con ese ID
  const supabase = await createClient()
  const { data: project, error } = await supabase
    .from('doa_historical_projects')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  // Si hay error de base de data, registrarlo en la consola
  if (error) {
    console.error('Error cargando project historical desde doa_historical_projects:', error)
  }

  // Paso 3: Cargar las familias documentales del project (table doa_historical_project_documents)
  //         + sus archivos asociados (join con doa_historical_projects_archivos)
  let documents: ProyectoHistoricoDocumentoRow[] = []
  if (project) {
    const { data: docs, error: docsError } = await supabase
      .from('doa_historical_project_documents')
      .select('*, archivos:doa_historical_projects_archivos(*)')
      .eq('historical_project_id', project.id)
      .order('orden_documental')

    if (docsError) {
      console.error('Error cargando documents del project historical:', docsError)
    } else {
      documents = ((docs ?? []) as ProyectoHistoricoDocumentoRow[]).map((d) => ({
        ...d,
        archivos: Array.isArray(d.archivos) ? d.archivos : [],
      }))
    }
  }

  // Si el project no existe, mostrar mensaje de error al user_label
  if (!project) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
        <TopBar
          title="Entrada de project historical"
          subtitle="Ficha preparada para completar la informacion del project"
        />
        <div className="flex min-h-0 flex-1 items-center justify-center px-5 py-8">
          <section className="w-full max-w-3xl rounded-[34px] border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-6 shadow-[0_24px_50px_rgba(14,165,233,0.10)]">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              Project historical no encontrado
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--ink-3)]">
              No hemos podido cargar la ficha de entrada para este project historical. Vuelve al
              listado y abre otra fila para continuar.
            </p>
          </section>
        </div>
      </div>
    )
  }

  // Paso 4: Normalizar campos JSONB antes de pasar al client. La BBDD puede
  //         devolver shapes inesperados (p.ej. mdl_content sin parsear como
  //         objeto sin las claves entregables/no_entregables, o compliance_docs_md
  //         como array en vez de Record). El client espera shape canonico.
  const projectSafe: ProyectoHistoricoDetailRow = {
    ...(project as HistoricalProjectRow),
    mdl_content: normalizeMdlContenido((project as HistoricalProjectRow).mdl_content),
    compliance_docs_md: normalizeComplianceDocsMd(
      (project as HistoricalProjectRow).compliance_docs_md,
    ),
  }

  // Paso 5: El project existe — mostrar la ficha completa (mdl_content viene incluido en el registro)
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      {/* Barra superior con title de la page */}
      <TopBar
        title="Entrada de project historical"
        subtitle="Ficha preparada para completar la informacion del project"
      />
      {/* Componente visual interactivo con todos los data del project y sus documents */}
      <HistoricalProjectEntryClient project={projectSafe} documents={documents} />
    </div>
  )
}
