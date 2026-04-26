/**
 * ============================================================================
 * GET/POST /api/automations/inbound-email/run
 * ============================================================================
 *
 * Slice 2 de la automatizacion. Lanza `processEmails()`, que para cada email
 * no leido del buzon: clasifica con OpenRouter, persiste en Supabase y marca
 * como leido en Outlook.
 *
 *   { ok: true, processed: 3, errors: [], results: [...] }
 *
 * En error general (lectura de buzon, etc.): { ok: false, error: "<msg>" } 500.
 *
 * Soporta GET (para abrir desde el navegador en pruebas locales) y POST (para
 * que el cron / n8n lo dispare). No requiere body.
 *
 * Nota: este endpoint NO es publico — deberia ir tras `requireUserApi()`
 * cuando reconectemos auth. De momento la app esta en estado frame-only y aun
 * no hay sesion, asi que se queda abierto para iteracion local.
 */

import { processEmails } from '@/automations/inbound-email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function handle(): Promise<Response> {
  try {
    const summary = await processEmails()
    return Response.json(
      {
        ok: true,
        processed: summary.processed,
        errors: summary.errors,
        results: summary.results,
      },
      {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    console.error('inbound-email/run: error procesando emails:', error)
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function GET() {
  return handle()
}

export async function POST() {
  return handle()
}
