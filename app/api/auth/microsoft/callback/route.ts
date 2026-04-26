/**
 * ============================================================================
 * GET /api/auth/microsoft/callback
 * ============================================================================
 *
 * Segundo paso del OAuth user flow. Microsoft redirige aquí con `code` y
 * `state` después del consentimiento. Validamos `state` contra la cookie,
 * canjeamos el `code` por tokens vía MSAL, y extraemos el `refresh_token` del
 * cache interno de MSAL para que el usuario lo pegue manualmente en
 * `MICROSOFT_REFRESH_TOKEN` de su .env.local.
 *
 * Por qué leer el cache: `acquireTokenByCode()` devuelve un
 * `AuthenticationResult` con `accessToken`, `idToken`, etc. — pero NO expone
 * el refresh_token directamente (decisión de MSAL para forzar el uso de la
 * caché de tokens). La forma canónica de recuperarlo es serializar el cache
 * (`tokenCache.serialize()`), parsearlo como JSON y leer
 * `RefreshToken.<key>.secret` (ver SerializedRefreshTokenEntity en msal-node).
 *
 * No escribimos automáticamente a .env.local: por seguridad el usuario lo
 * pega manualmente y reinicia el dev server.
 */

import { cookies } from 'next/headers'
import {
  GRAPH_DELEGATED_SCOPES,
  getMsalClient,
} from '@/automations/inbound-email/graph-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATE_COOKIE_NAME = 'ms_oauth_state'

interface SerializedCacheShape {
  RefreshToken?: Record<string, { secret?: string } | undefined>
}

function extractRefreshTokenFromCache(serializedCache: string): string | null {
  let parsed: SerializedCacheShape
  try {
    parsed = JSON.parse(serializedCache) as SerializedCacheShape
  } catch {
    return null
  }
  const refreshTokens = parsed.RefreshToken
  if (!refreshTokens) return null
  for (const entry of Object.values(refreshTokens)) {
    if (entry && typeof entry.secret === 'string' && entry.secret.length > 0) {
      return entry.secret
    }
  }
  return null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function htmlPage(title: string, bodyHtml: string, status = 200): Response {
  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>
      body { font-family: ui-sans-serif, system-ui, sans-serif; max-width: 720px; margin: 3rem auto; padding: 0 1rem; line-height: 1.5; color: #1a1a1a; }
      pre { background: #f4f4f5; padding: 1rem; border-radius: 8px; word-break: break-all; white-space: pre-wrap; font-size: 0.85rem; }
      h1 { font-size: 1.4rem; }
      code { background: #f4f4f5; padding: 0.1rem 0.3rem; border-radius: 4px; }
    </style>
  </head>
  <body>
    ${bodyHtml}
  </body>
</html>`
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const errorParam = url.searchParams.get('error')
    const errorDescription = url.searchParams.get('error_description')

    if (errorParam) {
      return htmlPage(
        'Error de autorización',
        `<h1>❌ Microsoft devolvió un error</h1>
         <p><strong>${escapeHtml(errorParam)}</strong></p>
         <pre>${escapeHtml(errorDescription ?? '(sin descripción)')}</pre>`,
        400,
      )
    }

    if (!code || !state) {
      return htmlPage(
        'Parámetros faltantes',
        `<h1>❌ Faltan <code>code</code> o <code>state</code> en la URL</h1>
         <p>Vuelve a iniciar el flujo desde <code>/api/auth/microsoft/login</code>.</p>`,
        400,
      )
    }

    const cookieStore = await cookies()
    const cookieState = cookieStore.get(STATE_COOKIE_NAME)?.value
    if (!cookieState || cookieState !== state) {
      return htmlPage(
        'State inválido',
        `<h1>❌ Validación de <code>state</code> fallida</h1>
         <p>El parámetro <code>state</code> no coincide con la cookie. Posible CSRF o cookie expirada.</p>
         <p>Vuelve a iniciar el flujo desde <code>/api/auth/microsoft/login</code>.</p>`,
        400,
      )
    }

    const redirectUri = process.env.MICROSOFT_REDIRECT_URI?.trim()
    if (!redirectUri) {
      throw new Error(
        'Falta la variable de entorno MICROSOFT_REDIRECT_URI. Añádela en .env.local (ver .env.local.example).',
      )
    }

    const cca = getMsalClient()

    const result = await cca.acquireTokenByCode({
      code,
      scopes: GRAPH_DELEGATED_SCOPES,
      redirectUri,
    })

    // El refresh_token no viene en `result` — hay que leerlo del cache MSAL.
    const serializedCache = cca.getTokenCache().serialize()
    const refreshToken = extractRefreshTokenFromCache(serializedCache)

    if (!refreshToken) {
      return htmlPage(
        'Sin refresh_token',
        `<h1>❌ No se obtuvo refresh_token</h1>
         <p>Microsoft no devolvió un refresh_token. Asegúrate de haber pedido el scope <code>offline_access</code> y reintenta.</p>
         <pre>${escapeHtml(serializedCache)}</pre>`,
        500,
      )
    }

    // Limpiar la cookie de state (ya cumplió su función).
    cookieStore.delete(STATE_COOKIE_NAME)

    const account = result?.account?.username ?? '(desconocida)'

    return htmlPage(
      'Outlook conectado',
      `<h1>✅ Outlook conectado</h1>
       <p>Cuenta autorizada: <code>${escapeHtml(account)}</code></p>
       <p>Copia este <code>refresh_token</code> a tu <code>.env.local</code> en <code>MICROSOFT_REFRESH_TOKEN</code>:</p>
       <pre>${escapeHtml(refreshToken)}</pre>
       <p>Luego reinicia el dev server y prueba <code>/api/automations/inbound-email/run</code>.</p>`,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    console.error('auth/microsoft/callback: error canjeando code:', error)
    return htmlPage(
      'Error en callback',
      `<h1>❌ Error procesando el callback</h1>
       <pre>${escapeHtml(message)}</pre>`,
      500,
    )
  }
}
