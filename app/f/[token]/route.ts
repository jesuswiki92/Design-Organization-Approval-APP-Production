/**
 * ============================================================================
 * GET /f/[token]  (Forms v2 — public intake landing)
 * ============================================================================
 *
 * Intentionally a route handler returning raw HTML. Converting this to a
 * React `page.tsx` would wrap the form HTML in the root layout's `<html>`
 * tags and break the embedded `<script>` that handles file upload to
 * Supabase Storage. Do NOT port this to a server component.
 *
 * Public, unauthenticated endpoint that serves the stored HTML form (from
 * `doa_forms.html`) with placeholders resolved for the given token's context.
 *
 * Why a route handler instead of a `page.tsx` server component?
 *   The HTML stored in `doa_forms` is a COMPLETE document (`<!doctype html>
 *   <html>... <script>...</script> </html>`) with inline CSS and inline
 *   scripts. Rendering it inside a Next.js page would nest `<html>` inside
 *   the root layout's `<html>` — producing invalid markup and breaking the
 *   form's own styles/scripts. A route handler lets us stream the document
 *   as-is with the correct Content-Type.
 *
 * Trust model:
 *   We trust the stored HTML because it is internal content (written and
 *   maintained by the DOA team in the `doa_forms` table, not user-supplied).
 *   DOMPurify would strip the inline `<script>` / `onclick` / `onchange`
 *   handlers the form relies on, so we deliberately SKIP sanitization here.
 *   If the trust model ever changes (e.g. form HTML becomes editable by
 *   external users), introduce `isomorphic-dompurify` with a permissive
 *   allow-list that keeps script/style/on* handlers.
 *
 * State machine:
 *   - token not found        → 404 + friendly card
 *   - expires_at <= now()    → 410 + "This link has expired..."
 *   - used_at is not null    → 410 + "This form has already been submitted..."
 *   - happy path             → 200 + form HTML (placeholders resolved)
 */

import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
// Public content, token-gated — never cache at the edge.
export const dynamic = 'force-dynamic'
export const revalidate = 0

type TokenRow = {
  token: string
  slug: 'cliente_conocido' | 'cliente_desconocido'
  incoming_request_id: string
  expires_at: string
  used_at: string | null
}

type IncomingRequestMinimal = {
  id: string
  subject: string | null
  sender: string | null
  entry_number: string | null
}

type ContactLookup = {
  id: string
  first_name: string
  last_name: string | null
  email: string
  client_id: string
  doa_clients: { id: string; name: string } | { id: string; name: string }[] | null
}

function statusCard(
  status: number,
  title: string,
  innerHtml: string,
): Response {
  return new Response(renderShell(title, innerHtml), {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}

function cardInvalid(): Response {
  return statusCard(
    404,
    'DOA — Link not valid',
    `<h1>This link is not valid.</h1>
     <p>The URL you used does not correspond to any active form.</p>
     <p class="muted">If you received this from us in error, please reply to the original email.</p>`,
  )
}

function cardExpired(): Response {
  return statusCard(
    410,
    'DOA — Link expired',
    `<h1>This link has expired. Please request a new one.</h1>
     <p class="muted">If you received this from us in error, please reply to the original email.</p>`,
  )
}

function cardUsed(): Response {
  return statusCard(
    410,
    'DOA — Already submitted',
    `<h1>This form has already been submitted.</h1>
     <p>Thank you — we've got your request.</p>`,
  )
}

/** Minimal HTML shell reused by the status cards above. */
function renderShell(title: string, innerHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; min-height: 100vh; background: #f6f8fc; color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: grid; place-items: center; padding: 32px; }
    .card { max-width: 520px; width: 100%; background: #ffffff; border: 1px solid #dbe4f0;
      border-radius: 20px; padding: 40px 32px; box-shadow: 0 20px 50px rgba(15,23,42,.08); text-align: center; }
    h1 { font-size: 20px; margin: 0 0 12px; }
    p  { color: #5b6b80; line-height: 1.55; margin: 0 0 8px; }
    .muted { font-size: 13px; color: #8b9ab0; margin-top: 20px; }
    .brand { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #8b9ab0; margin-bottom: 16px; }
  </style>
</head>
<body>
  <main class="card"><div class="brand">DOA Operations Hub</div>${innerHtml}</main>
</body>
</html>`
}

/**
 * Replace all `{{KEY}}` placeholders in the form HTML. Unknown keys are
 * replaced with the empty string so nothing like `{{CLIENT_ID}}` ever leaks
 * to the user.
 */
function substitutePlaceholders(
  html: string,
  values: Record<string, string>,
): string {
  return html.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const v = values[key]
    return v === undefined || v === null ? '' : v
  })
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params
  if (!token || typeof token !== 'string') return cardInvalid()

  const supabase = createAdminClient()

  // 1) Look up the token row
  const { data: tokenRow, error: tokenErr } = await supabase
    .from('doa_form_tokens')
    .select('token, slug, incoming_request_id, expires_at, used_at')
    .eq('token', token)
    .maybeSingle<TokenRow>()

  if (tokenErr) {
    console.error('[/f/[token]] token lookup failed:', tokenErr)
    return statusCard(
      500,
      'DOA — Error',
      `<h1>Something went wrong.</h1><p>Please try again in a moment.</p>`,
    )
  }
  if (!tokenRow) return cardInvalid()

  const now = Date.now()
  const expiresAt = Date.parse(tokenRow.expires_at)
  if (tokenRow.used_at) return cardUsed()
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return cardExpired()

  // 2) Fetch form HTML + incoming request row in parallel
  const [formRes, requestRes] = await Promise.all([
    supabase
      .from('doa_forms')
      .select('html')
      .eq('slug', tokenRow.slug)
      .maybeSingle<{ html: string }>(),
    supabase
      .from('doa_incoming_requests')
      .select('id, subject, sender, entry_number')
      .eq('id', tokenRow.incoming_request_id)
      .maybeSingle<IncomingRequestMinimal>(),
  ])

  if (formRes.error || !formRes.data) {
    console.error('[/f/[token]] form template missing:', {
      slug: tokenRow.slug,
      err: formRes.error,
    })
    return statusCard(
      500,
      'DOA — Error',
      `<h1>Form template not available.</h1>
       <p>Please contact us and reference the original email.</p>`,
    )
  }

  const incomingRequest = requestRes.data
  const formHtml = formRes.data.html

  // 3) For cliente_conocido, find the matching client+contact via sender email
  let clientCompanyName = ''
  let clientId = ''
  let contactId = ''
  let contactFullName = ''
  let contactEmail = ''

  if (tokenRow.slug === 'cliente_conocido' && incomingRequest?.sender) {
    // `sender` may be either "Name <foo@bar.com>" or a bare email; extract
    // the email-looking substring.
    const emailMatch = incomingRequest.sender.match(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    )
    const senderEmail = emailMatch ? emailMatch[0] : null

    if (senderEmail) {
      const { data: contact } = await supabase
        .from('doa_client_contacts')
        .select(
          'id, first_name, last_name, email, client_id, doa_clients!inner(id, name)',
        )
        .eq('email', senderEmail)
        .eq('active', true)
        .maybeSingle<ContactLookup>()

      if (contact) {
        contactId = contact.id
        contactEmail = contact.email
        contactFullName = [contact.first_name, contact.last_name]
          .filter(Boolean)
          .join(' ')
          .trim()
        clientId = contact.client_id
        const clientJoin = Array.isArray(contact.doa_clients)
          ? contact.doa_clients[0]
          : contact.doa_clients
        clientCompanyName = clientJoin?.name ?? ''
      }
    }
  }

  const senderEmailForTemplate =
    incomingRequest?.sender
      ?.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] ?? ''

  const consultaReference = (() => {
    if (incomingRequest?.entry_number) return incomingRequest.entry_number
    const subj = incomingRequest?.subject ?? ''
    return subj.length > 80 ? subj.slice(0, 80) : subj
  })()

  const placeholderValues: Record<string, string> = {
    CLIENT_COMPANY_NAME: clientCompanyName,
    CLIENT_CONTACT_FULL_NAME: contactFullName,
    CLIENT_CONTACT_EMAIL: contactEmail,
    CONSULTA_REFERENCE: consultaReference,
    CONSULTA_ID: tokenRow.incoming_request_id,
    FORM_VARIANT_KNOWN:
      tokenRow.slug === 'cliente_conocido' ? 'known' : 'unknown',
    CLIENT_ID: clientId,
    CLIENT_CONTACT_ID: contactId,
    SENDER_EMAIL: senderEmailForTemplate,
    FORM_TOKEN: tokenRow.token,
    SUBMIT_URL: `/f/${tokenRow.token}/submit`,
  }

  const finalHtml = substitutePlaceholders(formHtml, placeholderValues)

  // 4) Fire-and-forget: bump view_count (do NOT await the user on this)
  void supabase
    .rpc(
      'fn_touch_form_token_view' as never,
      { p_token: tokenRow.token } as never,
    )
    .then(({ error }) => {
      if (error) {
        console.error('[/f/[token]] view-count rpc failed:', error)
      }
    })

  // 5) Serve the form HTML as-is. We intentionally skip DOMPurify — see file
  //    header comment.
  return new Response(finalHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      // Allow inline scripts/styles used by the embedded form
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
