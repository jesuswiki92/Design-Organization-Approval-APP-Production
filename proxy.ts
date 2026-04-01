import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request })

  // Si la ruta es /login, dejar pasar sin verificar auth
  if (request.nextUrl.pathname.startsWith('/login')) {
    return response
  }

  const isDashboard = request.nextUrl.pathname.startsWith('/home') ||
    request.nextUrl.pathname.startsWith('/engineering') ||
    request.nextUrl.pathname.startsWith('/quotations') ||
    request.nextUrl.pathname.startsWith('/clients') ||
    request.nextUrl.pathname.startsWith('/databases') ||
    request.nextUrl.pathname.startsWith('/tools')

  // Solo verificar auth para rutas protegidas
  if (!isDashboard) {
    return response
  }

  let user = null
  try {
    let supabaseResponse = NextResponse.next({ request })
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
    ])
    user = result.data.user

    if (user) return supabaseResponse
  } catch {
    // Supabase down or timeout
  }

  // No user → redirect to login
  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
