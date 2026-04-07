import { NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function jsonResponse(status: number, data: Record<string, unknown>) {
  return Response.json(data, { status })
}

/**
 * POST — Añade un proyecto historico como referencia para esta consulta.
 * Body: { proyecto_id: string }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const body = (await request.json()) as { proyecto_id?: unknown }
    const proyectoId =
      typeof body.proyecto_id === 'string' ? body.proyecto_id.trim() : ''

    if (!id) return jsonResponse(400, { error: 'Consulta no válida.' })
    if (!proyectoId) return jsonResponse(400, { error: 'proyecto_id es obligatorio.' })

    const supabase = await createClient()

    // Leer las referencias actuales
    const { data: current, error: readError } = await supabase
      .from('doa_consultas_entrantes')
      .select('proyectos_referencia')
      .eq('id', id)
      .single()

    if (readError || !current) {
      return jsonResponse(404, { error: 'Consulta no encontrada.' })
    }

    const refs: string[] = Array.isArray(current.proyectos_referencia)
      ? current.proyectos_referencia
      : []

    if (refs.includes(proyectoId)) {
      return jsonResponse(200, { ok: true, action: 'already_exists', proyectos_referencia: refs })
    }

    const updatedRefs = [...refs, proyectoId]

    const { error: updateError } = await supabase
      .from('doa_consultas_entrantes')
      .update({ proyectos_referencia: updatedRefs })
      .eq('id', id)

    if (updateError) {
      return jsonResponse(500, { error: `Error al guardar referencia: ${updateError.message}` })
    }

    return jsonResponse(200, { ok: true, action: 'added', proyectos_referencia: updatedRefs })
  } catch (error) {
    console.error('referencias POST error:', error)
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Error inesperado.',
    })
  }
}

/**
 * DELETE — Quita un proyecto historico de las referencias de esta consulta.
 * Body: { proyecto_id: string }
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const body = (await request.json()) as { proyecto_id?: unknown }
    const proyectoId =
      typeof body.proyecto_id === 'string' ? body.proyecto_id.trim() : ''

    if (!id) return jsonResponse(400, { error: 'Consulta no válida.' })
    if (!proyectoId) return jsonResponse(400, { error: 'proyecto_id es obligatorio.' })

    const supabase = await createClient()

    const { data: current, error: readError } = await supabase
      .from('doa_consultas_entrantes')
      .select('proyectos_referencia')
      .eq('id', id)
      .single()

    if (readError || !current) {
      return jsonResponse(404, { error: 'Consulta no encontrada.' })
    }

    const refs: string[] = Array.isArray(current.proyectos_referencia)
      ? current.proyectos_referencia
      : []

    const updatedRefs = refs.filter((r) => r !== proyectoId)

    const { error: updateError } = await supabase
      .from('doa_consultas_entrantes')
      .update({ proyectos_referencia: updatedRefs })
      .eq('id', id)

    if (updateError) {
      return jsonResponse(500, { error: `Error al quitar referencia: ${updateError.message}` })
    }

    return jsonResponse(200, { ok: true, action: 'removed', proyectos_referencia: updatedRefs })
  } catch (error) {
    console.error('referencias DELETE error:', error)
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Error inesperado.',
    })
  }
}
