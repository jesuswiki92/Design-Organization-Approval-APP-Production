/**
 * ============================================================================
 * POST /api/projects/[id]/send-delivery  — Sprint 3 (close-the-loop)
 * ============================================================================
 *
 * Firma `delivery_release` via HMAC, empuja el email a n8n con el PDF y la URL
 * de confirmacion publica, y transita el project a `delivered`.
 *
 * Body JSON:
 *   {
 *     delivery_id: string,
 *     recipient_email: string,
 *     recipient_name?: string,
 *     cc_emails?: string[],
 *     subject?: string,
 *     body?: string,
 *   }
 *
 * Flujo:
 *   1. Validar execution_status = 'preparing_delivery' y que la delivery pertenece al project.
 *   2. Computar HMAC sobre el payload del release.
 *   3. INSERT firma `delivery_release` en doa_project_signatures.
 *   4. UPDATE delivery con signature_id, campos del email, dispatch_status='sending'.
 *   5. POST al webhook de n8n con el PDF URL firmado + confirmation_link.
 *        - 2xx -> dispatch_status='sent', dispatched_at=now; transit -> delivered.
 *        - !2xx / error -> dispatch_status='failed'; no hay transicion.
 */

import { NextRequest } from 'next/server'
import { createHmac } from 'node:crypto'

import { requireUserApi } from '@/lib/auth/require-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { logServerEvent } from '@/lib/observability/server'
import { buildRequestContext } from '@/lib/observability/shared'
import { computeSignature } from '@/lib/signatures/hmac'
import { resolveN8nSharedSecret } from '@/lib/security/n8n-outbound'
import {
  PROJECT_EXECUTION_PHASES,
  PROJECT_EXECUTION_STATES,
} from '@/lib/workflow-states'
import type { ProjectDelivery } from '@/types/database'

export const runtime = 'nodejs'

const DELIVERY_BUCKET = 'doa-deliverables'
const N8N_TIMEOUT_MS = 10_000

function jsonResponse(status: number, data: unknown) {
  return Response.json(data, { status })
}

function parseEmailList(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null
  const out = raw
    .map((e) => (typeof e === 'string' ? e.trim() : ''))
    .filter((e) => e.length > 0)
  return out.length > 0 ? out : null
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

    let body: Record<string, unknown> = {}
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return jsonResponse(400, { error: 'Body JSON invalido.' })
    }

    const deliveryId =
      typeof body.delivery_id === 'string' ? body.delivery_id.trim() : ''
    const recipientEmail =
      typeof body.recipient_email === 'string' ? body.recipient_email.trim() : ''
    const recipientName =
      typeof body.recipient_name === 'string' && body.recipient_name.trim()
        ? body.recipient_name.trim()
        : null
    const ccEmails = parseEmailList(body.cc_emails)
    const subjectOverride =
      typeof body.subject === 'string' && body.subject.trim()
        ? body.subject.trim()
        : null
    const bodyOverride =
      typeof body.body === 'string' && body.body.trim() ? body.body : null

    if (!deliveryId) return jsonResponse(400, { error: 'delivery_id requerido.' })
    if (!recipientEmail || !recipientEmail.includes('@')) {
      return jsonResponse(400, { error: 'recipient_email invalido.' })
    }

    if (!process.env.DOA_SIGNATURE_HMAC_SECRET) {
      return jsonResponse(500, {
        error:
          'Signature secret not configured. Set DOA_SIGNATURE_HMAC_SECRET in environment.',
      })
    }

    const webhookUrl = process.env.N8N_DELIVERY_WEBHOOK_URL
    if (!webhookUrl) {
      return jsonResponse(500, {
        error:
          'N8N_DELIVERY_WEBHOOK_URL no configurada. Define la URL del webhook n8n en env.',
      })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl) {
      return jsonResponse(500, {
        error:
          'NEXT_PUBLIC_APP_URL no configurada. Necesaria para construir el link de confirmacion.',
      })
    }

    // 1. Cargar project + delivery
    const { data: project, error: proyectoError } = await supabase
      .from('doa_projects')
      .select('id, project_number, title, execution_status')
      .eq('id', id)
      .maybeSingle()

    if (proyectoError) return jsonResponse(500, { error: proyectoError.message })
    if (!project) return jsonResponse(404, { error: 'Project no encontrado.' })

    const currentState = (project as { execution_status?: string | null }).execution_status ?? null
    if (currentState !== PROJECT_EXECUTION_STATES.PREPARING_DELIVERY) {
      return jsonResponse(409, {
        error:
          `El project no esta en "preparing_delivery" (status actual: "${currentState ?? 'desconocido'}"). ` +
          `Solo se admite send delivery desde "${PROJECT_EXECUTION_STATES.PREPARING_DELIVERY}".`,
        current_state: currentState,
      })
    }

    const { data: dRow, error: dErr } = await supabase
      .from('doa_project_deliveries')
      .select('*')
      .eq('id', deliveryId)
      .eq('project_id', id)
      .maybeSingle()

    if (dErr) return jsonResponse(500, { error: dErr.message })
    if (!dRow) {
      return jsonResponse(404, { error: 'Delivery no encontrada o no pertenece al project.' })
    }
    const delivery = dRow as ProjectDelivery
    if (delivery.dispatch_status !== 'pending') {
      return jsonResponse(409, {
        error: `La delivery ya fue procesada (dispatch_status="${delivery.dispatch_status}").`,
      })
    }

    // 2. Payload firmado
    const nowIso = new Date().toISOString()
    const signedPayload = {
      project_id: id,
      delivery_id: delivery.id,
      validation_id: delivery.validation_id,
      recipient_email: recipientEmail,
      soc_pdf_sha256: delivery.soc_pdf_sha256,
      signer_user_id: user.id,
      timestamp: nowIso,
    }

    let signatureComputed
    try {
      signatureComputed = computeSignature(signedPayload)
    } catch (error) {
      return jsonResponse(500, {
        error:
          'No se pudo computar la firma HMAC de release: ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      })
    }

    // Admin client (bypass RLS para insert signature y update delivery + project)
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

    // 3. Insert firma delivery_release
    const signatureInsertPayload = {
      project_id: id,
      validation_id: delivery.validation_id,
      signer_user_id: user.id,
      signer_role: 'staff',
      signature_type: 'delivery_release',
      payload_hash: signatureComputed.payloadHash,
      hmac_signature: signatureComputed.hmacSignature,
      hmac_key_id: signatureComputed.hmacKeyId,
      signed_payload: signedPayload,
    } as never

    const { data: sigRow, error: sigErr } = await admin
      .from('doa_project_signatures' as never)
      .insert(signatureInsertPayload)
      .select('id')
      .single()

    if (sigErr || !sigRow) {
      await logServerEvent({
        eventName: 'project.delivery.send_failed',
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
          stage: 'insert_signature',
          delivery_id: delivery.id,
          error_message: sigErr?.message ?? 'insert_signature_failed',
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
      return jsonResponse(500, {
        error: `No se pudo persistir la firma delivery_release: ${sigErr?.message ?? 'unknown'}`,
      })
    }

    const signatureId = (sigRow as { id: string }).id

    // 4. UPDATE delivery -> sending + campos email
    const subject = subjectOverride ?? delivery.subject
    const finalBody =
      bodyOverride ??
      delivery.body ??
      `Estimado client,\n\nAdjuntamos el Statement of Compliance del project ${
        (project as { project_number?: string | null }).project_number ?? ''
      }.\n\nConfirma la recepcion pulsando el enlace incluido en este email.\n\nUn saludo,\nDOA Operations`

    const deliveryPreparePayload = {
      signature_id: signatureId,
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      cc_emails: ccEmails,
      subject,
      body: finalBody,
      dispatch_status: 'sending',
    } as never

    const { error: updDelErr } = await admin
      .from('doa_project_deliveries' as never)
      .update(deliveryPreparePayload)
      .eq('id', delivery.id)

    if (updDelErr) {
      return jsonResponse(500, {
        error: `Firma creada pero no se pudo actualizar la delivery: ${updDelErr.message}`,
      })
    }

    // 5. Signed URL fresca para el PDF (1h)
    if (!delivery.soc_pdf_storage_path) {
      return jsonResponse(500, {
        error: 'La delivery no tiene soc_pdf_storage_path; recrea el prepare-delivery.',
      })
    }
    const { data: signed, error: signedErr } = await admin.storage
      .from(DELIVERY_BUCKET)
      .createSignedUrl(delivery.soc_pdf_storage_path, 3600)

    if (signedErr || !signed?.signedUrl) {
      return jsonResponse(500, {
        error: `No se pudo generar signed URL para el PDF: ${signedErr?.message ?? 'unknown'}`,
      })
    }

    const confirmationLink = `${appUrl.replace(/\/$/, '')}/api/projects/${id}/confirm-delivery?token=${encodeURIComponent(
      delivery.client_confirmation_token ?? '',
    )}`

    const webhookBody = {
      delivery_id: delivery.id,
      project_id: id,
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      cc_emails: ccEmails,
      subject,
      body: finalBody,
      soc_pdf_signed_url: signed.signedUrl,
      soc_pdf_sha256: delivery.soc_pdf_sha256,
      confirmation_link: confirmationLink,
    }
    const webhookBodyStr = JSON.stringify(webhookBody)

    // 6. POST a n8n con AbortController timeout 10s
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    // Canonical name is DOA_N8N_INBOUND_SECRET; DOA_N8N_WEBHOOK_SECRET kept
    // as a legacy fallback. See lib/security/n8n-outbound.ts.
    const n8nSecret = resolveN8nSharedSecret()
    if (n8nSecret) {
      const sig = createHmac('sha256', n8nSecret).update(webhookBodyStr).digest('hex')
      headers['x-doa-signature'] = sig
    } else if (process.env.NODE_ENV === 'production') {
      // Block 5 / Item G: en produccion la firma es obligatoria. Si falta el
      // secreto, no despachamos al webhook — registramos severity=error y
      // devolvemos 500 con mensaje claro.
      await logServerEvent({
        eventName: 'project.delivery.send_failed',
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
          stage: 'hmac_secret_missing',
          reason: 'n8n shared secret no definido en produccion',
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
      return jsonResponse(500, {
        error:
          'Configuracion invalida: DOA_N8N_INBOUND_SECRET (o DOA_N8N_WEBHOOK_SECRET como fallback) es obligatorio en produccion. ' +
          'Define el secreto compartido antes de despachar deliveries.',
      })
    } else {
      console.warn(
        'send-delivery: DOA_N8N_INBOUND_SECRET/DOA_N8N_WEBHOOK_SECRET no definido (modo dev), llamada sin firma. En produccion esta path devolvera 500.',
      )
    }

    let n8nOk = false
    let n8nStatus = 0
    let n8nExecutionId: string | null = null
    let n8nErrorMessage: string | null = null

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: webhookBodyStr,
        signal: controller.signal,
      })
      n8nStatus = res.status
      n8nOk = res.ok
      try {
        const respJson = (await res.json()) as { execution_id?: string | null }
        if (respJson && typeof respJson.execution_id === 'string') {
          n8nExecutionId = respJson.execution_id
        }
      } catch {
        // response sin JSON es aceptable si es 2xx
      }
      if (!n8nOk) {
        n8nErrorMessage = `n8n respondio HTTP ${n8nStatus}`
      }
    } catch (error) {
      n8nOk = false
      n8nErrorMessage =
        error instanceof Error ? error.message : 'Unknown n8n error'
    } finally {
      clearTimeout(timer)
    }

    if (!n8nOk) {
      await admin
        .from('doa_project_deliveries' as never)
        .update({ dispatch_status: 'failed' } as never)
        .eq('id', delivery.id)

      await logServerEvent({
        eventName: 'project.delivery.send_failed',
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
          delivery_id: delivery.id,
          signature_id: signatureId,
          n8n_status: n8nStatus,
          error_message: n8nErrorMessage,
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })

      return jsonResponse(502, {
        error: `El webhook n8n failed: ${n8nErrorMessage ?? 'desconocido'}.`,
        delivery_id: delivery.id,
        dispatch_status: 'failed',
      })
    }

    // 7. Success: marcar sent + transicionar a delivered
    const sentAt = new Date().toISOString()
    const deliveryFinalPayload = {
      dispatch_status: 'sent',
      dispatched_at: sentAt,
      n8n_execution_id: n8nExecutionId,
    } as never

    const { data: updatedDelivery, error: finalDelErr } = await admin
      .from('doa_project_deliveries' as never)
      .update(deliveryFinalPayload)
      .eq('id', delivery.id)
      .select('*')
      .single()

    if (finalDelErr) {
      return jsonResponse(500, {
        error: `n8n OK pero no se pudo marcar sent: ${finalDelErr.message}`,
      })
    }

    const proyectoUpdatePayload = {
      execution_status: PROJECT_EXECUTION_STATES.DELIVERED,
      current_phase: PROJECT_EXECUTION_PHASES.DELIVERY,
      status_updated_at: sentAt,
      status_updated_by: user.id,
    } as never

    const { data: updatedProyecto, error: proyectoUpdateErr } = await admin
      .from('doa_projects' as never)
      .update(proyectoUpdatePayload)
      .eq('id', id)
      .select('id, project_number, execution_status, current_phase, status_updated_at')
      .single()

    if (proyectoUpdateErr) {
      await logServerEvent({
        eventName: 'project.delivery.sent',
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
          intended_state: PROJECT_EXECUTION_STATES.DELIVERED,
          error_message: proyectoUpdateErr.message,
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
      return jsonResponse(500, {
        error: `Email sent, pero no se pudo transitar a delivered: ${proyectoUpdateErr.message}. Requiere recuperacion manual.`,
        delivery: updatedDelivery,
      })
    }

    await logServerEvent({
      eventName: 'project.delivery.sent',
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
        signature_id: signatureId,
        recipient_email: recipientEmail,
        cc_count: ccEmails?.length ?? 0,
        n8n_execution_id: n8nExecutionId,
        from_state: PROJECT_EXECUTION_STATES.PREPARING_DELIVERY,
        to_state: PROJECT_EXECUTION_STATES.DELIVERED,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return jsonResponse(200, {
      delivery: updatedDelivery,
      project: updatedProyecto,
    })
  } catch (error) {
    console.error('send-delivery POST error:', error)

    await logServerEvent({
      eventName: 'project.delivery.send_failed',
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
