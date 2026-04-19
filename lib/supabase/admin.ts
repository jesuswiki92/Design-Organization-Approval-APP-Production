/**
 * CLIENTE SUPABASE CON SERVICE ROLE (ADMIN)
 *
 * Este cliente usa la service_role key en lugar de la anon key.
 * Esto le permite saltarse las politicas RLS de las tablas, por lo
 * que SOLO debe usarse en el lado servidor (API routes, server actions)
 * y NUNCA exponerse al cliente.
 *
 * Caso de uso principal: operaciones de escritura (INSERT, UPDATE, DELETE)
 * en tablas que tienen RLS habilitado sin politicas para el rol
 * 'authenticated' (por ejemplo, proyectos que solo permite
 * SELECT publico y ALL para service_role).
 *
 * IMPORTANTE: la autenticacion del usuario ya debe haberse verificado
 * ANTES de usar este cliente (via requireUserApi / requireUserAction).
 * Este cliente NO valida sesion — solo ejecuta queries con permisos
 * elevados.
 */

import { createClient } from '@supabase/supabase-js'

let _admin: ReturnType<typeof createClient> | null = null

/**
 * Devuelve un cliente Supabase con service_role.
 * Es un singleton — se reutiliza en todas las llamadas del proceso.
 *
 * @throws Error si falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY
 */
export function createAdminClient() {
  if (_admin) return _admin

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error(
      'Falta la variable de entorno NEXT_PUBLIC_SUPABASE_URL. Configurala en .env.local.',
    )
  }
  if (!serviceRoleKey) {
    throw new Error(
      'Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY. Configurala en .env.local.',
    )
  }

  _admin = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return _admin
}
