import { NextResponse } from 'next/server'

import {
  getAllowedProjectTransitions,
  getAllowedQuotationTransitions,
  isProjectState,
  isQuotationState,
  requiresWorkflowReason,
} from '@/lib/workflow-states'
import { createClient } from '@/lib/supabase/server'

type TransitionBody = {
  entity?: 'project' | 'quotation'
  id?: string
  nextState?: string
  reason?: string | null
}

function isMissingSchemaError(message: string) {
  return (
    message.includes('Could not find the table') ||
    message.includes('column') ||
    message.includes('schema cache') ||
    message.includes('does not exist')
  )
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as TransitionBody | null
  if (!body?.entity || !body.id || !body.nextState) {
    return NextResponse.json({ error: 'Solicitud incompleta.' }, { status: 400 })
  }

  const entityConfig =
    body.entity === 'project'
      ? {
          table: 'doa_proyectos_generales',
          historyTable: 'doa_proyectos_estado_historial',
          foreignKey: 'proyecto_id',
        }
      : {
          table: 'doa_ofertas',
          historyTable: 'doa_ofertas_estado_historial',
          foreignKey: 'oferta_id',
        }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: currentRecord, error: currentError } = await supabase
    .from(entityConfig.table)
    .select('id,estado')
    .eq('id', body.id)
    .maybeSingle()

  if (currentError || !currentRecord) {
    return NextResponse.json({ error: 'No se encontro el registro.' }, { status: 404 })
  }

  const currentState = String(currentRecord.estado)
  const allowedTransitions =
    body.entity === 'project'
      ? getAllowedProjectTransitions(currentState)
      : getAllowedQuotationTransitions(currentState)

  if (!allowedTransitions.includes(body.nextState as never)) {
    return NextResponse.json({ error: 'Transicion no permitida.' }, { status: 400 })
  }

  if (
    (body.entity === 'project' && !isProjectState(body.nextState)) ||
    (body.entity === 'quotation' && !isQuotationState(body.nextState))
  ) {
    return NextResponse.json({ error: 'Estado de destino invalido.' }, { status: 400 })
  }

  const reason = body.reason?.trim() || null
  if (requiresWorkflowReason(body.entity, body.nextState) && !reason) {
    return NextResponse.json({ error: 'Debes indicar un motivo para este cambio.' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const updatePayload = {
    estado: body.nextState,
    estado_updated_at: now,
    estado_updated_by: user?.id ?? null,
    estado_motivo: reason,
  }

  let updateError = (
    await supabase.from(entityConfig.table).update(updatePayload).eq('id', body.id)
  ).error

  if (updateError && isMissingSchemaError(updateError.message)) {
    updateError = (await supabase.from(entityConfig.table).update({ estado: body.nextState }).eq('id', body.id))
      .error
  }

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const historyPayload = {
    [entityConfig.foreignKey]: body.id,
    estado_anterior: currentState,
    estado_nuevo: body.nextState,
    motivo: reason,
    changed_at: now,
    changed_by: user?.id ?? null,
  }

  const historyError = (
    await supabase.from(entityConfig.historyTable).insert(historyPayload)
  ).error

  if (historyError && !isMissingSchemaError(historyError.message)) {
    return NextResponse.json({ error: historyError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
