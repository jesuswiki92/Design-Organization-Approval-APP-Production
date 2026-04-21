/**
 * ============================================================================
 * CREACION MANUAL DE PROYECTOS
 * ============================================================================
 *
 * Utilidad servidor que encapsula TODO el flujo de creacion de un project
 * "desde cero" (sin request origen):
 *
 *   1. Derivar numero de project a partir del manufacturer/model.
 *   2. Crear la estructura de carpetas en disco (raiz new, NO la de
 *      simulacion usada por `abrir-project`).
 *   3. Insertar fila en `doa_projects` con `incoming_request_id = null`.
 *   4. Generar un `.docx` por cada template compliance seleccionada,
 *      aplicando reemplazos `project_code` / `document_code`.
 *   5. Insertar un `doa_project_deliverables` por cada template generada.
 *
 * Esta fn NO se mezcla con `lib/project-builder.ts`, que solo lo usa la path
 * automatica `/api/incoming-requests/[id]/open-project`. Comparte, eso si, los
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
} from '@/lib/projects/templates-docx'

/**
 * Estructura de subcarpetas para projects CREADOS MANUALMENTE.
 * No confundir con `PROJECT_FOLDER_STRUCTURE` de `lib/project-builder.ts`
 * (legacy, usada por el flujo abrir-project).
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
  title: string
  description?: string | null
  client_id?: string | null
  client_name?: string | null
  manufacturer?: string | null
  model?: string | null
  msn?: string | null
  tcds_code?: string | null
  tcds_code_short?: string | null
  owner?: string | null
  checker?: string | null
  approval?: string | null
  estimated_delivery_date?: string | null
  priority?: 'high' | 'medium' | 'low' | null
  plantilla_codes: string[]
}

export type CrearProyectoManualResult = {
  id: string
  project_number: string
  folder_path: string
  docs_creados: string[]
}

// ─── Sanitizado de segmentos de path ────────────────────────────────────────

const INVALID_PATH_CHARS = /[\/\\:*?"<>|]/g

/**
 * Limpia un segmento de path para Windows: elimina chars invalidos, colapsa
 * espacios y evita puntos/espacios finales, que Explorer no puede abrir bien.
 */
export function sanitizePathSegment(value: string): string {
  const cleaned = value
    .replace(INVALID_PATH_CHARS, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[ .]+$/g, '')

  return cleaned || 'Sin name'
}

/** Sanitiza un name de fichero conservando la extension. */
function sanitizeFilename(value: string): string {
  const cleaned = value
    .replace(INVALID_PATH_CHARS, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[ .]+$/g, '')

  return cleaned || 'document'
}

// ─── Fn primary ───────────────────────────────────────────────────────────

export async function crearProyectoManualCompleto(opts: {
  supabase: SupabaseClient
  createdByUserId: string
  input: CrearProyectoManualInput
  newProjectsRoot: string
  plantillasRoot: string
}): Promise<CrearProyectoManualResult> {
  const { supabase, createdByUserId, input, newProjectsRoot, plantillasRoot } = opts

  const title = input.title.trim()
  if (!title) throw new Error('El title es obligatorio.')

  const manufacturer = input.manufacturer?.trim() || null
  const model = input.model?.trim() || null
  const aeronaveLabel = [manufacturer, model].filter(Boolean).join(' ').trim() || null

  // 1. Numero de project
  const prefix = deriveModelPrefix(manufacturer, model)
  const { next } = await computeNextSequence(supabase, prefix)
  const numeroProyecto = formatProjectNumber(prefix, next)

  // 2. Folder
  const currentYear = new Date().getFullYear()
  const clienteSeg = sanitizePathSegment(input.client_name?.trim() || 'Sin client')
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
      `No se pudieron crear las carpetas del project en "${folderPath}": ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
  }

  // 4. INSERT en doa_projects
  const insertPayload: Record<string, unknown> = {
    project_number: numeroProyecto,
    title,
    description: input.description?.trim() || null,
    incoming_request_id: null,
    client_name: input.client_name?.trim() || null,
    client_id: input.client_id || null,
    aircraft: aeronaveLabel,
    model,
    msn: input.msn?.trim() || null,
    tcds_code: input.tcds_code?.trim() || null,
    tcds_code_short: input.tcds_code_short?.trim() || null,
    owner: input.owner?.trim() || null,
    checker: input.checker?.trim() || null,
    approval: input.approval?.trim() || null,
    estimated_delivery_date: input.estimated_delivery_date || null,
    priority: input.priority || null,
    status: PROJECT_STATES.NEW,
    execution_status: PROJECT_EXECUTION_STATES.PROJECT_OPENED,
    current_phase: PROJECT_EXECUTION_PHASES.EXECUTION,
    project_path: folderPath,
    year: currentYear,
    status_updated_at: new Date().toISOString(),
    status_updated_by: createdByUserId,
  }

  const { data: inserted, error: insertError } = await supabase
    .from('doa_projects')
    .insert(insertPayload)
    .select('id, project_number')
    .single()

  if (insertError || !inserted) {
    // Rollback best-effort
    try {
      await rm(folderPath, { recursive: true, force: true })
    } catch (rmErr) {
      console.error('[crear-manual] Rollback de folder failed:', rmErr)
    }
    throw new Error(
      `Error insertando en doa_projects: ${insertError?.message ?? 'sin fila devuelta'}`,
    )
  }

  const proyectoId = (inserted as { id: string }).id

  // 5. Generar .docx por cada template
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
        project_id: proyectoId,
        template_code: code,
        title: templateName,
        subpart_easa: null,
        description: null,
        status: 'pending' as const,
        current_version: 1,
        sort_order: i,
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
      // Continua con el resto de templates; registramos el deliverable como pending
    }

    deliverablesRows.push({
      project_id: proyectoId,
      template_code: code,
      title: templateName,
      subpart_easa: null,
      description: meta?.category ? `Categoria: ${meta.category}` : null,
      status: 'pending' as const,
      current_version: 1,
      sort_order: i,
      owner_user_id: createdByUserId,
      storage_path: destDocxPath,
      metadata: { source: 'manual', dotx: dotxFilename } as Record<string, unknown>,
    })
  }

  // 6. Insertar deliverables (si hay)
  if (deliverablesRows.length > 0) {
    const { error: deliverError } = await supabase
      .from('doa_project_deliverables')
      .insert(deliverablesRows)

    if (deliverError) {
      console.error('[crear-manual] Error insertando deliverables:', deliverError.message)
      // No abortamos: el project y los ficheros ya existen. Se deja log.
    }
  }

  return {
    id: proyectoId,
    project_number: numeroProyecto,
    folder_path: folderPath,
    docs_creados: docsCreados,
  }
}
