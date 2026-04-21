import type {
  ProyectoConRelaciones,
  ProyectoDocumento,
  ProyectoTarea,
} from '@/types/database'
import { getProjectStatusMeta as getSharedProjectStatusMeta } from '@/lib/workflow-states'

export type ExpertMode = 'overview' | 'document' | 'missing' | 'next' | 'references'

export const DOCUMENT_STATUS_CONFIG: Record<
  string,
  { label: string; badge: string; accent: string }
> = {
  pendiente: {
    label: 'Pendiente',
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    accent: 'bg-amber-500',
  },
  en_redaccion: {
    label: 'En redaccion',
    badge: 'border-sky-200 bg-sky-50 text-sky-700',
    accent: 'bg-sky-500',
  },
  en_revision: {
    label: 'En revision',
    badge: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    accent: 'bg-cyan-500',
  },
  aprobado: {
    label: 'Vigente',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    accent: 'bg-emerald-500',
  },
  bloqueado: {
    label: 'Bloqueado',
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
    accent: 'bg-rose-500',
  },
}

const REQUIRED_DOCUMENTS = [
  { label: 'Classification', patterns: ['classification', 'clasificacion'] },
  { label: 'Certification Plan', patterns: ['certification plan', 'cert plan'] },
  {
    label: 'Modification Description',
    patterns: ['modification description', 'descripcion', 'modification'],
  },
  { label: 'Master Document List', patterns: ['master document list', 'mdl'] },
]

export function calcDocumentCompletion(docs: ProyectoDocumento[]) {
  if (docs.length === 0) return 0
  const current = docs.filter((doc) => doc.estado === 'aprobado').length
  return Math.round((current / docs.length) * 100)
}

export function daysRemaining(date: string | null) {
  if (!date) return null
  const diff = new Date(date).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

/**
 * Formatea el nombre del owner del proyecto.
 * En doa_proyectos, owner es un campo texto simple.
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
 * Label de la aeronave del proyecto.
 * En doa_proyectos, aeronave es un campo texto simple.
 */
export function getAircraftLabel(aeronave: string | null) {
  return aeronave ?? 'Sin aeronave asignada'
}

/**
 * Label del cliente del proyecto.
 * En doa_proyectos, cliente es un objeto con nombre
 * o puede venir como cliente_nombre (texto simple).
 */
export function getClientLabel(cliente: { nombre?: string } | null) {
  return cliente?.nombre ?? 'Sin cliente asociado'
}

export function getProjectStatusMeta(status: string) {
  const meta = getSharedProjectStatusMeta(status)
  return {
    label: meta.label,
    badge: `${meta.border} ${meta.bg} ${meta.color}`,
    dot: meta.dot,
    emphasis:
      status === 'en_pausa' ||
      status === 'cancelado' ||
      status === 'pendiente_aprobacion_cve' ||
      status === 'pendiente_aprobacion_easa'
        ? 'high'
        : status === 'en_revision' || status === 'revision' || status === 'aprobacion'
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

export function getDocumentSearchText(doc: ProyectoDocumento) {
  return `${doc.nombre} ${doc.tipo_documento}`.toLowerCase()
}

export function inferDocumentCoverage(docs: ProyectoDocumento[]) {
  const present = REQUIRED_DOCUMENTS.filter(({ patterns }) =>
    docs.some((doc) => patterns.some((pattern) => getDocumentSearchText(doc).includes(pattern))),
  ).map((entry) => entry.label)

  const missing = REQUIRED_DOCUMENTS.filter(({ label }) => !present.includes(label)).map(
    (entry) => entry.label,
  )

  return { present, missing }
}

export function buildExpertAnalysis(params: {
  project: ProyectoConRelaciones
  docs: ProyectoDocumento[]
  tasks: ProyectoTarea[]
  selectedDoc: ProyectoDocumento | null
  mode: ExpertMode
}) {
  const { project, docs, tasks, selectedDoc, mode } = params
  const pendingDocs = docs.filter((doc) => doc.estado !== 'aprobado')
  const reviewDocs = docs.filter((doc) => doc.estado === 'en_revision')
  const overdueDays = daysRemaining(project.fecha_entrega_estimada)
  const coverage = inferDocumentCoverage(docs)

  if (mode === 'document' && selectedDoc) {
    const status = getDocumentStatusMeta(selectedDoc.estado)
    return {
      eyebrow: 'Documento activo',
      title: selectedDoc.nombre,
      summary: `El documento esta en estado ${status.label.toLowerCase()} y se analiza dentro del contexto del expediente ${project.numero_proyecto}.`,
      bullets: [
        `Tipo documental: ${selectedDoc.tipo_documento}`,
        `Version / revision actual: ${selectedDoc.version}`,
        selectedDoc.fecha_ultima_revision
          ? `Ultima revision registrada: ${selectedDoc.fecha_ultima_revision}`
          : 'No hay fecha de revision registrada',
      ],
      actions: [
        'Verificar si este documento cubre una dependencia critica del expediente',
        'Comparar su version actual con el resto del paquete documental',
        'Usarlo como contexto prioritario para responder dudas del proyecto',
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
        ? `Se detectan ${coverage.missing.length} piezas documentales clave sin correspondencia clara en la tabla actual.`
        : 'La base documental esencial del expediente ya tiene correspondencia visible en el workspace.',
      bullets: coverage.missing.length
        ? coverage.missing.map((item) => `Pendiente localizar o crear: ${item}`)
        : coverage.present.map((item) => `Cobertura detectada: ${item}`),
      actions: [
        'Priorizar la revision del paquete documental antes del siguiente hito',
        'Confirmar si las piezas faltantes existen con otra nomenclatura',
        'Abrir la base historica de proyectos para buscar referencias equivalentes en expedientes previos',
      ],
    }
  }

  if (mode === 'references') {
    return {
      eyebrow: 'Reutilizacion tecnica',
      title: 'Consulta sugerida para la base historica de proyectos',
      summary:
        'El valor del historico esta en recuperar expedientes similares y reutilizar criterios, estructuras y documentacion.',
      bullets: [
        `Buscar por aeronave: ${getAircraftLabel(project.aeronave)}`,
        project.tcds_code
          ? `Buscar por TCDS: ${project.tcds_code}`
          : 'No hay codigo TCDS definido todavia',
        project.cliente_nombre
          ? `Buscar por cliente: ${project.cliente_nombre}`
          : 'No hay cliente asociado todavia',
      ],
      actions: [
        'Consultar expedientes similares por aeronave y TCDS',
        'Recuperar plantillas documentales y decisiones previas reutilizables',
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
          ? 'La ventana temporal del proyecto ya exige cerrar huecos documentales y reducir incertidumbre.'
          : 'El expediente puede avanzar mejor si se ordenan primero pendientes documentales y revision interna.',
      bullets: [
        pendingDocs.length
          ? `${pendingDocs.length} documentos siguen sin estado vigente`
          : 'No hay pendientes documentales visibles en esta revision',
        reviewDocs.length
          ? `${reviewDocs.length} documentos estan en revision y pueden bloquear el siguiente paso`
          : 'No hay documentos retenidos especificamente en revision',
        tasks.length
          ? `${tasks.length} tareas registradas siguen formando parte del control operativo`
          : 'No hay tareas cargadas todavia en esta vista',
      ],
      actions: [
        'Revisar primero los documentos en revision o pendientes',
        'Convertir el proximo hueco critico en una tarea concreta',
        'Lanzar consulta contextual al experto con el expediente activo',
      ],
    }
  }

  return {
    eyebrow: 'Estado del expediente',
    title: 'Lectura rapida del workspace',
    summary:
      'El panel contextual resume el estado documental y operativo del expediente sin salir del entorno de trabajo.',
    bullets: [
      `Documentos visibles: ${docs.length}`,
      `Documentos no vigentes todavia: ${pendingDocs.length}`,
      tasks.length ? `Tareas abiertas en esta carga: ${tasks.length}` : 'Sin tareas visibles en esta carga',
    ],
    actions: [
      'Revisar primero cobertura documental y alertas abiertas',
      'Abrir un documento para profundizar con contexto especifico',
      'Usar busquedas de referencia cuando el expediente requiera reutilizacion tecnica',
    ],
  }
}
