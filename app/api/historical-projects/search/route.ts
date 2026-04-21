import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import { escapeIlikePattern } from '@/lib/supabase/escape-or-filter'

const MAX_QUERY_LENGTH = 100

export async function GET(request: NextRequest) {
  const auth = await requireUserApi()
  if (auth instanceof Response) return auth
  const { supabase } = auth

  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return Response.json([])
  }
  if (q.length > MAX_QUERY_LENGTH) {
    return Response.json({ error: 'Query too long' }, { status: 400 })
  }

  // Escape PostgREST `.or()` metacharacters and SQL LIKE wildcards before
  // building the filter string. Without this, characters like `,`, `(`, `)`,
  // `*`, `%`, `_` could break clause parsing or inject wildcards.
  const safeQ = escapeIlikePattern(q)
  if (!safeQ) {
    return Response.json([])
  }
  const pattern = `%${safeQ}%`

  const { data, error } = await supabase
    .from('doa_historical_projects')
    .select('id, project_number, title, description, status, aircraft, msn, client_name, year, created_at')
    .or(`project_number.ilike.${pattern},title.ilike.${pattern},client_name.ilike.${pattern},aircraft.ilike.${pattern},msn.ilike.${pattern},description.ilike.${pattern}`)
    .order('created_at', { ascending: false })
    .limit(15)

  if (error) {
    console.error('Error searching projects historical:', error)
    return Response.json([], { status: 500 })
  }

  return Response.json(data ?? [])
}
