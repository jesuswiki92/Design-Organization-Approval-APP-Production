/**
 * ============================================================================
 * RAG API WRAPPER — Comunicacion con el backend FastAPI de TCDS
 * ============================================================================
 *
 * Todas las llamadas van al servidor Python (FastAPI) que corre en localhost:3002.
 * Este modulo centraliza la comunicacion para que los componentes de React
 * solo importen funciones tipadas sin preocuparse por fetch/URLs/errores.
 *
 * El backend requiere autenticacion JWT. Las funciones aceptan un token
 * opcional — si se proporciona, se envia en el header Authorization.
 * ============================================================================
 */

/** URL base del backend RAG — configurable via variable de entorno */
const RAG_BASE = process.env.NEXT_PUBLIC_RAG_API_URL || 'http://localhost:3002'

/* -------------------------------------------------------------------------- */
/*                          UTILIDADES INTERNAS                               */
/* -------------------------------------------------------------------------- */

/**
 * Wrapper generico para fetch con manejo de errores.
 * Lanza un error con el mensaje del servidor si la respuesta no es ok.
 */
async function ragFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const url = `${RAG_BASE}${path}`

  // Cabeceras por defecto
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }

  // Anadir token de autenticacion si se proporciona
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // Solo poner Content-Type json si no es FormData (multipart se autodetecta)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  try {
    const res = await fetch(url, { ...options, headers })

    if (!res.ok) {
      // Intentar extraer mensaje de error del servidor
      let errorMsg = `Error ${res.status}`
      try {
        const errBody = await res.json()
        errorMsg = errBody.detail || errBody.message || errorMsg
      } catch {
        // Si no puede parsear JSON, usar el status text
        errorMsg = res.statusText || errorMsg
      }
      throw new Error(errorMsg)
    }

    return (await res.json()) as T
  } catch (error) {
    // Si es un error de red (servidor no disponible), dar mensaje claro
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('No se pudo conectar con el servidor RAG. Verifica que esta corriendo en ' + RAG_BASE)
    }
    throw error
  }
}

/* -------------------------------------------------------------------------- */
/*                              HEALTH                                        */
/* -------------------------------------------------------------------------- */

/** Respuesta del endpoint de salud */
export interface RagHealthResponse {
  status: string
  service?: string
}

/**
 * Verifica si el servidor RAG esta activo.
 * No requiere autenticacion.
 */
export async function ragHealth(): Promise<RagHealthResponse> {
  return ragFetch<RagHealthResponse>('/api/health')
}

/* -------------------------------------------------------------------------- */
/*                            AUTENTICACION                                   */
/* -------------------------------------------------------------------------- */

/** Respuesta del login */
export interface RagAuthResponse {
  access_token: string
  token_type: string
}

/**
 * Autentica con el backend RAG y obtiene un token JWT.
 * El backend espera form-urlencoded (OAuth2PasswordRequestForm).
 */
export async function ragLogin(
  username: string,
  password: string
): Promise<RagAuthResponse> {
  const url = `${RAG_BASE}/api/auth/login`
  const body = new URLSearchParams({ username, password })

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    let msg = 'Credenciales invalidas'
    try {
      const err = await res.json()
      msg = err.detail || msg
    } catch { /* ignorar */ }
    throw new Error(msg)
  }

  return (await res.json()) as RagAuthResponse
}

/* -------------------------------------------------------------------------- */
/*                             DASHBOARD                                      */
/* -------------------------------------------------------------------------- */

/** Estadisticas del dashboard del backend RAG */
export interface RagDashboardStats {
  documents: number | string
  uniqueDocuments: number | string
  pythonService: string
  server: string
  error?: string
}

/**
 * Obtiene las estadisticas del dashboard: total de chunks, documentos unicos, etc.
 * Requiere token de autenticacion.
 */
export async function ragDashboard(token: string): Promise<RagDashboardStats> {
  return ragFetch<RagDashboardStats>('/api/dashboard', {}, token)
}

/* -------------------------------------------------------------------------- */
/*                             SETTINGS                                       */
/* -------------------------------------------------------------------------- */

/** Respuesta del endpoint de settings — capacidades y credenciales */
export interface RagSettings {
  python: { ok: boolean; version: string }
  capabilities: {
    documents: boolean
    chat: boolean
    ocr: boolean
    embeddings: boolean
    reranking: boolean
  }
  credentials: Record<string, unknown>
}

/**
 * Obtiene la configuracion y capacidades del servidor RAG.
 * Util para saber que funcionalidades estan habilitadas.
 */
export async function ragSettings(token: string): Promise<RagSettings> {
  return ragFetch<RagSettings>('/api/settings', {}, token)
}

/* -------------------------------------------------------------------------- */
/*                            DOCUMENTS                                       */
/* -------------------------------------------------------------------------- */

/** Documento indexado en el sistema RAG */
export interface RagDocument {
  code: string
  title: string
  agency: string
  doc_type: string
  chunk_count: number
}

/** Chunk individual de un documento */
export interface RagChunk {
  id: number | string
  content: string
  section_id: string
  chapter: string
  topic: string
  page_number: number | null
  char_count: number
  has_image: boolean
  page_capture_url: string | null
  image_urls: string[]
  metadata: Record<string, unknown>
}

/**
 * Obtiene la lista de todos los documentos indexados.
 * Devuelve un array con codigo, titulo, agencia, tipo y cantidad de chunks.
 */
export async function ragListDocuments(token: string): Promise<RagDocument[]> {
  const res = await ragFetch<{ documents: RagDocument[] }>(
    '/api/documents',
    {},
    token
  )
  return res.documents
}

/**
 * Obtiene los chunks de un documento especifico por su codigo.
 * Devuelve el contenido completo con metadata para cada chunk.
 */
export async function ragGetDocumentChunks(
  code: string,
  token: string
): Promise<RagChunk[]> {
  const res = await ragFetch<{ chunks: RagChunk[] }>(
    `/api/documents/${encodeURIComponent(code)}/chunks`,
    {},
    token
  )
  return res.chunks
}

/* -------------------------------------------------------------------------- */
/*                              INGEST                                        */
/* -------------------------------------------------------------------------- */

/** Resultado del analisis previo de un PDF */
export interface IngestAnalysis {
  doc_info: {
    file_name: string
    num_pages: number
    file_size_mb: number
    has_images: boolean
  }
  classification: {
    agency: string
    doc_type: string
    standard_code: string
  }
  estimated_cost: string
}

/** Resultado del procesamiento completo de un PDF (OCR + chunking) */
export interface IngestProcessResult {
  doc_info: {
    file_name: string
    num_pages: number
    file_size_mb: number
  }
  classification: {
    agency: string
    doc_type: string
    standard_code: string
  }
  estimated_cost: string
  chunks: RagProcessedChunk[]
  semantic_info: {
    official_code: string
    agency: string
    doc_type: string
    document_title: string
  }
  logs: string[]
}

/** Chunk generado durante el procesamiento, antes de guardar */
export interface RagProcessedChunk {
  content: string
  section_id: string
  section_title: string
  char_count: number
  has_image: boolean
  metadata: Record<string, unknown>
}

/** Resultado de guardar chunks con embeddings en Supabase */
export interface IngestSaveResult {
  message: string
  result: {
    total: number
    successful: number
    failed: number
  }
  logs: string[]
}

/**
 * Analiza un PDF sin procesarlo: extrae info basica (paginas, tamano, clasificacion).
 * Util para mostrar una vista previa antes de procesar.
 */
export async function ragAnalyze(
  file: File,
  token: string
): Promise<IngestAnalysis> {
  const formData = new FormData()
  formData.append('file', file)

  return ragFetch<IngestAnalysis>(
    '/api/ingest/analyze',
    { method: 'POST', body: formData },
    token
  )
}

/**
 * Procesa un PDF completo: OCR + chunking semantico.
 * Devuelve los chunks generados y la info semantica para revision antes de guardar.
 */
export async function ragProcess(
  file: File,
  token: string
): Promise<IngestProcessResult> {
  const formData = new FormData()
  formData.append('file', file)

  return ragFetch<IngestProcessResult>(
    '/api/ingest/process',
    { method: 'POST', body: formData },
    token
  )
}

/**
 * Guarda los chunks procesados en Supabase con embeddings generados.
 * Esta es la operacion final del pipeline de ingesta.
 */
export async function ragSave(
  chunks: RagProcessedChunk[],
  semanticInfo: {
    official_code: string
    agency: string
    doc_type: string
    document_title: string
  },
  token: string
): Promise<IngestSaveResult> {
  return ragFetch<IngestSaveResult>(
    '/api/ingest/save',
    {
      method: 'POST',
      body: JSON.stringify({ chunks, semantic_info: semanticInfo }),
    },
    token
  )
}

/* -------------------------------------------------------------------------- */
/*                               CHAT                                         */
/* -------------------------------------------------------------------------- */

/** Fuente de una respuesta del chat RAG */
export interface ChatSource {
  code: string
  section: string
  topic: string
  score: number
  content: string
  page_number?: number
  page_capture_url?: string
  image_urls?: string[]
  source: string
}

/** Respuesta del endpoint de chat */
export interface ChatResponse {
  answer: string
  sources: ChatSource[]
  success: boolean
  reasoning_trace: string[]
  tokens_used: number
}

/**
 * Envia una pregunta al motor RAG y obtiene una respuesta con fuentes.
 * Utiliza busqueda semantica + reranking para encontrar los chunks mas relevantes.
 */
export async function ragChat(
  question: string,
  token: string,
  sessionId?: string
): Promise<ChatResponse> {
  return ragFetch<ChatResponse>(
    '/api/chat',
    {
      method: 'POST',
      body: JSON.stringify({ question, session_id: sessionId }),
    },
    token
  )
}

/* -------------------------------------------------------------------------- */
/*                           CHAT HISTORY                                     */
/* -------------------------------------------------------------------------- */

/** Estadisticas del historial de chat */
export interface ChatHistoryStats {
  sessions: number
  messages: number
}

/**
 * Obtiene el historial completo de sesiones de chat.
 */
export async function ragChatHistory(token: string): Promise<unknown[]> {
  return ragFetch<unknown[]>('/api/chat/history', {}, token)
}

/**
 * Obtiene estadisticas del historial de chat (sesiones y mensajes).
 */
export async function ragChatStats(token: string): Promise<ChatHistoryStats> {
  return ragFetch<ChatHistoryStats>('/api/chat/stats', {}, token)
}

/**
 * Borra todo el historial de chat.
 */
export async function ragClearHistory(token: string): Promise<void> {
  await ragFetch<{ message: string }>(
    '/api/chat/history',
    { method: 'DELETE' },
    token
  )
}

/**
 * Borra una sesion de chat especifica.
 */
export async function ragDeleteSession(
  sessionId: string,
  token: string
): Promise<void> {
  await ragFetch<{ message: string }>(
    `/api/chat/history/${encodeURIComponent(sessionId)}`,
    { method: 'DELETE' },
    token
  )
}

/* -------------------------------------------------------------------------- */
/*                   EXTRACCION DE DATOS DE AERONAVES                         */
/* -------------------------------------------------------------------------- */

/** Variante de aeronave extraida de un TCDS */
export interface AircraftVariant {
  tcds_code: string
  tcds_code_short: string
  tcds_issue: string
  tcds_date: string
  fabricante: string
  pais: string
  tipo: string
  modelo: string
  msn_elegibles: string
  motor: string
  mtow_kg: number | null
  mlw_kg: number | null
  regulacion_base: string
  categoria: string
  notas: string
}

/** Resultado de la extraccion de datos de aeronaves por IA */
export interface ExtractionResult {
  variants: AircraftVariant[]
  model_used: string
  tokens_used: number
}

/**
 * Extrae datos estructurados de aeronaves del texto del TCDS usando IA.
 * Envia el texto completo de los chunks al backend, que utiliza un LLM
 * para identificar y estructurar las variantes de aeronave.
 */
export async function ragExtractAircraft(
  chunksText: string,
  documentCode: string,
  token: string
): Promise<ExtractionResult> {
  return ragFetch<ExtractionResult>(
    '/api/extract/aircraft',
    {
      method: 'POST',
      body: JSON.stringify({ chunks_text: chunksText, document_code: documentCode }),
    },
    token
  )
}

/**
 * Guarda las variantes de aeronave aprobadas en la tabla doa_aeronaves.
 * Solo se llama despues de que el usuario revise y apruebe los datos extraidos.
 */
export async function ragSaveAircraft(
  variants: AircraftVariant[],
  token: string
): Promise<{ saved: number }> {
  return ragFetch<{ saved: number }>(
    '/api/extract/aircraft/save',
    {
      method: 'POST',
      body: JSON.stringify({ variants }),
    },
    token
  )
}
