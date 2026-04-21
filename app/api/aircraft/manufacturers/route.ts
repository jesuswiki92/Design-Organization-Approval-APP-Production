import { requireUserApi } from '@/lib/auth/require-user'

export const runtime = 'nodejs'

/**
 * GET /api/aircraft/manufacturers
 *
 * Devuelve la lista distinta de manufacturers en `doa_aircraft` (la table
 * catalogo real; `doa_aircraft_models` que declaraba types/database.ts no
 * existe en BD). No hay columna `active` — devolvemos todos los manufacturers
 * con `manufacturer` no-vacio.
 *
 * Response: `{ manufacturers: string[] }` (ordenada alfabeticamente).
 */
export async function GET() {
  const auth = await requireUserApi()
  if (auth instanceof Response) return auth
  const { supabase } = auth

  try {
    const { data, error } = await supabase
      .from('doa_aircraft')
      .select('manufacturer')

    if (error) {
      console.warn('[api/aircraft/manufacturers] error:', error.message)
      return Response.json({ manufacturers: [] })
    }

    const set = new Set<string>()
    for (const r of data ?? []) {
      const fab = (r as { manufacturer?: unknown }).manufacturer
      if (typeof fab === 'string' && fab.trim()) set.add(fab.trim())
    }
    const manufacturers = Array.from(set).sort((a, b) => a.localeCompare(b))

    return Response.json({ manufacturers })
  } catch (err) {
    console.error('[api/aircraft/manufacturers] excepcion:', err)
    return Response.json({ manufacturers: [] })
  }
}
