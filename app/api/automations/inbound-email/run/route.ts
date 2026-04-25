/**
 * ============================================================================
 * GET/POST /api/automations/inbound-email/run
 * ============================================================================
 *
 * Slice 1 de la automatización de emails entrantes. Lanza `readUnreadEmails()`
 * y devuelve el array crudo de emails no leídos del buzón configurado.
 *
 *   { ok: true, count: 3, emails: [...] }
 *
 * En error: { ok: false, error: "<message>" } con HTTP 500.
 *
 * Soporta GET (para abrir desde el navegador en pruebas locales) y POST (para
 * que el cron / n8n lo dispare). No requiere body.
 *
 * Nota: este endpoint NO es público — debería ir tras `requireUserApi()`
 * cuando reconectemos auth. De momento la app está en estado frame-only y aún
 * no hay sesión, así que se queda abierto para iteración local.
 */

import { readUnreadEmails } from '@/automations/inbound-email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function handle(): Promise<Response> {
  try {
    const emails = await readUnreadEmails()
    return Response.json(
      {
        ok: true,
        count: emails.length,
        emails,
      },
      {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    console.error('inbound-email/run: error leyendo emails no leídos:', error)
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function GET() {
  return handle()
}

export async function POST() {
  return handle()
}
