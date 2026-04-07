/**
 * ============================================================================
 * API ROUTE: CAMBIAR ESTADO DE UN PROYECTO
 * ============================================================================
 *
 * Endpoint: PATCH /api/proyectos/[id]/state
 * Body: { estado: string }
 *
 * Valida que el estado solicitado sea un codigo valido del workflow
 * (sin restriccion de transiciones) y actualiza en doa_proyectos.
 * ============================================================================
 */

import { NextResponse } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import { isProjectWorkflowState } from '@/lib/workflow-states'

// TODO(RLS): authz no garantiza ownership — depende de RLS [audit Fase pre-prod]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireUserApi()
    if (auth instanceof Response) return auth
    const { supabase } = auth

    const { id } = await params
    const body = (await request.json()) as { estado?: string }

    if (!body.estado) {
      return NextResponse.json(
        { error: 'Falta el campo "estado" en el body.' },
        { status: 400 },
      )
    }

    const nextState = body.estado

    // Validar que el estado solicitado es un codigo de estado valido del workflow
    if (!isProjectWorkflowState(nextState)) {
      return NextResponse.json(
        { error: `Estado "${nextState}" no es un codigo de estado de proyecto valido.` },
        { status: 422 },
      )
    }

    // Actualizar el estado en la base de datos sin restriccion de transicion
    // (el usuario puede cambiar manualmente a cualquier estado)
    // (updated_at se actualiza automaticamente via trigger en doa_proyectos)
    const { data: updatedRows, error: updateError } = await supabase
      .from('doa_proyectos')
      .update({ estado: nextState })
      .eq('id', id)
      .select('id, estado')

    if (updateError) {
      console.error('Error actualizando estado del proyecto:', updateError)
      return NextResponse.json(
        { error: 'No se pudo actualizar el estado del proyecto.' },
        { status: 500 },
      )
    }

    // Verificar que realmente se actualizo al menos una fila.
    // Supabase puede devolver error: null pero 0 filas si RLS bloquea la operacion
    // o si el ID no existe en la tabla.
    if (!updatedRows || updatedRows.length === 0) {
      console.error(
        `Estado del proyecto no actualizado: id=${id}, estado=${nextState}. ` +
        'Posible causa: RLS bloqueando la operacion o ID inexistente.',
      )
      return NextResponse.json(
        { error: 'No se encontro el proyecto o no se tienen permisos para actualizarlo.' },
        { status: 404 },
      )
    }

    return NextResponse.json({ ok: true, estado: updatedRows[0].estado })
  } catch (error) {
    console.error('Error en PATCH /api/proyectos/[id]/state:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor.' },
      { status: 500 },
    )
  }
}
