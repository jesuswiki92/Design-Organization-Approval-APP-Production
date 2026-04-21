/**
 * CONEXION A SUPABASE DESDE EL NAVEGADOR DEL USUARIO (LADO CLIENTE)
 *
 * Este archivo crea la conexion a Supabase (la base de data de la app)
 * para usarla en las partes de la app que se ejecutan en el navegador
 * del user_label (componentes marcados con "use client").
 *
 * Supabase es el servicio donde se guardan todos los data de la DOA:
 * clients, requests, projects, cotizaciones, etc.
 *
 * IMPORTANTE: Este archivo NO se debe usar en componentes del servidor.
 * Para esos casos, usar el archivo "server.ts" que esta en la misma folder.
 */

import { createBrowserClient } from '@supabase/ssr'

/**
 * Crea y devuelve una conexion a Supabase para usar desde el navegador.
 *
 * Utiliza dos data de configuracion que estan en las variables de entorno:
 * - NEXT_PUBLIC_SUPABASE_URL: la address website de nuestro project en Supabase
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY: la clave publica de acceso (segura para el navegador)
 *
 * @returns Un objeto de conexion a Supabase listo para hacer requests a la base de data
 */
export function createClient() {
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

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
