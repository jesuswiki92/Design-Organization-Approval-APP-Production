import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'

export const runtime = 'nodejs'

/**
 * GET /api/aeronaves/modelos?fabricante={name}
 *
 * Devuelve los modelos de `doa_aeronaves` para el fabricante dado.
 * La tabla real es `doa_aeronaves` (no `doa_aeronaves_modelos` que aparecia
 * en types/database.ts y no existe). No hay columna `familia` en BD; la
 * devolvemos como cadena vacia para conservar el contrato del modal.
 *
 * Respuesta: `{ modelos: { id, fabricante, familia, modelo }[] }` sin
 * duplicados por (modelo).
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
      .from('doa_aeronaves')
      .select('id, fabricante, modelo')
      .eq('fabricante', fabricante)

    if (error) {
      console.warn('[api/aeronaves/modelos] error:', error.message)
      return Response.json({ modelos: [] })
    }

    // Deduplicar por `modelo` — `doa_aeronaves` tiene una fila por TCDS/MSN,
    // asi que el mismo modelo aparece varias veces.
    const seen = new Map<string, { id: string; fabricante: string; familia: string; modelo: string }>()
    for (const r of data ?? []) {
      const row = r as { id?: unknown; fabricante?: unknown; modelo?: unknown }
      if (typeof row.id !== 'string' || typeof row.fabricante !== 'string') continue
      const modelo = typeof row.modelo === 'string' ? row.modelo.trim() : ''
      if (!modelo || seen.has(modelo)) continue
      seen.set(modelo, {
        id: row.id,
        fabricante: row.fabricante,
        familia: '',
        modelo,
      })
    }
    const modelos = Array.from(seen.values()).sort((a, b) => a.modelo.localeCompare(b.modelo))

    return Response.json({ modelos })
  } catch (err) {
    console.error('[api/aeronaves/modelos] excepcion:', err)
    return Response.json({ modelos: [] })
  }
}
