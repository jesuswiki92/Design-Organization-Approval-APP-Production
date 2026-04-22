import 'server-only'

import { existsSync } from 'fs'
import { writeFile } from 'fs/promises'
import path from 'path'

import { createClient } from '@/lib/supabase/server'
import type { DoaEmail } from '@/types/database'

const SIMULATION_BASE_PATH =
  process.env.DOA_SIMULATION_BASE_PATH ??
  'C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/02. Data DOA/00. APP sinulation/01. DOA_ENTRADAS'

/**
 * Genera el name de archivo para un email a partir de su date y address.
 *
 * Formato: `{YYYYMMDD}_{HHmm}_{address}.eml`
 * Ejemplo: `20260411_0822_entrante.eml`
 */
function buildEmailFilename(email: DoaEmail): string {
  const d = new Date(email.date)
  const yyyy = d.getFullYear().toString()
  const mm = (d.getMonth() + 1).toString().padStart(2, '0')
  const dd = d.getDate().toString().padStart(2, '0')
  const hh = d.getHours().toString().padStart(2, '0')
  const min = d.getMinutes().toString().padStart(2, '0')
  return `${yyyy}${mm}${dd}_${hh}${min}_${email.direction}.eml`
}

/**
 * Formatea una date como RFC 2822 para headers de email.
 * Ejemplo: `Fri, 11 Apr 2026 08:22:00 +0000`
 */
function toRfc2822Date(date: string): string {
  const d = new Date(date)
  return d.toUTCString().replace('GMT', '+0000')
}

/**
 * Construye un archivo .eml valido (RFC 2822) a partir de los data del email.
 * Se puede abrir directamente con Outlook u other client de email.
 */
function buildEmlContent(email: DoaEmail): string {
  const body = email.body ?? ''
  const isHtml = /<\/?[a-z][\s\S]*?>/i.test(body)

  const headers = [
    `From: ${email.from_email ?? 'unknown@unknown.com'}`,
    `To: ${email.to_email ?? 'undisclosed-recipients:;'}`,
    `Subject: ${email.subject ?? '(sin subject)'}`,
    `Date: ${toRfc2822Date(email.date)}`,
    email.message_id ? `Message-ID: ${email.message_id}` : null,
    'MIME-Version: 1.0',
    `Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset=utf-8`,
    'Content-Transfer-Encoding: 8bit',
    `X-DOA-Address: ${email.direction}`,
    `X-DOA-Request-ID: ${email.incoming_request_id ?? ''}`,
  ]
    .filter(Boolean)
    .join('\r\n')

  return `${headers}\r\n\r\n${body}\r\n`
}

/**
 * Descarga los emails de una request desde `doa_emails` y los guarda como
 * archivos `.eml` (RFC 2822) en la folder `{SIMULATION_BASE_PATH}/{numeroEntrada}/emails/`.
 *
 * Es idempotente: si un archivo ya existe (mismo name), se omite.
 * No lanza excepciones para no interrumpir la carga de la page.
 *
 * @returns Cantidad de archivos nuevos escritos, o -1 si hubo un error.
 */
export async function syncConsultaEmails(
  numeroEntrada: string,
  consultaId: string,
): Promise<{ written: number; error?: string }> {
  const trimmed = numeroEntrada.trim()
  if (!trimmed) {
    return { written: 0, error: 'entry_number vacio' }
  }

  try {
    const supabase = await createClient()

    // Nota: la tabla real usa columnas `from_addr`, `to_addr`, `sent_at`.
    // Se aliasean a `from_email`, `to_email`, `date` para coincidir con el tipo `DoaEmail`
    // usado en todo el codigo (buildEmailFilename, buildEmlContent, etc.).
    const { data: emails, error: dbError } = await supabase
      .from('doa_emails')
      .select(
        'id, incoming_request_id, direction, from_email:from_addr, to_email:to_addr, subject, body, date:sent_at, message_id, in_reply_to, created_at',
      )
      .eq('incoming_request_id', consultaId)
      .order('sent_at', { ascending: true })

    if (dbError) {
      console.error('syncConsultaEmails — error consultando doa_emails:', {
        message: dbError.message,
        code: (dbError as { code?: string }).code,
        details: (dbError as { details?: string }).details,
        hint: (dbError as { hint?: string }).hint,
      })
      return { written: -1, error: dbError.message }
    }

    if (!emails || emails.length === 0) {
      return { written: 0 }
    }

    const emailsDir = path.join(SIMULATION_BASE_PATH, trimmed, 'emails')
    let written = 0

    for (const row of emails as DoaEmail[]) {
      const filename = buildEmailFilename(row)
      const filePath = path.join(emailsDir, filename)

      if (existsSync(filePath)) {
        continue
      }

      const content = buildEmlContent(row)
      await writeFile(filePath, content, 'utf-8')
      written++
    }

    return { written }
  } catch (error) {
    console.error('syncConsultaEmails — error inesperado:', error)
    return {
      written: -1,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
