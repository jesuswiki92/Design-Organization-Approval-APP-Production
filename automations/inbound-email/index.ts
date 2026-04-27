/**
 * ============================================================================
 * inbound-email — API publica del modulo
 * ============================================================================
 *
 * Slice 1: lectura de emails no leidos (`readUnreadEmails`).
 * Slice 2: clasificacion AI, persistencia en Supabase, marcado como leido y
 * orquestador (`processEmails`).
 */

export { readUnreadEmails } from './read-unread'
export type {
  ReadUnreadEmailsOptions,
  UnreadEmail,
  UnreadEmailBody,
  UnreadEmailRecipient,
} from './read-unread'

export { processEmails } from './process-emails'
export type {
  ProcessEmailsOptions,
  ProcessEmailsSummary,
  ProcessEmailError,
  ProcessEmailResult,
  ProcessEmailArchived,
} from './process-emails'

export { classifyEmail } from './classify'
export type { ClassificationLabel, ClassificationResult } from './classify'

export { saveInboundEmail } from './save-email-record'
export type { SaveInboundEmailInput } from './save-email-record'

export { saveEmailToDisk } from './save-to-disk'
export type {
  SaveEmailToDiskInput,
  SaveEmailToDiskResult,
} from './save-to-disk'

export { fetchAttachments } from './fetch-attachments'
export type { InboundAttachment } from './fetch-attachments'
