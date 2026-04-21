import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'

export const runtime = 'nodejs'

/**
 * GET /api/aircraft/models?manufacturer={name}
 *
 * Devuelve los models de `doa_aircraft` para el manufacturer dado.
 * La table real es `doa_aircraft` (no `doa_aircraft_models` que aparecia
 * en types/database.ts y no existe). No hay columna `family` en BD; la
 * devolvemos como cadena vacia para conservar el contrato del modal.
 *
 * Response: `{ models: { id, manufacturer, family, model, tcds_code,
 * tcds_code_short, tcds_issue, tcds_date }[] }` sin duplicados por
 * (model). El front usa los campos TCDS para auto-rellenar cuando el
 * user_label selecciona un model.
 */
export async function GET(request: NextRequest) {
  const auth = await requireUserApi()
  if (auth instanceof Response) return auth
  const { supabase } = auth

  const manufacturer = request.nextUrl.searchParams.get('manufacturer')?.trim() ?? ''

  if (!manufacturer) {
    return Response.json({ models: [] })
  }

  try {
    const { data, error } = await supabase
      .from('doa_aircraft')
      .select('id, manufacturer, model, tcds_code, tcds_code_short, tcds_issue, tcds_date')
      .eq('manufacturer', manufacturer)

    if (error) {
      console.warn('[api/aircraft/models] error:', error.message)
      return Response.json({ models: [] })
    }

    // Deduplicar por `model` — `doa_aircraft` tiene una fila por TCDS/MSN,
    // asi que el mismo model aparece varias veces. Aqui la relacion
    // model -> TCDS es 1:1 (verificado en BD), asi que la primera ocurrencia
    // sirve.
    type ModeloRow = {
      id: string
      manufacturer: string
      family: string
      model: string
      tcds_code: string
      tcds_code_short: string
      tcds_issue: string
      tcds_date: string
    }
    const seen = new Map<string, ModeloRow>()
    for (const r of data ?? []) {
      const row = r as {
        id?: unknown
        manufacturer?: unknown
        model?: unknown
        tcds_code?: unknown
        tcds_code_short?: unknown
        tcds_issue?: unknown
        tcds_date?: unknown
      }
      if (typeof row.id !== 'string' || typeof row.manufacturer !== 'string') continue
      const model = typeof row.model === 'string' ? row.model.trim() : ''
      if (!model || seen.has(model)) continue
      seen.set(model, {
        id: row.id,
        manufacturer: row.manufacturer,
        family: '',
        model,
        tcds_code: typeof row.tcds_code === 'string' ? row.tcds_code : '',
        tcds_code_short: typeof row.tcds_code_short === 'string' ? row.tcds_code_short : '',
        tcds_issue: typeof row.tcds_issue === 'string' ? row.tcds_issue : '',
        tcds_date: typeof row.tcds_date === 'string' ? row.tcds_date : '',
      })
    }
    const models = Array.from(seen.values()).sort((a, b) => a.model.localeCompare(b.model))

    return Response.json({ models })
  } catch (err) {
    console.error('[api/aircraft/models] excepcion:', err)
    return Response.json({ models: [] })
  }
}
