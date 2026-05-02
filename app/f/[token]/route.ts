/**
 * GET /f/[token]
 *
 * Resolves the form-token slug, increments view counters, then renders the
 * matching HTML template from `public.doa_forms` with placeholders filled in.
 * The HTML uploads files directly to Supabase Storage using the publishable
 * anon key embedded in the inline script, and POSTs the final JSON to
 * `/api/forms/[slug]/submit`.
 */

import { supabaseServer } from '@/lib/supabase/server'
import { resolveFormTokenBySlug } from '@/lib/forms/token'
import { renderFormHtml, type RenderVars } from '@/lib/forms/render'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STORAGE_BUCKET = 'doa-formularios'

// ---------------------------------------------------------------------------
// Status pages
// ---------------------------------------------------------------------------

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache',
    },
  })
}

function statusPage(title: string, message: string, status: number): Response {
  const body = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title}</title>
<style>
  body { margin: 0; font-family: -apple-system, "Segoe UI", "Helvetica Neue", sans-serif; background: #f6f8fc; color: #0f172a; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .card { max-width: 480px; padding: 32px; background: #fff; border: 1px solid #dbe4f0; border-radius: 20px; box-shadow: 0 20px 50px rgba(15,23,42,.08); text-align: center; }
  h1 { margin: 0 0 12px; font-size: 22px; letter-spacing: -.02em; }
  p { margin: 0; color: #64748b; font-size: 15px; line-height: 1.6; }
</style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`
  return htmlResponse(body, status)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractEmailFromSender(sender: string): string | null {
  const angleMatch = sender.match(/<\s*([^>]+?)\s*>/)
  if (angleMatch?.[1]) return angleMatch[1].trim().toLowerCase()
  const inlineMatch = sender.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)
  if (inlineMatch?.[0]) return inlineMatch[0].trim().toLowerCase()
  return null
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token: slug } = await context.params

  if (!slug) {
    return statusPage('Enlace no válido', 'Falta el identificador del formulario.', 400)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('public-form: missing NEXT_PUBLIC_SUPABASE_* env vars')
    return statusPage(
      'No hemos podido cargar el formulario',
      'Error de configuración del servidor. Inténtalo más tarde.',
      500,
    )
  }

  const resolved = await resolveFormTokenBySlug(slug)
  if (!resolved.ok) {
    if (resolved.status === 404) {
      return statusPage(
        'Enlace no válido',
        'No encontramos ningún formulario asociado a este enlace.',
        404,
      )
    }
    if (resolved.status === 410) {
      if (resolved.reason === 'used') {
        return statusPage(
          'Formulario ya enviado',
          'Ya hemos recibido tus datos. Gracias.',
          410,
        )
      }
      return statusPage(
        'Enlace expirado',
        'Este enlace ha caducado. Solicita uno nuevo al equipo de DOA.',
        410,
      )
    }
    return statusPage(
      'No hemos podido cargar el formulario',
      'Vuelve a intentarlo en unos minutos.',
      500,
    )
  }

  const tokenRow = resolved.row
  const formSlug = tokenRow.client_kind === 'known' ? 'cliente_conocido' : 'cliente_desconocido'

  const { data: formRow, error: formError } = await supabaseServer
    .from('doa_forms')
    .select('html')
    .eq('slug', formSlug)
    .maybeSingle()

  if (formError || !formRow) {
    console.error('public-form: error fetching form template', formError)
    return statusPage(
      'No hemos podido cargar el formulario',
      'Falta la plantilla del formulario. Contacta con DOA.',
      500,
    )
  }

  const template = (formRow as { html: string }).html

  const { data: incomingRow, error: incomingError } = await supabaseServer
    .from('doa_incoming_requests_v2')
    .select('id, sender, entry_number, client_id')
    .eq('id', tokenRow.incoming_request_id)
    .maybeSingle()

  if (incomingError || !incomingRow) {
    console.error('public-form: error fetching incoming request', incomingError)
    return statusPage(
      'Solicitud no disponible',
      'No hemos podido recuperar la solicitud asociada a este enlace.',
      500,
    )
  }

  const incoming = incomingRow as {
    id: string
    sender: string | null
    entry_number: string | null
    client_id: string | null
  }

  let clientCompanyName: string | undefined
  let clientContactId: string | undefined
  let clientContactFullName: string | undefined
  let clientContactEmail: string | undefined

  if (tokenRow.client_kind === 'known' && incoming.client_id) {
    const { data: clientRow, error: clientError } = await supabaseServer
      .from('doa_clients_v2')
      .select('name')
      .eq('id', incoming.client_id)
      .maybeSingle()
    if (clientError) {
      console.error('public-form: error fetching client', clientError)
    } else if (clientRow) {
      clientCompanyName = ((clientRow as { name: string | null }).name) ?? undefined
    }

    const { data: contactRow, error: contactError } = await supabaseServer
      .from('doa_client_contacts_v2')
      .select('id, first_name, last_name, email')
      .eq('client_id', incoming.client_id)
      .eq('is_primary', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (contactError) {
      console.error('public-form: error fetching primary contact', contactError)
    } else if (contactRow) {
      const c = contactRow as {
        id: string
        first_name: string | null
        last_name: string | null
        email: string | null
      }
      clientContactId = c.id
      const fullName = `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()
      clientContactFullName = fullName.length > 0 ? fullName : undefined
      clientContactEmail = c.email ?? undefined
    }
  }

  const senderEmail =
    tokenRow.client_kind === 'unknown' && incoming.sender
      ? extractEmailFromSender(incoming.sender) ?? undefined
      : undefined

  const submitUrl = `/api/forms/${tokenRow.slug}/submit`

  const vars: RenderVars = {
    FORM_TOKEN: tokenRow.token,
    SUBMIT_URL: submitUrl,
    CONSULTA_ID: incoming.id,
    CONSULTA_REFERENCE: incoming.entry_number ?? undefined,
    CLIENT_ID: incoming.client_id ?? undefined,
    CLIENT_COMPANY_NAME: clientCompanyName,
    CLIENT_CONTACT_ID: clientContactId,
    CLIENT_CONTACT_FULL_NAME: clientContactFullName,
    CLIENT_CONTACT_EMAIL: clientContactEmail,
    FORM_VARIANT_KNOWN: tokenRow.client_kind === 'known' ? 'true' : undefined,
    SENDER_EMAIL: senderEmail,
  }

  const rendered = renderFormHtml(template, vars, {
    supabaseUrl,
    supabaseAnonKey,
    bucket: STORAGE_BUCKET,
  })

  // View counters (non-fatal). The race for view_count is benign — soft analytics only.
  const { error: updateError } = await supabaseServer
    .from('doa_form_tokens_v2')
    .update({
      view_count: (tokenRow.view_count ?? 0) + 1,
      first_viewed_at: tokenRow.first_viewed_at ?? new Date().toISOString(),
    })
    .eq('token', tokenRow.token)
  if (updateError) {
    console.error('public-form: error updating view counters', updateError)
  }

  return htmlResponse(rendered, 200)
}
