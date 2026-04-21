import { requireUserApi } from '@/lib/auth/require-user'
import { logServerEvent } from '@/lib/observability/server'
import { buildRequestContext } from '@/lib/observability/shared'
import { createAdminClient } from '@/lib/supabase/admin'
import { isMissingSchemaError } from '@/lib/supabase/errors'

export const runtime = 'nodejs'

function jsonResponse(status: number, error: string) {
  return Response.json({ error }, { status })
}

// TODO(RLS): authz no garantiza ownership — depende de RLS [audit Fase pre-prod]
// doa_projects.owner es text libre (name del ingeniero), no FK a auth.users,
// asi que no se puede usar como check de ownership real. Hasta que se introduzca
// una table de roles + owner_user_id, cualquier user_label autenticado puede borrar
// projects. Se emite un evento severity=warn cuando el actor no es admin.
//
// Borra un project de doa_projects. Las tablas hijas NO tienen ON DELETE
// CASCADE, asi que hacemos cleanup explicito antes del borrado primary:
//   1. doa_project_embeddings (FK: project_number text, sin cascade)
//   2. doa_project_time_entries (FK: project_id uuid, creada fuera de migrations)
// Si cualquiera de estos cleanups falla, devolvemos 500 con un mensaje claro;
// no lo silenciamos porque dejaria el project sin borrar con hijos huerfanos.
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireUserApi()
    if (auth instanceof Response) return auth
    const { user } = auth

    const isAdmin =
      (user.user_metadata as { role?: unknown } | null)?.role === 'admin'

    // Usamos el client admin (service_role) para las operaciones de
    // escritura porque doa_projects tiene RLS habilitado y solo permite
    // SELECT para users autenticados — DELETE requiere service_role.
    // La autenticacion del user_label ya se verifico con requireUserApi().
    const admin = createAdminClient()

    const { id } = await context.params

    if (!id) {
      return jsonResponse(400, 'Project no válido.')
    }

    if (!isAdmin) {
      const ctx = buildRequestContext(request)
      await logServerEvent({
        eventName: 'project.delete.non_admin',
        eventCategory: 'security',
        outcome: 'info',
        severity: 'warn',
        actorUserId: user.id,
        requestId: ctx.requestId,
        route: ctx.route,
        method: request.method,
        entityType: 'project',
        entityId: id,
        metadata: { reason: 'rls_pending' },
      })
    }

    // 1) Obtener project_number para limpiar embeddings (FK por project_number text)
    const project = await admin
      .from('doa_projects' as never)
      .select('id, project_number')
      .eq('id', id)
      .maybeSingle<{ id: string; project_number: string | null }>()

    if (project.error) {
      if (isMissingSchemaError(project.error)) {
        return jsonResponse(
          409,
          'La table public.doa_projects no coincide con el esquema esperado. Aplica la migración pending antes de borrar projects.',
        )
      }
      return jsonResponse(
        500,
        `No se pudo consultar el project: ${project.error.message}`,
      )
    }

    if (!project.data) {
      return jsonResponse(404, 'El project indicado no existe o ya fue eliminado.')
    }

    // 2) Cleanup de doa_project_embeddings por project_number.
    //    Si la table no existe todavia, ignoramos el error (entorno dev sin la migración).
    const embeddingsCleanup = await admin
      .from('doa_project_embeddings' as never)
      .delete()
      .eq('project_number', project.data.project_number as never)

    if (embeddingsCleanup.error && !isMissingSchemaError(embeddingsCleanup.error)) {
      return jsonResponse(
        500,
        `No se pudo limpiar embeddings del project: ${embeddingsCleanup.error.message}`,
      )
    }

    // 3) Cleanup de doa_project_time_entries por project_id.
    //    Idem: si no existe en este entorno, toleramos el missing-schema.
    const timeEntriesCleanup = await admin
      .from('doa_project_time_entries' as never)
      .delete()
      .eq('project_id', id as never)

    if (timeEntriesCleanup.error && !isMissingSchemaError(timeEntriesCleanup.error)) {
      return jsonResponse(
        500,
        `No se pudo limpiar el conteo de horas del project: ${timeEntriesCleanup.error.message}`,
      )
    }

    // 4) Borrar el project.
    const deletion = await admin
      .from('doa_projects' as never)
      .delete()
      .eq('id', id as never)
      .select('id')
      .maybeSingle<{ id: string }>()

    if (deletion.error) {
      if (isMissingSchemaError(deletion.error)) {
        return jsonResponse(
          409,
          'La table public.doa_projects no coincide con el esquema esperado. Aplica la migración pending antes de borrar projects.',
        )
      }

      return jsonResponse(
        500,
        `No se pudo borrar el project: ${deletion.error.message}`,
      )
    }

    if (!deletion.data) {
      return jsonResponse(404, 'El project indicado no existe o ya fue eliminado.')
    }

    return Response.json({
      ok: true,
      id: deletion.data.id,
    })
  } catch (error) {
    console.error('project DELETE error:', error)

    return jsonResponse(
      500,
      error instanceof Error ? error.message : 'Unexpected server error.',
    )
  }
}
