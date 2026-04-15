import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'

export const runtime = 'nodejs'

/**
 * GET /api/aeronaves/modelos?fabricante={name}
 *
 * Devuelve los modelos activos de `doa_aeronaves_modelos` para el fabricante
 * dado. Usamos `doa_aeronaves_modelos` porque tiene columnas `familia`,
 * `modelo` y `activo` (mientras que `doa_aeronaves` modela aeronaves reales
 * con TCDS/MSN).
 *
 * Respuesta: `{ modelos: { id, fabricante, familia, modelo }[] }`.
 */
export async function GET(request: NextRequest) {
  const auth = await requireUserApi()
  if (auth instanceof Response) return auth
  const { supabase } = auth

  const fabricante = request.nextUrl.searchParams.get('fabricante')?.trim() ?? ''

  if (!fabricante) {
    return Response.json({ modelos: [] })
  }

  try {
    const { data, error } = await supabase
      .from('doa_aeronaves_modelos')
      .select('id, fabricante, familia, modelo')
      .eq('activo', true)
      .eq('fabricante', fabricante)

    if (error) {
      console.warn('[api/aeronaves/modelos] error:', error.message)
      return Response.json({ modelos: [] })
    }

    const modelos = (data ?? [])
      .map((r) => {
        const row = r as {
          id?: unknown
          fabricante?: unknown
          familia?: unknown
          modelo?: unknown
        }
        if (typeof row.id !== 'string' || typeof row.fabricante !== 'string') return null
        return {
          id: row.id,
          fabricante: row.fabricante,
          familia: typeof row.familia === 'string' ? row.familia : '',
          modelo: typeof row.modelo === 'string' ? row.modelo : '',
        }
      })
      .filter((r): r is { id: string; fabricante: string; familia: string; modelo: string } => r !== null)
      .sort((a, b) => a.modelo.localeCompare(b.modelo))

    return Response.json({ modelos })
  } catch (err) {
    console.error('[api/aeronaves/modelos] excepcion:', err)
    return Response.json({ modelos: [] })
  }
}
