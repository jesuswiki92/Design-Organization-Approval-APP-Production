/**
 * ============================================================================
 * Canonical SoC (Statement of Compliance) payload builder — Sprint 3
 * ============================================================================
 *
 * This payload is BOTH:
 *   - rendered into the SoC PDF (lib/pdf/soc-renderer.tsx), and
 *   - signed via HMAC-SHA256 (lib/signatures/hmac.ts) on the
 *     `delivery_release` signature row.
 *
 * Therefore the shape MUST be deterministic: given the same project +
 * validation + deliverables snapshot, the builder produces the exact same
 * payload, which canonicalizes (via canonicalJSON) to the exact same bytes,
 * which in turn produce the exact same SHA-256 hash and HMAC.
 *
 * Fields that are environmental (company name, approval number) are read
 * from env vars at build-time and passed in by the caller, so this module
 * stays pure and easy to test.
 */

import 'server-only'

import type {
  DeliverableStatus,
  DeliverableSnapshot,
  StatementOfCompliancePayload,
  ValidationDecision,
  ValidationRole,
} from '@/types/database'

export type BuildSoCParams = {
  document: {
    id: string
    title?: string
    generated_at: string
    company: {
      name: string
      approval_no: string
    }
  }
  project: {
    id: string
    project_number: string
    title: string
    description: string | null
    client_name: string | null
  }
  validation: {
    id: string
    role: ValidationRole
    decision: ValidationDecision
    validator_user_id: string
    validator_email: string | null
    decided_at: string
  }
  deliverables: Array<{
    id: string
    template_code: string | null
    title: string
    subpart_easa: string | null
    current_version: number
    status: DeliverableStatus
  }>
  signature: {
    validation_signature_id: string
    hmac_key_id: string
    hmac_signature: string
    signed_by_user_id: string
    signed_at: string
  }
}

/**
 * Build the canonical SoC payload. The function normalizes the deliverables
 * order (by template_code then title) so the output is stable regardless of
 * how the caller provides them.
 */
export function buildSoCCanonicalPayload(
  params: BuildSoCParams,
): StatementOfCompliancePayload {
  const deliverables = [...params.deliverables]
    .map((d) => ({
      id: d.id,
      template_code: d.template_code,
      title: d.title,
      subpart_easa: d.subpart_easa,
      current_version: d.current_version,
      status: d.status,
    }))
    .sort((a, b) => {
      const ka = a.template_code ?? a.title
      const kb = b.template_code ?? b.title
      if (ka < kb) return -1
      if (ka > kb) return 1
      return 0
    })

  const hmac = params.signature.hmac_signature
  const hmacFirst8 = hmac.slice(0, 8)
  const hmacLast8 = hmac.slice(Math.max(0, hmac.length - 8))

  const payload: StatementOfCompliancePayload = {
    document: {
      id: params.document.id,
      title: params.document.title ?? 'Statement of Compliance',
      generated_at: params.document.generated_at,
      company: {
        name: params.document.company.name,
        approval_no: params.document.company.approval_no,
      },
    },
    project: {
      id: params.project.id,
      project_number: params.project.project_number,
      title: params.project.title,
      description: params.project.description,
      client_name: params.project.client_name,
    },
    validation: {
      id: params.validation.id,
      role: params.validation.role,
      decision: params.validation.decision,
      validator_user_id: params.validation.validator_user_id,
      validator_email: params.validation.validator_email,
      decided_at: params.validation.decided_at,
    },
    deliverables,
    compliance_reference: {
      regulation: 'EASA Part 21 Subpart J',
      clauses: ['21.A.239', '21.A.257', '21.A.263'],
    },
    signature: {
      validation_signature_id: params.signature.validation_signature_id,
      hmac_key_id: params.signature.hmac_key_id,
      hmac_signature_first8: hmacFirst8,
      hmac_signature_last8: hmacLast8,
      signed_by_user_id: params.signature.signed_by_user_id,
      signed_at: params.signature.signed_at,
    },
  }

  return payload
}

/** Map a DeliverableSnapshot (validation row) to the deliverables block. */
export function snapshotToSoCDeliverables(
  snapshot: DeliverableSnapshot[],
  extraByDeliverableId?: Map<
    string,
    { template_code: string | null; subpart_easa: string | null }
  >,
): BuildSoCParams['deliverables'] {
  return snapshot.map((d) => ({
    id: d.id,
    title: d.title,
    status: d.status,
    current_version: d.current_version,
    template_code: extraByDeliverableId?.get(d.id)?.template_code ?? null,
    subpart_easa: extraByDeliverableId?.get(d.id)?.subpart_easa ?? null,
  }))
}
