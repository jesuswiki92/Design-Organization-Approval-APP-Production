/**
 * GET /api/projects/[id]/closure — Sprint 4
 *
 * Devuelve la closure row (si existe), la firma de closure asociada y la lista
 * de lecciones del project.
 */

import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'

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
  if (!id) return jsonResponse(400, { error: 'project_id requerido.' })

  const { data: closure, error: closureErr } = await supabase
    .from('doa_project_closures')
    .select('*')
    .eq('project_id', id)
    .maybeSingle()

  if (closureErr) return jsonResponse(500, { error: closureErr.message })

  let signature: unknown = null
  if (closure && (closure as { signature_id?: string | null }).signature_id) {
    const sigId = (closure as { signature_id: string }).signature_id
    const { data: sigRow } = await supabase
      .from('doa_project_signatures')
      .select('id, signature_type, signer_role, signer_user_id, payload_hash, hmac_key_id, created_at')
      .eq('id', sigId)
      .maybeSingle()
    signature = sigRow ?? null
  }

  const { data: lessons, error: lessonsErr } = await supabase
    .from('doa_project_lessons')
    .select('*')
    .eq('project_id', id)
    .order('created_at', { ascending: true })

  if (lessonsErr) return jsonResponse(500, { error: lessonsErr.message })

  return jsonResponse(200, {
    closure,
    signature,
    lessons: lessons ?? [],
  })
}
