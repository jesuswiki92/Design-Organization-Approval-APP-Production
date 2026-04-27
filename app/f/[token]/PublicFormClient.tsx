/**
 * ============================================================================
 * PublicFormClient — public client-facing form (known + unknown)
 * ============================================================================
 *
 * Renderiza el formulario que el cliente final rellena para describir su
 * proyecto. Hay dos modos según `clientKind`:
 *   - 'known': el cliente ya existe en `doa_clients_v2`. Mostramos un banner
 *     read-only con sus datos confirmados y solo pedimos los datos del
 *     proyecto.
 *   - 'unknown': el sender no coincide con ningún cliente registrado.
 *     Pedimos también un bloque "Datos de tu empresa" y un bloque "Tu
 *     contacto", con `contact_email` prefilled desde el remitente del email
 *     original cuando es extraíble.
 *
 * Validación:
 *   - Cliente: HTML5 (`required`, `type="email"`). No traemos Zod aquí para
 *     no engordar el bundle público — el endpoint hace validación canónica.
 *   - Servidor: `lib/forms/schemas.ts` (Zod) en `/api/forms/[token]/submit`.
 *
 * Visual: paleta Warm Executive (paper / ink / cobalt). El layout es de tipo
 * "Typeform" con secciones tarjeta. NO usa el chrome del dashboard.
 * ============================================================================
 */

'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Loader2, Send } from 'lucide-react'

type ClientKind = 'known' | 'unknown'

type KnownClientSummary = {
  name: string
  country: string
  vat_tax_id: string | null
  city: string | null
}

type IncomingSummary = {
  id: string
  code: string
  subject: string
}

type PublicFormClientProps = {
  tokenSlug: string
  clientKind: ClientKind
  incoming: IncomingSummary
  knownClient: KnownClientSummary | null
  prefillContactEmail: string | null
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

type CompanyState = {
  company_name: string
  vat_tax_id: string
  country: string
  city: string
  address: string
  company_phone: string
  website: string
}

type ContactState = {
  contact_first_name: string
  contact_last_name: string
  contact_email: string
  contact_phone: string
  position_role: string
}

type ProjectState = {
  aircraft_manufacturer: string
  aircraft_model: string
  registration: string
  project_type: 'New project' | 'Modification'
  modification_description: string
  affected_aircraft_count: number
  ata_chapter: string
  applicable_regulation: string
  has_previous_approval: boolean
  reference_document: string
  aircraft_location: string
  desired_timeline: string
  is_aog: boolean
  has_drawings: boolean
  additional_notes: string
}

const INITIAL_COMPANY: CompanyState = {
  company_name: '',
  vat_tax_id: '',
  country: '',
  city: '',
  address: '',
  company_phone: '',
  website: '',
}

function buildInitialContact(prefillEmail: string | null): ContactState {
  return {
    contact_first_name: '',
    contact_last_name: '',
    contact_email: prefillEmail ?? '',
    contact_phone: '',
    position_role: '',
  }
}

const INITIAL_PROJECT: ProjectState = {
  aircraft_manufacturer: '',
  aircraft_model: '',
  registration: '',
  project_type: 'New project',
  modification_description: '',
  affected_aircraft_count: 1,
  ata_chapter: '',
  applicable_regulation: '',
  has_previous_approval: false,
  reference_document: '',
  aircraft_location: '',
  desired_timeline: '',
  is_aog: false,
  has_drawings: false,
  additional_notes: '',
}

// ---------------------------------------------------------------------------
// Visual primitives
// ---------------------------------------------------------------------------

function SectionCard({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--paper-2)] p-6 shadow-sm">
      <h2 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-[color:var(--ink)]">
        {title}
      </h2>
      {hint ? (
        <p className="mt-1 text-xs text-[color:var(--ink-3)]">{hint}</p>
      ) : null}
      <div className="mt-5 grid gap-4">{children}</div>
    </section>
  )
}

function Field({
  label,
  required = false,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5 text-left">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ink-3)]">
        {label}
        {required ? <span className="ml-1 text-[color:var(--err)]">*</span> : null}
      </span>
      {children}
      {hint ? (
        <span className="text-[11px] text-[color:var(--ink-3)]">{hint}</span>
      ) : null}
    </label>
  )
}

const inputClass =
  'w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--paper)] px-3 py-2 text-sm text-[color:var(--ink)] outline-none transition-colors placeholder:text-[color:var(--ink-4)] focus:border-[color:var(--cobalt)] focus:bg-[color:var(--paper-2)]'

const textareaClass = `${inputClass} min-h-[110px] resize-y leading-6`

const selectClass = inputClass

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--paper)] px-3 py-2.5 text-sm text-[color:var(--ink-2)] transition-colors hover:border-[color:var(--cobalt)]/40">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 cursor-pointer accent-[color:var(--cobalt)]"
      />
      <span>{label}</span>
    </label>
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function PublicFormClient({
  tokenSlug,
  clientKind,
  incoming,
  knownClient,
  prefillContactEmail,
}: PublicFormClientProps) {
  const [company, setCompany] = useState<CompanyState>(INITIAL_COMPANY)
  const [contact, setContact] = useState<ContactState>(() =>
    buildInitialContact(prefillContactEmail),
  )
  const [project, setProject] = useState<ProjectState>(INITIAL_PROJECT)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting || submitted) return

    setSubmitting(true)
    try {
      // Coerce the count to a positive integer (HTML5 number inputs return
      // strings sometimes; we keep state typed but defend the wire format).
      const count = Number.isFinite(project.affected_aircraft_count)
        ? Math.max(1, Math.floor(project.affected_aircraft_count))
        : 1

      const payload =
        clientKind === 'known'
          ? {
              client_kind: 'known' as const,
              project: {
                ...project,
                affected_aircraft_count: count,
              },
            }
          : {
              client_kind: 'unknown' as const,
              company,
              contact,
              project: {
                ...project,
                affected_aircraft_count: count,
              },
            }

      const res = await fetch(`/api/forms/${tokenSlug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
      }

      if (!res.ok || !json.ok) {
        const message = json.error || `Error ${res.status}`
        toast.error(`No se pudo enviar el formulario: ${message}`)
        return
      }

      setSubmitted(true)
      toast.success('Formulario enviado correctamente')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido'
      toast.error(`No se pudo enviar el formulario: ${message}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-3xl border border-[color:var(--ok)]/30 bg-[color:var(--ok)]/5 p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-10 w-10 text-[color:var(--ok)]" />
        <h1 className="mt-4 font-[family-name:var(--font-heading)] text-2xl font-semibold text-[color:var(--ink)]">
          Formulario enviado
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[color:var(--ink-2)]">
          Recibirás respuesta del equipo de DOA en breve. Gracias por tu envío.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Header reference card */}
      <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper-2)] px-5 py-4 text-sm text-[color:var(--ink-2)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ink-3)]">
          Referencia
        </p>
        <p className="mt-1 font-mono text-xs text-[color:var(--ink-2)]">
          {incoming.code}
        </p>
        {incoming.subject ? (
          <p className="mt-1 truncate text-sm text-[color:var(--ink)]">
            {incoming.subject}
          </p>
        ) : null}
      </div>

      {clientKind === 'known' && knownClient ? (
        <div className="rounded-2xl border border-[color:var(--cobalt)]/30 bg-[color:var(--cobalt-soft)] px-5 py-4 text-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--cobalt)]">
            Datos confirmados
          </p>
          <p className="mt-1 text-base font-semibold text-[color:var(--ink)]">
            {knownClient.name}
          </p>
          <div className="mt-1 grid grid-cols-1 gap-1 text-xs text-[color:var(--ink-2)] sm:grid-cols-3">
            <p>
              <span className="text-[color:var(--ink-3)]">País:</span>{' '}
              {knownClient.country}
            </p>
            <p>
              <span className="text-[color:var(--ink-3)]">VAT:</span>{' '}
              {knownClient.vat_tax_id ?? '—'}
            </p>
            <p>
              <span className="text-[color:var(--ink-3)]">Ciudad:</span>{' '}
              {knownClient.city ?? '—'}
            </p>
          </div>
        </div>
      ) : null}

      {clientKind === 'unknown' ? (
        <>
          <SectionCard
            title="Datos de tu empresa"
            hint="No te tenemos registrado todavía. Estos datos crearán tu ficha de cliente en DOA."
          >
            <Field label="Nombre comercial" required>
              <input
                type="text"
                required
                value={company.company_name}
                onChange={(e) =>
                  setCompany({ ...company, company_name: e.target.value })
                }
                className={inputClass}
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="VAT / Tax ID" required>
                <input
                  type="text"
                  required
                  value={company.vat_tax_id}
                  onChange={(e) =>
                    setCompany({ ...company, vat_tax_id: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="País" required>
                <input
                  type="text"
                  required
                  value={company.country}
                  onChange={(e) =>
                    setCompany({ ...company, country: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Ciudad">
                <input
                  type="text"
                  value={company.city}
                  onChange={(e) =>
                    setCompany({ ...company, city: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Dirección">
                <input
                  type="text"
                  value={company.address}
                  onChange={(e) =>
                    setCompany({ ...company, address: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Teléfono">
                <input
                  type="tel"
                  value={company.company_phone}
                  onChange={(e) =>
                    setCompany({ ...company, company_phone: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Web">
                <input
                  type="url"
                  value={company.website}
                  onChange={(e) =>
                    setCompany({ ...company, website: e.target.value })
                  }
                  className={inputClass}
                  placeholder="https://"
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="Tu contacto"
            hint="Persona principal para esta solicitud."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nombre" required>
                <input
                  type="text"
                  required
                  value={contact.contact_first_name}
                  onChange={(e) =>
                    setContact({
                      ...contact,
                      contact_first_name: e.target.value,
                    })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Apellidos" required>
                <input
                  type="text"
                  required
                  value={contact.contact_last_name}
                  onChange={(e) =>
                    setContact({
                      ...contact,
                      contact_last_name: e.target.value,
                    })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Email" required>
                <input
                  type="email"
                  required
                  value={contact.contact_email}
                  onChange={(e) =>
                    setContact({
                      ...contact,
                      contact_email: e.target.value,
                    })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Teléfono">
                <input
                  type="tel"
                  value={contact.contact_phone}
                  onChange={(e) =>
                    setContact({
                      ...contact,
                      contact_phone: e.target.value,
                    })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Cargo / rol">
                <input
                  type="text"
                  value={contact.position_role}
                  onChange={(e) =>
                    setContact({
                      ...contact,
                      position_role: e.target.value,
                    })
                  }
                  className={inputClass}
                />
              </Field>
            </div>
          </SectionCard>
        </>
      ) : null}

      <SectionCard
        title="Datos del proyecto"
        hint="Cuéntanos sobre la modificación que necesitas certificar."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Fabricante de la aeronave">
            <input
              type="text"
              value={project.aircraft_manufacturer}
              onChange={(e) =>
                setProject({
                  ...project,
                  aircraft_manufacturer: e.target.value,
                })
              }
              className={inputClass}
              placeholder="Airbus, Boeing, Embraer…"
            />
          </Field>
          <Field label="Modelo de aeronave" required>
            <input
              type="text"
              required
              value={project.aircraft_model}
              onChange={(e) =>
                setProject({ ...project, aircraft_model: e.target.value })
              }
              className={inputClass}
              placeholder="A320-214, B737-800…"
            />
          </Field>
          <Field label="Matrícula">
            <input
              type="text"
              value={project.registration}
              onChange={(e) =>
                setProject({ ...project, registration: e.target.value })
              }
              className={inputClass}
              placeholder="EC-XXX"
            />
          </Field>
          <Field label="Tipo de proyecto">
            <select
              value={project.project_type}
              onChange={(e) =>
                setProject({
                  ...project,
                  project_type: e.target.value as ProjectState['project_type'],
                })
              }
              className={selectClass}
            >
              <option value="New project">Nuevo proyecto</option>
              <option value="Modification">Modificación existente</option>
            </select>
          </Field>
        </div>

        <Field label="Descripción de la modificación" required>
          <textarea
            required
            value={project.modification_description}
            onChange={(e) =>
              setProject({
                ...project,
                modification_description: e.target.value,
              })
            }
            className={textareaClass}
            placeholder="Describe la modificación que necesitas, su alcance y el resultado esperado."
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Aeronaves afectadas">
            <input
              type="number"
              min={1}
              value={project.affected_aircraft_count}
              onChange={(e) =>
                setProject({
                  ...project,
                  affected_aircraft_count: Number(e.target.value),
                })
              }
              className={inputClass}
            />
          </Field>
          <Field label="Capítulo ATA">
            <input
              type="text"
              value={project.ata_chapter}
              onChange={(e) =>
                setProject({ ...project, ata_chapter: e.target.value })
              }
              className={inputClass}
              placeholder="25, 53, 71…"
            />
          </Field>
          <Field label="Reglamento aplicable">
            <input
              type="text"
              value={project.applicable_regulation}
              onChange={(e) =>
                setProject({
                  ...project,
                  applicable_regulation: e.target.value,
                })
              }
              className={inputClass}
              placeholder="CS-25, Part 21J…"
            />
          </Field>
        </div>

        <Checkbox
          label="Existe una aprobación previa de esta modificación"
          checked={project.has_previous_approval}
          onChange={(v) =>
            setProject({ ...project, has_previous_approval: v })
          }
        />
        {project.has_previous_approval ? (
          <Field label="Documento de referencia">
            <input
              type="text"
              value={project.reference_document}
              onChange={(e) =>
                setProject({
                  ...project,
                  reference_document: e.target.value,
                })
              }
              className={inputClass}
              placeholder="STC, Service Bulletin, Major Repair…"
            />
          </Field>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Localización de la aeronave">
            <input
              type="text"
              value={project.aircraft_location}
              onChange={(e) =>
                setProject({ ...project, aircraft_location: e.target.value })
              }
              className={inputClass}
              placeholder="Aeropuerto / hangar"
            />
          </Field>
          <Field
            label="Fecha objetivo"
            hint="Acepta texto libre (ej. Q2 2026) o fecha exacta (2026-06-01)."
          >
            <input
              type="text"
              value={project.desired_timeline}
              onChange={(e) =>
                setProject({ ...project, desired_timeline: e.target.value })
              }
              className={inputClass}
              placeholder="Q2 2026 / 2026-06-01"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Checkbox
            label="Aircraft on Ground (AOG) — situación urgente"
            checked={project.is_aog}
            onChange={(v) => setProject({ ...project, is_aog: v })}
          />
          <Checkbox
            label="Tengo planos / documentación disponibles"
            checked={project.has_drawings}
            onChange={(v) => setProject({ ...project, has_drawings: v })}
          />
        </div>

        <Field label="Notas adicionales">
          <textarea
            value={project.additional_notes}
            onChange={(e) =>
              setProject({ ...project, additional_notes: e.target.value })
            }
            className={textareaClass}
            placeholder="Cualquier información adicional que consideres relevante."
          />
        </Field>
      </SectionCard>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--cobalt)] bg-[color:var(--cobalt)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[color:var(--cobalt)]/90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {submitting ? 'Enviando…' : 'Enviar formulario'}
        </button>
      </div>
    </form>
  )
}
