/**
 * CLIENTE SUPABASE CON SERVICE ROLE (ADMIN)
 *
 * Este client usa la service_role key en lugar de la anon key.
 * Esto le permite saltarse las politicas RLS de las tablas, por lo
 * que SOLO debe usarse en el lado servidor (API routes, server actions)
 * y NUNCA exponerse al client.
 *
 * Caso de uso primary: operaciones de escritura (INSERT, UPDATE, DELETE)
 * en tablas que tienen RLS habilitado sin politicas para el role
 * 'authenticated' (por ejemplo, doa_projects que solo permite
 * SELECT publico y ALL para service_role).
 *
 * IMPORTANTE: la autenticacion del user_label ya debe haberse verificado
 * ANTES de usar este client (via requireUserApi / requireUserAction).
 * Este client NO valida sesion — solo ejecuta queries con permisos
 * elevados.
 */

import { createClient } from '@supabase/supabase-js'

let _admin: ReturnType<typeof createClient> | null = null

/**
 * Devuelve un client Supabase con service_role.
 * Es un singleton — se reutiliza en todas las llamadas del process.
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
