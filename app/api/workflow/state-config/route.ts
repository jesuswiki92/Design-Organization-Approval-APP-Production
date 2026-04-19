import { NextRequest } from 'next/server'

import { isMissingSchemaError } from '@/lib/supabase/errors'
import { createClient } from '@/lib/supabase/server'
import {
  getAllowedWorkflowStateCodes,
  isWorkflowStateColorToken,
  resolveWorkflowStateRows,
  WORKFLOW_STATE_SCOPES,
} from '@/lib/workflow-state-config'
import type {
  WorkflowStateColorToken,
  WorkflowStateConfigRow,
  WorkflowStateScope,
} from '@/types/database'

export const runtime = 'nodejs'

type WorkflowStateConfigPayload = {
  scope?: unknown
  states?: unknown
}

type WorkflowStateMutationInput = {
  stateCode: string
  label: string
  shortLabel: string | null
  description: string | null
  colorToken: WorkflowStateColorToken
  sortOrder: number
}

function jsonResponse(status: number, error: string) {
  return Response.json({ error }, { status })
}

function isWorkflowStateScope(value: string): value is WorkflowStateScope {
  return Object.values(WORKFLOW_STATE_SCOPES).includes(value as WorkflowStateScope)
}

function normalizeMutationInput(
  value: unknown,
  allowedStateCodes: string[],
): WorkflowStateMutationInput | null {
  if (!value || typeof value !== 'object') return null

  const candidate = value as Record<string, unknown>
  const stateCode = typeof candidate.stateCode === 'string' ? candidate.stateCode.trim() : ''
  const label = typeof candidate.label === 'string' ? candidate.label.trim() : ''
  const shortLabel =
    typeof candidate.shortLabel === 'string' ? candidate.shortLabel.trim() : ''
  const description =
    typeof candidate.description === 'string' ? candidate.description.trim() : ''
  const colorToken = typeof candidate.colorToken === 'string' ? candidate.colorToken.trim() : ''
  const sortOrder = Number(candidate.sortOrder)

  if (!stateCode || !allowedStateCodes.includes(stateCode)) return null
  if (!label) return null
  if (!isWorkflowStateColorToken(colorToken)) return null
  if (!Number.isFinite(sortOrder)) return null

  return {
    stateCode,
    label,
    shortLabel: shortLabel || null,
    description: description || null,
    colorToken,
    sortOrder: Math.trunc(sortOrder),
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as WorkflowStateConfigPayload
    const scope = typeof body.scope === 'string' ? body.scope.trim() : ''

    if (!scope || !isWorkflowStateScope(scope)) {
      return jsonResponse(400, 'Scope de workflow no válido.')
    }

    if (!Array.isArray(body.states) || body.states.length === 0) {
      return jsonResponse(400, 'Debes enviar al menos un estado para guardar.')
    }

    const allowedStateCodes = getAllowedWorkflowStateCodes(scope)
    const states = body.states
      .map((state) => normalizeMutationInput(state, allowedStateCodes))
      .filter((state): state is WorkflowStateMutationInput => state !== null)

    if (states.length !== allowedStateCodes.length) {
      return jsonResponse(
        400,
        'La configuración enviada no coincide con el conjunto esperado de estados del workflow.',
      )
    }

    const uniqueCodes = new Set(states.map((state) => state.stateCode))
    if (uniqueCodes.size !== states.length) {
      return jsonResponse(400, 'Hay estados duplicados en la configuración enviada.')
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return jsonResponse(401, 'Necesitas iniciar sesión para modificar los estados.')
    }

    const payload: WorkflowStateConfigRow[] = states.map((state) => ({
      scope,
      state_code: state.stateCode,
      label: state.label,
      short_label: state.shortLabel,
      description: state.description,
      color_token: state.colorToken,
      sort_order: state.sortOrder,
      is_system: true,
      is_active: true,
    }))

    const { data, error } = await supabase
      .from('workflow_state_config')
      .upsert(payload, { onConflict: 'scope,state_code' })
      .select(
        'id, scope, state_code, label, short_label, description, color_token, sort_order, is_system, is_active, created_at, updated_at',
      )

    if (error) {
      if (isMissingSchemaError(error)) {
        return jsonResponse(
          409,
          'La tabla public.workflow_state_config no está lista todavía. Aplica primero la migración de Supabase.',
        )
      }

      return jsonResponse(
        500,
        `No se pudo guardar la configuración de estados: ${error.message}`,
      )
    }

    return Response.json({
      ok: true,
      scope,
      rows: resolveWorkflowStateRows(scope, (data ?? []) as WorkflowStateConfigRow[]),
    })
  } catch (error) {
    console.error('workflow state config POST error:', error)
    return jsonResponse(
      500,
      error instanceof Error ? error.message : 'Unexpected server error.',
    )
  }
}
