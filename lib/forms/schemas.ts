/**
 * ============================================================================
 * Public client form — Zod schemas (known + unknown variants)
 * ============================================================================
 *
 * Used by `POST /api/forms/[token]/submit` to validate the JSON body posted
 * from `app/f/[token]/PublicFormClient.tsx`. We share a single
 * `projectFormSchema` between both client kinds; the unknown variant adds a
 * `company` block and a `contact` block on top.
 *
 * Notes on field shapes:
 *   - All booleans here are real `boolean`. The handler converts them to the
 *     legacy 'true'/'false' text format before writing to
 *     `doa_incoming_requests_v2.is_aog` / `has_drawings` (those columns are
 *     `text`, not `boolean`, despite the column names suggesting otherwise).
 *     `doa_form_submissions_v2` keeps them as real booleans.
 *   - `desired_timeline` accepts free text (e.g. "Q2 2026") OR an ISO date
 *     ("2026-06-01"). The handler attempts a best-effort parse to populate
 *     `doa_incoming_requests_v2.target_date` (a real `date` column), and
 *     falls back to null on failure.
 *   - `affected_aircraft_count` defaults to 1 when missing.
 * ============================================================================
 */

import { z } from 'zod'

/** Trim and coerce empty strings to undefined so optional() works as expected. */
const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))

const requiredString = z.string().trim().min(1)

/** Project block — same fields for both known and unknown clients. */
export const projectFormSchema = z.object({
  aircraft_manufacturer: optionalString,
  aircraft_model: requiredString,
  registration: optionalString,
  project_type: z.enum(['New project', 'Modification']),
  modification_description: requiredString,
  affected_aircraft_count: z
    .number()
    .int()
    .min(1)
    .default(1),
  ata_chapter: optionalString,
  applicable_regulation: optionalString,
  has_previous_approval: z.boolean().default(false),
  reference_document: optionalString,
  aircraft_location: optionalString,
  desired_timeline: optionalString,
  is_aog: z.boolean().default(false),
  has_drawings: z.boolean().default(false),
  additional_notes: optionalString,
})

export type ProjectFormData = z.infer<typeof projectFormSchema>

/** Company block — only present for unknown-client submissions. */
export const companyFormSchema = z.object({
  company_name: requiredString,
  vat_tax_id: requiredString,
  country: requiredString,
  city: optionalString,
  address: optionalString,
  company_phone: optionalString,
  website: optionalString,
})

export type CompanyFormData = z.infer<typeof companyFormSchema>

/** Contact block — only present for unknown-client submissions. */
export const contactFormSchema = z.object({
  contact_first_name: requiredString,
  contact_last_name: requiredString,
  contact_email: z.string().trim().email(),
  contact_phone: optionalString,
  position_role: optionalString,
})

export type ContactFormData = z.infer<typeof contactFormSchema>

/** Schema for `clientKind === 'known'` — only the project block. */
export const knownClientFormSchema = z.object({
  client_kind: z.literal('known'),
  project: projectFormSchema,
})

export type KnownClientFormInput = z.infer<typeof knownClientFormSchema>

/** Schema for `clientKind === 'unknown'` — company + contact + project. */
export const unknownClientFormSchema = z.object({
  client_kind: z.literal('unknown'),
  company: companyFormSchema,
  contact: contactFormSchema,
  project: projectFormSchema,
})

export type UnknownClientFormInput = z.infer<typeof unknownClientFormSchema>

/** Discriminated union — pick the right schema by `client_kind`. */
export const submitFormSchema = z.discriminatedUnion('client_kind', [
  knownClientFormSchema,
  unknownClientFormSchema,
])

export type SubmitFormInput = z.infer<typeof submitFormSchema>
