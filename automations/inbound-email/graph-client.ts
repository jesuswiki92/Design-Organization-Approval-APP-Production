/**
 * ============================================================================
 * Microsoft Graph client (delegated / OAuth user flow con refresh_token)
 * ============================================================================
 *
 * Slice 1 — inbound-email automation. El cliente de Microsoft Graph se
 * autentica con el flujo OAuth de usuario delegado: el usuario hace login una
 * sola vez vía /api/auth/microsoft/login, copia el `refresh_token` resultante
 * a `MICROSOFT_REFRESH_TOKEN` en .env.local, y a partir de ahí el servidor
 * intercambia ese refresh_token por access_tokens frescos en cada llamada.
 *
 * Por qué delegated en vez de client_credentials:
 *   - El buzón a leer es una cuenta personal Microsoft (@outlook.com).
 *   - client_credentials NO soporta cuentas MSA personales — solo work/school
 *     dentro de un tenant. Para personal accounts hay que pasar por el
 *     authority `/common` con permisos delegados.
 *
 * Authority: hardcoded a `https://login.microsoftonline.com/common`. NO usar
 * `AZURE_AD_TENANT_ID` aquí — las cuentas personales requieren `/common`.
 *
 * Variables requeridas en `.env.local`:
 *   - AZURE_AD_CLIENT_ID
 *   - AZURE_AD_CLIENT_SECRET
 *   - OUTLOOK_MAILBOX           (informativo: confirma que se configuró el flujo)
 *   - MICROSOFT_REFRESH_TOKEN   (vacío al principio — se rellena tras el login)
 *
 * `AZURE_AD_TENANT_ID` se sigue declarando en .env.local para coherencia con
 * la app registration, pero NO se referencia desde este flujo.
 */

import { ConfidentialClientApplication } from '@azure/msal-node'
import { Client } from '@microsoft/microsoft-graph-client'
import type { AuthenticationProvider } from '@microsoft/microsoft-graph-client'

const AUTHORITY_COMMON = 'https://login.microsoftonline.com/common'

export const GRAPH_DELEGATED_SCOPES = [
  'https://graph.microsoft.com/Mail.ReadWrite',
  'offline_access',
]

function readEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Añádela en .env.local (ver .env.local.example).`,
    )
  }
  return value
}

/**
 * Construye una instancia compartida de ConfidentialClientApplication para
 * todas las operaciones MSAL del módulo (login, callback, refresh).
 */
export function getMsalClient(): ConfidentialClientApplication {
  const clientId = readEnv('AZURE_AD_CLIENT_ID')
  const clientSecret = readEnv('AZURE_AD_CLIENT_SECRET')

  return new ConfidentialClientApplication({
    auth: {
      clientId,
      clientSecret,
      authority: AUTHORITY_COMMON,
    },
  })
}

/**
 * Devuelve un cliente de Microsoft Graph autenticado con el access_token
 * obtenido al canjear `MICROSOFT_REFRESH_TOKEN`. El cliente Graph llama a
 * `getAccessToken()` de forma perezosa antes de cada request, así que MSAL
 * gestiona la renovación de tokens sin que el resto del código lo sepa.
 */
export function getGraphClient(): Client {
  // Validamos credenciales de la app y el mailbox como sanity check.
  // (mailbox no se usa en la URL de Graph en flujo delegado — el endpoint es
  // /me — pero queremos fallar pronto si la automatización no está configurada.)
  readEnv('AZURE_AD_CLIENT_ID')
  readEnv('AZURE_AD_CLIENT_SECRET')
  readEnv('OUTLOOK_MAILBOX')

  const refreshToken = process.env.MICROSOFT_REFRESH_TOKEN?.trim()
  if (!refreshToken) {
    throw new Error(
      'No hay refresh_token. Visita /api/auth/microsoft/login para autorizar la cuenta de Outlook una vez.',
    )
  }

  const cca = getMsalClient()

  const authProvider: AuthenticationProvider = {
    async getAccessToken(): Promise<string> {
      const result = await cca.acquireTokenByRefreshToken({
        refreshToken,
        scopes: GRAPH_DELEGATED_SCOPES,
      })
      if (!result || !result.accessToken) {
        throw new Error(
          'MSAL no devolvió access_token al canjear MICROSOFT_REFRESH_TOKEN. ' +
            'Es posible que el refresh_token haya expirado: vuelve a /api/auth/microsoft/login.',
        )
      }
      return result.accessToken
    },
  }

  return Client.initWithMiddleware({ authProvider })
}
