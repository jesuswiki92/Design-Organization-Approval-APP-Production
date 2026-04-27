/**
 * ============================================================================
 * /f/[token] — public client-facing form page
 * ============================================================================
 *
 * Este archivo es la página pública a la que llega el cliente desde el correo
 * que le hemos mandado (`{NEXT_PUBLIC_APP_URL}/f/<slug>`). El "token" en el
 * path es en realidad el `slug` legible (ej: `qry-2026-0001-9a8039`), no el
 * UUID — el UUID vive como columna `token` en la tabla y nunca se expone en
 * la URL.
 *
 * Contrato:
 *   - Si el slug no existe → "Enlace no válido".
 *   - Si la fila está expirada (`expires_at < now()`) → "Enlace expirado".
 *   - Si ya fue enviado (`used_at IS NOT NULL`) → "Formulario ya enviado".
 *   - En el resto de casos: contamos la visita (view_count++, first_viewed_at
 *     si null) y renderizamos el formulario público vía `<PublicFormClient />`.
 *
 * El layout es deliberadamente "standalone" — no hay sidebar, no hay TopBar,
 * solo paper background con un panel central tipo Typeform. El root layout
 * (`app/layout.tsx`) ya nos da fuente y Toaster; el chrome del dashboard vive
 * en `(dashboard)/layout.tsx` y por tanto NO se aplica aquí.
 *
 * Sin auth: el slug ES la credencial. Cuando se reconecte auth, este endpoint
 * sigue siendo público (es para clientes externos sin cuenta).
 * ============================================================================
 */

import { supabaseServer } from '@/lib/supabase/server'
import type { Client, IncomingRequest } from '@/types/database'
import { PublicFormClient } from './PublicFormClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type FormTokenRow = {
  token: string
  slug: string
  incoming_request_id: string
  expires_at: string
  used_at: string | null
  first_viewed_at: string | null
  view_count: number
  client_kind: 'known' | 'unknown'
}

// ----------------------------------------------------------------------------
// Visual primitives — kept inline (single-use, simple) so we don't pull a UI
// component into a public route that should stay minimal.
// ----------------------------------------------------------------------------

function PublicShell({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="min-h-screen bg-[color:var(--paper)] text-[color:var(--ink)]">
      <div className="mx-auto flex max-w-3xl flex-col px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-3)]">
              DOA Operations Hub
            </span>
            <span className="font-[family-name:var(--font-heading)] text-2xl font-semibold leading-tight text-[color:var(--ink)]">
              Solicitud de proyecto
            </span>
          </div>
        </header>
        {children}
        <footer className="mt-10 border-t border-[color:var(--line)] pt-4 text-[11px] text-[color:var(--ink-3)]">
          Este enlace es privado. Si lo recibiste por error, ignóralo.
        </footer>
      </div>
    </main>
  )
}

function StatusCard({
  title,
  message,
  tone = 'neutral',
}: {
  title: string
  message: string
  tone?: 'neutral' | 'success' | 'error' | 'warn'
}) {
  const accents: Record<typeof tone, string> = {
    neutral: 'border-[color:var(--line-strong)] bg-[color:var(--paper-2)]',
    success: 'border-[color:var(--ok)]/30 bg-[color:var(--ok)]/5',
    error: 'border-[color:var(--err)]/30 bg-[color:var(--err)]/5',
    warn: 'border-[color:var(--warn)]/30 bg-[color:var(--warn)]/5',
  }

  return (
    <div
      className={`rounded-3xl border p-8 shadow-sm ${accents[tone]}`}
    >
      <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-[color:var(--ink)]">
        {title}
      </h1>
      <p className="mt-3 text-sm leading-6 text-[color:var(--ink-2)]">
        {message}
      </p>
    </div>
  )
}

// ----------------------------------------------------------------------------
// Page
// ----------------------------------------------------------------------------

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token: slug } = await params

  // 1) Fetch token row by slug.
  const { data: tokenRow, error: tokenError } = await supabaseServer
    .from('doa_form_tokens_v2')
    .select(
      'token, slug, incoming_request_id, expires_at, used_at, first_viewed_at, view_count, client_kind',
    )
    .eq('slug', slug)
    .maybeSingle()

  if (tokenError) {
    console.error('public-form: error fetching token row', tokenError)
    return (
      <PublicShell>
        <StatusCard
          title="No hemos podido cargar el formulario"
          message="Ha ocurrido un error al recuperar tu solicitud. Vuelve a intentarlo en unos minutos o contacta con DOA."
          tone="error"
        />
      </PublicShell>
    )
  }

  if (!tokenRow) {
    return (
      <PublicShell>
        <StatusCard
          title="Enlace no válido"
          message="No encontramos ningún formulario asociado a este enlace. Comprueba que la URL es correcta o solicita uno nuevo al equipo de DOA."
          tone="error"
        />
      </PublicShell>
    )
  }

  const row = tokenRow as FormTokenRow

  // 2) Expired?
  const expiresAt = Date.parse(row.expires_at)
  if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
    return (
      <PublicShell>
        <StatusCard
          title="Enlace expirado"
          message="Este enlace ha caducado. Si todavía necesitas enviarnos información, responde al último correo de DOA y te haremos llegar un nuevo enlace."
          tone="warn"
        />
      </PublicShell>
    )
  }

  // 3) Already submitted?
  if (row.used_at) {
    return (
      <PublicShell>
        <StatusCard
          title="Formulario ya enviado"
          message="Ya hemos recibido tus datos. Gracias por tu envío — el equipo de DOA revisará la información y te contactará en breve."
          tone="success"
        />
      </PublicShell>
    )
  }

  // 4) Load the incoming request for context (subject, code).
  const { data: incomingRow, error: incomingError } = await supabaseServer
    .from('doa_incoming_requests_v2')
    .select('*')
    .eq('id', row.incoming_request_id)
    .maybeSingle()

  if (incomingError || !incomingRow) {
    if (incomingError) {
      console.error('public-form: error fetching incoming request', incomingError)
    }
    return (
      <PublicShell>
        <StatusCard
          title="Solicitud no disponible"
          message="No hemos podido recuperar la solicitud asociada a este enlace. Contacta con DOA para que te enviemos uno nuevo."
          tone="error"
        />
      </PublicShell>
    )
  }

  const incoming = incomingRow as unknown as IncomingRequest

  // 5) For known clients, also load the matched company (read-only display).
  let knownClient: Pick<Client, 'name' | 'country' | 'vat_tax_id' | 'city'> | null = null
  if (row.client_kind === 'known' && incoming.client_id) {
    const { data: clientRow, error: clientError } = await supabaseServer
      .from('doa_clients_v2')
      .select('name, country, cif_vat, city')
      .eq('id', incoming.client_id)
      .maybeSingle()

    if (clientError) {
      console.error('public-form: error fetching matched client', clientError)
      // Not fatal — we just won't show the prefilled banner.
    } else if (clientRow) {
      knownClient = {
        name: clientRow.name as string,
        country: clientRow.country as string,
        // alias cif_vat → vat_tax_id to match types/database.ts
        vat_tax_id: (clientRow.cif_vat as string | null) ?? null,
        city: (clientRow.city as string | null) ?? null,
      }
    }
  }

  // 6) Best-effort prefill of contact_email for unknown clients.
  let prefillContactEmail: string | null = null
  if (row.client_kind === 'unknown' && incoming.sender) {
    prefillContactEmail = extractEmailFromSender(incoming.sender)
  }

  // 7) Increment view counters atomically — single UPDATE.
  //    Use a Postgres expression for view_count via raw RPC-like patch: the
  //    supabase-js client doesn't have a native increment, so we read the
  //    current value above and compute it here. The race is benign: we only
  //    use view_count for soft analytics, not for control flow.
  const { error: updateError } = await supabaseServer
    .from('doa_form_tokens_v2')
    .update({
      view_count: (row.view_count ?? 0) + 1,
      first_viewed_at: row.first_viewed_at ?? new Date().toISOString(),
    })
    .eq('token', row.token)

  if (updateError) {
    console.error('public-form: error updating view counters', updateError)
    // Non-fatal — keep going.
  }

  const incomingCode = (incoming.entry_number?.trim() || `QRY-${incoming.id.slice(0, 8).toUpperCase()}`)

  return (
    <PublicShell>
      <PublicFormClient
        tokenSlug={row.slug}
        clientKind={row.client_kind}
        incoming={{
          id: incoming.id,
          code: incomingCode,
          subject: incoming.subject ?? '',
        }}
        knownClient={knownClient}
        prefillContactEmail={prefillContactEmail}
      />
    </PublicShell>
  )
}

function extractEmailFromSender(sender: string): string | null {
  const angleMatch = sender.match(/<\s*([^>]+?)\s*>/)
  if (angleMatch?.[1]) return angleMatch[1].trim().toLowerCase()
  const inlineMatch = sender.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)
  if (inlineMatch?.[0]) return inlineMatch[0].trim().toLowerCase()
  return null
}
