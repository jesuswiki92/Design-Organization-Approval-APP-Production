import {
  QUOTATION_BOARD_STATES,
  getQuotationBoardStatusMeta,
  type QuotationBoardState,
} from '@/lib/workflow-states'

export type QuotationCard = {
  id: string
  code: string
  title: string
  note: string
  owner: string
  due: string
  tag: string
  customer: string
  aircraft: string
  amount: string
  requestDate: string
  channel: string
  priority: string
  nextStep: string
}

export type QuotationLaneAccent = {
  bg: string
  border: string
  dot: string
  text: string
  chip: string
}

export type QuotationLane = {
  id: string
  state: QuotationBoardState | string
  title: string
  description: string
  isCustom: boolean
  accent: QuotationLaneAccent
  cards: QuotationCard[]
}

type StoredQuotationLane = Omit<QuotationLane, 'accent'>

export const QUOTATION_BOARD_STORAGE_KEY = 'doa-quotations-board-lanes-v3'

const ACCENTS: QuotationLaneAccent[] = [
  {
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    dot: 'bg-sky-500',
    text: 'text-sky-700',
    chip: 'border-sky-200 bg-white/90 text-sky-700',
  },
  {
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    dot: 'bg-cyan-500',
    text: 'text-cyan-700',
    chip: 'border-cyan-200 bg-white/90 text-cyan-700',
  },
  {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
    chip: 'border-emerald-200 bg-white/90 text-emerald-700',
  },
  {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    text: 'text-amber-700',
    chip: 'border-amber-200 bg-white/90 text-amber-700',
  },
  {
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    dot: 'bg-violet-500',
    text: 'text-violet-700',
    chip: 'border-violet-200 bg-white/90 text-violet-700',
  },
  {
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
    text: 'text-indigo-700',
    chip: 'border-indigo-200 bg-white/90 text-indigo-700',
  },
  {
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    dot: 'bg-slate-500',
    text: 'text-slate-700',
    chip: 'border-slate-200 bg-white/90 text-slate-700',
  },
]

const MOCK_CARDS: Record<QuotationBoardState, Omit<QuotationCard, 'id'>[]> = {
  entrada_recibida: [
    {
      code: 'Q-1208',
      title: 'Winglet retrofit inquiry',
      note: 'New customer request from Spain, waiting for triage and routing.',
      owner: 'M. Ruiz',
      due: 'Today',
      tag: 'Fresh',
      customer: 'AeroNova Leasing',
      aircraft: 'A320-214',
      amount: 'Pending estimate',
      requestDate: '31 Mar 2026',
      channel: 'Email intake',
      priority: 'Alta',
      nextStep: 'Confirmar alcance inicial con ingeniería comercial.',
    },
    {
      code: 'Q-1212',
      title: 'Cabin IT upgrade scope',
      note: 'Needs quick scoping before moving to technical review.',
      owner: 'A. Vega',
      due: 'Today',
      tag: 'Urgent',
      customer: 'SkyBridge Charter',
      aircraft: 'B737-800',
      amount: 'Pending estimate',
      requestDate: '31 Mar 2026',
      channel: 'Customer portal',
      priority: 'Crítica',
      nextStep: 'Recibir listado final de equipos y restricciones de cableado.',
    },
    {
      code: 'Q-1219',
      title: 'Minor repair clarification',
      note: 'Customer sent a short follow-up with attachments.',
      owner: 'L. Campos',
      due: 'Tomorrow',
      tag: 'Inbox',
      customer: 'Horizon Wings',
      aircraft: 'ATR 72-600',
      amount: 'Pending estimate',
      requestDate: '30 Mar 2026',
      channel: 'Email intake',
      priority: 'Media',
      nextStep: 'Validar documentación adjunta y abrir checklist comercial.',
    },
  ],
  triage: [
    {
      code: 'Q-1194',
      title: 'Route to engineering review',
      note: 'Scope looks feasible, classification is being checked.',
      owner: 'J. Ortega',
      due: '4h',
      tag: 'Review',
      customer: 'Altair Fleet Services',
      aircraft: 'A321NX',
      amount: 'EUR 18,000 - draft',
      requestDate: '29 Mar 2026',
      channel: 'Sales handoff',
      priority: 'Alta',
      nextStep: 'Confirmar categoría de cambio y dependencias certificativas.',
    },
    {
      code: 'Q-1198',
      title: 'Clarify aircraft model',
      note: 'Waiting for aircraft registration and maintenance history.',
      owner: 'S. Ramos',
      due: 'Today',
      tag: 'Pending info',
      customer: 'Helix Airways',
      aircraft: 'Unknown variant',
      amount: 'EUR 9,800 - draft',
      requestDate: '28 Mar 2026',
      channel: 'Phone call',
      priority: 'Media',
      nextStep: 'Solicitar matrícula exacta y historial de modificaciones previas.',
    },
  ],
  alcance_definido: [
    {
      code: 'Q-1188',
      title: 'Scope frozen for estimate',
      note: 'Requirements have been shaped and cost model can begin.',
      owner: 'I. Navarro',
      due: 'Tomorrow',
      tag: 'Scope',
      customer: 'Vertex MRO',
      aircraft: 'A330-300',
      amount: 'EUR 42,500 - target',
      requestDate: '27 Mar 2026',
      channel: 'Commercial workshop',
      priority: 'Alta',
      nextStep: 'Preparar BOM preliminar y horas de certificación.',
    },
    {
      code: 'Q-1189',
      title: 'Assumptions documented',
      note: 'Commercial assumptions were written for internal alignment.',
      owner: 'P. Gil',
      due: '2d',
      tag: 'Aligned',
      customer: 'Atlas Commuter',
      aircraft: 'ERJ 190',
      amount: 'EUR 23,700 - target',
      requestDate: '27 Mar 2026',
      channel: 'Internal sync',
      priority: 'Media',
      nextStep: 'Bloquear supuestos y pasar a redacción de oferta.',
    },
  ],
  oferta_en_redaccion: [
    {
      code: 'Q-1181',
      title: 'Draft quotation assembly',
      note: 'Working draft is being assembled with pricing blocks.',
      owner: 'R. Sanz',
      due: 'Today',
      tag: 'Draft',
      customer: 'Global Aero Assets',
      aircraft: 'B757-200',
      amount: 'EUR 61,300 - draft',
      requestDate: '26 Mar 2026',
      channel: 'Sales pipeline',
      priority: 'Alta',
      nextStep: 'Cerrar versión 0.8 de la propuesta y preparar anexos.',
    },
    {
      code: 'Q-1184',
      title: 'Commercial proposal copy',
      note: 'Language and assumptions are being refined before review.',
      owner: 'M. Alonso',
      due: '6h',
      tag: 'Writing',
      customer: 'BlueJet Partners',
      aircraft: 'A319-112',
      amount: 'EUR 15,900 - draft',
      requestDate: '26 Mar 2026',
      channel: 'Commercial review',
      priority: 'Media',
      nextStep: 'Ajustar copy ejecutivo y validar supuestos financieros.',
    },
    {
      code: 'Q-1187',
      title: 'Attachment pack prep',
      note: 'Supporting documents are being collected for the quote.',
      owner: 'N. Costa',
      due: 'Tomorrow',
      tag: 'Assets',
      customer: 'Sierra Aviation',
      aircraft: 'DHC-8 Q400',
      amount: 'EUR 11,200 - draft',
      requestDate: '26 Mar 2026',
      channel: 'Engineering handoff',
      priority: 'Media',
      nextStep: 'Subir evidencias técnicas y matriz de entregables.',
    },
  ],
  revision_interna: [
    {
      code: 'Q-1172',
      title: 'Internal check pending',
      note: 'Numbers and wording are under review before release.',
      owner: 'A. Martin',
      due: 'Today',
      tag: 'QA',
      customer: 'NorthLine Air',
      aircraft: 'A220-300',
      amount: 'EUR 34,800 - under review',
      requestDate: '25 Mar 2026',
      channel: 'Internal approval',
      priority: 'Alta',
      nextStep: 'Resolver observaciones de pricing y legal disclaimer.',
    },
    {
      code: 'Q-1176',
      title: 'Commercial sign-off',
      note: 'Awaiting final OK from responsible engineer.',
      owner: 'C. Lopez',
      due: 'Tomorrow',
      tag: 'Approval',
      customer: 'Orion Executive Jets',
      aircraft: 'Falcon 2000',
      amount: 'EUR 54,100 - under review',
      requestDate: '25 Mar 2026',
      channel: 'Approval gate',
      priority: 'Alta',
      nextStep: 'Conseguir aprobación final del responsable de disciplina.',
    },
  ],
  pendiente_envio: [
    {
      code: 'Q-1166',
      title: 'Ready to send',
      note: 'Response is complete and only the send step remains.',
      owner: 'D. Prieto',
      due: 'Now',
      tag: 'Ready',
      customer: 'Meridian Aircraft',
      aircraft: 'B767-300',
      amount: 'EUR 72,000 - final',
      requestDate: '24 Mar 2026',
      channel: 'Outbound email',
      priority: 'Alta',
      nextStep: 'Enviar email al cliente y registrar acuse de recibo.',
    },
    {
      code: 'Q-1168',
      title: 'Client message prepared',
      note: 'Email body is ready with the quotation link attached.',
      owner: 'E. Torres',
      due: 'Now',
      tag: 'Send',
      customer: 'Airframe Solutions',
      aircraft: 'A321-200',
      amount: 'EUR 28,600 - final',
      requestDate: '24 Mar 2026',
      channel: 'Outbound email',
      priority: 'Media',
      nextStep: 'Lanzar envío desde la app y activar seguimiento comercial.',
    },
  ],
  seguimiento_cierre: [
    {
      code: 'Q-1158',
      title: 'Follow-up after send',
      note: 'Waiting on customer feedback after quotation delivery.',
      owner: 'F. Diaz',
      due: '2d',
      tag: 'Follow-up',
      customer: 'EuroSky Maintenance',
      aircraft: 'A320neo',
      amount: 'EUR 38,900 - sent',
      requestDate: '22 Mar 2026',
      channel: 'Customer follow-up',
      priority: 'Media',
      nextStep: 'Contactar al cliente y resolver objeciones económicas.',
    },
    {
      code: 'Q-1161',
      title: 'Closing conversation',
      note: 'Commercial thread is active and needs a final push.',
      owner: 'H. Serra',
      due: '3d',
      tag: 'Close',
      customer: 'Vista Flight Ops',
      aircraft: 'E175',
      amount: 'EUR 19,400 - sent',
      requestDate: '22 Mar 2026',
      channel: 'Sales follow-up',
      priority: 'Alta',
      nextStep: 'Alinear calendario de firma y transición a proyecto.',
    },
  ],
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function makeCard(state: QuotationBoardState, index: number): QuotationCard {
  const template = MOCK_CARDS[state][index % MOCK_CARDS[state].length]

  return {
    id: `${state}-${index + 1}`,
    ...template,
  }
}

function makeLaneFromState(state: QuotationBoardState, index: number): QuotationLane {
  const meta = getQuotationBoardStatusMeta(state)
  const accent = ACCENTS[index % ACCENTS.length]
  const templates = MOCK_CARDS[state]

  return {
    id: state,
    state,
    title: meta.label,
    description: meta.description,
    isCustom: false,
    accent,
    cards: templates.map((_, cardIndex) => makeCard(state, cardIndex)),
  }
}

export function makeCustomQuotationLane(title: string, index: number): QuotationLane {
  const accent = ACCENTS[index % ACCENTS.length]
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return {
    id: slug ? createId(slug) : createId('quotation-state'),
    state: title,
    title,
    description: 'Estado creado manualmente desde la UI local',
    isCustom: true,
    accent,
    cards: [
      {
        id: createId('card'),
        code: 'NEW-001',
        title,
        note: 'Placeholder card created with the new lane.',
        owner: 'Local',
        due: 'Now',
        tag: 'Custom',
        customer: 'Pending customer',
        aircraft: 'To be defined',
        amount: 'Pending estimate',
        requestDate: 'Now',
        channel: 'Manual lane',
        priority: 'Baja',
        nextStep: 'Completar la información real de la quotation.',
      },
    ],
  }
}

export function defaultQuotationLanes() {
  return Object.values(QUOTATION_BOARD_STATES).map((state, index) => makeLaneFromState(state, index))
}

function normalizeStoredLane(value: unknown, index: number): QuotationLane | null {
  if (!value || typeof value !== 'object') return null

  const candidate = value as Partial<StoredQuotationLane>
  if (typeof candidate.title !== 'string' || typeof candidate.id !== 'string') return null

  const cards = Array.isArray(candidate.cards)
    ? candidate.cards
        .filter((card): card is QuotationCard => {
          return (
            !!card &&
            typeof card === 'object' &&
            typeof (card as { id?: unknown }).id === 'string' &&
            typeof (card as { code?: unknown }).code === 'string' &&
            typeof (card as { title?: unknown }).title === 'string' &&
            typeof (card as { note?: unknown }).note === 'string' &&
            typeof (card as { owner?: unknown }).owner === 'string' &&
            typeof (card as { due?: unknown }).due === 'string' &&
            typeof (card as { tag?: unknown }).tag === 'string' &&
            typeof (card as { customer?: unknown }).customer === 'string' &&
            typeof (card as { aircraft?: unknown }).aircraft === 'string' &&
            typeof (card as { amount?: unknown }).amount === 'string' &&
            typeof (card as { requestDate?: unknown }).requestDate === 'string' &&
            typeof (card as { channel?: unknown }).channel === 'string' &&
            typeof (card as { priority?: unknown }).priority === 'string' &&
            typeof (card as { nextStep?: unknown }).nextStep === 'string'
          )
        })
    : []

  return {
    id: candidate.id,
    title: candidate.title,
    description:
      typeof candidate.description === 'string'
        ? candidate.description
        : 'Estado creado manualmente desde la UI local',
    state: typeof candidate.state === 'string' ? candidate.state : candidate.title,
    isCustom:
      typeof candidate.isCustom === 'boolean'
        ? candidate.isCustom
        : !Object.values(QUOTATION_BOARD_STATES).includes(
            (typeof candidate.state === 'string' ? candidate.state : candidate.title) as QuotationBoardState,
          ),
    cards,
    accent: ACCENTS[index % ACCENTS.length],
  }
}

export function loadStoredQuotationLanes() {
  if (typeof window === 'undefined') return defaultQuotationLanes()

  try {
    const raw = window.localStorage.getItem(QUOTATION_BOARD_STORAGE_KEY)
    if (!raw) return defaultQuotationLanes()

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultQuotationLanes()

    const lanes = parsed
      .map((lane, index) => normalizeStoredLane(lane, index))
      .filter((lane): lane is QuotationLane => lane !== null)

    return lanes.length > 0 ? lanes : defaultQuotationLanes()
  } catch {
    return defaultQuotationLanes()
  }
}

export function stripQuotationLaneAccent(lane: QuotationLane): StoredQuotationLane {
  return {
    id: lane.id,
    title: lane.title,
    description: lane.description,
    state: lane.state,
    isCustom: lane.isCustom,
    cards: lane.cards,
  }
}

export function canDeleteQuotationLane(lane: QuotationLane) {
  return lane.isCustom
}

export function findQuotationCardById(lanes: QuotationLane[], cardId: string) {
  for (const lane of lanes) {
    const card = lane.cards.find((currentCard) => currentCard.id === cardId)
    if (card) {
      return { lane, card }
    }
  }

  return null
}
