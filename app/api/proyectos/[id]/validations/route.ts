import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

function jsonResponse(status: number, data: unknown) {
  return Response.json(data, { status })
}

type ValidationRow = {
  id: string
  proyecto_id: string
  validator_user_id: string
  role: string
  decision: string
  comentarios: string | null
  observaciones: unknown
  deliverables_snapshot: unknown
  created_at: string
}

/**
 * GET — Lista las validaciones de un proyecto ordenadas por fecha DESC.
 * Enriquece cada fila con `validator_email` (via auth.admin.getUserById,
 * usando el admin client). Si la consulta admin falla, el email queda null
 * pero la validacion se devuelve igualmente.
 */
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
    .from('proyectos')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (proyectoError) return jsonResponse(500, { error: proyectoError.message })
  if (!proyecto) return jsonResponse(404, { error: 'Proyecto no encontrado.' })

  const { data, error } = await supabase
    .from('project_validations')
    .select('*')
    .eq('proyecto_id', id)
    .order('created_at', { ascending: false })

  if (error) return jsonResponse(500, { error: error.message })

  const rows = (data ?? []) as ValidationRow[]

  // Enriquecer con email del validador usando admin client (auth.users no es
  // tabla directamente consultable por el cliente SSR normal).
  let admin: ReturnType<typeof createAdminClient> | null = null
  try {
    admin = createAdminClient()
  } catch (e) {
    console.error('validations GET: admin client unavailable:', e)
  }

  const uniqueIds = Array.from(new Set(rows.map((r) => r.validator_user_id)))
  const emailByUser = new Map<string, string | null>()

  if (admin) {
    await Promise.all(
      uniqueIds.map(async (uid) => {
        try {
          const { data: u } = await admin!.auth.admin.getUserById(uid)
          emailByUser.set(uid, u?.user?.email ?? null)
        } catch {
          emailByUser.set(uid, null)
        }
      }),
    )
  }

  const enriched = rows.map((r) => ({
    ...r,
    validator_email: emailByUser.get(r.validator_user_id) ?? null,
  }))

  return jsonResponse(200, { validations: enriched })
}
