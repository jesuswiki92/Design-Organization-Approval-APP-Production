/**
 * GET /api/projects/[id]/deliveries/[deliveryId]/soc-pdf  — Sprint 3
 * Redirige (302) a una signed URL fresca del PDF SoC almacenado en Storage.
 * Auth requerida: solo users de la organizacion pueden ver el PDF.
 */

import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const DELIVERY_BUCKET = 'doa-deliverables'

function jsonResponse(status: number, data: unknown) {
  return Response.json(data, { status })
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string; deliveryId: string }> },
) {
  const auth = await requireUserApi()
  if (auth instanceof Response) return auth
  const { supabase } = auth
  const { id, deliveryId } = await context.params

  if (!id || !deliveryId) {
    return jsonResponse(400, { error: 'project_id y deliveryId requeridos.' })
  }

  const { data: dRow, error: dErr } = await supabase
    .from('doa_project_deliveries')
    .select('id, project_id, soc_pdf_storage_path')
    .eq('id', deliveryId)
    .eq('project_id', id)
    .maybeSingle()

  if (dErr) return jsonResponse(500, { error: dErr.message })
  if (!dRow) {
    return jsonResponse(404, { error: 'Delivery no encontrada o no pertenece al project.' })
  }

  const path = (dRow as { soc_pdf_storage_path: string | null }).soc_pdf_storage_path
  if (!path) {
    return jsonResponse(404, { error: 'La delivery no tiene PDF asociado.' })
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (e) {
    return jsonResponse(500, {
      error: 'Admin client no disponible. ' + (e instanceof Error ? e.message : ''),
    })
  }

  const { data: signed, error: sErr } = await admin.storage
    .from(DELIVERY_BUCKET)
    .createSignedUrl(path, 3600)

  if (sErr || !signed?.signedUrl) {
    return jsonResponse(500, {
      error: `No se pudo generar signed URL: ${sErr?.message ?? 'unknown'}`,
    })
  }

  return Response.redirect(signed.signedUrl, 302)
}
