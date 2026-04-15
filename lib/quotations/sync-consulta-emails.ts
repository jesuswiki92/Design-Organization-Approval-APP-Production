import 'server-only'

import { existsSync } from 'fs'
import { writeFile } from 'fs/promises'
import path from 'path'

import { createClient } from '@/lib/supabase/server'
import type { DoaEmail } from '@/types/database'

const SIMULATION_BASE_PATH =
  process.env.DOA_SIMULATION_BASE_PATH ??
  'C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/02. Datos DOA/00. APP sinulation/01. DOA_ENTRADAS'

/**
 * Genera el nombre de archivo para un email a partir de su fecha y direccion.
 *
 * Formato: `{YYYYMMDD}_{HHmm}_{direccion}.eml`
 * Ejemplo: `20260411_0822_entrante.eml`
 */
function buildEmailFilename(email: DoaEmail): string {
  const d = new Date(email.fecha)
  const yyyy = d.getFullYear().toString()
  const mm = (d.getMonth() + 1).toString().padStart(2, '0')
  const dd = d.getDate().toString().padStart(2, '0')
  const hh = d.getHours().toString().padStart(2, '0')
  const min = d.getMinutes().toString().padStart(2, '0')
  return `${yyyy}${mm}${dd}_${hh}${min}_${email.direccion}.eml`
}

/**
 * Formatea una fecha como RFC 2822 para headers de email.
 * Ejemplo: `Fri, 11 Apr 2026 08:22:00 +0000`
 */
function toRfc2822Date(fecha: string): string {
  const d = new Date(fecha)
  return d.toUTCString().replace('GMT', '+0000')
}

/**
 * Construye un archivo .eml valido (RFC 2822) a partir de los datos del email.
 * Se puede abrir directamente con Outlook u otro cliente de correo.
 */
function buildEmlContent(email: DoaEmail): string {
  const body = email.cuerpo ?? ''
  const isHtml = /<\/?[a-z][\s\S]*?>/i.test(body)

  const headers = [
    `From: ${email.de ?? 'unknown@unknown.com'}`,
    `To: ${email.para ?? 'undisclosed-recipients:;'}`,
    `Subject: ${email.asunto ?? '(sin asunto)'}`,
    `Date: ${toRfc2822Date(email.fecha)}`,
    email.mensaje_id ? `Message-ID: ${email.mensaje_id}` : null,
    'MIME-Version: 1.0',
    `Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset=utf-8`,
    'Content-Transfer-Encoding: 8bit',
    `X-DOA-Direccion: ${email.direccion}`,
    `X-DOA-Consulta-ID: ${email.consulta_id ?? ''}`,
  ]
    .filter(Boolean)
    .join('\r\n')

  return `${headers}\r\n\r\n${body}\r\n`
}

/**
 * Descarga los emails de una consulta desde `doa_emails` y los guarda como
 * archivos `.eml` (RFC 2822) en la carpeta `{SIMULATION_BASE_PATH}/{numeroEntrada}/emails/`.
 *
 * Es idempotente: si un archivo ya existe (mismo nombre), se omite.
 * No lanza excepciones para no interrumpir la carga de la pagina.
 *
 * @returns Cantidad de archivos nuevos escritos, o -1 si hubo un error.
 */
export async function syncConsultaEmails(
  numeroEntrada: string,
  consultaId: string,
): Promise<{ written: number; error?: string }> {
  const trimmed = numeroEntrada.trim()
  if (!trimmed) {
    return { written: 0, error: 'numero_entrada vacio' }
  }

  try {
    const supabase = await createClient()

    const { data: emails, error: dbError } = await supabase
      .from('doa_emails')
      .select('*')
      .eq('consulta_id', consultaId)
      .order('fecha', { ascending: true })

    if (dbError) {
      console.error('syncConsultaEmails — error consultando doa_emails:', dbError)
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
