/**
 * ============================================================================
 * PLANTILLAS DE DOCUMENTOS DE COMPLIANCE (DOA)
 * ============================================================================
 *
 * Lista maestra de las plantillas G12-xx y G18-xx disponibles en:
 *   02. Datos DOA / 01. Plantillas
 *
 * FUENTE DE VERDAD: tabla `plantillas_compliance` en Supabase.
 * Las constantes de este archivo se usan como fallback y para el mapeo
 * FAMILIA_TO_TEMPLATES que conecta las familias documentales de proyectos
 * historicos (proyectos_historico_documentos.familia_documental) con
 * los codigos de plantilla, permitiendo la pre-seleccion automatica cuando
 * el ingeniero marca un proyecto como referencia.
 *
 * La pagina de detalle carga las plantillas desde BD (server component)
 * y las pasa al client component ComplianceDocumentsSection.
 * ============================================================================
 */

export type ComplianceTemplate = {
  code: string
  name: string
  category: 'classification' | 'review' | 'approval' | 'analysis' | 'test' | 'manual' | 'management'
}

export const COMPLIANCE_TEMPLATES: ComplianceTemplate[] = [
  // --- Clasificacion y descripcion ---
  { code: 'G12-01', name: 'Change Classification', category: 'classification' },
  { code: 'G12-17', name: 'Modification Description', category: 'classification' },
  { code: 'G12-46', name: 'Repair Description', category: 'classification' },

  // --- Revisiones de diseno ---
  { code: 'G12-05', name: 'Initial Design Review', category: 'review' },
  { code: 'G12-09', name: 'Preliminary Design Review', category: 'review' },
  { code: 'G12-02', name: 'Critical Design Review', category: 'review' },
  { code: 'G12-04', name: 'Final Design Review', category: 'review' },

  // --- Aprobaciones y declaraciones ---
  { code: 'G12-06', name: 'Minor Change Approval', category: 'approval' },
  { code: 'G12-07', name: 'Minor Repair Approval', category: 'approval' },
  { code: 'G12-10', name: 'Repair Declaration of Compliance', category: 'approval' },
  { code: 'G12-11', name: 'STC & Major Change Declaration of Compliance', category: 'approval' },
  { code: 'G12-12', name: 'Certification Plan - Minor', category: 'approval' },
  { code: 'G12-39', name: 'Certification Plan - STC Major', category: 'approval' },
  { code: 'G12-08', name: 'Concession', category: 'approval' },

  // --- Analisis ---
  { code: 'G12-14', name: 'Electrical Load Analysis', category: 'analysis' },
  { code: 'G12-15', name: 'Equipment Qualification', category: 'analysis' },
  { code: 'G12-16', name: 'Flammability Analysis', category: 'analysis' },
  { code: 'G12-18', name: 'Hazard Analysis', category: 'analysis' },
  { code: 'G12-20', name: 'Structural Analysis', category: 'analysis' },
  { code: 'G12-21', name: 'Weight and Balance Report', category: 'analysis' },
  { code: 'G12-22', name: 'Fatigue Analysis', category: 'analysis' },
  { code: 'G12-23', name: 'Damage Tolerance Analysis', category: 'analysis' },
  { code: 'G12-42', name: 'Damage Assessment', category: 'analysis' },
  { code: 'G12-45', name: 'Evacuation Analysis', category: 'analysis' },

  // --- Tests y ensayos ---
  { code: 'G12-24', name: 'Ground Test Procedure', category: 'test' },
  { code: 'G12-36', name: 'Ground Test Results', category: 'test' },
  { code: 'G12-25', name: 'EMI/EMC Test Procedure', category: 'test' },
  { code: 'G12-37', name: 'EMI/EMC Test Results', category: 'test' },
  { code: 'G12-26', name: 'Flight Test Procedure', category: 'test' },
  { code: 'G12-38', name: 'Flight Test Results', category: 'test' },
  { code: 'G12-40', name: 'ED-130 Test Procedure', category: 'test' },
  { code: 'G12-41', name: 'ED-130 Test Results', category: 'test' },
  { code: 'G12-43', name: 'Statement of Flight Testing', category: 'test' },

  // --- Suplementos de manual ---
  { code: 'G12-28', name: 'Flight Manual Supplement', category: 'manual' },
  { code: 'G12-29', name: 'IPC Supplement', category: 'manual' },
  { code: 'G12-30', name: 'Maintenance Manual Supplement', category: 'manual' },
  { code: 'G12-31', name: 'Operation Manual Supplement', category: 'manual' },
  { code: 'G12-32', name: 'Wiring Manual Supplement', category: 'manual' },

  // --- Gestion y fabricacion ---
  { code: 'G12-03', name: 'EWIS-ICA', category: 'management' },
  { code: 'G12-19', name: 'Service Bulletin', category: 'management' },
  { code: 'G12-44', name: 'Manufacturing Instructions', category: 'management' },
  { code: 'G12-60', name: 'Service Letter', category: 'management' },
  { code: 'G18-02', name: 'Master Document List', category: 'management' },
  { code: 'G18-03', name: 'Engineering Change Proposal', category: 'management' },
]

/** Nombre legible para cada categoria */
export const CATEGORY_LABELS: Record<ComplianceTemplate['category'], string> = {
  classification: 'Clasificacion y descripcion',
  review: 'Revisiones de diseno',
  approval: 'Aprobaciones y declaraciones',
  analysis: 'Analisis',
  test: 'Tests y ensayos',
  manual: 'Suplementos de manual',
  management: 'Gestion y fabricacion',
}

/** Orden de las categorias en la UI */
export const CATEGORY_ORDER: ComplianceTemplate['category'][] = [
  'classification',
  'review',
  'approval',
  'analysis',
  'test',
  'manual',
  'management',
]

/**
 * Mapeo de familia_documental (proyectos_historico_documentos)
 * a codigos de plantilla. Cuando el ingeniero marca un proyecto como
 * referencia, se pre-seleccionan las plantillas correspondientes.
 */
export const FAMILIA_TO_TEMPLATES: Record<string, string[]> = {
  'Change Classification': ['G12-01'],
  'Modification Description': ['G12-17'],
  'Repair Description': ['G12-46'],
  'Certification Plan': ['G12-12', 'G12-39'],
  'Master Document List': ['G18-02'],
  'Equipment Qualification': ['G12-15'],
  'Structural Analysis': ['G12-20'],
  'Weight & Balance': ['G12-21'],
  'Electrical Load Analysis': ['G12-14'],
  'Flammability Analysis': ['G12-16'],
  'Safety Analysis': ['G12-18'],
  'Damage Assessment': ['G12-42'],
  'Damage Tolerance Analysis': ['G12-23'],
  'Manufacturing Instructions': ['G12-44'],
  'Service Bulletin': ['G12-19'],
  'STC Declaration': ['G12-11'],
  'Manual Supplements': ['G12-28', 'G12-29', 'G12-30', 'G12-31', 'G12-32'],
}

/**
 * Dado un array de familias documentales de un proyecto historico,
 * devuelve los codigos de plantilla que se deben pre-seleccionar.
 */
export function getPreselectedTemplates(familias: string[]): string[] {
  const codes = new Set<string>()
  for (const familia of familias) {
    const mapped = FAMILIA_TO_TEMPLATES[familia]
    if (mapped) {
      for (const code of mapped) codes.add(code)
    }
  }
  return [...codes]
}

/**
 * Convierte codigo de plantilla a nombre de columna en BD.
 * "G12-01" → "doc_g12_01"
 */
export function codeToColumn(code: string): string {
  return 'doc_' + code.toLowerCase().replace('-', '_')
}

/**
 * Convierte nombre de columna a codigo de plantilla.
 * "doc_g12_01" → "G12-01"
 */
export function columnToCode(col: string): string {
  return col.replace('doc_', '').replace('_', '-').toUpperCase()
}

/** Lista de todas las columnas doc_* en consultas_entrantes */
export const ALL_DOC_COLUMNS = COMPLIANCE_TEMPLATES.map((t) => codeToColumn(t.code))
