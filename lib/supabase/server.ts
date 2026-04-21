/**
 * CONEXION A SUPABASE DESDE EL SERVIDOR (LADO SERVIDOR)
 *
 * Este archivo crea la conexion a Supabase (la base de data de la app)
 * para usarla en las partes de la app que se ejecutan en el servidor
 * (las paginas "page.tsx", las API routes, y los Server Components).
 *
 * A diferencia del archivo "client.ts", esta version maneja las "cookies"
 * (pequenos data que el navegador guarda para mantener la sesion del user_label).
 * Esto permite que el servidor sepa quien esta conectado y verificar permisos.
 *
 * IMPORTANTE: No modificar este archivo sin una razon clara.
 * Es una pieza critica de la autenticacion y el acceso a data.
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Crea y devuelve una conexion a Supabase para usar desde el servidor.
 *
 * Esta funcion es "async" (asincrona) porque necesita esperar a leer
 * las cookies del navegador del user_label antes de crear la conexion.
 *
 * La configuracion de cookies permite que Supabase:
 * - getAll: lea las cookies existentes para saber quien es el user_label
 * - setAll: guarde o actualice cookies (por ejemplo, al renovar la sesion)
 *
 * El bloque "catch" vacio en setAll es intencional: en los Server Components
 * de Next.js no se pueden modificar cookies, asi que se ignora el error.
 *
 * @returns Un objeto de conexion a Supabase listo para hacer requests autenticadas
 */
export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl) {
    throw new Error(
      'Falta la variable de entorno NEXT_PUBLIC_SUPABASE_URL. Configurala en .env.local antes de arrancar la app.',
    )
  }
  if (!supabaseAnonKey) {
    throw new Error(
      'Falta la variable de entorno NEXT_PUBLIC_SUPABASE_ANON_KEY. Configurala en .env.local antes de arrancar la app.',
    )
  }

  const cookieStore = await cookies()

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Se ignora el error en Server Components porque ahi no se pueden modificar cookies
          }
        },
      },
    }
  )
}
