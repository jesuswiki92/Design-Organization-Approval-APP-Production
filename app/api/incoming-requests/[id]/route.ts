import { requireUserApi } from '@/lib/auth/require-user'
import { logServerEvent } from '@/lib/observability/server'
import { buildRequestContext } from '@/lib/observability/shared'
import { isMissingSchemaError } from '@/lib/supabase/errors'

export const runtime = 'nodejs'

function jsonResponse(status: number, error: string) {
  return Response.json({ error }, { status })
}

// TODO(RLS): authz no garantiza ownership — depende de RLS [audit Fase pre-prod]
// doa_incoming_requests no tiene columna de ownership (no owner_user_id). Hasta
// que se introduzca una table de roles + columna owner, cualquier user_label
// autenticado puede borrar cualquier request. Se emite un evento severity=warn
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
      return jsonResponse(400, 'Request no válida.')
    }

    // Registrar acciones destructivas hechas por no-admin hasta que haya RLS real.
    const isAdmin =
      (user.user_metadata as { role?: unknown } | null)?.role === 'admin'
    if (!isAdmin) {
      const ctx = buildRequestContext(request)
      await logServerEvent({
        eventName: 'request.delete.non_admin',
        eventCategory: 'security',
        outcome: 'info',
        severity: 'warn',
        actorUserId: user.id,
        requestId: ctx.requestId,
        route: ctx.route,
        method: request.method,
        entityType: 'request',
        entityId: id,
        metadata: { reason: 'rls_pending' },
      })
    }

    // Cascade manual en orden de dependencia:
    //
    // La mayoria de child tables (doa_emails, doa_form_tokens,
    // doa_form_submissions, doa_quotations) ya tienen `ON DELETE CASCADE`
    // en la FK hacia doa_incoming_requests, asi que Postgres las borra
    // automaticamente cuando se borra la request.
    //
    // La excepcion es `doa_projects.incoming_request_id`, cuya FK es
    // `NO ACTION` (bloquea el delete). Hay que borrar los projects
    // asociados primero; sus descendientes (time entries, deliverables,
    // closures, signatures, validations, lessons, deliveries) sí
    // cascadean desde doa_projects.
    //
    // El resto de tables se borran en orden como defensa en profundidad
    // por si alguna FK se cambia en el futuro a NO ACTION.
    const childTables: Array<
      'doa_emails' | 'doa_form_tokens' | 'doa_form_submissions' | 'doa_quotations' | 'doa_projects'
    > = [
      'doa_emails',
      'doa_form_tokens',
      'doa_form_submissions',
      'doa_quotations',
      'doa_projects',
    ]

    for (const table of childTables) {
      const childDeletion = await supabase
        .from(table)
        .delete()
        .eq('incoming_request_id', id)

      if (childDeletion.error) {
        if (isMissingSchemaError(childDeletion.error)) {
          // La table aun no existe o la columna no esta — seguimos con las demas.
          continue
        }

        return jsonResponse(
          500,
          `No se pudo borrar registros relacionados en ${table}: ${childDeletion.error.message}`,
        )
      }
    }

    const deletion = await supabase
      .from('doa_incoming_requests')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (deletion.error) {
      if (isMissingSchemaError(deletion.error)) {
        return jsonResponse(
          409,
          'La table public.doa_incoming_requests no coincide con el esquema esperado. Aplica la migración pending antes de borrar requests.',
        )
      }

      return jsonResponse(
        500,
        `No se pudo borrar la request: ${deletion.error.message}`,
      )
    }

    if (!deletion.data) {
      return jsonResponse(404, 'La request indicada no existe o ya fue eliminada.')
    }

    return Response.json({
      ok: true,
      id: deletion.data.id,
    })
  } catch (error) {
    console.error('request DELETE error:', error)

    return jsonResponse(
      500,
      error instanceof Error ? error.message : 'Unexpected server error.',
    )
  }
}
