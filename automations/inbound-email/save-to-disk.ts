/**
 * ============================================================================
 * save-to-disk — archiva un email entrante en disco local bajo entry_number
 * ============================================================================
 *
 * Slice 3. Para cada email procesado crea la estructura:
 *
 *   {DOA_INBOUND_ROOT}/{entry_number}/
 *   ├── correos/
 *   │   └── {YYYY-MM-DDTHH-mm-ss}_{subject-sanitized}.eml
 *   └── adjuntos/
 *       └── {original-attachment-name-sanitized}
 *
 * El .eml se construye como mensaje RFC822-style minimal (un solo cuerpo,
 * sin multipart) usando CRLF como separador de líneas. El Content-Type del
 * cuerpo se elige a partir de `email.body.contentType` (html → text/html,
 * resto → text/plain). Si el body es null se usa `bodyPreview` como
 * text/plain.
 *
 * La sanitización de nombres reemplaza los caracteres prohibidos en filename
 * de Windows (`<>:"/\|?*`) por `_`, colapsa repetidos y trunca el subject a
 * 80 chars. mkdir es idempotente con `recursive: true`, y el .eml se
 * sobrescribe sin deduplicación.
 */

import { promises as fs } from 'fs'
import path from 'path'

import { fetchAttachments } from './fetch-attachments'
import type { UnreadEmail } from './read-unread'

const SUBJECT_FILENAME_MAX = 80
const FORBIDDEN_CHARS_RE = /[<>:"/\\|?*\x00-\x1f]/g
const REPEATED_UNDERSCORES_RE = /_+/g

export interface SaveEmailToDiskInput {
  entryNumber: string
  email: UnreadEmail
}

export interface SaveEmailToDiskResult {
  emailFilePath: string
  attachmentsSaved: number
  attachmentsFailed: number
}

function sanitizeForFs(value: string): string {
  return value
    .replace(FORBIDDEN_CHARS_RE, '_')
    .replace(REPEATED_UNDERSCORES_RE, '_')
    .trim()
    .replace(/^[._]+|[._]+$/g, '')
}

function sanitizeSubject(subject: string | null | undefined): string {
  const raw = (subject ?? '').trim()
  if (!raw) return 'sin-asunto'
  const cleaned = sanitizeForFs(raw).slice(0, SUBJECT_FILENAME_MAX)
  return cleaned || 'sin-asunto'
}

function sanitizeAttachmentName(name: string): string {
  const raw = (name ?? '').trim() || 'attachment'
  const ext = path.extname(raw)
  const base = path.basename(raw, ext)
  const cleanBase = sanitizeForFs(base) || 'attachment'
  const cleanExt = ext ? sanitizeForFs(ext) : ''
  return cleanBase + (cleanExt.startsWith('.') ? cleanExt : cleanExt ? '.' + cleanExt : '')
}

function isoToFsTimestamp(iso: string): string {
  // 2026-04-27T10:23:45.123Z -> 2026-04-27T10-23-45
  const safe = iso.replace(/\.\d+Z?$/, '').replace(/Z$/, '')
  return safe.replace(/:/g, '-')
}

function rfc2822Date(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toUTCString()
}

function joinRecipients(recipients: UnreadEmail['toRecipients']): string {
  return (recipients ?? [])
    .map((r) => {
      const addr = r?.emailAddress?.address ?? ''
      const name = r?.emailAddress?.name ?? ''
      if (name && addr) return `${name} <${addr}>`
      return addr
    })
    .filter((s) => s.length > 0)
    .join(', ')
}

function buildEmlContent(email: UnreadEmail): string {
  const CRLF = '\r\n'

  const fromAddr = email.from?.emailAddress?.address ?? ''
  const fromName = email.from?.emailAddress?.name ?? ''
  const fromHeader = fromName && fromAddr ? `${fromName} <${fromAddr}>` : fromAddr

  const toHeader = joinRecipients(email.toRecipients)
  const subjectHeader = email.subject ?? ''
  const dateHeader = rfc2822Date(email.receivedDateTime)
  const messageIdHeader = email.internetMessageId ?? ''

  const body = email.body
  let contentType: string
  let contentBody: string
  if (body && typeof body.content === 'string' && body.content.length > 0) {
    contentType =
      body.contentType === 'html' ? 'text/html; charset="UTF-8"' : 'text/plain; charset="UTF-8"'
    contentBody = body.content
  } else {
    contentType = 'text/plain; charset="UTF-8"'
    contentBody = email.bodyPreview ?? ''
  }

  const headers = [
    `From: ${fromHeader}`,
    `To: ${toHeader}`,
    `Subject: ${subjectHeader}`,
    `Date: ${dateHeader}`,
    `Message-ID: ${messageIdHeader}`,
    'MIME-Version: 1.0',
    `Content-Type: ${contentType}`,
  ].join(CRLF)

  return headers + CRLF + CRLF + contentBody
}

export async function saveEmailToDisk(
  input: SaveEmailToDiskInput,
): Promise<SaveEmailToDiskResult> {
  const root = process.env.DOA_INBOUND_ROOT?.trim()
  if (!root) {
    throw new Error('Missing DOA_INBOUND_ROOT in .env.local')
  }

  const { entryNumber, email } = input

  const entryDir = path.join(root, entryNumber)
  const correosDir = path.join(entryDir, 'correos')
  const adjuntosDir = path.join(entryDir, 'adjuntos')

  await fs.mkdir(entryDir, { recursive: true })
  await fs.mkdir(correosDir, { recursive: true })
  await fs.mkdir(adjuntosDir, { recursive: true })

  const timestamp = isoToFsTimestamp(email.receivedDateTime ?? new Date().toISOString())
  const subjectSlug = sanitizeSubject(email.subject)
  const emailFileName = `${timestamp}_${subjectSlug}.eml`
  const emailFilePath = path.join(correosDir, emailFileName)

  const emlContent = buildEmlContent(email)
  await fs.writeFile(emailFilePath, emlContent, 'utf8')

  let attachmentsSaved = 0
  let attachmentsFailed = 0

  if (email.hasAttachments === true) {
    const attachments = await fetchAttachments(email.id)
    for (const att of attachments) {
      try {
        if (!att.contentBytes) {
          throw new Error(`adjunto sin contentBytes (id=${att.id} name=${att.name})`)
        }
        const safeName = sanitizeAttachmentName(att.name)
        const buffer = Buffer.from(att.contentBytes, 'base64')
        const targetPath = path.join(adjuntosDir, safeName)
        await fs.writeFile(targetPath, buffer)
        attachmentsSaved += 1
      } catch (err) {
        attachmentsFailed += 1
        const detail = err instanceof Error ? err.message : String(err)
        console.error(
          `save-to-disk: fallo al guardar adjunto entryNumber=${entryNumber} name=${att?.name}: ${detail}`,
        )
      }
    }
  }

  return {
    emailFilePath,
    attachmentsSaved,
    attachmentsFailed,
  }
}
