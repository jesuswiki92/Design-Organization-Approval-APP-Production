/**
 * ============================================================================
 * Microsoft Graph client (app-only / client_credentials)
 * ============================================================================
 *
 * Slice 1 — inbound-email automation. Construye un cliente de Microsoft Graph
 * autenticado con `ClientSecretCredential` (flujo client_credentials, app-only)
 * envuelto en `TokenCredentialAuthenticationProvider` del SDK oficial.
 *
 * Por qué app-only: el lector de emails corre como cron del servidor, sin
 * usuario en la sesión. Evitamos el OAuth interactivo y el manejo de refresh
 * tokens — el secreto vive solo en `.env.local` (servidor).
 *
 * Variables requeridas en `.env.local`:
 *   - AZURE_AD_TENANT_ID
 *   - AZURE_AD_CLIENT_ID
 *   - AZURE_AD_CLIENT_SECRET
 *   - OUTLOOK_MAILBOX  (e.g. consultas@empresa.com)
 *
 * En app-only es obligatorio indicar el buzón explícito al consultar Graph
 * (`/users/{mailbox}/...`) — por eso `OUTLOOK_MAILBOX` también se valida aquí
 * aunque no se use directamente en este fichero: queremos fallar pronto.
 */

import { ClientSecretCredential } from '@azure/identity'
import { Client } from '@microsoft/microsoft-graph-client'
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials'

const GRAPH_DEFAULT_SCOPE = 'https://graph.microsoft.com/.default'

function readEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Añádela en .env.local (ver .env.local.example).`,
    )
  }
  return value
}

export function getGraphClient(): Client {
  const tenantId = readEnv('AZURE_AD_TENANT_ID')
  const clientId = readEnv('AZURE_AD_CLIENT_ID')
  const clientSecret = readEnv('AZURE_AD_CLIENT_SECRET')
  // Validamos OUTLOOK_MAILBOX aquí también para que el error sea inmediato y
  // claro si falta — no se usa en este fichero, pero es requisito del flujo.
  readEnv('OUTLOOK_MAILBOX')

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret)

  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: [GRAPH_DEFAULT_SCOPE],
  })

  return Client.initWithMiddleware({ authProvider })
}
