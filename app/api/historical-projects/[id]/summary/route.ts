import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import { extractPhase4BaselineFromSummary } from '@/lib/project-summary-phase4'

export const runtime = 'nodejs'

/**
 * GET — Fetches the PROJECT_SUMMARY markdown from doa_historical_projects.
 * Returns { summary_md, project_number, title }.
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
    return Response.json({ error: 'ID de project no valido.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('doa_historical_projects')
    .select('summary_md, project_number, title')
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
      { error: 'Project no encontrado.' },
      { status: 404 },
    )
  }

  return Response.json({
    phase4_baseline: extractPhase4BaselineFromSummary(data.summary_md, {
      projectCode: data.project_number,
      projectTitle: data.title,
    }),
    summary_md: data.summary_md ?? null,
    project_number: data.project_number ?? '',
    title: data.title ?? '',
  })
}
