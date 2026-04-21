import { NextRequest } from 'next/server'
import { requireUserApi } from '@/lib/auth/require-user'

export const runtime = 'nodejs'

function jsonResponse(status: number, data: unknown) {
  return Response.json(data, { status })
}

// GET: Load saved classification answers
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireUserApi()
    if (auth instanceof Response) return auth
    const { supabase } = auth
    const { id } = await context.params

    const { data, error } = await supabase
      .from('doa_consultas_entrantes')
      .select('change_classification')
      .eq('id', id)
      .maybeSingle()

    if (error) return jsonResponse(500, { error: error.message })
    if (!data) return jsonResponse(404, { error: 'Consulta no encontrada.' })

    return jsonResponse(200, { classification: data.change_classification })
  } catch (error) {
    return jsonResponse(500, { error: error instanceof Error ? error.message : 'Error inesperado.' })
  }
}

// PUT: Save classification answers
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireUserApi()
    if (auth instanceof Response) return auth
    const { supabase } = auth
    const { id } = await context.params

    const body = await request.json()
    const classification = body.classification

    if (!classification || !Array.isArray(classification)) {
      return jsonResponse(400, { error: 'classification debe ser un array.' })
    }

    const { error } = await supabase
      .from('doa_consultas_entrantes')
      .update({ change_classification: classification })
      .eq('id', id)

    if (error) return jsonResponse(500, { error: error.message })

    return jsonResponse(200, { ok: true })
  } catch (error) {
    return jsonResponse(500, { error: error instanceof Error ? error.message : 'Error inesperado.' })
  }
}
