import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import {
  PROJECT_FOLDER_STRUCTURE,
  buildProjectFolderPath,
  computeNextSequence,
  deriveModelPrefix,
  formatProjectNumber,
  type ProjectPreview,
} from '@/lib/project-builder'

export const runtime = 'nodejs'

const SIMULATION_BASE_PATH =
  process.env.DOA_SIMULATION_BASE_PATH ??
  'C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/02. Data DOA/00. APP sinulation'

function jsonResponse(status: number, data: unknown) {
  return Response.json(data, { status })
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireUserApi()
    if (auth instanceof Response) return auth
    const { supabase } = auth
    const { id } = await context.params

    if (!id) return jsonResponse(400, { error: 'Request ID requerido.' })

    const { data: request, error } = await supabase
      .from('doa_incoming_requests')
      .select(
        'id, subject, resumen, sender, aircraft_manufacturer, aircraft_model, aircraft_msn, tcds_number, modification_summary, entry_number',
      )
      .eq('id', id)
      .maybeSingle()

    if (error) return jsonResponse(500, { error: error.message })
    if (!request) return jsonResponse(404, { error: 'Request no encontrada.' })

    const manufacturer = (request.aircraft_manufacturer as string | null) ?? null
    const model = (request.aircraft_model as string | null) ?? null
    const tcdsNumber = (request.tcds_number as string | null) ?? null

    // Resolver TCDS code_short si hay match en doa_aircraft
    let tcdsCodeShort: string | null = null
    if (tcdsNumber) {
      const { data: aircraft } = await supabase
        .from('doa_aircraft')
        .select('tcds_code_short')
        .eq('tcds_code', tcdsNumber)
        .maybeSingle()
      tcdsCodeShort = (aircraft?.tcds_code_short as string | null) ?? null
    }

    const prefix = deriveModelPrefix(manufacturer, model)
    const { next, existing } = await computeNextSequence(supabase, prefix)
    const numeroProyecto = formatProjectNumber(prefix, next)

    const aeronaveLabel = [manufacturer, model].filter(Boolean).join(' ').trim() || null
    const tituloSugerido =
      (request.modification_summary as string | null)?.slice(0, 120) ||
      (request.subject as string | null) ||
      'Project sin title'

    const folderPath = buildProjectFolderPath(SIMULATION_BASE_PATH, numeroProyecto)

    const preview: ProjectPreview = {
      project_number_sugerido: numeroProyecto,
      modelo_prefijo: prefix,
      existentes_mismo_prefijo: existing,
      secuencia_sugerida: next,
      titulo_sugerido: tituloSugerido,
      aircraft: aeronaveLabel,
      client: (request.sender as string | null) ?? null,
      tcds_code: tcdsNumber,
      tcds_code_short: tcdsCodeShort,
      folder_path: folderPath,
      folder_structure: PROJECT_FOLDER_STRUCTURE,
    }

    return jsonResponse(200, preview)
  } catch (error) {
    console.error('project-preview GET error:', error)
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Error inesperado.',
    })
  }
}
