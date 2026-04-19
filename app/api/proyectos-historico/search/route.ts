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
    .from('proyectos_historico')
    .select('id, numero_proyecto, titulo, descripcion, estado, aeronave, msn, cliente_nombre, anio, created_at')
    .or(`numero_proyecto.ilike.${pattern},titulo.ilike.${pattern},cliente_nombre.ilike.${pattern},aeronave.ilike.${pattern},msn.ilike.${pattern},descripcion.ilike.${pattern}`)
    .order('created_at', { ascending: false })
    .limit(15)

  if (error) {
    console.error('Error searching proyectos historico:', error)
    return Response.json([], { status: 500 })
  }

  return Response.json(data ?? [])
}
