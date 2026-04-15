import { requireUserApi } from '@/lib/auth/require-user'

export const runtime = 'nodejs'

/**
 * GET /api/aeronaves/fabricantes
 *
 * Devuelve la lista distinta de fabricantes activos en `doa_aeronaves_modelos`
 * (tabla que SI tiene columna `activo`; `doa_aeronaves` no la tiene).
 * Se usa para poblar el primer select del modal "Crear Proyecto Nuevo".
 *
 * Respuesta: `{ fabricantes: string[] }` (ordenada alfabeticamente).
 */
export async function GET() {
  const auth = await requireUserApi()
  if (auth instanceof Response) return auth
  const { supabase } = auth

  try {
    const { data, error } = await supabase
      .from('doa_aeronaves_modelos')
      .select('fabricante')
      .eq('activo', true)

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
