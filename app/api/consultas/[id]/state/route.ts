import { NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { isMissingSchemaError } from '@/lib/supabase/errors'
import { isIncomingQueryStateCode, isQuotationBoardStateCode } from '@/lib/workflow-state-config'

export const runtime = 'nodejs'

function jsonResponse(status: number, error: string) {
  return Response.json({ error }, { status })
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const body = (await request.json()) as { estado?: unknown }
    const estado = typeof body.estado === 'string' ? body.estado.trim() : ''

    if (!id) {
      return jsonResponse(400, 'Consulta no válida.')
    }

    if (!estado || (!isIncomingQueryStateCode(estado) && !isQuotationBoardStateCode(estado))) {
      return jsonResponse(400, 'El estado solicitado no es válido.')
    }

    const supabase = await createClient()
    const update = await supabase
      .from('doa_consultas_entrantes')
      .update({ estado })
      .eq('id', id)
      .select('id, estado')
      .single()

    if (update.error) {
      if (isMissingSchemaError(update.error)) {
        return jsonResponse(
          409,
          'La tabla public.doa_consultas_entrantes no coincide con el esquema esperado. Aplica la migración pendiente antes de cambiar estados.',
        )
      }

      return jsonResponse(
        500,
        `No se pudo actualizar el estado de la consulta: ${update.error.message}`,
      )
    }

    return Response.json({
      ok: true,
      id: update.data.id,
      estado: update.data.estado,
    })
  } catch (error) {
    console.error('consulta state PATCH error:', error)

    return jsonResponse(
      500,
      error instanceof Error ? error.message : 'Unexpected server error.',
    )
  }
}
