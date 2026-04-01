import type {
  WorkflowStateColorToken,
  WorkflowStateConfigRow,
  WorkflowStateScope,
} from '@/types/database'
import {
  CONSULTA_ESTADOS,
  CONSULTA_STATE_CONFIG,
  QUOTATION_BOARD_STATE_CONFIG,
  QUOTATION_BOARD_STATES,
  type EstadoConsulta,
  type QuotationBoardState,
} from '@/lib/workflow-states'

export const WORKFLOW_STATE_SCOPES = {
  INCOMING_QUERIES: 'incoming_queries',
  QUOTATION_BOARD: 'quotation_board',
} as const satisfies Record<string, WorkflowStateScope>

export const WORKFLOW_STATE_COLOR_TOKENS = [
  'sky',
  'cyan',
  'emerald',
  'amber',
  'violet',
  'indigo',
  'slate',
  'blue',
  'green',
  'yellow',
  'rose',
] as const satisfies readonly WorkflowStateColorToken[]

export type WorkflowBadgeStyle = {
  color: string
}

export type WorkflowBoardAccent = {
  bg: string
  border: string
  dot: string
  text: string
  chip: string
}

export type ResolvedWorkflowStateMeta = WorkflowStateConfigRow & {
  short_label: string
  badge: WorkflowBadgeStyle
  boardAccent: WorkflowBoardAccent
}

type WorkflowStateDefaultsMap = Record<string, WorkflowStateConfigRow>

const COLOR_STYLE_MAP: Record<
  WorkflowStateColorToken,
  { badge: WorkflowBadgeStyle; boardAccent: WorkflowBoardAccent; editorChip: string; label: string }
> = {
  sky: {
    label: 'Sky',
    badge: { color: 'bg-sky-500/20 text-sky-400 border-sky-500/30' },
    boardAccent: {
      bg: 'bg-sky-50',
      border: 'border-sky-200',
      dot: 'bg-sky-500',
      text: 'text-sky-700',
      chip: 'border-sky-200 bg-white/90 text-sky-700',
    },
    editorChip: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  cyan: {
    label: 'Cyan',
    badge: { color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
    boardAccent: {
      bg: 'bg-cyan-50',
      border: 'border-cyan-200',
      dot: 'bg-cyan-500',
      text: 'text-cyan-700',
      chip: 'border-cyan-200 bg-white/90 text-cyan-700',
    },
    editorChip: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  },
  emerald: {
    label: 'Emerald',
    badge: { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    boardAccent: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      dot: 'bg-emerald-500',
      text: 'text-emerald-700',
      chip: 'border-emerald-200 bg-white/90 text-emerald-700',
    },
    editorChip: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  amber: {
    label: 'Amber',
    badge: { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    boardAccent: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      dot: 'bg-amber-500',
      text: 'text-amber-700',
      chip: 'border-amber-200 bg-white/90 text-amber-700',
    },
    editorChip: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  violet: {
    label: 'Violet',
    badge: { color: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
    boardAccent: {
      bg: 'bg-violet-50',
      border: 'border-violet-200',
      dot: 'bg-violet-500',
      text: 'text-violet-700',
      chip: 'border-violet-200 bg-white/90 text-violet-700',
    },
    editorChip: 'border-violet-200 bg-violet-50 text-violet-700',
  },
  indigo: {
    label: 'Indigo',
    badge: { color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
    boardAccent: {
      bg: 'bg-indigo-50',
      border: 'border-indigo-200',
      dot: 'bg-indigo-500',
      text: 'text-indigo-700',
      chip: 'border-indigo-200 bg-white/90 text-indigo-700',
    },
    editorChip: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  },
  slate: {
    label: 'Slate',
    badge: { color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
    boardAccent: {
      bg: 'bg-slate-50',
      border: 'border-slate-200',
      dot: 'bg-slate-500',
      text: 'text-slate-700',
      chip: 'border-slate-200 bg-white/90 text-slate-700',
    },
    editorChip: 'border-slate-200 bg-slate-50 text-slate-700',
  },
  blue: {
    label: 'Blue',
    badge: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    boardAccent: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      dot: 'bg-blue-500',
      text: 'text-blue-700',
      chip: 'border-blue-200 bg-white/90 text-blue-700',
    },
    editorChip: 'border-blue-200 bg-blue-50 text-blue-700',
  },
  green: {
    label: 'Green',
    badge: { color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    boardAccent: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      dot: 'bg-green-500',
      text: 'text-green-700',
      chip: 'border-green-200 bg-white/90 text-green-700',
    },
    editorChip: 'border-green-200 bg-green-50 text-green-700',
  },
  yellow: {
    label: 'Yellow',
    badge: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    boardAccent: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      dot: 'bg-yellow-500',
      text: 'text-yellow-700',
      chip: 'border-yellow-200 bg-white/90 text-yellow-700',
    },
    editorChip: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  },
  rose: {
    label: 'Rose',
    badge: { color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
    boardAccent: {
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      dot: 'bg-rose-500',
      text: 'text-rose-700',
      chip: 'border-rose-200 bg-white/90 text-rose-700',
    },
    editorChip: 'border-rose-200 bg-rose-50 text-rose-700',
  },
}

const QUOTATION_BOARD_DEFAULT_ROWS: WorkflowStateConfigRow[] = [
  {
    scope: WORKFLOW_STATE_SCOPES.QUOTATION_BOARD,
    state_code: QUOTATION_BOARD_STATES.ENTRADA_RECIBIDA,
    label: QUOTATION_BOARD_STATE_CONFIG.entrada_recibida.label,
    short_label: QUOTATION_BOARD_STATE_CONFIG.entrada_recibida.shortLabel,
    description: QUOTATION_BOARD_STATE_CONFIG.entrada_recibida.description,
    color_token: 'sky',
    sort_order: 10,
    is_system: true,
    is_active: true,
  },
  {
    scope: WORKFLOW_STATE_SCOPES.QUOTATION_BOARD,
    state_code: QUOTATION_BOARD_STATES.TRIAGE,
    label: QUOTATION_BOARD_STATE_CONFIG.triage.label,
    short_label: QUOTATION_BOARD_STATE_CONFIG.triage.shortLabel,
    description: QUOTATION_BOARD_STATE_CONFIG.triage.description,
    color_token: 'cyan',
    sort_order: 20,
    is_system: true,
    is_active: true,
  },
  {
    scope: WORKFLOW_STATE_SCOPES.QUOTATION_BOARD,
    state_code: QUOTATION_BOARD_STATES.ALCANCE_DEFINIDO,
    label: QUOTATION_BOARD_STATE_CONFIG.alcance_definido.label,
    short_label: QUOTATION_BOARD_STATE_CONFIG.alcance_definido.shortLabel,
    description: QUOTATION_BOARD_STATE_CONFIG.alcance_definido.description,
    color_token: 'emerald',
    sort_order: 30,
    is_system: true,
    is_active: true,
  },
  {
    scope: WORKFLOW_STATE_SCOPES.QUOTATION_BOARD,
    state_code: QUOTATION_BOARD_STATES.OFERTA_EN_REDACCION,
    label: QUOTATION_BOARD_STATE_CONFIG.oferta_en_redaccion.label,
    short_label: QUOTATION_BOARD_STATE_CONFIG.oferta_en_redaccion.shortLabel,
    description: QUOTATION_BOARD_STATE_CONFIG.oferta_en_redaccion.description,
    color_token: 'amber',
    sort_order: 40,
    is_system: true,
    is_active: true,
  },
  {
    scope: WORKFLOW_STATE_SCOPES.QUOTATION_BOARD,
    state_code: QUOTATION_BOARD_STATES.REVISION_INTERNA,
    label: QUOTATION_BOARD_STATE_CONFIG.revision_interna.label,
    short_label: QUOTATION_BOARD_STATE_CONFIG.revision_interna.shortLabel,
    description: QUOTATION_BOARD_STATE_CONFIG.revision_interna.description,
    color_token: 'violet',
    sort_order: 50,
    is_system: true,
    is_active: true,
  },
  {
    scope: WORKFLOW_STATE_SCOPES.QUOTATION_BOARD,
    state_code: QUOTATION_BOARD_STATES.PENDIENTE_ENVIO,
    label: QUOTATION_BOARD_STATE_CONFIG.pendiente_envio.label,
    short_label: QUOTATION_BOARD_STATE_CONFIG.pendiente_envio.shortLabel,
    description: QUOTATION_BOARD_STATE_CONFIG.pendiente_envio.description,
    color_token: 'indigo',
    sort_order: 60,
    is_system: true,
    is_active: true,
  },
  {
    scope: WORKFLOW_STATE_SCOPES.QUOTATION_BOARD,
    state_code: QUOTATION_BOARD_STATES.SEGUIMIENTO_CIERRE,
    label: QUOTATION_BOARD_STATE_CONFIG.seguimiento_cierre.label,
    short_label: QUOTATION_BOARD_STATE_CONFIG.seguimiento_cierre.shortLabel,
    description: QUOTATION_BOARD_STATE_CONFIG.seguimiento_cierre.description,
    color_token: 'slate',
    sort_order: 70,
    is_system: true,
    is_active: true,
  },
]

const INCOMING_QUERY_DEFAULT_ROWS: WorkflowStateConfigRow[] = [
  {
    scope: WORKFLOW_STATE_SCOPES.INCOMING_QUERIES,
    state_code: CONSULTA_ESTADOS.NUEVO,
    label: CONSULTA_STATE_CONFIG.nuevo.label,
    short_label: 'Entrada',
    description: CONSULTA_STATE_CONFIG.nuevo.description,
    color_token: 'blue',
    sort_order: 10,
    is_system: true,
    is_active: true,
  },
  {
    scope: WORKFLOW_STATE_SCOPES.INCOMING_QUERIES,
    state_code: CONSULTA_ESTADOS.ESPERANDO_FORMULARIO,
    label: CONSULTA_STATE_CONFIG.esperando_formulario.label,
    short_label: 'Enviado',
    description: CONSULTA_STATE_CONFIG.esperando_formulario.description,
    color_token: 'yellow',
    sort_order: 20,
    is_system: true,
    is_active: true,
  },
  {
    scope: WORKFLOW_STATE_SCOPES.INCOMING_QUERIES,
    state_code: CONSULTA_ESTADOS.FORMULARIO_RECIBIDO,
    label: CONSULTA_STATE_CONFIG.formulario_recibido.label,
    short_label: 'Revisar',
    description: CONSULTA_STATE_CONFIG.formulario_recibido.description,
    color_token: 'green',
    sort_order: 30,
    is_system: true,
    is_active: true,
  },
]

const DEFAULT_ROWS_BY_SCOPE: Record<WorkflowStateScope, WorkflowStateConfigRow[]> = {
  incoming_queries: INCOMING_QUERY_DEFAULT_ROWS,
  quotation_board: QUOTATION_BOARD_DEFAULT_ROWS,
}

export function isWorkflowStateColorToken(value: string): value is WorkflowStateColorToken {
  return (WORKFLOW_STATE_COLOR_TOKENS as readonly string[]).includes(value)
}

export function getWorkflowStateColorStyle(colorToken: WorkflowStateColorToken) {
  return COLOR_STYLE_MAP[colorToken]
}

export function getWorkflowStateColorOptions() {
  return WORKFLOW_STATE_COLOR_TOKENS.map((token) => ({
    value: token,
    label: COLOR_STYLE_MAP[token].label,
    editorChip: COLOR_STYLE_MAP[token].editorChip,
  }))
}

export function getDefaultWorkflowStateRows(scope: WorkflowStateScope) {
  return DEFAULT_ROWS_BY_SCOPE[scope].map((row) => ({ ...row }))
}

export function getAllowedWorkflowStateCodes(scope: WorkflowStateScope) {
  return getDefaultWorkflowStateRows(scope).map((row) => row.state_code)
}

function getDefaultRowsMap(scope: WorkflowStateScope): WorkflowStateDefaultsMap {
  return Object.fromEntries(
    getDefaultWorkflowStateRows(scope).map((row) => [row.state_code, row]),
  )
}

function normalizeRow(
  row: WorkflowStateConfigRow,
  defaultRow: WorkflowStateConfigRow,
): WorkflowStateConfigRow {
  return {
    ...defaultRow,
    ...row,
    label: row.label?.trim() || defaultRow.label,
    short_label: row.short_label?.trim() || defaultRow.short_label,
    description: row.description?.trim() || defaultRow.description,
    color_token: isWorkflowStateColorToken(row.color_token)
      ? row.color_token
      : defaultRow.color_token,
    sort_order: Number.isFinite(row.sort_order) ? Math.trunc(row.sort_order) : defaultRow.sort_order,
    is_system: typeof row.is_system === 'boolean' ? row.is_system : defaultRow.is_system,
    is_active: typeof row.is_active === 'boolean' ? row.is_active : defaultRow.is_active,
  }
}

export function resolveWorkflowStateRows(
  scope: WorkflowStateScope,
  rows: WorkflowStateConfigRow[] = [],
): ResolvedWorkflowStateMeta[] {
  const defaultsMap = getDefaultRowsMap(scope)
  const overrides = new Map<string, WorkflowStateConfigRow>()

  for (const row of rows) {
    if (row.scope !== scope) continue
    if (!defaultsMap[row.state_code]) continue
    overrides.set(row.state_code, normalizeRow(row, defaultsMap[row.state_code]))
  }

  return Object.values(defaultsMap)
    .map((defaultRow) => overrides.get(defaultRow.state_code) ?? defaultRow)
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((row) => ({
      ...row,
      short_label: row.short_label?.trim() || row.label,
      description: row.description?.trim() || '',
      badge: getWorkflowStateColorStyle(row.color_token).badge,
      boardAccent: getWorkflowStateColorStyle(row.color_token).boardAccent,
    }))
}

export function replaceWorkflowStateRowsForScope(
  rows: WorkflowStateConfigRow[],
  scope: WorkflowStateScope,
  nextRows: WorkflowStateConfigRow[],
) {
  return [
    ...rows.filter((row) => row.scope !== scope),
    ...nextRows,
  ]
}

export function getResolvedIncomingQueryStatusMeta(
  estado: string,
  rows: WorkflowStateConfigRow[] = [],
) {
  const resolvedRows = resolveWorkflowStateRows(WORKFLOW_STATE_SCOPES.INCOMING_QUERIES, rows)
  const match = resolvedRows.find((row) => row.state_code === estado)

  if (!match) {
    return {
      label: estado,
      shortLabel: estado,
      description: 'Estado desconocido',
      color: COLOR_STYLE_MAP.slate.badge.color,
    }
  }

  return {
    label: match.label,
    shortLabel: match.short_label,
    description: match.description ?? '',
    color: match.badge.color,
  }
}

export function getResolvedQuotationBoardStatusMeta(
  state: string,
  rows: WorkflowStateConfigRow[] = [],
) {
  const resolvedRows = resolveWorkflowStateRows(WORKFLOW_STATE_SCOPES.QUOTATION_BOARD, rows)
  const match = resolvedRows.find((row) => row.state_code === state)

  if (!match) {
    const fallback = getWorkflowStateColorStyle('slate')

    return {
      label: state,
      shortLabel: state,
      description: 'Estado de quotations desconocido',
      colorToken: 'slate' as WorkflowStateColorToken,
      accent: fallback.boardAccent,
    }
  }

  return {
    label: match.label,
    shortLabel: match.short_label,
    description: match.description ?? '',
    colorToken: match.color_token,
    accent: match.boardAccent,
  }
}

export function isIncomingQueryStateCode(value: string): value is EstadoConsulta {
  return getAllowedWorkflowStateCodes(WORKFLOW_STATE_SCOPES.INCOMING_QUERIES).includes(value)
}

export function isQuotationBoardStateCode(value: string): value is QuotationBoardState {
  return getAllowedWorkflowStateCodes(WORKFLOW_STATE_SCOPES.QUOTATION_BOARD).includes(value)
}
