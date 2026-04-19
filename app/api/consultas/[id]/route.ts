import { requireUserApi } from '@/lib/auth/require-user'
import { logServerEvent } from '@/lib/observability/server'
import { buildRequestContext } from '@/lib/observability/shared'
import { isMissingSchemaError } from '@/lib/supabase/errors'

export const runtime = 'nodejs'

function jsonResponse(status: number, error: string) {
  return Response.json({ error }, { status })
}

// TODO(RLS): authz no garantiza ownership — depende de RLS [audit Fase pre-prod]
// consultas_entrantes no tiene columna de ownership (no owner_user_id). Hasta
// que se introduzca una tabla de roles + columna owner, cualquier usuario
// autenticado puede borrar cualquier consulta. Se emite un evento severity=warn
// cuando el actor no es admin para que quede trazable en la auditoria.
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireUserApi()
    if (auth instanceof Response) return auth
    const { user, supabase } = auth

    const { id } = await context.params

    if (!id) {
      return jsonResponse(400, 'Consulta no válida.')
    }

    // Registrar acciones destructivas hechas por no-admin hasta que haya RLS real.
    const isAdmin =
      (user.user_metadata as { role?: unknown } | null)?.role === 'admin'
    if (!isAdmin) {
      const ctx = buildRequestContext(request)
      await logServerEvent({
        eventName: 'consulta.delete.non_admin',
        eventCategory: 'security',
        outcome: 'info',
        severity: 'warn',
        actorUserId: user.id,
        requestId: ctx.requestId,
        route: ctx.route,
        method: request.method,
        entityType: 'consulta',
        entityId: id,
        metadata: { reason: 'rls_pending' },
      })
    }

    const deletion = await supabase
      .from('consultas_entrantes')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (deletion.error) {
      if (isMissingSchemaError(deletion.error)) {
        return jsonResponse(
          409,
          'La tabla public.consultas_entrantes no coincide con el esquema esperado. Aplica la migración pendiente antes de borrar consultas.',
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
