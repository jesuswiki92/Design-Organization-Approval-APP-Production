/**
 * PROXY DE AUTENTICACION (Next.js 16)
 *
 * En Next.js 16 el archivo que antes se llamaba `middleware.ts` paso a
 * llamarse `proxy.ts`, y el export debe llamarse `proxy`. Next.js sigue
 * aceptando `middleware.ts` pero emite un warning de deprecacion en cada
 * build, asi que la convencion canonica es esta.
 *
 * Next.js ejecuta automaticamente `proxy.ts` (en la raiz del proyecto) antes
 * de cada request que coincida con `config.matcher`. Aqui es donde protegemos
 * las rutas del dashboard exigiendo una sesion valida de Supabase antes de
 * que el handler de la pagina se ejecute.
 *
 * Reglas que aplica este proxy:
 *
 * 1. Rutas excluidas del matcher (`/_next/*`, `/favicon.ico`, `/api/*`,
 *    recursos estaticos): NO pasan por aqui. Las APIs aplican su propia
 *    verificacion via `requireUserApi` (ver `lib/auth/require-user.ts`).
 *
 * 2. `/login` con sesion valida -> redirige 307 a `/home` (el usuario ya
 *    esta autenticado, no necesita volver a loguearse).
 *
 * 3. `/login` sin sesion -> deja pasar al login.
 *
 * 4. Rutas del dashboard (`/home`, `/engineering`, `/quotations`, `/clients`,
 *    `/databases`, `/tools`, `/settings`) sin sesion valida -> redirige 307
 *    a `/login`.
 *
 * 5. Rutas del dashboard con sesion valida -> deja pasar (con las cookies
 *    refrescadas por Supabase SSR si aplica).
 *
 * 6. Cualquier otra ruta (landing, paginas publicas) -> deja pasar sin
 *    verificar.
 *
 * IMPORTANTE: Next.js 16 requiere que el archivo se llame `proxy.ts` y que
 * el export de la funcion sea `proxy` (no `middleware`). No renombrar.
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Intenta obtener el usuario actual desde las cookies SSR de Supabase.
 * Aplica un timeout de 3 segundos para que un Supabase caido no tumbe la app.
 *
 * @returns `{ user, supabaseResponse }` si la auth responde a tiempo, o
 *          `{ user: null, supabaseResponse: null }` si expira o falla.
 */
async function resolveUser(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000),
      ),
    ])
    return { user: result.data.user, supabaseResponse }
  } catch {
    // Supabase caido o timeout -> tratamos como "sin sesion"
    return { user: null, supabaseResponse: null }
  }
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  const isLogin = pathname.startsWith('/login')
  const isDashboard =
    pathname.startsWith('/home') ||
    pathname.startsWith('/engineering') ||
    pathname.startsWith('/quotations') ||
    pathname.startsWith('/clients') ||
    pathname.startsWith('/databases') ||
    pathname.startsWith('/tools') ||
    pathname.startsWith('/settings')

  // Rutas que no son ni login ni dashboard: pasan sin verificar.
  if (!isLogin && !isDashboard) {
    return NextResponse.next({ request })
  }

  const { user, supabaseResponse } = await resolveUser(request)

  // Caso 1: /login con usuario ya autenticado -> redirige a /home.
  if (isLogin) {
    if (user) {
      return NextResponse.redirect(new URL('/home', request.url))
    }
    // Sin sesion -> deja pasar al login.
    return supabaseResponse ?? NextResponse.next({ request })
  }

  // Caso 2: ruta del dashboard con sesion valida -> deja pasar.
  if (user && supabaseResponse) {
    return supabaseResponse
  }

  // Caso 3: ruta del dashboard sin sesion (o auth tumbada) -> login.
  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
