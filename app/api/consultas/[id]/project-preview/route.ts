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
  'C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/02. Datos DOA/00. APP sinulation'

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

    if (!id) return jsonResponse(400, { error: 'Consulta ID requerido.' })

    const { data: consulta, error } = await supabase
      .from('doa_consultas_entrantes')
      .select(
        'id, asunto, resumen, remitente, aircraft_manufacturer, aircraft_model, aircraft_msn, tcds_number, modification_summary, numero_entrada',
      )
      .eq('id', id)
      .maybeSingle()

    if (error) return jsonResponse(500, { error: error.message })
    if (!consulta) return jsonResponse(404, { error: 'Consulta no encontrada.' })

    const manufacturer = (consulta.aircraft_manufacturer as string | null) ?? null
    const model = (consulta.aircraft_model as string | null) ?? null
    const tcdsNumber = (consulta.tcds_number as string | null) ?? null

    // Resolver TCDS code_short si hay match en doa_aeronaves
    let tcdsCodeShort: string | null = null
    if (tcdsNumber) {
      const { data: aeronave } = await supabase
        .from('doa_aeronaves')
        .select('tcds_code_short')
        .eq('tcds_code', tcdsNumber)
        .maybeSingle()
      tcdsCodeShort = (aeronave?.tcds_code_short as string | null) ?? null
    }

    const prefix = deriveModelPrefix(manufacturer, model)
    const { next, existing } = await computeNextSequence(supabase, prefix)
    const numeroProyecto = formatProjectNumber(prefix, next)

    const aeronaveLabel = [manufacturer, model].filter(Boolean).join(' ').trim() || null
    const tituloSugerido =
      (consulta.modification_summary as string | null)?.slice(0, 120) ||
      (consulta.asunto as string | null) ||
      'Proyecto sin titulo'

    const folderPath = buildProjectFolderPath(SIMULATION_BASE_PATH, numeroProyecto)

    const preview: ProjectPreview = {
      numero_proyecto_sugerido: numeroProyecto,
      modelo_prefijo: prefix,
      existentes_mismo_prefijo: existing,
      secuencia_sugerida: next,
      titulo_sugerido: tituloSugerido,
      aeronave: aeronaveLabel,
      cliente: (consulta.remitente as string | null) ?? null,
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
