/**
 * Cliente Supabase mínimo para Server Components — SOLO LECTURA, SIN AUTH.
 *
 * Convención de la reconstrucción frame-only:
 * - Sin cookies/sesión: usamos la publishable (anon) key.
 * - Sin RLS en las tablas reconectadas (de momento). Cuando reconectemos auth,
 *   añadiremos RLS y un cliente con sesión.
 * - Solo se importa desde server components / route handlers — nunca cliente.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local',
  )
}

export const supabaseServer = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
