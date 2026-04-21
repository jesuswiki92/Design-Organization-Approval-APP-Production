/**
 * GET  /api/projects/[id]/lessons — Sprint 4
 * POST /api/projects/[id]/lessons — Sprint 4
 *
 * GET: lista las lecciones del project.
 * POST: crea una leccion. Admitida en cualquier momento; si hay una closure
 *   row para el project, la vincula via closure_id, si no queda NULL.
 */

import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import type { LessonCategory, LessonType } from '@/types/database'

export const runtime = 'nodejs'

const VALID_CAT: readonly LessonCategory[] = [
  'technical',
  'process',
  'client',
  'quality',
  'planning',
  'tools',
  'regulatory',
  'other',
]
const VALID_TIPO: readonly LessonType[] = ['positive', 'negative', 'improvement', 'risk']

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
  if (!id) return jsonResponse(400, { error: 'project_id requerido.' })

  const { data, error } = await supabase
    .from('doa_project_lessons')
    .select('*')
    .eq('project_id', id)
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
  if (!id) return jsonResponse(400, { error: 'project_id requerido.' })

  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return jsonResponse(400, { error: 'Body JSON invalido.' })
  }

  const category = typeof body.category === 'string' ? body.category : ''
  const type = typeof body.type === 'string' ? body.type : ''
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const description =
    typeof body.description === 'string' ? body.description.trim() : ''

  if (!VALID_CAT.includes(category as LessonCategory)) {
    return jsonResponse(400, { error: 'category invalida.' })
  }
  if (!VALID_TIPO.includes(type as LessonType)) {
    return jsonResponse(400, { error: 'type invalido.' })
  }
  if (!title) return jsonResponse(400, { error: 'title requerido.' })
  if (!description) return jsonResponse(400, { error: 'description requerida.' })

  const impact =
    typeof body.impact === 'string' && body.impact.trim()
      ? body.impact.trim()
      : null
  const recommendation =
    typeof body.recommendation === 'string' && body.recommendation.trim()
      ? body.recommendation.trim()
      : null
  const tags = Array.isArray(body.tags)
    ? (body.tags as unknown[])
        .map((t) => (typeof t === 'string' ? t.trim() : ''))
        .filter((t) => t.length > 0)
    : null

  // Resolver closure_id si existe
  const { data: closure } = await supabase
    .from('doa_project_closures')
    .select('id')
    .eq('project_id', id)
    .maybeSingle()

  const closureId = (closure as { id?: string } | null)?.id ?? null

  const { data: inserted, error: insertErr } = await supabase
    .from('doa_project_lessons')
    .insert({
      project_id: id,
      closure_id: closureId,
      author_user_id: user.id,
      category: category as LessonCategory,
      type: type as LessonType,
      title,
      description,
      impact,
      recommendation,
      tags: tags && tags.length > 0 ? tags : null,
    })
    .select('*')
    .single()

  if (insertErr) return jsonResponse(500, { error: insertErr.message })
  return jsonResponse(200, { lesson: inserted })
}
