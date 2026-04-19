/**
 * ============================================================================
 * CREACION MANUAL DE PROYECTOS
 * ============================================================================
 *
 * Utilidad servidor que encapsula TODO el flujo de creacion de un proyecto
 * "desde cero" (sin consulta origen):
 *
 *   1. Derivar numero de proyecto a partir del fabricante/modelo.
 *   2. Crear la estructura de carpetas en disco (raiz nueva, NO la de
 *      simulacion usada por `abrir-proyecto`).
 *   3. Insertar fila en `proyectos` con `consulta_id = null`.
 *   4. Generar un `.docx` por cada plantilla compliance seleccionada,
 *      aplicando reemplazos `project_code` / `document_code`.
 *   5. Insertar un `project_deliverables` por cada plantilla generada.
 *
 * Esta fn NO se mezcla con `lib/project-builder.ts`, que solo lo usa la ruta
 * automatica `/api/consultas/[id]/abrir-proyecto`. Comparte, eso si, los
 * helpers puros (`deriveModelPrefix`, `computeNextSequence`,
 * `formatProjectNumber`) de ese modulo.
 * ============================================================================
 */

import { mkdir, rm } from 'fs/promises'
import path from 'path'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  computeNextSequence,
  deriveModelPrefix,
  formatProjectNumber,
} from '@/lib/project-builder'
import { COMPLIANCE_TEMPLATES } from '@/lib/compliance-templates'
import {
  PROJECT_EXECUTION_PHASES,
  PROJECT_EXECUTION_STATES,
  PROJECT_STATES,
} from '@/lib/workflow-states'
import {
  generarDocxDesdeTemplate,
  primeTemplateCache,
  resolveDotxFilename,
} from '@/lib/proyectos/plantillas-docx'

/**
 * Estructura de subcarpetas para proyectos CREADOS MANUALMENTE.
 * No confundir con `PROJECT_FOLDER_STRUCTURE` de `lib/project-builder.ts`
 * (legacy, usada por el flujo abrir-proyecto).
 */
export const MANUAL_PROJECT_FOLDER_STRUCTURE = [
  '00. Project info',
  '01. Compliance documents',
  '02. Working documents',
  '03. Reference material',
  '04. Deliveries',
  '05. Correspondence',
] as const

export type CrearProyectoManualInput = {
  titulo: string
  descripcion?: string | null
  cliente_id?: string | null
  cliente_nombre?: string | null
  fabricante?: string | null
  modelo?: string | null
  msn?: string | null
  tcds_code?: string | null
  tcds_code_short?: string | null
  owner?: string | null
  checker?: string | null
  approval?: string | null
  fecha_entrega_estimada?: string | null
  prioridad?: 'alta' | 'media' | 'baja' | null
  plantilla_codes: string[]
}

export type CrearProyectoManualResult = {
  id: string
  numero_proyecto: string
  folder_path: string
  docs_creados: string[]
}

// ─── Sanitizado de segmentos de ruta ────────────────────────────────────────

const INVALID_PATH_CHARS = /[\/\\:*?"<>|]/g

/** Limpia un segmento de path para Windows: elimina chars invalidos y colapsa espacios. */
export function sanitizePathSegment(value: string): string {
  return value
    .replace(INVALID_PATH_CHARS, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Sanitiza un nombre de fichero conservando la extension. */
function sanitizeFilename(value: string): string {
  return value
    .replace(INVALID_PATH_CHARS, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Fn principal ───────────────────────────────────────────────────────────

export async function crearProyectoManualCompleto(opts: {
  supabase: SupabaseClient
  createdByUserId: string
  input: CrearProyectoManualInput
  newProjectsRoot: string
  plantillasRoot: string
}): Promise<CrearProyectoManualResult> {
  const { supabase, createdByUserId, input, newProjectsRoot, plantillasRoot } = opts

  const titulo = input.titulo.trim()
  if (!titulo) throw new Error('El titulo es obligatorio.')

  const fabricante = input.fabricante?.trim() || null
  const modelo = input.modelo?.trim() || null
  const aeronaveLabel = [fabricante, modelo].filter(Boolean).join(' ').trim() || null

  // 1. Numero de proyecto
  const prefix = deriveModelPrefix(fabricante, modelo)
  const { next } = await computeNextSequence(supabase, prefix)
  const numeroProyecto = formatProjectNumber(prefix, next)

  // 2. Carpeta
  const currentYear = new Date().getFullYear()
  const clienteSeg = sanitizePathSegment(input.cliente_nombre?.trim() || 'Sin cliente')
  const avionSeg = sanitizePathSegment(aeronaveLabel || 'Sin avion')
  const numeroSeg = sanitizePathSegment(numeroProyecto)
  const folderPath = path.posix.join(
    newProjectsRoot.replace(/\\/g, '/').replace(/\/+$/, ''),
    clienteSeg,
    avionSeg,
    String(currentYear),
    numeroSeg,
  )

  // 3. Crear carpetas fisicas ANTES del INSERT para detectar problemas de disco
  //    temprano (permisos, unidad no montada, etc.). Si el INSERT falla despues,
  //    hacemos rollback con rm recursive.
  try {
    await mkdir(folderPath, { recursive: true })
    await Promise.all(
      MANUAL_PROJECT_FOLDER_STRUCTURE.map((sub) =>
        mkdir(path.posix.join(folderPath, sub), { recursive: true }),
      ),
    )
  } catch (err) {
    throw new Error(
      `No se pudieron crear las carpetas del proyecto en "${folderPath}": ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
  }

  // 4. INSERT en proyectos
  const insertPayload: Record<string, unknown> = {
    numero_proyecto: numeroProyecto,
    titulo,
    descripcion: input.descripcion?.trim() || null,
    consulta_id: null,
    cliente_nombre: input.cliente_nombre?.trim() || null,
    client_id: input.cliente_id || null,
    aeronave: aeronaveLabel,
    modelo,
    msn: input.msn?.trim() || null,
    tcds_code: input.tcds_code?.trim() || null,
    tcds_code_short: input.tcds_code_short?.trim() || null,
    owner: input.owner?.trim() || null,
    checker: input.checker?.trim() || null,
    approval: input.approval?.trim() || null,
    fecha_entrega_estimada: input.fecha_entrega_estimada || null,
    prioridad: input.prioridad || null,
    estado: PROJECT_STATES.NUEVO,
    estado_v2: PROJECT_EXECUTION_STATES.PROYECTO_ABIERTO,
    fase_actual: PROJECT_EXECUTION_PHASES.EJECUCION,
    ruta_proyecto: folderPath,
    anio: currentYear,
    estado_updated_at: new Date().toISOString(),
    estado_updated_by: createdByUserId,
  }

  const { data: inserted, error: insertError } = await supabase
    .from('proyectos')
    .insert(insertPayload)
    .select('id, numero_proyecto')
    .single()

  if (insertError || !inserted) {
    // Rollback best-effort
    try {
      await rm(folderPath, { recursive: true, force: true })
    } catch (rmErr) {
      console.error('[crear-manual] Rollback de carpeta fallo:', rmErr)
    }
    throw new Error(
      `Error insertando en proyectos: ${insertError?.message ?? 'sin fila devuelta'}`,
    )
  }

  const proyectoId = (inserted as { id: string }).id

  // 5. Generar .docx por cada plantilla
  await primeTemplateCache(plantillasRoot)

  const complianceFolder = path.posix.join(folderPath, '01. Compliance documents')
  const docsCreados: string[] = []
  const deliverablesRows: Record<string, unknown>[] = []

  const codes = Array.isArray(input.plantilla_codes) ? input.plantilla_codes : []

  for (let i = 0; i < codes.length; i += 1) {
    const rawCode = codes[i]
    if (typeof rawCode !== 'string') continue
    const code = rawCode.trim()
    if (!code) continue

    const meta = COMPLIANCE_TEMPLATES.find((t) => t.code === code)
    const templateName = meta?.name ?? code

    const dotxFilename = resolveDotxFilename(code)
    if (!dotxFilename) {
      console.warn(`[crear-manual] No se encontro .dotx para el codigo ${code}; se omite.`)
      // Aun asi insertamos el deliverable (sin storage_path) para no perder la seleccion
      deliverablesRows.push({
        proyecto_id: proyectoId,
        template_code: code,
        titulo: templateName,
        subpart_easa: null,
        descripcion: null,
        estado: 'pendiente' as const,
        version_actual: 1,
        orden: i,
        owner_user_id: createdByUserId,
        metadata: { source: 'manual', template_missing: true } as Record<string, unknown>,
      })
      continue
    }

    const dotxPath = path.posix.join(plantillasRoot.replace(/\\/g, '/'), dotxFilename)
    const destFilename = sanitizeFilename(
      `${numeroProyecto}-${code} ${templateName}.docx`,
    )
    const destDocxPath = path.posix.join(complianceFolder, destFilename)

    try {
      await generarDocxDesdeTemplate({
        dotxPath,
        destDocxPath,
        replacements: {
          project_code: numeroProyecto,
          document_code: `${numeroProyecto}-${code}`,
        },
      })
      docsCreados.push(destDocxPath)
    } catch (err) {
      console.error(
        `[crear-manual] Error generando ${destDocxPath} desde ${dotxPath}:`,
        err,
      )
      // Continua con el resto de plantillas; registramos el deliverable como pendiente
    }

    deliverablesRows.push({
      proyecto_id: proyectoId,
      template_code: code,
      titulo: templateName,
      subpart_easa: null,
      descripcion: meta?.category ? `Categoria: ${meta.category}` : null,
      estado: 'pendiente' as const,
      version_actual: 1,
      orden: i,
      owner_user_id: createdByUserId,
      storage_path: destDocxPath,
      metadata: { source: 'manual', dotx: dotxFilename } as Record<string, unknown>,
    })
  }

  // 6. Insertar deliverables (si hay)
  if (deliverablesRows.length > 0) {
    const { error: deliverError } = await supabase
      .from('project_deliverables')
      .insert(deliverablesRows)

    if (deliverError) {
      console.error('[crear-manual] Error insertando deliverables:', deliverError.message)
      // No abortamos: el proyecto y los ficheros ya existen. Se deja log.
    }
  }

  return {
    id: proyectoId,
    numero_proyecto: numeroProyecto,
    folder_path: folderPath,
    docs_creados: docsCreados,
  }
}
