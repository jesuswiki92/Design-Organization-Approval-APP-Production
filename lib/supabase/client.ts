/**
 * CONEXION A SUPABASE DESDE EL NAVEGADOR DEL USUARIO (LADO CLIENTE)
 *
 * Este archivo crea la conexion a Supabase (la base de datos de la app)
 * para usarla en las partes de la app que se ejecutan en el navegador
 * del usuario (componentes marcados con "use client").
 *
 * Supabase es el servicio donde se guardan todos los datos de la DOA:
 * clientes, consultas, proyectos, cotizaciones, etc.
 *
 * IMPORTANTE: Este archivo NO se debe usar en componentes del servidor.
 * Para esos casos, usar el archivo "server.ts" que esta en la misma carpeta.
 */

import { createBrowserClient } from '@supabase/ssr'

/**
 * Crea y devuelve una conexion a Supabase para usar desde el navegador.
 *
 * Utiliza dos datos de configuracion que estan en las variables de entorno:
 * - NEXT_PUBLIC_SUPABASE_URL: la direccion web de nuestro proyecto en Supabase
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY: la clave publica de acceso (segura para el navegador)
 *
 * @returns Un objeto de conexion a Supabase listo para hacer consultas a la base de datos
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
