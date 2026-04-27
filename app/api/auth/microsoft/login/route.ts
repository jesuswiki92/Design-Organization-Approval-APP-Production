/**
 * ============================================================================
 * GET /api/auth/microsoft/login
 * ============================================================================
 *
 * Primer paso del OAuth user flow para conectar la cuenta Outlook que lee
 * `automations/inbound-email`. Genera la URL del /authorize de Microsoft,
 * guarda un `state` en cookie httpOnly para mitigar CSRF, y redirige al
 * usuario al login de Microsoft.
 *
 * Tras consentir, Microsoft redirige a `MICROSOFT_REDIRECT_URI`
 * (= /api/auth/microsoft/callback) con `code` + `state`.
 *
 * Authority: `https://login.microsoftonline.com/common` para soportar cuentas
 * personales MSA (@outlook.com) además de organizativas. El tenant_id NO se
 * usa aquí.
 *
 * Scopes pedidos:
 *   - https://graph.microsoft.com/Mail.ReadWrite — leer/marcar/responder mails
 *   - https://graph.microsoft.com/Mail.Send       — enviar respuestas al cliente
 *   - offline_access                              — devuelve refresh_token
 */

import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { GRAPH_DELEGATED_SCOPES, getMsalClient } from '@/automations/inbound-email/graph-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATE_COOKIE_NAME = 'ms_oauth_state'
const STATE_COOKIE_MAX_AGE_SECONDS = 600

export async function GET(): Promise<Response> {
  try {
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI?.trim()
    if (!redirectUri) {
      throw new Error(
        'Falta la variable de entorno MICROSOFT_REDIRECT_URI. Añádela en .env.local (ver .env.local.example).',
      )
    }

    const cca = getMsalClient()
    const state = randomUUID()

    const authUrl = await cca.getAuthCodeUrl({
      scopes: GRAPH_DELEGATED_SCOPES,
      redirectUri,
      state,
      // `prompt: 'select_account'` no se fuerza para que la primera vez pida
      // login normal y reutilice sesión en consentimientos sucesivos.
    })

    const cookieStore = await cookies()
    cookieStore.set(STATE_COOKIE_NAME, state, {
      httpOnly: true,
      secure: false, // localhost dev
      sameSite: 'lax',
      maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
      path: '/',
    })

    return Response.redirect(authUrl, 302)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    console.error('auth/microsoft/login: error generando authUrl:', error)
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
