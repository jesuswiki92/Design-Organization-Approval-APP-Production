import type {
  ProjectWithRelations,
  ProjectDocument,
  ProjectTask,
} from '@/types/database'
import { getProjectStatusMeta as getSharedProjectStatusMeta } from '@/lib/workflow-states'

export type ExpertMode = 'overview' | 'document' | 'missing' | 'next' | 'references'

export const DOCUMENT_STATUS_CONFIG: Record<
  string,
  { label: string; badge: string; accent: string }
> = {
  pending: {
    label: 'Pending',
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    accent: 'bg-amber-500',
  },
  drafting: {
    label: 'En redaccion',
    badge: 'border-sky-200 bg-sky-50 text-sky-700',
    accent: 'bg-sky-500',
  },
  in_review: {
    label: 'En review',
    badge: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    accent: 'bg-cyan-500',
  },
  approved: {
    label: 'Vigente',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    accent: 'bg-emerald-500',
  },
  blocked: {
    label: 'Bloqueado',
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
    accent: 'bg-rose-500',
  },
}

const REQUIRED_DOCUMENTS = [
  { label: 'Classification', patterns: ['classification', 'classification'] },
  { label: 'Certification Plan', patterns: ['certification plan', 'cert plan'] },
  {
    label: 'Modification Description',
    patterns: ['modification description', 'description', 'modification'],
  },
  { label: 'Master Document List', patterns: ['master document list', 'mdl'] },
]

export function calcDocumentCompletion(docs: ProjectDocument[]) {
  if (docs.length === 0) return 0
  const current = docs.filter((doc) => doc.status === 'approved').length
  return Math.round((current / docs.length) * 100)
}

export function daysRemaining(date: string | null) {
  if (!date) return null
  const diff = new Date(date).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

/**
 * Formatea el name del owner del project.
 * En doa_projects, owner es un campo text simple.
 */
export function userName(user: string | null) {
  if (!user) return 'Sin asignar'
  return user
}

/**
 * Devuelve iniciales del owner (primeras 2 letras).
 */
export function userInitials(user: string | null) {
  if (!user) return '--'
  return user.slice(0, 2).toUpperCase()
}

/**
 * Label de la aircraft del project.
 * En doa_projects, aircraft es un campo text simple.
 */
export function getAircraftLabel(aircraft: string | null) {
  return aircraft ?? 'Sin aircraft asignada'
}

/**
 * Label del client del project.
 * En doa_projects, client es un objeto con name
 * o puede venir como client_name (text simple).
 */
export function getClientLabel(client: { name?: string } | null) {
  return client?.name ?? 'Sin client asociado'
}

export function getProjectStatusMeta(status: string) {
  const meta = getSharedProjectStatusMeta(status)
  return {
    label: meta.label,
    badge: `${meta.border} ${meta.bg} ${meta.color}`,
    dot: meta.dot,
    emphasis:
      status === 'paused' ||
      status === 'canceled' ||
      status === 'pending_cve_approval' ||
      status === 'pending_easa_approval'
        ? 'high'
        : status === 'in_review' || status === 'review' || status === 'approval'
          ? 'medium'
          : 'low',
  }
}

export function getDocumentStatusMeta(status: string) {
  return DOCUMENT_STATUS_CONFIG[status] ?? {
    label: status,
    badge: 'border-slate-500/20 bg-slate-500/10 text-slate-300',
    accent: 'bg-slate-400',
  }
}

export function getDocumentSearchText(doc: ProjectDocument) {
  return `${doc.name} ${doc.document_type}`.toLowerCase()
}

export function inferDocumentCoverage(docs: ProjectDocument[]) {
  const present = REQUIRED_DOCUMENTS.filter(({ patterns }) =>
    docs.some((doc) => patterns.some((pattern) => getDocumentSearchText(doc).includes(pattern))),
  ).map((entry) => entry.label)

  const missing = REQUIRED_DOCUMENTS.filter(({ label }) => !present.includes(label)).map(
    (entry) => entry.label,
  )

  return { present, missing }
}

export function buildExpertAnalysis(params: {
  project: ProjectWithRelations
  docs: ProjectDocument[]
  tasks: ProjectTask[]
  selectedDoc: ProjectDocument | null
  mode: ExpertMode
}) {
  const { project, docs, tasks, selectedDoc, mode } = params
  const pendingDocs = docs.filter((doc) => doc.status !== 'approved')
  const reviewDocs = docs.filter((doc) => doc.status === 'in_review')
  const overdueDays = daysRemaining(project.estimated_delivery_date)
  const coverage = inferDocumentCoverage(docs)

  if (mode === 'document' && selectedDoc) {
    const status = getDocumentStatusMeta(selectedDoc.status)
    return {
      eyebrow: 'Document is_active',
      title: selectedDoc.name,
      summary: `El document esta en status ${status.label.toLowerCase()} y se analiza dentro del contexto del expediente ${project.project_number}.`,
      bullets: [
        `Tipo documental: ${selectedDoc.document_type}`,
        `Version / review actual: ${selectedDoc.version}`,
        selectedDoc.last_review_date
          ? `Ultima review registrada: ${selectedDoc.last_review_date}`
          : 'No hay date de review registrada',
      ],
      actions: [
        'Verificar si este document cubre una dependencia critica del expediente',
        'Comparar su version actual con el resto del paquete documental',
        'Usarlo como contexto prioritario para responder dudas del project',
      ],
    }
  }

  if (mode === 'missing') {
    return {
      eyebrow: 'Cobertura del expediente',
      title: coverage.missing.length
        ? 'Faltan piezas criticas del paquete documental'
        : 'Cobertura documental base identificada',
      summary: coverage.missing.length
        ? `Se detectan ${coverage.missing.length} piezas documentales clave sin correspondencia clara en la table actual.`
        : 'La base documental esencial del expediente ya tiene correspondencia visible en el workspace.',
      bullets: coverage.missing.length
        ? coverage.missing.map((item) => `Pending localizar o crear: ${item}`)
        : coverage.present.map((item) => `Cobertura detectada: ${item}`),
      actions: [
        'Priorizar la review del paquete documental antes del siguiente hito',
        'Confirmar si las piezas faltantes existen con otra nomenclatura',
        'Abrir la base historica de projects para buscar referencias equivalentes en expedientes previos',
      ],
    }
  }

  if (mode === 'references') {
    return {
      eyebrow: 'Reutilizacion technical',
      title: 'Request sugerida para la base historica de projects',
      summary:
        'El valor del historical esta en recuperar expedientes similares y reutilizar criterios, estructuras y documentacion.',
      bullets: [
        `Buscar por aircraft: ${getAircraftLabel(project.aircraft)}`,
        project.tcds_code
          ? `Buscar por TCDS: ${project.tcds_code}`
          : 'No hay codigo TCDS definido todavia',
        project.client_name
          ? `Buscar por client: ${project.client_name}`
          : 'No hay client asociado todavia',
      ],
      actions: [
        'Consultar expedientes similares por aircraft y TCDS',
        'Recuperar templates documentales y decisiones previas reutilizables',
        'Usar el experto para comparar huecos del expediente actual con referencias historicas',
      ],
    }
  }

  if (mode === 'next') {
    return {
      eyebrow: 'Siguiente paso sugerido',
      title: 'Prioridad operativa inmediata',
      summary:
        overdueDays !== null && overdueDays <= 15
          ? 'La ventana temporal del project ya exige close huecos documentales y reducir incertidumbre.'
          : 'El expediente puede avanzar mejor si se ordenan primero pendientes documentales y review internal.',
      bullets: [
        pendingDocs.length
          ? `${pendingDocs.length} documents siguen sin status vigente`
          : 'No hay pendientes documentales visibles en esta review',
        reviewDocs.length
          ? `${reviewDocs.length} documents estan en review y pueden bloquear el siguiente paso`
          : 'No hay documents retenidos especificamente en review',
        tasks.length
          ? `${tasks.length} tareas registradas siguen formando parte del control operativo`
          : 'No hay tareas cargadas todavia en esta vista',
      ],
      actions: [
        'Revisar primero los documents en review o pendientes',
        'Convertir el proximo hueco critico en una tarea concreta',
        'Lanzar request contextual al experto con el expediente is_active',
      ],
    }
  }

  return {
    eyebrow: 'Status del expediente',
    title: 'Lectura rapida del workspace',
    summary:
      'El panel contextual resume el status documental y operativo del expediente sin salir del entorno de trabajo.',
    bullets: [
      `Documents visibles: ${docs.length}`,
      `Documents no vigentes todavia: ${pendingDocs.length}`,
      tasks.length ? `Tareas abiertas en esta carga: ${tasks.length}` : 'Sin tareas visibles en esta carga',
    ],
    actions: [
      'Revisar primero cobertura documental y alertas abiertas',
      'Abrir un document para profundizar con contexto especifico',
      'Usar busquedas de referencia cuando el expediente requiera reutilizacion technical',
    ],
  }
}
