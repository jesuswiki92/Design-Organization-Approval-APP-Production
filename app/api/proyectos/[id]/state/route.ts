/**
 * ============================================================================
 * API ROUTE: CAMBIAR ESTADO DE UN PROYECTO
 * ============================================================================
 *
 * Endpoint: PATCH /api/proyectos/[id]/state
 * Body: { estado: string }
 *
 * Valida que la transicion sea permitida segun las reglas del workflow
 * antes de actualizar el estado en doa_proyectos.
 * ============================================================================
 */

import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import {
  getAllowedProjectTransitions,
  getProjectStatusMeta,
} from '@/lib/workflow-states'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = (await request.json()) as { estado?: string }

    if (!body.estado) {
      return NextResponse.json(
        { error: 'Falta el campo "estado" en el body.' },
        { status: 400 },
      )
    }

    const nextState = body.estado

    // Obtener el proyecto actual para validar la transicion
    const supabase = await createClient()

    const { data: proyecto, error: fetchError } = await supabase
      .from('doa_proyectos')
      .select('id, estado')
      .eq('id', id)
      .single()

    if (fetchError || !proyecto) {
      return NextResponse.json(
        { error: 'Proyecto no encontrado.' },
        { status: 404 },
      )
    }

    // Validar que la transicion esta permitida
    const allowed = getAllowedProjectTransitions(proyecto.estado)
    if (!allowed.includes(nextState as never)) {
      const currentMeta = getProjectStatusMeta(proyecto.estado)
      const nextMeta = getProjectStatusMeta(nextState)
      return NextResponse.json(
        {
          error: `Transicion no permitida: de "${currentMeta.label}" a "${nextMeta.label}".`,
        },
        { status: 422 },
      )
    }

    // Actualizar el estado en la base de datos
    const { error: updateError } = await supabase
      .from('doa_proyectos')
      .update({
        estado: nextState,
        estado_updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error actualizando estado del proyecto:', updateError)
      return NextResponse.json(
        { error: 'No se pudo actualizar el estado del proyecto.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true, estado: nextState })
  } catch (error) {
    console.error('Error en PATCH /api/proyectos/[id]/state:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor.' },
      { status: 500 },
    )
  }
}
