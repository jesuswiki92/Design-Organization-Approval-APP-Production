/**
 * ============================================================================
 * Form template renderer
 * ============================================================================
 *
 * Renders the HTML stored in `public.doa_forms` (slugs `cliente_conocido` /
 * `cliente_desconocido`) by:
 *
 *   1) Substituting `{{KEY}}` placeholders with values from `vars`.
 *   2) Rewriting the hardcoded `var SB_URL/SB_KEY/BUCKET` literals at the top
 *      of the inline IIFE so the form uploads files to the correct bucket
 *      (`doa-formularios`) using the runtime publishable key — without
 *      touching the rest of the JS.
 *   3) Injecting a `window.SB_URL/SB_KEY/BUCKET` block right before the first
 *      `<script>` for any future template that prefers reading from window.
 *
 * Values are JSON.stringify()'d before being embedded in JS so that quotes,
 * backslashes and stray `</script>` sequences cannot break out of the script
 * tag (defensive, even if SB_URL/keys are well-known opaque strings).
 * ============================================================================
 */

export type FormVariant = 'known' | 'unknown'

export type RenderVars = {
  FORM_TOKEN: string
  SUBMIT_URL: string
  CONSULTA_ID: string
  CONSULTA_REFERENCE?: string
  CLIENT_ID?: string
  CLIENT_COMPANY_NAME?: string
  CLIENT_CONTACT_ID?: string
  CLIENT_CONTACT_FULL_NAME?: string
  CLIENT_CONTACT_EMAIL?: string
  FORM_VARIANT_KNOWN?: string
  SENDER_EMAIL?: string
}

export type RenderRuntime = {
  supabaseUrl: string
  supabaseAnonKey: string
  bucket: string
}

const PLACEHOLDER_RE = /\{\{\s*([A-Z0-9_]+)\s*\}\}/g

function escapeForScriptTag(value: string): string {
  return JSON.stringify(value).replace(/<\/script/gi, '<\\/script')
}

export function renderFormHtml(
  template: string,
  vars: RenderVars,
  runtime: RenderRuntime,
): string {
  const lookup: Record<string, string | undefined> = vars as unknown as Record<
    string,
    string | undefined
  >

  let rendered = template.replace(PLACEHOLDER_RE, (_match, key: string) => {
    const value = lookup[key]
    return value ?? ''
  })

  // Override the hardcoded constants inside the inline IIFE so file uploads
  // hit the correct project + bucket (templates were authored with literal
  // values and we don't want to re-edit the DB row each rotation).
  rendered = rendered.replace(
    /var\s+SB_URL\s*=\s*'[^']*'\s*;/,
    `var SB_URL=${escapeForScriptTag(runtime.supabaseUrl)};`,
  )
  rendered = rendered.replace(
    /var\s+SB_KEY\s*=\s*'[^']*'\s*;/,
    `var SB_KEY=${escapeForScriptTag(runtime.supabaseAnonKey)};`,
  )
  rendered = rendered.replace(
    /var\s+BUCKET\s*=\s*'[^']*'\s*;/,
    `var BUCKET=${escapeForScriptTag(runtime.bucket)};`,
  )

  // Also expose them on `window` for any future template that reads from
  // there. Injected immediately before the first `<script>` tag.
  const runtimeInjection = `<script>
window.SB_URL = ${escapeForScriptTag(runtime.supabaseUrl)};
window.SB_KEY = ${escapeForScriptTag(runtime.supabaseAnonKey)};
window.BUCKET = ${escapeForScriptTag(runtime.bucket)};
</script>`

  const firstScriptIdx = rendered.indexOf('<script')
  if (firstScriptIdx >= 0) {
    rendered =
      rendered.slice(0, firstScriptIdx) +
      runtimeInjection +
      rendered.slice(firstScriptIdx)
  }

  return rendered
}
