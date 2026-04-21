/**
 * ============================================================================
 * POST /api/projects/[id]/prepare-delivery  — Sprint 3 (close-the-loop)
 * ============================================================================
 *
 * Transita un project de `validated` -> `preparing_delivery`:
 *   1. Verifica que hay una validation approved + su firma `validation_approval`.
 *   2. Construye el payload canonico del Statement of Compliance.
 *   3. Renderiza el PDF con @react-pdf/renderer, calcula SHA-256.
 *   4. Sube el PDF a Supabase Storage (bucket `doa-deliverables`).
 *   5. Genera un token aleatorio de 32 bytes (base64url) para el link de confirmacion.
 *   6. Crea una fila en `doa_project_deliveries` con dispatch_status='pending'.
 *   7. Actualiza `doa_projects.execution_status -> preparing_delivery`.
 *
 * NO envia el email — eso lo hace `send-delivery` al pulsar el boton.
 *
 * Inconsistencies (loguean severity=error en observability):
 *   - No hay validation aprobada    -> 422
 *   - No existe signature_approval  -> 422
 *   - Falta el bucket de Storage    -> 500 con mensaje claro
 *   - Upload falla                  -> 500
 *   - Insert delivery falla         -> 500 (rollback manual)
 *   - Transition falla              -> 500 + severity=error (rollback manual)
 */

import { NextRequest } from 'next/server'
import { createHash, randomBytes } from 'node:crypto'

import { requireUserApi } from '@/lib/auth/require-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { logServerEvent } from '@/lib/observability/server'
import { buildRequestContext } from '@/lib/observability/shared'
import { buildSoCCanonicalPayload } from '@/lib/pdf/canonical-payload'
import { renderStatementOfCompliance } from '@/lib/pdf/soc-renderer'
import {
  PROJECT_EXECUTION_PHASES,
  PROJECT_EXECUTION_STATES,
} from '@/lib/workflow-states'
import type {
  DeliverableStatus,
  ProjectSignature,
  ProjectValidation,
  ValidationDecision,
  ValidationRole,
} from '@/types/database'

export const runtime = 'nodejs'

const DELIVERY_BUCKET = 'doa-deliverables'

function jsonResponse(status: number, data: unknown) {
  return Response.json(data, { status })
}

type DeliverableRow = {
  id: string
  template_code: string | null
  title: string
  subpart_easa: string | null
  current_version: number
  status: DeliverableStatus
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireUserApi()
  if (auth instanceof Response) return auth
  const { user, supabase } = auth
  const requestContext = buildRequestContext(request)
  const { id } = await context.params

  try {
    if (!id) return jsonResponse(400, { error: 'project_id requerido.' })

    // 1. Cargar project + validar status
    const { data: project, error: proyectoError } = await supabase
      .from('doa_projects')
      .select(
        'id, project_number, title, description, client_name, incoming_request_id, execution_status, current_phase',
      )
      .eq('id', id)
      .maybeSingle()

    if (proyectoError) return jsonResponse(500, { error: proyectoError.message })
    if (!project) return jsonResponse(404, { error: 'Project no encontrado.' })

    const currentState = (project as { execution_status?: string | null }).execution_status ?? null
    if (currentState !== PROJECT_EXECUTION_STATES.VALIDATED) {
      return jsonResponse(409, {
        error:
          `El project no esta en "validated" (status actual: "${currentState ?? 'desconocido'}"). ` +
          `Solo se admite prepare delivery desde "${PROJECT_EXECUTION_STATES.VALIDATED}".`,
        current_state: currentState,
      })
    }

    const proyectoRow = project as {
      id: string
      project_number: string
      title: string
      description: string | null
      client_name: string | null
      incoming_request_id: string | null
    }

    // 2. Ultima validation aprobada + firma validation_approval
    const { data: vRow, error: vErr } = await supabase
      .from('doa_project_validations')
      .select('*')
      .eq('project_id', id)
      .eq('decision', 'approved')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (vErr) return jsonResponse(500, { error: vErr.message })
    if (!vRow) {
      return jsonResponse(422, {
        error:
          'No se encontro una validation aprobada para este project. ' +
          'Requiere una decision "approved" previa en doa_project_validations.',
      })
    }
    const validation = vRow as ProjectValidation

    const { data: sigRow, error: sigErr } = await supabase
      .from('doa_project_signatures')
      .select('*')
      .eq('validation_id', validation.id)
      .eq('signature_type', 'validation_approval')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (sigErr) return jsonResponse(500, { error: sigErr.message })
    if (!sigRow) {
      return jsonResponse(422, {
        error:
          `No se encontro firma "validation_approval" para la validation ${validation.id}. ` +
          'Sprint 2 deberia haber creado la firma; revisa doa_project_signatures.',
      })
    }
    const approvalSignature = sigRow as ProjectSignature

    // 3. Deliverables actuales (sort_order estable)
    const { data: delRows, error: delErr } = await supabase
      .from('doa_project_deliverables')
      .select('id, template_code, title, subpart_easa, current_version, status')
      .eq('project_id', id)
      .order('sort_order', { ascending: true })

    if (delErr) return jsonResponse(500, { error: delErr.message })
    const deliverables = (delRows ?? []) as DeliverableRow[]

    // Email del validador (para el PDF)
    let validatorEmail: string | null = null
    try {
      const admin = createAdminClient()
      const { data: uRes } = await admin.auth.admin.getUserById(
        validation.validator_user_id,
      )
      validatorEmail = uRes?.user?.email ?? null
    } catch (e) {
      console.error('prepare-delivery: admin client unavailable:', e)
    }

    // 4. Construir payload canonico + renderizar PDF
    const generatedAt = new Date().toISOString()
    const companyName = process.env.DOA_COMPANY_NAME ?? 'DOA Operations'
    const companyApproval =
      process.env.DOA_COMPANY_APPROVAL_NO ?? 'EASA.21J.XXXX (PENDIENTE)'

    const payload = buildSoCCanonicalPayload({
      document: {
        id: `SoC-${proyectoRow.project_number}-${generatedAt}`,
        title: 'Statement of Compliance',
        generated_at: generatedAt,
        company: { name: companyName, approval_no: companyApproval },
      },
      project: {
        id: proyectoRow.id,
        project_number: proyectoRow.project_number,
        title: proyectoRow.title,
        description: proyectoRow.description,
        client_name: proyectoRow.client_name,
      },
      validation: {
        id: validation.id,
        role: validation.role as ValidationRole,
        decision: validation.decision as ValidationDecision,
        validator_user_id: validation.validator_user_id,
        validator_email: validatorEmail,
        decided_at: validation.created_at,
      },
      deliverables: deliverables.map((d) => ({
        id: d.id,
        template_code: d.template_code,
        title: d.title,
        subpart_easa: d.subpart_easa,
        current_version: d.current_version,
        status: d.status,
      })),
      signature: {
        validation_signature_id: approvalSignature.id,
        hmac_key_id: approvalSignature.hmac_key_id,
        hmac_signature: approvalSignature.hmac_signature,
        signed_by_user_id: approvalSignature.signer_user_id,
        signed_at: approvalSignature.created_at,
      },
    })

    let pdfBuffer: Buffer
    try {
      pdfBuffer = await renderStatementOfCompliance(payload)
    } catch (error) {
      console.error('prepare-delivery: PDF render failed', error)
      return jsonResponse(500, {
        error:
          'Fallo al renderizar el Statement of Compliance. Verifica que @react-pdf/renderer esta instalado. ' +
          (error instanceof Error ? error.message : ''),
      })
    }

    const sha256Hex = createHash('sha256').update(pdfBuffer).digest('hex')

    // 5. Upload a Storage (usamos admin client para saltar RLS del bucket)
    const storagePath = `projects/${id}/deliveries/${generatedAt}/SoC.pdf`
    let admin: ReturnType<typeof createAdminClient>
    try {
      admin = createAdminClient()
    } catch (e) {
      return jsonResponse(500, {
        error:
          'Admin client no disponible. Configura SUPABASE_SERVICE_ROLE_KEY. ' +
          (e instanceof Error ? e.message : ''),
      })
    }

    const { error: uploadError } = await admin.storage
      .from(DELIVERY_BUCKET)
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      const msg = uploadError.message || ''
      if (/bucket.*not found|not.*exist/i.test(msg)) {
        return jsonResponse(500, {
          error: `Storage bucket '${DELIVERY_BUCKET}' not found. Create it in Supabase dashboard.`,
        })
      }
      await logServerEvent({
        eventName: 'project.delivery.prepared',
        eventCategory: 'project',
        outcome: 'failure',
        severity: 'error',
        actorUserId: user.id,
        requestId: requestContext.requestId,
        route: requestContext.route,
        method: request.method,
        entityType: 'project',
        entityId: id,
        metadata: {
          stage: 'storage_upload',
          storage_path: storagePath,
          error_message: msg,
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
      return jsonResponse(500, {
        error: `No se pudo subir el SoC PDF a Storage: ${msg}`,
      })
    }

    // 6. Email client por defecto desde request (sender)
    let recipientEmailDefault = ''
    if (proyectoRow.incoming_request_id) {
      const { data: request } = await supabase
        .from('doa_incoming_requests')
        .select('id, sender')
        .eq('id', proyectoRow.incoming_request_id)
        .maybeSingle()
      const row = request as { sender?: string | null } | null
      const rem = row?.sender?.trim() ?? ''
      // Extraer email si viene en formato "Name <email@x.com>"
      const match = rem.match(/<([^>]+)>/)
      recipientEmailDefault = (match?.[1] ?? rem).trim()
    }

    // 7. Token de confirmacion (32 bytes base64url)
    const confirmationToken = randomBytes(32).toString('base64url')

    const defaultSubject = `Statement of Compliance — ${proyectoRow.title}`

    const deliveryInsertPayload = {
      project_id: id,
      validation_id: validation.id,
      signature_id: null, // se fija cuando se firma el delivery_release en send-delivery
      sent_by_user_id: user.id,
      recipient_email: recipientEmailDefault || 'pending@doa.local',
      recipient_name: proyectoRow.client_name,
      cc_emails: null,
      subject: defaultSubject,
      body: null,
      soc_pdf_storage_path: storagePath,
      soc_pdf_sha256: sha256Hex,
      attachments: [],
      dispatch_status: 'pending',
      client_confirmation_token: confirmationToken,
    } as never

    const { data: deliveryRow, error: insertErr } = await admin
      .from('doa_project_deliveries' as never)
      .insert(deliveryInsertPayload)
      .select('*')
      .single()

    if (insertErr || !deliveryRow) {
      await logServerEvent({
        eventName: 'project.delivery.prepared',
        eventCategory: 'project',
        outcome: 'failure',
        severity: 'error',
        actorUserId: user.id,
        requestId: requestContext.requestId,
        route: requestContext.route,
        method: request.method,
        entityType: 'project',
        entityId: id,
        metadata: {
          stage: 'insert_delivery',
          storage_path: storagePath,
          error_message: insertErr?.message ?? 'insert_delivery_failed',
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
      return jsonResponse(500, {
        error: `PDF subido pero no se pudo crear la fila de delivery: ${insertErr?.message ?? 'unknown'}`,
      })
    }

    const delivery = deliveryRow as { id: string; soc_pdf_storage_path: string }

    // 8. Transitar project -> preparing_delivery
    const nowIso = new Date().toISOString()
    const proyectoUpdatePayload = {
      execution_status: PROJECT_EXECUTION_STATES.PREPARING_DELIVERY,
      current_phase: PROJECT_EXECUTION_PHASES.DELIVERY,
      status_updated_at: nowIso,
      status_updated_by: user.id,
    } as never

    const { data: updated, error: updateError } = await admin
      .from('doa_projects' as never)
      .update(proyectoUpdatePayload)
      .eq('id', id)
      .select('id, project_number, execution_status, current_phase, status_updated_at')
      .single()

    if (updateError) {
      await logServerEvent({
        eventName: 'project.delivery.prepared',
        eventCategory: 'project',
        outcome: 'failure',
        severity: 'error',
        actorUserId: user.id,
        requestId: requestContext.requestId,
        route: requestContext.route,
        method: request.method,
        entityType: 'project',
        entityId: id,
        metadata: {
          stage: 'transition_state',
          delivery_id: delivery.id,
          intended_state: PROJECT_EXECUTION_STATES.PREPARING_DELIVERY,
          error_message: updateError.message,
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
      return jsonResponse(500, {
        error:
          `Delivery creado (${delivery.id}) pero la transicion a preparing_delivery failed: ${updateError.message}. Requiere recuperacion manual.`,
        delivery_id: delivery.id,
      })
    }

    // 9. Signed URL preview (1h)
    const { data: signed } = await admin.storage
      .from(DELIVERY_BUCKET)
      .createSignedUrl(storagePath, 3600)

    await logServerEvent({
      eventName: 'project.delivery.prepared',
      eventCategory: 'project',
      outcome: 'success',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'project',
      entityId: id,
      metadata: {
        delivery_id: delivery.id,
        validation_id: validation.id,
        validation_signature_id: approvalSignature.id,
        storage_path: storagePath,
        soc_pdf_sha256: sha256Hex,
        deliverables_count: deliverables.length,
        from_state: PROJECT_EXECUTION_STATES.VALIDATED,
        to_state: PROJECT_EXECUTION_STATES.PREPARING_DELIVERY,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return jsonResponse(200, {
      delivery_id: delivery.id,
      soc_pdf_storage_path: storagePath,
      soc_pdf_sha256: sha256Hex,
      signed_url_preview: signed?.signedUrl ?? null,
      project: updated,
    })
  } catch (error) {
    console.error('prepare-delivery POST error:', error)

    await logServerEvent({
      eventName: 'project.delivery.prepared',
      eventCategory: 'project',
      outcome: 'failure',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'project',
      entityId: id,
      metadata: {
        error_message:
          error instanceof Error ? error.message : 'Unknown error',
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Error inesperado.',
    })
  }
}
