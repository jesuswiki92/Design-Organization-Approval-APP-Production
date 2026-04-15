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
// doa_proyectos.owner es texto libre (nombre del ingeniero), no FK a auth.users,
// asi que no se puede usar como check de ownership real. Hasta que se introduzca
// una tabla de roles + owner_user_id, cualquier usuario autenticado puede borrar
// proyectos. Se emite un evento severity=warn cuando el actor no es admin.
//
// Borra un proyecto de doa_proyectos. Las tablas hijas NO tienen ON DELETE
// CASCADE, asi que hacemos cleanup explicito antes del borrado principal:
//   1. doa_proyectos_embeddings (FK: project_number text, sin cascade)
//   2. doa_conteo_horas_proyectos (FK: proyecto_id uuid, creada fuera de migrations)
// Si cualquiera de estos cleanups falla, devolvemos 500 con un mensaje claro;
// no lo silenciamos porque dejaria el proyecto sin borrar con hijos huerfanos.
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

    // Usamos el cliente admin (service_role) para las operaciones de
    // escritura porque doa_proyectos tiene RLS habilitado y solo permite
    // SELECT para usuarios autenticados — DELETE requiere service_role.
    // La autenticacion del usuario ya se verifico con requireUserApi().
    const admin = createAdminClient()

    const { id } = await context.params

    if (!id) {
      return jsonResponse(400, 'Proyecto no válido.')
    }

    if (!isAdmin) {
      const ctx = buildRequestContext(request)
      await logServerEvent({
        eventName: 'proyecto.delete.non_admin',
        eventCategory: 'security',
        outcome: 'info',
        severity: 'warn',
        actorUserId: user.id,
        requestId: ctx.requestId,
        route: ctx.route,
        method: request.method,
        entityType: 'proyecto',
        entityId: id,
        metadata: { reason: 'rls_pending' },
      })
    }

    // 1) Obtener numero_proyecto para limpiar embeddings (FK por project_number text)
    const project = await admin
      .from('doa_proyectos' as never)
      .select('id, numero_proyecto')
      .eq('id', id)
      .maybeSingle<{ id: string; numero_proyecto: string | null }>()

    if (project.error) {
      if (isMissingSchemaError(project.error)) {
        return jsonResponse(
          409,
          'La tabla public.doa_proyectos no coincide con el esquema esperado. Aplica la migración pendiente antes de borrar proyectos.',
        )
      }
      return jsonResponse(
        500,
        `No se pudo consultar el proyecto: ${project.error.message}`,
      )
    }

    if (!project.data) {
      return jsonResponse(404, 'El proyecto indicado no existe o ya fue eliminado.')
    }

    // 2) Cleanup de doa_proyectos_embeddings por project_number.
    //    Si la tabla no existe todavia, ignoramos el error (entorno dev sin la migración).
    const embeddingsCleanup = await admin
      .from('doa_proyectos_embeddings' as never)
      .delete()
      .eq('project_number', project.data.numero_proyecto as never)

    if (embeddingsCleanup.error && !isMissingSchemaError(embeddingsCleanup.error)) {
      return jsonResponse(
        500,
        `No se pudo limpiar embeddings del proyecto: ${embeddingsCleanup.error.message}`,
      )
    }

    // 3) Cleanup de doa_conteo_horas_proyectos por proyecto_id.
    //    Idem: si no existe en este entorno, toleramos el missing-schema.
    const timeEntriesCleanup = await admin
      .from('doa_conteo_horas_proyectos' as never)
      .delete()
      .eq('proyecto_id', id as never)

    if (timeEntriesCleanup.error && !isMissingSchemaError(timeEntriesCleanup.error)) {
      return jsonResponse(
        500,
        `No se pudo limpiar el conteo de horas del proyecto: ${timeEntriesCleanup.error.message}`,
      )
    }

    // 4) Borrar el proyecto.
    const deletion = await admin
      .from('doa_proyectos' as never)
      .delete()
      .eq('id', id as never)
      .select('id')
      .maybeSingle<{ id: string }>()

    if (deletion.error) {
      if (isMissingSchemaError(deletion.error)) {
        return jsonResponse(
          409,
          'La tabla public.doa_proyectos no coincide con el esquema esperado. Aplica la migración pendiente antes de borrar proyectos.',
        )
      }

      return jsonResponse(
        500,
        `No se pudo borrar el proyecto: ${deletion.error.message}`,
      )
    }

    if (!deletion.data) {
      return jsonResponse(404, 'El proyecto indicado no existe o ya fue eliminado.')
    }

    return Response.json({
      ok: true,
      id: deletion.data.id,
    })
  } catch (error) {
    console.error('proyecto DELETE error:', error)

    return jsonResponse(
      500,
      error instanceof Error ? error.message : 'Unexpected server error.',
    )
  }
}
