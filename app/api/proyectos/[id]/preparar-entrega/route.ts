/**
 * ============================================================================
 * POST /api/proyectos/[id]/preparar-entrega  — Sprint 3 (close-the-loop)
 * ============================================================================
 *
 * Transita un proyecto de `validado` -> `preparando_entrega`:
 *   1. Verifica que hay una validacion approved + su firma `validation_approval`.
 *   2. Construye el payload canonico del Statement of Compliance.
 *   3. Renderiza el PDF con @react-pdf/renderer, calcula SHA-256.
 *   4. Sube el PDF a Supabase Storage (bucket `doa-deliverables`).
 *   5. Genera un token aleatorio de 32 bytes (base64url) para el link de confirmacion.
 *   6. Crea una fila en `project_deliveries` con dispatch_status='pendiente'.
 *   7. Actualiza `proyectos.estado_v2 -> preparando_entrega`.
 *
 * NO envia el email — eso lo hace `enviar-entrega` al pulsar el boton.
 *
 * Inconsistencies (loguean severity=error en observability):
 *   - No hay validacion aprobada    -> 422
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
  DeliverableEstado,
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
  titulo: string
  subpart_easa: string | null
  version_actual: number
  estado: DeliverableEstado
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
    if (!id) return jsonResponse(400, { error: 'proyecto_id requerido.' })

    // 1. Cargar proyecto + validar estado
    const { data: proyecto, error: proyectoError } = await supabase
      .from('proyectos')
      .select(
        'id, numero_proyecto, titulo, descripcion, cliente_nombre, consulta_id, estado_v2, fase_actual',
      )
      .eq('id', id)
      .maybeSingle()

    if (proyectoError) return jsonResponse(500, { error: proyectoError.message })
    if (!proyecto) return jsonResponse(404, { error: 'Proyecto no encontrado.' })

    const currentState = (proyecto as { estado_v2?: string | null }).estado_v2 ?? null
    if (currentState !== PROJECT_EXECUTION_STATES.VALIDADO) {
      return jsonResponse(409, {
        error:
          `El proyecto no esta en "validado" (estado actual: "${currentState ?? 'desconocido'}"). ` +
          `Solo se admite preparar entrega desde "${PROJECT_EXECUTION_STATES.VALIDADO}".`,
        current_state: currentState,
      })
    }

    const proyectoRow = proyecto as {
      id: string
      numero_proyecto: string
      titulo: string
      descripcion: string | null
      cliente_nombre: string | null
      consulta_id: string | null
    }

    // 2. Ultima validacion aprobada + firma validation_approval
    const { data: vRow, error: vErr } = await supabase
      .from('project_validations')
      .select('*')
      .eq('proyecto_id', id)
      .eq('decision', 'aprobado')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (vErr) return jsonResponse(500, { error: vErr.message })
    if (!vRow) {
      return jsonResponse(422, {
        error:
          'No se encontro una validacion aprobada para este proyecto. ' +
          'Requiere una decision "aprobado" previa en project_validations.',
      })
    }
    const validation = vRow as ProjectValidation

    const { data: sigRow, error: sigErr } = await supabase
      .from('project_signatures')
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
          `No se encontro firma "validation_approval" para la validacion ${validation.id}. ` +
          'Sprint 2 deberia haber creado la firma; revisa project_signatures.',
      })
    }
    const approvalSignature = sigRow as ProjectSignature

    // 3. Deliverables actuales (orden estable)
    const { data: delRows, error: delErr } = await supabase
      .from('project_deliverables')
      .select('id, template_code, titulo, subpart_easa, version_actual, estado')
      .eq('proyecto_id', id)
      .order('orden', { ascending: true })

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
      console.error('preparar-entrega: admin client unavailable:', e)
    }

    // 4. Construir payload canonico + renderizar PDF
    const generatedAt = new Date().toISOString()
    const companyName = process.env.DOA_COMPANY_NAME ?? 'DOA Operations'
    const companyApproval = process.env.DOA_COMPANY_APPROVAL_NO?.trim()
    if (!companyApproval) {
      await logServerEvent({
        eventName: 'project.preparar_entrega.config_missing',
        eventCategory: 'project',
        outcome: 'failure',
        severity: 'error',
        actorUserId: user.id,
        requestId: requestContext.requestId,
        route: requestContext.route,
        method: request.method,
        entityType: 'proyecto',
        entityId: id,
        metadata: { missing_env: 'DOA_COMPANY_APPROVAL_NO' },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
      return jsonResponse(500, {
        error:
          'EASA DOA number not configured. Define DOA_COMPANY_APPROVAL_NO ' +
          '(ej: EASA.21J.NNNN) en el entorno antes de preparar la entrega. ' +
          'No se genera el SoC PDF con placeholder.',
      })
    }

    const payload = buildSoCCanonicalPayload({
      document: {
        id: `SoC-${proyectoRow.numero_proyecto}-${generatedAt}`,
        title: 'Statement of Compliance',
        generated_at: generatedAt,
        company: { name: companyName, approval_no: companyApproval },
      },
      proyecto: {
        id: proyectoRow.id,
        numero_proyecto: proyectoRow.numero_proyecto,
        titulo: proyectoRow.titulo,
        descripcion: proyectoRow.descripcion,
        cliente_nombre: proyectoRow.cliente_nombre,
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
        titulo: d.titulo,
        subpart_easa: d.subpart_easa,
        version_actual: d.version_actual,
        estado: d.estado,
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
      console.error('preparar-entrega: PDF render failed', error)
      return jsonResponse(500, {
        error:
          'Fallo al renderizar el Statement of Compliance. Verifica que @react-pdf/renderer esta instalado. ' +
          (error instanceof Error ? error.message : ''),
      })
    }

    const sha256Hex = createHash('sha256').update(pdfBuffer).digest('hex')

    // 5. Upload a Storage (usamos admin client para saltar RLS del bucket)
    const storagePath = `proyectos/${id}/deliveries/${generatedAt}/SoC.pdf`
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
        entityType: 'proyecto',
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

    // 6. Email cliente por defecto desde consulta (remitente)
    let recipientEmailDefault = ''
    if (proyectoRow.consulta_id) {
      const { data: consulta } = await supabase
        .from('consultas_entrantes')
        .select('id, remitente')
        .eq('id', proyectoRow.consulta_id)
        .maybeSingle()
      const row = consulta as { remitente?: string | null } | null
      const rem = row?.remitente?.trim() ?? ''
      // Extraer email si viene en formato "Nombre <email@x.com>"
      const match = rem.match(/<([^>]+)>/)
      recipientEmailDefault = (match?.[1] ?? rem).trim()
    }

    // 7. Token de confirmacion (32 bytes base64url)
    const confirmationToken = randomBytes(32).toString('base64url')

    const defaultSubject = `Statement of Compliance — ${proyectoRow.titulo}`

    const deliveryInsertPayload = {
      proyecto_id: id,
      validation_id: validation.id,
      signature_id: null, // se fija cuando se firma el delivery_release en enviar-entrega
      sent_by_user_id: user.id,
      recipient_email: recipientEmailDefault || 'pendiente@doa.local',
      recipient_name: proyectoRow.cliente_nombre,
      cc_emails: null,
      subject: defaultSubject,
      body: null,
      soc_pdf_storage_path: storagePath,
      soc_pdf_sha256: sha256Hex,
      attachments: [],
      dispatch_status: 'pendiente',
      client_confirmation_token: confirmationToken,
    } as never

    const { data: deliveryRow, error: insertErr } = await admin
      .from('project_deliveries' as never)
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
        entityType: 'proyecto',
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

    // 8. Transitar proyecto -> preparando_entrega
    const nowIso = new Date().toISOString()
    const proyectoUpdatePayload = {
      estado_v2: PROJECT_EXECUTION_STATES.PREPARANDO_ENTREGA,
      fase_actual: PROJECT_EXECUTION_PHASES.ENTREGA,
      estado_updated_at: nowIso,
      estado_updated_by: user.id,
    } as never

    const { data: updated, error: updateError } = await admin
      .from('proyectos' as never)
      .update(proyectoUpdatePayload)
      .eq('id', id)
      .select('id, numero_proyecto, estado_v2, fase_actual, estado_updated_at')
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
        entityType: 'proyecto',
        entityId: id,
        metadata: {
          stage: 'transition_state',
          delivery_id: delivery.id,
          intended_state: PROJECT_EXECUTION_STATES.PREPARANDO_ENTREGA,
          error_message: updateError.message,
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
      return jsonResponse(500, {
        error:
          `Delivery creado (${delivery.id}) pero la transicion a preparando_entrega fallo: ${updateError.message}. Requiere recuperacion manual.`,
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
      entityType: 'proyecto',
      entityId: id,
      metadata: {
        delivery_id: delivery.id,
        validation_id: validation.id,
        validation_signature_id: approvalSignature.id,
        storage_path: storagePath,
        soc_pdf_sha256: sha256Hex,
        deliverables_count: deliverables.length,
        from_state: PROJECT_EXECUTION_STATES.VALIDADO,
        to_state: PROJECT_EXECUTION_STATES.PREPARANDO_ENTREGA,
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
      proyecto: updated,
    })
  } catch (error) {
    console.error('preparar-entrega POST error:', error)

    await logServerEvent({
      eventName: 'project.delivery.prepared',
      eventCategory: 'project',
      outcome: 'failure',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'proyecto',
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
