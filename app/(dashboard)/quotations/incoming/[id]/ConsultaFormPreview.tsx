import path from 'path'
import { readFile } from 'fs/promises'
import { ExternalLink, FileText } from 'lucide-react'

import type { ClienteWithContactos } from '@/types/database'

type ConsultaFormPreviewProps = {
  consultaId: string
  consultaCode: string
  senderEmail: string | null
  publicFormUrl: string | null
  matchedClient: ClienteWithContactos | null
}

function getPrimaryContact(client: ClienteWithContactos | null) {
  if (!client) return null

  return (
    client.contactos.find((contact) => contact.es_principal && contact.activo) ??
    client.contactos.find((contact) => contact.activo) ??
    client.contactos[0] ??
    null
  )
}

function deriveEmailDomain(email: string | null) {
  if (!email) return ''
  const normalized = email.trim().toLowerCase()
  const atIndex = normalized.indexOf('@')
  return atIndex >= 0 ? normalized.slice(atIndex + 1) : ''
}

async function loadTemplate(templateName: string) {
  const templatePath = path.join(process.cwd(), 'Formularios', templateName)
  return readFile(templatePath, 'utf8')
}

function replacePlaceholders(template: string, replacements: Record<string, string>) {
  return Object.entries(replacements).reduce((html, [key, value]) => {
    return html.replaceAll(`{{${key}}}`, value)
  }, template)
}

export async function ConsultaFormPreview({
  consultaId,
  consultaCode,
  senderEmail,
  publicFormUrl,
  matchedClient,
}: ConsultaFormPreviewProps) {
  const templateName = matchedClient
    ? 'formulario_cliente_conocido.html'
    : 'formulario_cliente_desconocido.html'
  const template = await loadTemplate(templateName)
  const primaryContact = getPrimaryContact(matchedClient)
  const resolvedSenderEmail = senderEmail?.trim() || primaryContact?.email?.trim() || ''

  const previewHtml = replacePlaceholders(template, {
    FORM_POST_URL: '#preview-only',
    FORM_TOKEN: 'preview-token',
    FORM_LINK_ID: 'preview-link',
    CONSULTA_ID: consultaId,
    FORM_VARIANT_KNOWN: 'known_client',
    FORM_VARIANT_UNKNOWN: 'unknown_client',
    CLIENT_ID: matchedClient?.id ?? '',
    CLIENT_CONTACT_ID: primaryContact?.id ?? '',
    CLIENT_COMPANY_NAME: matchedClient?.nombre ?? '',
    CLIENT_CONTACT_FULL_NAME:
      [primaryContact?.nombre, primaryContact?.apellidos].filter(Boolean).join(' ') || '',
    CLIENT_CONTACT_EMAIL: primaryContact?.email ?? resolvedSenderEmail,
    CONSULTA_REFERENCE: consultaCode,
    SENDER_EMAIL: resolvedSenderEmail,
    DERIVED_EMAIL_DOMAIN: deriveEmailDomain(resolvedSenderEmail),
  })

  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(148,163,184,0.12)]">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Formulario
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">
              Vista previa del formulario enviado
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Esta vista reproduce el HTML que n8n servirÃ¡ al cliente usando la URL
              guardada en la consulta.
            </p>
          </div>

          {publicFormUrl ? (
            <a
              href={publicFormUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700 transition-colors hover:bg-sky-100"
            >
              <ExternalLink className="mr-2 h-3.5 w-3.5" />
              Abrir URL publica
            </a>
          ) : null}
        </div>
      </div>

      {!publicFormUrl ? (
        <div className="px-5 py-5">
          <div className="rounded-[20px] border border-dashed border-amber-200 bg-amber-50/70 px-4 py-5 text-sm leading-6 text-slate-700">
            TodavÃ­a no hay una `url_formulario` guardada en esta consulta. Cuando n8n
            la escriba en Supabase, la app podrÃ¡ abrir y reproducir el formulario
            exacto que se enviarÃ¡ al cliente.
          </div>
        </div>
      ) : (
        <div className="grid gap-4 px-5 py-5">
          <div className="flex items-start gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                URL registrada en Supabase
              </p>
              <p className="mt-1 break-all text-sm text-slate-700">{publicFormUrl}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50/60">
            <iframe
              title="Form preview"
              srcDoc={previewHtml}
              className="h-[960px] w-full bg-white"
            />
          </div>
        </div>
      )}
    </section>
  )
}
