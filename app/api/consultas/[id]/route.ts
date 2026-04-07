import { createClient } from '@/lib/supabase/server'
import { isMissingSchemaError } from '@/lib/supabase/errors'

export const runtime = 'nodejs'

function jsonResponse(status: number, error: string) {
  return Response.json({ error }, { status })
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params

    if (!id) {
      return jsonResponse(400, 'Consulta no válida.')
    }

    const supabase = await createClient()
    const deletion = await supabase
      .from('doa_consultas_entrantes')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (deletion.error) {
      if (isMissingSchemaError(deletion.error)) {
        return jsonResponse(
          409,
          'La tabla public.doa_consultas_entrantes no coincide con el esquema esperado. Aplica la migración pendiente antes de borrar consultas.',
        )
      }

      return jsonResponse(
        500,
        `No se pudo borrar la consulta: ${deletion.error.message}`,
      )
    }

    if (!deletion.data) {
      return jsonResponse(404, 'La consulta indicada no existe o ya fue eliminada.')
    }

    return Response.json({
      ok: true,
      id: deletion.data.id,
    })
  } catch (error) {
    console.error('consulta DELETE error:', error)

    return jsonResponse(
      500,
      error instanceof Error ? error.message : 'Unexpected server error.',
    )
  }
}
