import { requireUserApi } from '@/lib/auth/require-user'

export const runtime = 'nodejs'

/**
 * GET /api/clientes
 *
 * Devuelve la lista minima de clientes (id + nombre) para poblar selectores
 * en formularios como el modal "Crear Proyecto Nuevo".
 *
 * Respuesta: `{ clientes: { id, nombre }[] }`.
 */
export async function GET() {
  const auth = await requireUserApi()
  if (auth instanceof Response) return auth
  const { supabase } = auth

  try {
    const { data, error } = await supabase
      .from('doa_clientes_datos_generales')
      .select('id, nombre')
      .order('nombre', { ascending: true })

    if (error) {
      console.warn('[api/clientes] error leyendo doa_clientes_datos_generales:', error.message)
      return Response.json({ clientes: [] })
    }

    const clientes = (data ?? [])
      .filter((r): r is { id: string; nombre: string } => {
        const row = r as { id?: unknown; nombre?: unknown }
        return typeof row.id === 'string' && typeof row.nombre === 'string'
      })

    return Response.json({ clientes })
  } catch (err) {
    console.error('[api/clientes] excepcion:', err)
    return Response.json({ clientes: [] })
  }
}
