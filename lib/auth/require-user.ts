/**
 * HELPER DE AUTENTICACION PARA API ROUTES Y SERVER ACTIONS
 *
 * Este modulo centraliza la verificacion de sesion de Supabase en el lado
 * servidor. Antes, cada API route duplicaba el bloque:
 *
 *   const supabase = await createClient()
 *   const { data: { user } } = await supabase.auth.getUser()
 *   if (!user) return NextResponse.json({ error: '...' }, { status: 401 })
 *
 * Ahora hay dos variantes, una por cada contexto:
 *
 * - `requireUserApi()`  -> para `app/api/.../route.ts`. Devuelve un objeto
 *   `{ user, supabase }` si la sesion es valida, o directamente un `Response`
 *   con `401 { error: 'Unauthorized' }` si no lo es. El handler debe hacer:
 *
 *     const auth = await requireUserApi()
 *     if (auth instanceof Response) return auth
 *     const { user, supabase } = auth
 *
 * - `requireUserAction()` -> para Server Actions y Server Components. Si no
 *   hay sesion, llama a `redirect('/login')` de `next/navigation` (que lanza
 *   una excepcion especial que Next.js intercepta). Devuelve `{ user, supabase }`
 *   cuando la sesion es valida.
 *
 * Ambas variantes reutilizan el `createClient` async de `lib/supabase/server.ts`
 * para respetar la misma configuracion de cookies SSR del resto de la app.
 *
 * IMPORTANTE: este helper NO sustituye al guard de rutas (`proxy.ts`).
 * El proxy protege las paginas del dashboard; este helper protege
 * endpoints y acciones del lado servidor donde el proxy no se ejecuta
 * (las rutas `/api/*` estan excluidas del matcher de `proxy.ts`).
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { SupabaseClient, User } from '@supabase/supabase-js'

type AuthOk = { user: User; supabase: SupabaseClient }

/**
 * Verifica la sesion de Supabase en una API route.
 *
 * Uso tipico dentro de `app/api/.../route.ts`:
 *
 * ```ts
 * import { requireUserApi } from '@/lib/auth/require-user'
 *
 * export async function POST(request: Request) {
 *   const auth = await requireUserApi()
 *   if (auth instanceof Response) return auth
 *   const { user, supabase } = auth
 *   // ... logica del endpoint ...
 * }
 * ```
 *
 * @returns `Response` 401 JSON `{ error: 'Unauthorized' }` si no hay sesion,
 *          o `{ user, supabase }` si la sesion es valida.
 */
export async function requireUserApi(): Promise<Response | AuthOk> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return { user, supabase }
}

/**
 * Verifica la sesion de Supabase en una Server Action o Server Component.
 *
 * Si no hay sesion valida, llama a `redirect('/login')` de `next/navigation`.
 * `redirect` lanza una excepcion especial que Next.js intercepta para
 * redirigir al user_label, por eso esta funcion nunca "devuelve" un Response.
 *
 * Uso tipico en un Server Action:
 *
 * ```ts
 * 'use server'
 * import { requireUserAction } from '@/lib/auth/require-user'
 *
 * export async function actualizarConsulta(id: string, data: unknown) {
 *   const { user, supabase } = await requireUserAction()
 *   // ... logica de la accion ...
 * }
 * ```
 *
 * @returns `{ user, supabase }` cuando la sesion es valida. Si no hay sesion,
 *          la funcion NO retorna: `redirect` interrumpe la execution.
 */
export async function requireUserAction(): Promise<AuthOk> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return { user, supabase }
}
