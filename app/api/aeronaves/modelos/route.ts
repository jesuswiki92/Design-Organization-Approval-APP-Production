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
 * Respuesta: `{ modelos: { id, fabricante, familia, modelo, tcds_code,
 * tcds_code_short, tcds_issue, tcds_date }[] }` sin duplicados por
 * (modelo). El front usa los campos TCDS para auto-rellenar cuando el
 * usuario selecciona un modelo.
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
      .select('id, fabricante, modelo, tcds_code, tcds_code_short, tcds_issue, tcds_date')
      .eq('fabricante', fabricante)

    if (error) {
      console.warn('[api/aeronaves/modelos] error:', error.message)
      return Response.json({ modelos: [] })
    }

    // Deduplicar por `modelo` — `doa_aeronaves` tiene una fila por TCDS/MSN,
    // asi que el mismo modelo aparece varias veces. Aqui la relacion
    // modelo -> TCDS es 1:1 (verificado en BD), asi que la primera ocurrencia
    // sirve.
    type ModeloRow = {
      id: string
      fabricante: string
      familia: string
      modelo: string
      tcds_code: string
      tcds_code_short: string
      tcds_issue: string
      tcds_date: string
    }
    const seen = new Map<string, ModeloRow>()
    for (const r of data ?? []) {
      const row = r as {
        id?: unknown
        fabricante?: unknown
        modelo?: unknown
        tcds_code?: unknown
        tcds_code_short?: unknown
        tcds_issue?: unknown
        tcds_date?: unknown
      }
      if (typeof row.id !== 'string' || typeof row.fabricante !== 'string') continue
      const modelo = typeof row.modelo === 'string' ? row.modelo.trim() : ''
      if (!modelo || seen.has(modelo)) continue
      seen.set(modelo, {
        id: row.id,
        fabricante: row.fabricante,
        familia: '',
        modelo,
        tcds_code: typeof row.tcds_code === 'string' ? row.tcds_code : '',
        tcds_code_short: typeof row.tcds_code_short === 'string' ? row.tcds_code_short : '',
        tcds_issue: typeof row.tcds_issue === 'string' ? row.tcds_issue : '',
        tcds_date: typeof row.tcds_date === 'string' ? row.tcds_date : '',
      })
    }
    const modelos = Array.from(seen.values()).sort((a, b) => a.modelo.localeCompare(b.modelo))

    return Response.json({ modelos })
  } catch (err) {
    console.error('[api/aeronaves/modelos] excepcion:', err)
    return Response.json({ modelos: [] })
  }
}
