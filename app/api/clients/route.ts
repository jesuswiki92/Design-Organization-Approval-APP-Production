import { requireUserApi } from '@/lib/auth/require-user'

export const runtime = 'nodejs'

/**
 * GET /api/clients
 *
 * Devuelve la lista minima de clients (id + name) para poblar selectores
 * en forms como el modal "Crear Project New".
 *
 * Response: `{ clients: { id, name }[] }`.
 */
export async function GET() {
  const auth = await requireUserApi()
  if (auth instanceof Response) return auth
  const { supabase } = auth

  try {
    const { data, error } = await supabase
      .from('doa_clients')
      .select('id, name')
      .order('name', { ascending: true })

    if (error) {
      console.warn('[api/clients] error leyendo doa_clients:', error.message)
      return Response.json({ clients: [] })
    }

    const clients = (data ?? [])
      .filter((r): r is { id: string; name: string } => {
        const row = r as { id?: unknown; name?: unknown }
        return typeof row.id === 'string' && typeof row.name === 'string'
      })

    return Response.json({ clients })
  } catch (err) {
    console.error('[api/clients] excepcion:', err)
    return Response.json({ clients: [] })
  }
}
