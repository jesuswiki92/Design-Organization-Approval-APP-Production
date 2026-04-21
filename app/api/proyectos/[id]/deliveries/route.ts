/**
 * GET /api/proyectos/[id]/deliveries  — Sprint 3
 * Lista las entregas (deliveries) de un proyecto ordenadas DESC por created_at.
 */

import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import type { ProjectDelivery } from '@/types/database'

export const runtime = 'nodejs'

function jsonResponse(status: number, data: unknown) {
  return Response.json(data, { status })
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireUserApi()
  if (auth instanceof Response) return auth
  const { supabase } = auth
  const { id } = await context.params

  if (!id) return jsonResponse(400, { error: 'proyecto_id requerido.' })

  const { data: proyecto, error: proyectoError } = await supabase
    .from('doa_proyectos')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (proyectoError) return jsonResponse(500, { error: proyectoError.message })
  if (!proyecto) return jsonResponse(404, { error: 'Proyecto no encontrado.' })

  const { data, error } = await supabase
    .from('doa_project_deliveries')
    .select('*')
    .eq('proyecto_id', id)
    .order('created_at', { ascending: false })

  if (error) return jsonResponse(500, { error: error.message })

  return jsonResponse(200, {
    deliveries: (data ?? []) as ProjectDelivery[],
  })
}
