/**
 * ============================================================================
 * API ROUTE: CAMBIAR ESTADO DE UN PROYECTO
 * ============================================================================
 *
 * Endpoint: PATCH /api/projects/[id]/state
 * Body: { status: string }
 *
 * Valida que el status solicitado sea un codigo valido del workflow
 * (sin restriccion de transiciones) y actualiza en doa_projects.
 * ============================================================================
 */

import { NextResponse } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import { logServerEvent } from '@/lib/observability/server'
import { buildRequestContext } from '@/lib/observability/shared'
import { isProjectWorkflowState } from '@/lib/workflow-states'

// TODO(RLS): authz no garantiza ownership — depende de RLS [audit Fase pre-prod]
// doa_projects.owner es text libre (no FK a auth.users), asi que no se puede
// enforcear ownership server-side. Hasta que exista una table de roles +
// owner_user_id, emitimos un severity=warn cuando un non-admin muta el status.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireUserApi()
    if (auth instanceof Response) return auth
    const { user, supabase } = auth

    const { id } = await params
    const body = (await request.json()) as { status?: string }

    if (!body.status) {
      return NextResponse.json(
        { error: 'Falta el campo "status" en el body.' },
        { status: 400 },
      )
    }

    const nextState = body.status

    // Validar que el status solicitado es un codigo de status valido del workflow
    if (!isProjectWorkflowState(nextState)) {
      return NextResponse.json(
        { error: `Status "${nextState}" no es un codigo de status de project valido.` },
        { status: 422 },
      )
    }

    const isAdmin =
      (user.user_metadata as { role?: unknown } | null)?.role === 'admin'
    if (!isAdmin) {
      const ctx = buildRequestContext(request)
      await logServerEvent({
        eventName: 'project.state_change.non_admin',
        eventCategory: 'security',
        outcome: 'info',
        severity: 'warn',
        actorUserId: user.id,
        requestId: ctx.requestId,
        route: ctx.route,
        method: request.method,
        entityType: 'project',
        entityId: id,
        metadata: { reason: 'rls_pending', intended_state: nextState },
      })
    }

    // Actualizar el status en la base de data sin restriccion de transicion
    // (el user_label puede cambiar manualmente a cualquier status)
    // (updated_at se actualiza automaticamente via trigger en doa_projects)
    const { data: updatedRows, error: updateError } = await supabase
      .from('doa_projects')
      .update({ status: nextState })
      .eq('id', id)
      .select('id, status')

    if (updateError) {
      console.error('Error actualizando status del project:', updateError)
      return NextResponse.json(
        { error: 'No se pudo actualizar el status del project.' },
        { status: 500 },
      )
    }

    // Verificar que realmente se actualizo al menos una fila.
    // Supabase puede devolver error: null pero 0 filas si RLS bloquea la operacion
    // o si el ID no existe en la table.
    if (!updatedRows || updatedRows.length === 0) {
      console.error(
        `Status del project no actualizado: id=${id}, status=${nextState}. ` +
        'Posible causa: RLS bloqueando la operacion o ID inexistente.',
      )
      return NextResponse.json(
        { error: 'No se encontro el project o no se tienen permisos para actualizarlo.' },
        { status: 404 },
      )
    }

    return NextResponse.json({ ok: true, status: updatedRows[0].status })
  } catch (error) {
    console.error('Error en PATCH /api/projects/[id]/state:', error)
    return NextResponse.json(
      { error: 'Error internal del servidor.' },
      { status: 500 },
    )
  }
}
