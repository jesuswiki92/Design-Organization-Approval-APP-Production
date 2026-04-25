/**
 * ============================================================================
 * inbound-email — API pública del módulo
 * ============================================================================
 *
 * Slice 1: solo se expone la lectura de emails no leídos. Los siguientes
 * slices añadirán: clasificación IA, persistencia en Supabase, marcado como
 * leído y respuesta automática.
 */

export { readUnreadEmails } from './read-unread'
export type {
  ReadUnreadEmailsOptions,
  UnreadEmail,
  UnreadEmailBody,
  UnreadEmailRecipient,
} from './read-unread'
