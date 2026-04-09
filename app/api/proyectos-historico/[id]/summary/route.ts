import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'

export const runtime = 'nodejs'

/**
 * GET — Fetches the PROJECT_SUMMARY markdown from doa_proyectos_historico.
 * Returns { summary_md, numero_proyecto, titulo }.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireUserApi()
  if (auth instanceof Response) return auth
  const { supabase } = auth

  const { id } = await context.params

  if (!id) {
    return Response.json({ error: 'ID de proyecto no valido.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('doa_proyectos_historico')
    .select('summary_md, numero_proyecto, titulo')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('Error fetching project summary:', error)
    return Response.json(
      { error: `Error al obtener resumen: ${error.message}` },
      { status: 500 },
    )
  }

  if (!data) {
    return Response.json(
      { error: 'Proyecto no encontrado.' },
      { status: 404 },
    )
  }

  return Response.json({
    summary_md: data.summary_md ?? null,
    numero_proyecto: data.numero_proyecto ?? '',
    titulo: data.titulo ?? '',
  })
}
