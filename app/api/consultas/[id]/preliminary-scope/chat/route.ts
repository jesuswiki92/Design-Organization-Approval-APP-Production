import OpenAI from 'openai'
import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import {
  buildPreliminaryScopeModel,
  formatPreliminaryScopeChatContext,
  type PreliminaryScopeAircraftVariant,
  type PreliminaryScopeReferenceProject,
} from '@/lib/quotations/build-preliminary-scope-model'
import { extractPhase4BaselineFromSummary } from '@/lib/project-summary-phase4'
import type { ConsultaEntrante } from '@/types/database'

export const runtime = 'nodejs'

type ChatHistoryItem = {
  content: string
  role: 'assistant' | 'system' | 'user'
}

type ConsultationRow = ConsultaEntrante & {
  proyectos_referencia?: string[] | null
}

type AuthSuccess = Exclude<Awaited<ReturnType<typeof requireUserApi>>, Response>

const DEFAULT_OPENROUTER_MODEL = 'anthropic/claude-sonnet-4'

const SYSTEM_PROMPT = [
  'You are a DOA engineering copilot working on the preliminary scope stage of an incoming quotation.',
  'Answer in the same language as the user, clearly and practically.',
  'Use the supplied server-side context only. Distinguish client-provided facts, DOA inference, precedent contribution, and missing information.',
  'Certification route is an internal DOA / engineering inference, not a client input.',
  'If the precedent lacks fields, treat that as incomplete documentation, not as proof that the impact does not exist.',
  'Do not claim that you searched databases or documents beyond the supplied context.',
].join(' ')

function jsonResponse(status: number, error: string) {
  return Response.json({ error }, { status })
}

function normalizeHistory(history: unknown): ChatHistoryItem[] {
  if (!Array.isArray(history)) return []

  return history
    .filter((item): item is ChatHistoryItem => {
      if (!item || typeof item !== 'object') return false

      const role = (item as { role?: unknown }).role
      const content = (item as { content?: unknown }).content

      return (
        (role === 'assistant' || role === 'system' || role === 'user') &&
        typeof content === 'string' &&
        content.trim().length > 0
      )
    })
    .slice(-12)
}

function sseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

async function getPrimaryAircraftVariant(
  supabase: AuthSuccess['supabase'],
  consultation: ConsultaEntrante,
) {
  let variants: PreliminaryScopeAircraftVariant[] = []

  if (consultation.tcds_number) {
    const { data } = await supabase
      .from('doa_aeronaves')
      .select(
        'fabricante, modelo, mtow_kg, msn_elegibles, regulacion_base, tcds_code, tcds_code_short',
      )
      .eq('tcds_code', consultation.tcds_number)

    variants = (data ?? []) as PreliminaryScopeAircraftVariant[]
  }

  if (variants.length === 0 && (consultation.aircraft_model || consultation.aircraft_manufacturer)) {
    let fallbackQuery = supabase
      .from('doa_aeronaves')
      .select(
        'fabricante, modelo, mtow_kg, msn_elegibles, regulacion_base, tcds_code, tcds_code_short',
      )

    if (consultation.aircraft_model) {
      fallbackQuery = fallbackQuery.ilike('modelo', `%${consultation.aircraft_model}%`)
    } else if (consultation.aircraft_manufacturer) {
      fallbackQuery = fallbackQuery.ilike('fabricante', `%${consultation.aircraft_manufacturer}%`)
    }

    const { data } = await fallbackQuery.limit(10)
    variants = (data ?? []) as PreliminaryScopeAircraftVariant[]
  }

  if (variants.length === 0) return null

  return (
    variants.find(
      (variant) =>
        consultation.aircraft_model &&
        variant.modelo.toLowerCase() === consultation.aircraft_model.toLowerCase(),
    ) ??
    variants[0] ??
    null
  )
}

function sortReferencesBySelectionOrder(
  references: PreliminaryScopeReferenceProject[],
  referenceIds: string[],
  selectedReferenceId: string | null,
) {
  const order = new Map<string, number>()
  referenceIds.forEach((id, index) => {
    order.set(id, index)
  })

  return [...references].sort((left, right) => {
    if (selectedReferenceId) {
      if (left.id === selectedReferenceId) return -1
      if (right.id === selectedReferenceId) return 1
    }

    return (order.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(right.id) ?? Number.MAX_SAFE_INTEGER)
  })
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireUserApi()
    if (auth instanceof Response) return auth

    const { supabase } = auth
    const { id } = await context.params

    if (!id) {
      return jsonResponse(400, 'Consulta no valida.')
    }

    const body = (await request.json()) as {
      history?: unknown
      question?: unknown
      selectedReferenceId?: unknown
    }

    const question = typeof body.question === 'string' ? body.question.trim() : ''
    if (!question) {
      return jsonResponse(400, 'Question is required.')
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return jsonResponse(500, 'OPENROUTER_API_KEY is not configured.')
    }

    const { data: consultationRowRaw, error: consultationError } = await supabase
      .from('doa_consultas_entrantes')
      .select(
        [
          'id',
          'created_at',
          'asunto',
          'remitente',
          'cuerpo_original',
          'clasificacion',
          'respuesta_ia',
          'estado',
          'numero_entrada',
          'url_formulario',
          'correo_cliente_enviado_at',
          'correo_cliente_enviado_by',
          'ultimo_borrador_cliente',
          'tcds_number',
          'aircraft_manufacturer',
          'aircraft_model',
          'aircraft_count',
          'aircraft_msn',
          'tcds_pdf_url',
          'work_type',
          'existing_project_code',
          'modification_summary',
          'operational_goal',
          'has_equipment',
          'equipment_details',
          'has_drawings',
          'has_previous_mod',
          'previous_mod_ref',
          'has_manufacturer_docs',
          'target_date',
          'is_aog',
          'aircraft_location',
          'additional_notes',
          'reply_body',
          'reply_sent_at',
          'proyectos_referencia',
        ].join(','),
      )
      .eq('id', id)
      .maybeSingle()

    if (consultationError) {
      return jsonResponse(500, consultationError.message)
    }

    const consultationRow = consultationRowRaw as ConsultationRow | null

    if (!consultationRow) {
      return jsonResponse(404, 'Consulta no encontrada.')
    }

    const referenceIds = Array.isArray(consultationRow.proyectos_referencia)
      ? consultationRow.proyectos_referencia
      : []
    const requestedReferenceId =
      typeof body.selectedReferenceId === 'string' && referenceIds.includes(body.selectedReferenceId)
        ? body.selectedReferenceId
        : null

    let referenceProjects: PreliminaryScopeReferenceProject[] = []

    if (referenceIds.length > 0) {
      const { data: referenceRows, error: referencesError } = await supabase
        .from('doa_proyectos_historico')
        .select('id, numero_proyecto, titulo, aeronave, anio, created_at, summary_md')
        .in('id', referenceIds)

      if (referencesError) {
        return jsonResponse(500, referencesError.message)
      }

      referenceProjects = sortReferencesBySelectionOrder(
        (referenceRows ?? []).map((project) => ({
          aeronave: project.aeronave,
          anio: project.anio,
          baseline: extractPhase4BaselineFromSummary(project.summary_md, {
            aircraftLabel: project.aeronave,
            projectCode: project.numero_proyecto,
            projectTitle: project.titulo,
          }),
          created_at: project.created_at,
          id: project.id,
          numero_proyecto: project.numero_proyecto,
          summary_md: project.summary_md,
          titulo: project.titulo,
        })),
        referenceIds,
        requestedReferenceId,
      )
    }

    const primaryAircraftVariant = await getPrimaryAircraftVariant(supabase, consultationRow)
    const model = buildPreliminaryScopeModel({
      clientLabel: consultationRow.remitente,
      consultation: consultationRow,
      primaryAircraftVariant,
      referenceProjects,
    })

    const modelName = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL
    const history = normalizeHistory(body.history)
    const openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    })

    const completion = await openai.chat.completions.create(
      {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'system', content: formatPreliminaryScopeChatContext(model) },
          ...history.map((item) => ({
            content: item.content,
            role: item.role,
          })),
          { role: 'user', content: question },
        ],
        model: modelName,
        stream: true,
        temperature: 0.25,
      },
      {
        headers: {
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'DOA Preliminary Scope Copilot',
        },
      },
    )

    const encoder = new TextEncoder()

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let fullAnswer = ''

        try {
          controller.enqueue(encoder.encode(sseEvent('meta', { model: modelName })))

          for await (const chunk of completion) {
            const token = chunk.choices[0]?.delta?.content ?? ''
            if (!token) continue

            fullAnswer += token
            controller.enqueue(encoder.encode(sseEvent('token', { token })))
          }

          controller.enqueue(
            encoder.encode(sseEvent('done', { answer: fullAnswer, model: modelName })),
          )
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unexpected error while streaming.'
          controller.enqueue(encoder.encode(sseEvent('error', { error: message })))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Content-Type': 'text/event-stream; charset=utf-8',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.'
    return jsonResponse(500, message)
  }
}
