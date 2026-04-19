/**
 * GET  /api/proyectos/[id]/lessons — Sprint 4
 * POST /api/proyectos/[id]/lessons — Sprint 4
 *
 * GET: lista las lecciones del proyecto.
 * POST: crea una leccion. Admitida en cualquier momento; si hay una closure
 *   row para el proyecto, la vincula via closure_id, si no queda NULL.
 */

import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import type { LessonCategoria, LessonTipo } from '@/types/database'

export const runtime = 'nodejs'

const VALID_CAT: readonly LessonCategoria[] = [
  'tecnica',
  'proceso',
  'cliente',
  'calidad',
  'planificacion',
  'herramientas',
  'regulatoria',
  'otro',
]
const VALID_TIPO: readonly LessonTipo[] = ['positiva', 'negativa', 'mejora', 'riesgo']

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

  const { data, error } = await supabase
    .from('project_lessons')
    .select('*')
    .eq('proyecto_id', id)
    .order('created_at', { ascending: true })

  if (error) return jsonResponse(500, { error: error.message })
  return jsonResponse(200, { lessons: data ?? [] })
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireUserApi()
  if (auth instanceof Response) return auth
  const { user, supabase } = auth
  const { id } = await context.params
  if (!id) return jsonResponse(400, { error: 'proyecto_id requerido.' })

  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return jsonResponse(400, { error: 'Body JSON invalido.' })
  }

  const categoria = typeof body.categoria === 'string' ? body.categoria : ''
  const tipo = typeof body.tipo === 'string' ? body.tipo : ''
  const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : ''
  const descripcion =
    typeof body.descripcion === 'string' ? body.descripcion.trim() : ''

  if (!VALID_CAT.includes(categoria as LessonCategoria)) {
    return jsonResponse(400, { error: 'categoria invalida.' })
  }
  if (!VALID_TIPO.includes(tipo as LessonTipo)) {
    return jsonResponse(400, { error: 'tipo invalido.' })
  }
  if (!titulo) return jsonResponse(400, { error: 'titulo requerido.' })
  if (!descripcion) return jsonResponse(400, { error: 'descripcion requerida.' })

  const impacto =
    typeof body.impacto === 'string' && body.impacto.trim()
      ? body.impacto.trim()
      : null
  const recomendacion =
    typeof body.recomendacion === 'string' && body.recomendacion.trim()
      ? body.recomendacion.trim()
      : null
  const tags = Array.isArray(body.tags)
    ? (body.tags as unknown[])
        .map((t) => (typeof t === 'string' ? t.trim() : ''))
        .filter((t) => t.length > 0)
    : null

  // Resolver closure_id si existe
  const { data: closure } = await supabase
    .from('project_closures')
    .select('id')
    .eq('proyecto_id', id)
    .maybeSingle()

  const closureId = (closure as { id?: string } | null)?.id ?? null

  const { data: inserted, error: insertErr } = await supabase
    .from('project_lessons')
    .insert({
      proyecto_id: id,
      closure_id: closureId,
      author_user_id: user.id,
      categoria: categoria as LessonCategoria,
      tipo: tipo as LessonTipo,
      titulo,
      descripcion,
      impacto,
      recomendacion,
      tags: tags && tags.length > 0 ? tags : null,
    })
    .select('*')
    .single()

  if (insertErr) return jsonResponse(500, { error: insertErr.message })
  return jsonResponse(200, { lesson: inserted })
}
