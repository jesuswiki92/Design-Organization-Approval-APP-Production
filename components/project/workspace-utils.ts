import type {
  AeronaveModelo,
  Cliente,
  ProyectoConRelaciones,
  ProyectoDocumento,
  ProyectoTarea,
  UsuarioDoa,
} from '@/types/database'

export type ExpertMode = 'overview' | 'document' | 'missing' | 'next' | 'references'

export const PROJECT_STATUS_CONFIG: Record<
  string,
  { label: string; badge: string; dot: string; emphasis: 'low' | 'medium' | 'high' }
> = {
  oferta: {
    label: 'Oferta',
    badge: 'border-slate-500/20 bg-slate-500/10 text-slate-300',
    dot: 'bg-slate-400',
    emphasis: 'low',
  },
  activo: {
    label: 'Activo',
    badge: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
    dot: 'bg-blue-400',
    emphasis: 'low',
  },
  en_revision: {
    label: 'En revisión',
    badge: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    dot: 'bg-amber-400',
    emphasis: 'medium',
  },
  pendiente_aprobacion_cve: {
    label: 'En aprobación',
    badge: 'border-orange-500/20 bg-orange-500/10 text-orange-300',
    dot: 'bg-orange-400',
    emphasis: 'high',
  },
  pendiente_aprobacion_easa: {
    label: 'En aprobación',
    badge: 'border-orange-500/20 bg-orange-500/10 text-orange-300',
    dot: 'bg-orange-400',
    emphasis: 'high',
  },
  en_pausa: {
    label: 'En pausa',
    badge: 'border-violet-500/20 bg-violet-500/10 text-violet-300',
    dot: 'bg-violet-400',
    emphasis: 'high',
  },
  cancelado: {
    label: 'Cancelado',
    badge: 'border-red-500/20 bg-red-500/10 text-red-300',
    dot: 'bg-red-400',
    emphasis: 'medium',
  },
  cerrado: {
    label: 'Cerrado',
    badge: 'border-slate-600/20 bg-slate-700/20 text-slate-400',
    dot: 'bg-slate-500',
    emphasis: 'low',
  },
  guardado_en_base_de_datos: {
    label: 'Guardado en base de datos',
    badge: 'border-slate-700/20 bg-slate-800/30 text-slate-500',
    dot: 'bg-slate-600',
    emphasis: 'low',
  },
}

export const DOCUMENT_STATUS_CONFIG: Record<
  string,
  { label: string; badge: string; accent: string }
> = {
  pendiente: {
    label: 'Pendiente',
    badge: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    accent: 'bg-amber-400',
  },
  en_redaccion: {
    label: 'En redacción',
    badge: 'border-sky-500/20 bg-sky-500/10 text-sky-300',
    accent: 'bg-sky-400',
  },
  en_revision: {
    label: 'En revisión',
    badge: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300',
    accent: 'bg-cyan-400',
  },
  aprobado: {
    label: 'Vigente',
    badge: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    accent: 'bg-emerald-400',
  },
  bloqueado: {
    label: 'Bloqueado',
    badge: 'border-red-500/20 bg-red-500/10 text-red-300',
    accent: 'bg-red-400',
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

export function calcProjectProgress(project: ProyectoConRelaciones) {
  if (!project.horas_estimadas || project.horas_estimadas === 0) return 0
  const real = Number(project.horas_reales ?? 0)
  return Math.min(100, Math.round((real / project.horas_estimadas) * 100))
}

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

export function userName(user: UsuarioDoa | null) {
  if (!user) return 'Sin asignar'
  return `${user.nombre}${user.apellidos ? ` ${user.apellidos}` : ''}`
}

export function userInitials(user: UsuarioDoa | null) {
  if (!user) return '—'
  const first = user.nombre[0] ?? ''
  const last = user.apellidos?.[0] ?? ''
  return (first + last).toUpperCase()
}

export function getAircraftLabel(model: AeronaveModelo | null) {
  return model ? `${model.fabricante} ${model.modelo}` : 'Sin aeronave asignada'
}

export function getClientLabel(client: Cliente | null) {
  return client?.nombre ?? 'Sin cliente asociado'
}

export function getProjectStatusMeta(status: string) {
  return PROJECT_STATUS_CONFIG[status] ?? PROJECT_STATUS_CONFIG.cerrado
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
  const overdueDays = daysRemaining(project.fecha_prevista)
  const coverage = inferDocumentCoverage(docs)

  if (mode === 'document' && selectedDoc) {
    const status = getDocumentStatusMeta(selectedDoc.estado)
    return {
      eyebrow: 'Documento activo',
      title: selectedDoc.nombre,
      summary: `El documento está en estado ${status.label.toLowerCase()} y se analiza dentro del contexto del expediente ${project.numero_proyecto}.`,
      bullets: [
        `Tipo documental: ${selectedDoc.tipo_documento}`,
        `Versión / revisión actual: ${selectedDoc.version}`,
        selectedDoc.fecha_ultima_revision
          ? `Última revisión registrada: ${selectedDoc.fecha_ultima_revision}`
          : 'No hay fecha de revisión registrada',
      ],
      actions: [
        'Verificar si este documento cubre una dependencia crítica del expediente',
        'Comparar su versión actual con el resto del paquete documental',
        'Usarlo como contexto prioritario para responder dudas del proyecto',
      ],
    }
  }

  if (mode === 'missing') {
    return {
      eyebrow: 'Cobertura del expediente',
      title: coverage.missing.length
        ? 'Faltan piezas críticas del paquete documental'
        : 'Cobertura documental base identificada',
      summary: coverage.missing.length
        ? `Se detectan ${coverage.missing.length} piezas documentales clave sin correspondencia clara en la tabla actual.`
        : 'La base documental esencial del expediente ya tiene correspondencia visible en el workspace.',
      bullets: coverage.missing.length
        ? coverage.missing.map((item) => `Pendiente localizar o crear: ${item}`)
        : coverage.present.map((item) => `Cobertura detectada: ${item}`),
      actions: [
        'Priorizar la revisión del paquete documental antes del siguiente hito',
        'Confirmar si las piezas faltantes existen con otra nomenclatura',
        'Abrir Engineering Data Base para buscar referencias equivalentes en proyectos previos',
      ],
    }
  }

  if (mode === 'references') {
    return {
      eyebrow: 'Reutilización técnica',
      title: 'Consulta sugerida para Engineering Data Base',
      summary:
        'El valor del histórico está en recuperar expedientes similares y reutilizar criterios, estructuras y documentación.',
      bullets: [
        `Buscar por aeronave: ${getAircraftLabel(project.modelo)}`,
        `Buscar por tipo de modificación: ${project.tipo_modificacion}`,
        project.clasificacion_cambio
          ? `Buscar por clasificación: ${project.clasificacion_cambio}`
          : 'No hay clasificación de cambio definida todavía',
      ],
      actions: [
        'Consultar expedientes similares por aeronave y cert basis',
        'Recuperar plantillas documentales y decisiones previas reutilizables',
        'Usar el experto para comparar huecos del expediente actual con referencias históricas',
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
          : 'El expediente puede avanzar mejor si se ordenan primero pendientes documentales y revisión interna.',
      bullets: [
        pendingDocs.length
          ? `${pendingDocs.length} documentos siguen sin estado vigente`
          : 'No hay pendientes documentales visibles en esta revisión',
        reviewDocs.length
          ? `${reviewDocs.length} documentos están en revisión y pueden bloquear el siguiente paso`
          : 'No hay documentos retenidos específicamente en revisión',
        tasks.length
          ? `${tasks.length} tareas registradas siguen formando parte del control operativo`
          : 'No hay tareas cargadas todavía en esta vista',
      ],
      actions: [
        'Revisar primero los documentos en revisión o pendientes',
        'Convertir el próximo hueco crítico en una tarea concreta',
        'Lanzar consulta contextual al experto con el expediente activo',
      ],
    }
  }

  return {
    eyebrow: 'Estado del expediente',
    title: 'Lectura rápida del workspace',
    summary:
      'El panel contextual resume el estado documental y operativo del expediente sin salir del entorno de trabajo.',
    bullets: [
      `Documentos visibles: ${docs.length}`,
      `Documentos no vigentes todavía: ${pendingDocs.length}`,
      tasks.length ? `Tareas abiertas en esta carga: ${tasks.length}` : 'Sin tareas visibles en esta carga',
    ],
    actions: [
      'Revisar primero cobertura documental y alertas abiertas',
      'Abrir un documento para profundizar con contexto específico',
      'Usar búsquedas de referencia cuando el expediente requiera reutilización técnica',
    ],
  }
}
