/**
 * ============================================================================
 * Public form payload schemas — matches the inline JS payload built by the
 * HTML templates stored in `public.doa_forms`.
 * ============================================================================
 *
 * Wire shape (sent by the inline IIFE in both templates):
 *
 *   known   → { form_token, aircraft: {...}, technical: {...} }
 *   unknown → { form_token, client: {...}, aircraft: {...}, technical: {...} }
 *
 * `client_kind` is NOT sent over the wire — the canonical source of truth is
 * the `doa_form_tokens_v2.client_kind` column. The submit handler discriminates
 * on that and picks `unknownSubmitSchema` / `knownSubmitSchema` accordingly.
 *
 * Booleans coming from <select yes/no> are coerced via `lazyBool` (accepts
 * 'true'/'false'/'1'/'0'/'yes'/'no' or real booleans). Many `impact_*` fields
 * are SELECTs with an extra `no_se`/`not_sure` value, so they stay as plain
 * strings.
 * ============================================================================
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Coercion helpers
// ---------------------------------------------------------------------------

const optionalString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined) return undefined
    const s = String(v).trim()
    return s.length > 0 ? s : undefined
  })

const requiredString = z
  .string({ message: 'Required' })
  .transform((v) => v.trim())
  .refine((v) => v.length > 0, { message: 'Required' })

const lazyBool = z
  .union([z.boolean(), z.string(), z.null(), z.undefined()])
  .transform((v, ctx) => {
    if (typeof v === 'boolean') return v
    if (v === null || v === undefined) return undefined
    const s = String(v).trim().toLowerCase()
    if (s === '') return undefined
    if (s === 'true' || s === '1' || s === 'yes') return true
    if (s === 'false' || s === '0' || s === 'no') return false
    ctx.addIssue({ code: 'custom', message: `Invalid boolean: ${v}` })
    return z.NEVER
  })
  .optional()

const lazyInt = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v, ctx) => {
    if (v === null || v === undefined || v === '') return undefined
    const n = typeof v === 'number' ? v : parseInt(String(v), 10)
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: 'custom', message: `Invalid integer: ${v}` })
      return z.NEVER
    }
    return Math.trunc(n)
  })
  .optional()

const lazyFloat = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v, ctx) => {
    if (v === null || v === undefined || v === '') return undefined
    const n = typeof v === 'number' ? v : parseFloat(String(v))
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: 'custom', message: `Invalid number: ${v}` })
      return z.NEVER
    }
    return n
  })
  .optional()

const isoDateOptional = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v, ctx) => {
    if (v === null || v === undefined) return undefined
    const s = String(v).trim()
    if (s === '') return undefined
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      ctx.addIssue({ code: 'custom', message: `Invalid date (YYYY-MM-DD): ${v}` })
      return z.NEVER
    }
    return s
  })

const urlOptional = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v, ctx) => {
    if (v === null || v === undefined) return undefined
    const s = String(v).trim()
    if (s === '') return undefined
    try {
      new URL(s)
      return s
    } catch {
      ctx.addIssue({ code: 'custom', message: `Invalid URL: ${v}` })
      return z.NEVER
    }
  })

// ---------------------------------------------------------------------------
// Aircraft block (shared)
// ---------------------------------------------------------------------------

export const aircraftBlockSchema = z.object({
  tcds_number: optionalString,
  aircraft_manufacturer: optionalString,
  aircraft_model: optionalString,
  aircraft_count: lazyInt
    .transform((v) => (v === undefined || v < 1 ? 1 : v)),
  aircraft_msn: optionalString,
  tcds_pdf_url: urlOptional,
})

export type AircraftBlock = z.infer<typeof aircraftBlockSchema>

// ---------------------------------------------------------------------------
// Technical block (shared)
// ---------------------------------------------------------------------------

const itemWeightEntrySchema = z
  .object({
    name: optionalString,
    weight_added_kg: lazyFloat,
    weight_removed_kg: lazyFloat,
  })
  .passthrough()

export type ItemWeightEntry = z.infer<typeof itemWeightEntrySchema>

export const technicalBlockSchema = z.object({
  work_type: optionalString,
  modification_summary: optionalString,
  operational_goal: optionalString,
  existing_project_code: optionalString,
  has_equipment: optionalString,
  equipment_details: optionalString,
  has_drawings: lazyBool,
  has_previous_mod: optionalString,
  previous_mod_ref: optionalString,
  has_manufacturer_docs: lazyBool,
  target_date: isoDateOptional,
  is_aog: lazyBool,
  aircraft_location: optionalString,
  additional_notes: optionalString,
  impact_location: optionalString,
  impact_structural_attachment: optionalString,
  impact_structural_interface: optionalString,
  impact_electrical: optionalString,
  impact_avionics: optionalString,
  impact_cabin_layout: lazyBool,
  impact_pressurized: optionalString,
  impact_operational_change: optionalString,
  installation_drawings: z.array(z.string()).optional().default([]),
  items_weight_list: z.array(itemWeightEntrySchema).optional().default([]),
  installation_weight_kg: lazyFloat,
  fuselage_position: optionalString,
  sta_location: optionalString,
  affects_primary_structure: optionalString,
  ad_reference: optionalString,
  motivated_by_ad: optionalString,
})

export type TechnicalBlock = z.infer<typeof technicalBlockSchema>

// ---------------------------------------------------------------------------
// Client block (only present in the unknown variant)
// ---------------------------------------------------------------------------

export const clientBlockSchema = z.object({
  customer_type: optionalString,
  company_name: requiredString,
  vat_number: optionalString,
  country: requiredString,
  city: optionalString,
  address: optionalString,
  company_phone: optionalString,
  website: optionalString,
  contact_first_name: requiredString,
  contact_last_name: requiredString,
  contact_email: z
    .string()
    .trim()
    .min(1, 'Required')
    .email('Invalid email'),
  contact_phone: optionalString,
  contact_role: optionalString,
})

export type ClientBlock = z.infer<typeof clientBlockSchema>

// ---------------------------------------------------------------------------
// Top-level submit schemas
// ---------------------------------------------------------------------------

export const knownSubmitSchema = z.object({
  form_token: optionalString,
  aircraft: aircraftBlockSchema,
  technical: technicalBlockSchema,
})

export type KnownSubmitInput = z.infer<typeof knownSubmitSchema>

export const unknownSubmitSchema = z.object({
  form_token: optionalString,
  client: clientBlockSchema,
  aircraft: aircraftBlockSchema,
  technical: technicalBlockSchema,
})

export type UnknownSubmitInput = z.infer<typeof unknownSubmitSchema>
