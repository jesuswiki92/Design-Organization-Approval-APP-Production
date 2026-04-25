/**
 * ============================================================================
 * Forms v2 — Zod schemas (shared between issue-link and submit routes)
 * ============================================================================
 *
 * Canonical JSON contracts for the public intake forms. Defined here once so
 * both `POST /api/forms/issue-link` (n8n -> us) and
 * `POST /f/[token]/submit` (browser -> us) share a single source of truth.
 *
 * Notes on the submit payload:
 * - `client` is present only on the `cliente_desconocido` variant.
 * - All impact_* / has_* / is_* fields are booleans here (the RPC converts
 *   them to the legacy 'yes'/'no' text storage format in DB).
 * - `motivated_by_ad` is the form's field name; the RPC maps it to the
 *   `related_to_ad` column in `doa_incoming_requests`.
 * - `installation_weight_kg` is the form's numeric field; the RPC maps it to
 *   the `estimated_weight_kg` text column.
 */

import { z } from 'zod'

// ─── /api/forms/issue-link ────────────────────────────────────────────────

export const issueLinkSchema = z.object({
  incoming_request_id: z.string().uuid(),
  slug: z.enum(['cliente_conocido', 'cliente_desconocido']),
  ttl_days: z
    .number()
    .int()
    .min(1)
    .max(60)
    .optional(),
})

export type IssueLinkInput = z.infer<typeof issueLinkSchema>

// ─── /f/[token]/submit ────────────────────────────────────────────────────

/**
 * Allowed values for `customer_type` — MUST stay in sync with the DB check
 * constraint `doa_clientes_datos_generales_tipo_cliente_check` on
 * `doa_clients.client_type` (ARRAY['airline','mro','private','manufacturer','other']).
 *
 * Keep in sync with:
 *   - `doa_forms.html` (cliente_desconocido) `<select id="customer_type">` options
 *   - `types/database.ts` DoaClient.client_type union
 *   - Formularios/formulario_cliente_desconocido.html
 */
export const CUSTOMER_TYPE_VALUES = [
  'airline',
  'mro',
  'private',
  'manufacturer',
  'other',
] as const

const clientBlockSchema = z.object({
  company_name: z.string().min(1),
  vat_number: z.string().optional(),
  country: z.string().min(1),
  city: z.string().optional(),
  address: z.string().optional(),
  company_phone: z.string().optional(),
  website: z.string().optional(),
  customer_type: z.enum(CUSTOMER_TYPE_VALUES, {
    errorMap: () => ({
      message: `customer_type must be one of: ${CUSTOMER_TYPE_VALUES.join(', ')}`,
    }),
  }),
  contact_first_name: z.string().min(1),
  contact_last_name: z.string().min(1),
  contact_email: z.string().email(),
  contact_phone: z.string().optional(),
  contact_role: z.string().optional(),
})

const aircraftBlockSchema = z.object({
  tcds_number: z.string().min(1),
  aircraft_manufacturer: z.string().min(1),
  aircraft_model: z.string().min(1),
  aircraft_count: z.number().int().min(1),
  aircraft_msn: z.string().min(1),
  tcds_pdf_url: z.string().url().optional().or(z.literal('').transform(() => undefined)),
})

const itemWeightSchema = z.object({
  name: z.string(),
  weight_added_kg: z.number().optional(),
  weight_removed_kg: z.number().optional(),
})

const technicalBlockSchema = z.object({
  work_type: z.string().min(1),
  modification_summary: z.string().min(1),
  operational_goal: z.string().min(1),
  existing_project_code: z.string().optional(),
  has_equipment: z.boolean(),
  equipment_details: z.string().optional(),
  has_drawings: z.boolean(),
  has_previous_mod: z.boolean(),
  previous_mod_ref: z.string().optional(),
  has_manufacturer_docs: z.boolean(),
  target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('').transform(() => undefined)),
  is_aog: z.boolean(),
  aircraft_location: z.string().optional(),
  additional_notes: z.string().optional(),
  impact_location: z.boolean(),
  impact_structural_attachment: z.boolean(),
  impact_structural_interface: z.boolean().optional(),
  impact_electrical: z.boolean(),
  impact_avionics: z.boolean(),
  impact_cabin_layout: z.boolean(),
  impact_pressurized: z.boolean(),
  impact_operational_change: z.boolean(),
  installation_drawings: z.array(z.string()).optional(),
  items_weight_list: z.array(itemWeightSchema).optional(),
  installation_weight_kg: z.number().optional(),
  fuselage_position: z.string().optional(),
  sta_location: z.string().optional(),
  affects_primary_structure: z.boolean().optional(),
  ad_reference: z.string().optional(),
  motivated_by_ad: z.boolean().optional(),
})

export const submitFormSchema = z.object({
  client: clientBlockSchema.optional(),
  aircraft: aircraftBlockSchema,
  technical: technicalBlockSchema,
})

export type SubmitFormInput = z.infer<typeof submitFormSchema>
