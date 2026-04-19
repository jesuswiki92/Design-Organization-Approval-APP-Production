import { requireUserApi } from '@/lib/auth/require-user'

export const runtime = 'nodejs'

/**
 * GET /api/aeronaves/fabricantes
 *
 * Devuelve la lista distinta de fabricantes en `aeronaves` (la tabla
 * catalogo real; `ams_aeronaves_modelos` que declaraba types/database.ts no
 * existe en BD). No hay columna `activo` — devolvemos todos los fabricantes
 * con `fabricante` no-vacio.
 *
 * Respuesta: `{ fabricantes: string[] }` (ordenada alfabeticamente).
 */
export async function GET() {
  const auth = await requireUserApi()
  if (auth instanceof Response) return auth
  const { supabase } = auth

  try {
    const { data, error } = await supabase
      .from('aeronaves')
      .select('fabricante')

    if (error) {
      console.warn('[api/aeronaves/fabricantes] error:', error.message)
      return Response.json({ fabricantes: [] })
    }

    const set = new Set<string>()
    for (const r of data ?? []) {
      const fab = (r as { fabricante?: unknown }).fabricante
      if (typeof fab === 'string' && fab.trim()) set.add(fab.trim())
    }
    const fabricantes = Array.from(set).sort((a, b) => a.localeCompare(b))

    return Response.json({ fabricantes })
  } catch (err) {
    console.error('[api/aeronaves/fabricantes] excepcion:', err)
    return Response.json({ fabricantes: [] })
  }
}
