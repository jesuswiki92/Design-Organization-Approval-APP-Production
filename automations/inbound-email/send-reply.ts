/**
 * ============================================================================
 * send-reply — Envío de email saliente al cliente vía Microsoft Graph
 * ============================================================================
 *
 * Sub-Slice B. Envía un email HTML a través del endpoint /me/sendMail de
 * Microsoft Graph usando el cliente delegado autenticado con
 * `getGraphClient()`. La cuenta es la del usuario que autorizó vía
 * /api/auth/microsoft/login (mailbox personal Outlook).
 *
 * El endpoint /me/sendMail responde con 202 No Content cuando todo va bien,
 * y el SDK simplemente devuelve `undefined`. Si algo falla (auth, scope,
 * payload) lanza una excepción que cazamos y normalizamos.
 *
 * Permiso requerido: Mail.Send (Delegated). Si el refresh_token actual no
 * tiene ese scope concedido (porque se generó antes de añadirlo), Graph
 * devolverá 403 ErrorAccessDenied y el usuario tendrá que volver a
 * /api/auth/microsoft/login para regenerar el refresh_token con el scope
 * actualizado.
 * ============================================================================
 */

import { getGraphClient } from './graph-client'

export interface SendReplyInput {
  /** OUTLOOK_MAILBOX env. Solo informativo — Graph usa /me en flujo delegado. */
  fromMailbox: string
  /** Dirección del destinatario (ya extraída y normalizada). */
  toEmail: string
  /** Subject del email. Normalmente "Re: <subject original>". */
  subject: string
  /** Body HTML ya con {{FORM_LINK}} sustituido por la URL real. */
  body: string
}

export interface SendReplyResult {
  /** Siempre true: si Graph falla, lanzamos. */
  graphSendOk: true
  /** ISO timestamp del momento del envío (lado servidor de la app). */
  sentAtIso: string
}

interface GraphLikeError {
  code?: string
  statusCode?: number
  status?: number
  message?: string
  body?: unknown
}

function isGraphLikeError(value: unknown): value is GraphLikeError {
  return typeof value === 'object' && value !== null
}

const ACCESS_DENIED_MESSAGE =
  'Permiso Mail.Send no concedido aún en Azure. Añádelo en API permissions, da admin consent, y regenera el refresh_token desde /api/auth/microsoft/login.'

export async function sendReply(input: SendReplyInput): Promise<SendReplyResult> {
  // fromMailbox no se usa en la URL (Graph delegated → /me). Se acepta y se
  // ignora deliberadamente para que el caller pase OUTLOOK_MAILBOX y dejemos
  // constancia de qué buzón se intentó usar.
  void input.fromMailbox

  const client = getGraphClient()

  const payload = {
    message: {
      subject: input.subject,
      body: {
        contentType: 'HTML',
        content: input.body,
      },
      toRecipients: [
        {
          emailAddress: {
            address: input.toEmail,
          },
        },
      ],
    },
    saveToSentItems: true,
  }

  try {
    // /me/sendMail responde 202 No Content en éxito; el SDK devuelve undefined.
    await client.api('/me/sendMail').post(payload)
  } catch (error) {
    if (isGraphLikeError(error)) {
      const code = error.code
      const status = error.statusCode ?? error.status
      if (code === 'ErrorAccessDenied' || status === 403) {
        throw new Error(ACCESS_DENIED_MESSAGE)
      }
      const detail = error.message ?? 'Unknown Graph error'
      throw new Error(`Microsoft Graph sendMail error: ${detail}`)
    }
    throw new Error('Microsoft Graph sendMail error: unknown failure')
  }

  return {
    graphSendOk: true,
    sentAtIso: new Date().toISOString(),
  }
}
