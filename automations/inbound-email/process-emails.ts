/**
 * ============================================================================
 * process-emails — orquestador del slice 2 de inbound-email
 * ============================================================================
 *
 * Para cada email no leido en el buzon configurado:
 *   1. Clasifica via OpenRouter (classifyEmail).
 *   2. Inserta una fila en doa_incoming_requests_v2 (saveAsIncoming).
 *   3. Marca el mensaje como leido en Outlook (markAsRead) — barrera anti
 *      duplicado para la siguiente pasada.
 *
 * Procesa los emails en SECUENCIA (no en paralelo) para mantener simple el
 * rate limit de OpenRouter y la serializacion de inserts en Supabase.
 *
 * Si un email falla, se captura el error, se anade al array `errors` y se
 * sigue con el siguiente. Una unica falla NO aborta el lote.
 */

import { readUnreadEmails } from './read-unread'
import { classifyEmail, type ClassificationLabel } from './classify'
import { saveAsIncoming } from './save-as-incoming'
import { saveInboundEmail } from './save-email-record'
import { markAsRead } from './mark-as-read'

export interface ProcessEmailsOptions {
  limit?: number
}

export interface ProcessEmailError {
  messageId: string
  error: string
}

export interface ProcessEmailResult {
  messageId: string
  incomingRequestId: string
  classification: ClassificationLabel
}

export interface ProcessEmailsSummary {
  processed: number
  errors: ProcessEmailError[]
  results: ProcessEmailResult[]
}

export async function processEmails(
  opts: ProcessEmailsOptions = {},
): Promise<ProcessEmailsSummary> {
  const emails = await readUnreadEmails({ limit: opts.limit })

  const errors: ProcessEmailError[] = []
  const results: ProcessEmailResult[] = []

  for (const email of emails) {
    const messageId = email.id

    try {
      const senderEmail = email.from?.emailAddress?.address ?? ''
      const senderName = email.from?.emailAddress?.name ?? ''
      const senderText = senderName
        ? `${senderName} <${senderEmail}>`
        : senderEmail

      const subject = email.subject ?? ''
      const bodyPreview = email.bodyPreview ?? ''
      const fullBody = email.body?.content ?? bodyPreview

      const classification = await classifyEmail({
        subject,
        senderEmail,
        bodyPreview,
      })

      const saved = await saveAsIncoming({
        subject,
        sender: senderText,
        originalBody: fullBody,
        classification: classification.clasificacion,
        outlookConversationId: email.conversationId ?? null,
      })

      try {
        await saveInboundEmail({
          incomingRequestId: saved.id,
          fromAddr: senderEmail,
          toAddr: process.env.OUTLOOK_MAILBOX ?? null,
          subject: email.subject ?? '',
          body: email.body?.content ?? bodyPreview,
          sentAt: email.receivedDateTime ?? new Date().toISOString(),
          messageId: email.internetMessageId ?? null,
        })
      } catch (emailRecordErr) {
        const emailRecordMessage =
          emailRecordErr instanceof Error
            ? emailRecordErr.message
            : String(emailRecordErr)
        console.error(
          `process-emails: error guardando doa_emails_v2 para messageId=${messageId}:`,
          emailRecordErr,
        )
        errors.push({
          messageId,
          error: `email-record-save-failed: ${emailRecordMessage}`,
        })
      }

      await markAsRead(messageId)

      results.push({
        messageId,
        incomingRequestId: saved.id,
        classification: classification.clasificacion,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(
        `process-emails: error procesando messageId=${messageId}:`,
        err,
      )
      errors.push({ messageId, error: message })
    }
  }

  return {
    processed: results.length,
    errors,
    results,
  }
}
