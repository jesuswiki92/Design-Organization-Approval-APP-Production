'use client'

/**
 * ============================================================================
 * COMPONENTE CLIENTE: TCDS RAG ENGINE DASHBOARD
 * ============================================================================
 *
 * Dashboard interactivo para gestionar el motor RAG de TCDS.
 * Conectado al backend FastAPI en localhost:3002 via lib/rag-api.ts.
 *
 * PESTANAS:
 *   1. Dashboard — estadisticas reales, stack tecnologico y estado operativo
 *   2. Ingest — carga de PDFs, analisis, procesamiento y guardado
 *   3. Documents — listado de documentos, visor de chunks y busqueda
 *
 * UBICACION ANTERIOR: app/(dashboard)/settings/tcds-rag/TcdsRagClient.tsx
 * Se movio a /tools porque TCDS RAG es una herramienta operativa, no un ajuste.
 * ============================================================================
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  LayoutDashboard,
  Upload,
  FileStack,
  Database,
  Wifi,
  WifiOff,
  Cpu,
  Layers3,
  Search,
  FileUp,
  FileText,
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  RefreshCw,
  Save,
  Plane,
  X,
  ClipboardPaste,
} from 'lucide-react'
import {
  ragHealth,
  ragDashboard,
  ragSettings,
  ragListDocuments,
  ragGetDocumentChunks,
  ragAnalyze,
  ragProcess,
  ragSave,
  ragChat,
  ragExtractAircraft,
  ragSaveAircraft,
  type RagHealthResponse,
  type RagDashboardStats,
  type RagSettings,
  type RagDocument,
  type RagChunk,
  type IngestAnalysis,
  type IngestProcessResult,
  type RagProcessedChunk,
  type ChatResponse,
  type AircraftVariant,
  type ExtractionResult,
} from '@/lib/rag-api'

/* -------------------------------------------------------------------------- */
/*                         TIPOS Y CONSTANTES LOCALES                         */
/* -------------------------------------------------------------------------- */

/** Identificadores de las pestanas disponibles */
type TabId = 'dashboard' | 'ingest' | 'extract' | 'documents'

/** Configuracion de cada pestana — orden: Dashboard | Ingest | Extraer | Documents */
const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'ingest', label: 'Ingest', icon: Upload },
  { id: 'extract', label: 'Extraer', icon: Plane },
  { id: 'documents', label: 'Documents', icon: FileStack },
]

/* -------------------------------------------------------------------------- */
/*                          COMPONENTE PRINCIPAL                              */
/* -------------------------------------------------------------------------- */

/**
 * Ya no se requiere autenticacion separada para el motor RAG.
 * El usuario ya esta autenticado en la app principal DOA.
 * Se pasa token vacio a las sub-pestanas; el backend se ajustara
 * para no requerir JWT en las rutas RAG.
 */

export function TcdsRagClient() {
  /** Leer parametro ?tab= de la URL para preseleccionar la pestana */
  const searchParams = useSearchParams()

  /** Pestana activa — se inicializa desde la URL si el valor es valido */
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const tabParam = searchParams.get('tab') as TabId | null
    const validTabs: TabId[] = ['dashboard', 'ingest', 'extract', 'documents']
    return tabParam && validTabs.includes(tabParam) ? tabParam : 'dashboard'
  })

  /** Indica si el servidor esta conectado */
  const [isConnected, setIsConnected] = useState<boolean | null>(null)

  /** Estado compartido: texto de chunks del ultimo documento procesado en Ingest */
  const [lastProcessedChunksText, setLastProcessedChunksText] = useState<string>('')
  /** Estado compartido: codigo del ultimo documento procesado en Ingest */
  const [lastProcessedDocCode, setLastProcessedDocCode] = useState<string>('')

  /** Verificar conexion al montar */
  useEffect(() => {
    ragHealth()
      .then(() => setIsConnected(true))
      .catch(() => setIsConnected(false))
  }, [])

  return (
    <div className="space-y-6">
      {/* === BARRA SUPERIOR: PESTANAS + ESTADO DE CONEXION === */}
      <div className="flex items-center justify-between gap-4">
        {/* Selector de pestanas */}
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Indicador de conexion */}
        <div className="flex items-center gap-2">
          {isConnected === null ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          ) : isConnected ? (
            <Wifi className="h-4 w-4 text-emerald-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-rose-500" />
          )}
          <span className="text-xs text-slate-500">
            {isConnected === null
              ? 'Verificando...'
              : isConnected
                ? 'Conectado'
                : 'Desconectado'}
          </span>
        </div>
      </div>

      {/* === CONTENIDO DE LA PESTANA ACTIVA === */}
      {activeTab === 'dashboard' && <DashboardTab token="" />}
      {activeTab === 'ingest' && (
        <IngestTab
          token=""
          onProcessComplete={(chunksText, docCode) => {
            setLastProcessedChunksText(chunksText)
            setLastProcessedDocCode(docCode)
          }}
          onGoToExtract={() => setActiveTab('extract')}
        />
      )}
      {activeTab === 'extract' && (
        <ExtractTab
          token=""
          lastProcessedChunksText={lastProcessedChunksText}
          lastProcessedDocCode={lastProcessedDocCode}
        />
      )}
      {activeTab === 'documents' && <DocumentsTab token="" />}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                      PESTANA 1: DASHBOARD                                  */
/* -------------------------------------------------------------------------- */

function DashboardTab({ token }: { token: string }) {
  /** Estado del dashboard: datos reales del backend */
  const [dashData, setDashData] = useState<RagDashboardStats | null>(null)
  const [settingsData, setSettingsData] = useState<RagSettings | null>(null)
  const [healthOk, setHealthOk] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /** Cargar datos del dashboard al montar */
  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Lanzar las tres peticiones en paralelo para velocidad
      const [healthRes, dashRes, settingsRes] = await Promise.allSettled([
        ragHealth(),
        ragDashboard(token),
        ragSettings(token),
      ])

      // Procesar resultado de health
      setHealthOk(healthRes.status === 'fulfilled')

      // Procesar resultado de dashboard
      if (dashRes.status === 'fulfilled') {
        setDashData(dashRes.value)
      }

      // Procesar resultado de settings
      if (settingsRes.status === 'fulfilled') {
        setSettingsData(settingsRes.value)
      }

      // Si todas fallaron, mostrar error
      if (
        healthRes.status === 'rejected' &&
        dashRes.status === 'rejected' &&
        settingsRes.status === 'rejected'
      ) {
        setError('No se pudo conectar con el servidor RAG')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  /** Tarjetas de estadisticas principales — datos reales del backend */
  const stats = [
    {
      label: 'Total Chunks',
      value: loading ? '...' : dashData ? String(dashData.documents) : '--',
      icon: Layers3,
      color: dashData ? 'text-sky-600' : 'text-slate-400',
      bg: dashData ? 'bg-sky-50' : 'bg-slate-50',
    },
    {
      label: 'Documentos Unicos',
      value: loading ? '...' : dashData ? String(dashData.uniqueDocuments) : '--',
      icon: FileStack,
      color: dashData ? 'text-violet-600' : 'text-slate-400',
      bg: dashData ? 'bg-violet-50' : 'bg-slate-50',
    },
    {
      label: 'Python API',
      value: loading
        ? '...'
        : healthOk
          ? 'Online'
          : 'Offline',
      icon: healthOk ? Wifi : WifiOff,
      color: healthOk ? 'text-emerald-600' : 'text-rose-600',
      bg: healthOk ? 'bg-emerald-50' : 'bg-rose-50',
    },
    {
      label: 'Mode',
      value: 'Hybrid',
      icon: Cpu,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
    },
  ]

  /** Stack tecnologico del sistema RAG */
  const techStack = [
    { label: 'Frontend', value: 'Next.js 16' },
    { label: 'Backend', value: settingsData ? `Python ${settingsData.python.version}` : 'Python FastAPI' },
    { label: 'Embeddings', value: settingsData?.capabilities.embeddings ? 'Google 3072-dim' : 'No configurado' },
    { label: 'Vector DB', value: settingsData?.capabilities.documents ? 'Supabase pgvector' : 'No configurado' },
    { label: 'Reranking', value: settingsData?.capabilities.reranking ? 'Cohere rerank-v3.5' : 'No configurado' },
    { label: 'OCR', value: settingsData?.capabilities.ocr ? 'Mistral OCR' : 'No configurado' },
  ]

  /** Estado operativo de cada componente — derivado de las capacidades reales */
  const operationalStatus = [
    {
      label: 'Extraccion OCR de PDFs',
      status: settingsData?.capabilities.ocr ? 'ok' : 'pending',
    },
    {
      label: 'Chunking semantico',
      status: healthOk ? 'ok' : 'pending',
    },
    {
      label: 'Generacion de embeddings',
      status: settingsData?.capabilities.embeddings ? 'ok' : 'pending',
    },
    {
      label: 'Almacenamiento en pgvector',
      status: settingsData?.capabilities.documents ? 'ok' : 'pending',
    },
    {
      label: 'Busqueda hibrida (texto + vector)',
      status: settingsData?.capabilities.chat ? 'ok' : 'pending',
    },
    {
      label: 'Reranking con Cohere',
      status: settingsData?.capabilities.reranking ? 'ok' : 'pending',
    },
  ]

  return (
    <div className="space-y-6">
      {/* --- Error global --- */}
      {error && (
        <div className="flex items-center justify-between rounded-[22px] border border-rose-200 bg-rose-50 px-5 py-3">
          <div className="flex items-center gap-2 text-sm text-rose-600">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
          <button
            onClick={loadDashboard}
            className="flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50"
          >
            <RefreshCw className="h-3 w-3" />
            Reintentar
          </button>
        </div>
      )}

      {/* --- Tarjetas de estadisticas --- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <div
              key={s.label}
              className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)]"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {s.label}
                </span>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-xl ${s.bg}`}
                >
                  <Icon className={`h-4 w-4 ${s.color}`} />
                </div>
              </div>
              <p className={`mt-2 text-xl font-bold ${s.color}`}>
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  s.value
                )}
              </p>
            </div>
          )
        })}
      </div>

      {/* --- Paneles informativos: stack tecnologico y estado operativo --- */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Panel izquierdo: Vision general del sistema */}
        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 text-sky-700">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-950">
                Vision general del sistema
              </h3>
              <p className="text-xs text-slate-500">
                Stack tecnologico del motor RAG
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {techStack.map((t) => (
              <div
                key={t.label}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5"
              >
                <span className="text-sm text-slate-600">{t.label}</span>
                <span className="text-sm font-medium text-slate-950">
                  {t.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Panel derecho: Estado operativo */}
        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-700">
              <Cpu className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-950">
                Estado operativo
              </h3>
              <p className="text-xs text-slate-500">
                Componentes del pipeline RAG
              </p>
            </div>
            {/* Boton para refrescar */}
            <button
              onClick={loadDashboard}
              disabled={loading}
              className="ml-auto flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>

          <div className="space-y-2">
            {operationalStatus.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5"
              >
                <span className="text-sm text-slate-600">{item.label}</span>
                {item.status === 'ok' ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                    <CheckCircle2 className="h-3 w-3" />
                    Activo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
                    <Clock className="h-3 w-3" />
                    Pendiente
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                      PESTANA 2: INGEST                                     */
/* -------------------------------------------------------------------------- */

/** Etapas del pipeline de ingesta */
type IngestStage = 'idle' | 'analyzing' | 'analyzed' | 'processing' | 'processed' | 'saving' | 'saved'

function IngestTab({
  token,
  onProcessComplete,
  onGoToExtract,
}: {
  token: string
  /** Callback para compartir el texto de chunks y codigo del documento procesado */
  onProcessComplete: (chunksText: string, docCode: string) => void
  /** Callback para navegar a la pestana Extraer */
  onGoToExtract: () => void
}) {
  /** Referencia al input de archivo oculto */
  const fileInputRef = useRef<HTMLInputElement>(null)
  /** Referencia al contenedor de logs para auto-scroll */
  const logEndRef = useRef<HTMLDivElement>(null)

  /** Archivo seleccionado por el usuario */
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  /** Etapa actual del procesamiento */
  const [stage, setStage] = useState<IngestStage>('idle')

  /** Resultado del analisis previo */
  const [analysis, setAnalysis] = useState<IngestAnalysis | null>(null)

  /** Resultado del procesamiento completo */
  const [processResult, setProcessResult] = useState<IngestProcessResult | null>(null)

  /** Mensajes del log tipo terminal */
  const [logs, setLogs] = useState<string[]>(['// Esperando documento para procesar...'])

  /** Error actual (si hay) */
  const [error, setError] = useState<string | null>(null)

  /** Agregar mensaje al log */
  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev, msg])
  }, [])

  /** Auto-scroll del log cuando cambia */
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  /** Maneja la seleccion de archivo desde el input o el drop */
  function handleFileChange(file: File | null) {
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file)
      setStage('idle')
      setAnalysis(null)
      setProcessResult(null)
      setError(null)
      setLogs([`// Archivo seleccionado: ${file.name}`])
    }
  }

  /** Formatea el tamano de archivo en KB o MB */
  function formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  /** Paso 1: Analizar el PDF (solo metadatos, sin procesar) */
  async function handleAnalyze() {
    if (!selectedFile) return
    setStage('analyzing')
    setError(null)
    addLog('>>> Analizando documento...')

    try {
      const result = await ragAnalyze(selectedFile, token)
      setAnalysis(result)
      setStage('analyzed')
      addLog(`OK: ${result.doc_info.file_name}`)
      addLog(`   Paginas: ${result.doc_info.num_pages}`)
      addLog(`   Tamano: ${result.doc_info.file_size_mb} MB`)
      addLog(`   Agencia: ${result.classification.agency}`)
      addLog(`   Codigo: ${result.classification.standard_code}`)
      addLog(`   Tipo: ${result.classification.doc_type}`)
      addLog(`   Costo estimado: $${result.estimated_cost}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al analizar'
      setError(msg)
      addLog(`ERROR: ${msg}`)
      setStage('idle')
    }
  }

  /** Paso 2: Procesar el PDF (OCR + chunking semantico) */
  async function handleProcess() {
    if (!selectedFile) return
    setStage('processing')
    setError(null)
    addLog('>>> Procesando documento (OCR + Chunking)...')
    addLog('   Esto puede tardar varios minutos...')

    try {
      const result = await ragProcess(selectedFile, token)
      setProcessResult(result)
      setStage('processed')

      // Agregar los logs del servidor
      for (const log of result.logs) {
        addLog(log)
      }

      addLog(`>>> Procesamiento completo: ${result.chunks.length} chunks generados`)
      addLog(`   Codigo: ${result.semantic_info.official_code}`)
      addLog('   Revisa los chunks abajo. Pulsa "Guardar" para indexar.')

      // Compartir texto de chunks y codigo con el componente padre para la pestana Extraer
      const fullText = result.chunks.map((c) => c.content).join('\n\n---\n\n')
      onProcessComplete(fullText, result.semantic_info.official_code)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al procesar'
      setError(msg)
      addLog(`ERROR: ${msg}`)
      setStage('analyzed')
    }
  }

  /** Paso 3: Guardar chunks con embeddings en Supabase */
  async function handleSave() {
    if (!processResult) return
    setStage('saving')
    setError(null)
    addLog('>>> Generando embeddings y guardando en Supabase...')

    try {
      const result = await ragSave(
        processResult.chunks,
        processResult.semantic_info,
        token
      )

      // Agregar los logs del servidor
      for (const log of result.logs) {
        addLog(log)
      }

      addLog(`>>> ${result.message}`)
      addLog(`   Total: ${result.result.total}, Exitosos: ${result.result.successful}, Fallidos: ${result.result.failed}`)

      // Only mark as saved if chunks were actually inserted
      if (result.result.successful > 0) {
        setStage('saved')
      } else {
        setError('El servidor no guardo ningun chunk. Revisa los logs para mas detalles.')
        setStage('processed')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar'
      setError(msg)
      addLog(`ERROR: ${msg}`)
      setStage('processed')
    }
  }

  /** Resetear todo para un nuevo documento */
  function handleReset() {
    setSelectedFile(null)
    setStage('idle')
    setAnalysis(null)
    setProcessResult(null)
    setError(null)
    setLogs(['// Esperando documento para procesar...'])
  }

  /** Determinar si un boton de accion esta habilitado.
   *  Se usa 'as string' para evitar que TypeScript estreche el tipo
   *  de stage en las comparaciones posteriores del JSX.
   */
  const stageStr = stage as string
  const canAnalyze = !!selectedFile && stageStr === 'idle'
  const canProcess = stageStr === 'analyzed'
  const canSave = stageStr === 'processed' && !!processResult
  const isAnalyzing = stageStr === 'analyzing'
  const isProcessing = stageStr === 'processing'
  const isSaving = stageStr === 'saving'
  const isSaved = stageStr === 'saved'

  return (
    <div className="space-y-6">
      {/* --- Zona de carga de archivos --- */}
      <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-950">
            Cargar documento PDF
          </h3>
          {stage === 'saved' && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-600 transition-colors hover:bg-sky-100"
            >
              <RefreshCw className="h-3 w-3" />
              Nuevo documento
            </button>
          )}
        </div>

        {/* Zona de drag & drop */}
        <div
          className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 transition-colors hover:border-sky-400 hover:bg-sky-50/30"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const file = e.dataTransfer.files?.[0] ?? null
            handleFileChange(file)
          }}
        >
          <FileUp className="h-8 w-8 text-slate-400" />
          <p className="text-sm text-slate-600">
            Arrastra un PDF aqui o haz clic para seleccionar
          </p>
          <p className="text-xs text-slate-400">Solo archivos .pdf</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) =>
              handleFileChange(e.target.files?.[0] ?? null)
            }
          />
        </div>

        {/* Informacion del archivo seleccionado */}
        {selectedFile && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
            <FileText className="h-5 w-5 text-sky-600" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-950">
                {selectedFile.name}
              </p>
              <p className="text-xs text-slate-500">
                {formatSize(selectedFile.size)}
                {analysis && (
                  <> &middot; {analysis.doc_info.num_pages} paginas &middot; {analysis.classification.agency} &middot; {analysis.classification.standard_code}</>
                )}
              </p>
            </div>
            {stage === 'idle' && (
              <button
                onClick={() => {
                  setSelectedFile(null)
                  setLogs(['// Esperando documento para procesar...'])
                }}
                className="text-xs text-slate-400 transition-colors hover:text-rose-600"
              >
                Quitar
              </button>
            )}
          </div>
        )}

        {/* Resultado del analisis: detalles de clasificacion */}
        {analysis && stage !== 'idle' && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Paginas', value: String(analysis.doc_info.num_pages) },
              { label: 'Agencia', value: analysis.classification.agency },
              { label: 'Codigo', value: analysis.classification.standard_code },
              { label: 'Tipo', value: analysis.classification.doc_type },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {item.label}
                </p>
                <p className="truncate text-sm font-medium text-slate-800">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-600">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Botones de accion */}
        <div className="mt-4 flex flex-wrap gap-3">
          {/* Boton 1: Analizar */}
          <button
            onClick={handleAnalyze}
            disabled={!canAnalyze || isAnalyzing}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
              canAnalyze
                ? 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
                : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
            }`}
          >
            {isAnalyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            1. Analizar
          </button>

          {/* Boton 2: Procesar */}
          <button
            onClick={handleProcess}
            disabled={!canProcess || isProcessing}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
              canProcess
                ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
            }`}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Layers3 className="h-4 w-4" />
            )}
            2. Procesar
          </button>

          {/* Boton 3: Guardar */}
          <button
            onClick={handleSave}
            disabled={!canSave || isSaving}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
              canSave
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
            }`}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            3. Guardar
          </button>

          {/* Indicador de etapa completada */}
          {isSaved && (
            <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              Documento indexado exitosamente
            </div>
          )}
        </div>

        {/* Sugerencia para extraer datos de aeronave despues de guardar */}
        {isSaved && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <Plane className="h-4 w-4 text-sky-600" />
              <span className="text-sm text-sky-800">
                Documento procesado. ¿Extraer datos de aeronave?
              </span>
            </div>
            <button
              onClick={onGoToExtract}
              className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-sky-700"
            >
              <Plane className="h-3 w-3" />
              Ir a Extraer
            </button>
          </div>
        )}
      </div>

      {/* --- Log de procesamiento (terminal) --- */}
      <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
        <h3 className="mb-4 text-sm font-semibold text-slate-950">
          Log de procesamiento
        </h3>
        <div className="max-h-72 overflow-y-auto rounded-xl bg-slate-900 p-4 font-mono text-sm leading-6">
          {logs.map((log, i) => (
            <p
              key={i}
              className={
                log.startsWith('ERROR')
                  ? 'text-rose-400'
                  : log.startsWith('>>>')
                    ? 'text-sky-400'
                    : log.startsWith('OK') || log.includes('OK')
                      ? 'text-green-400'
                      : log.startsWith('//')
                        ? 'text-slate-500'
                        : 'text-green-400'
              }
            >
              {log}
            </p>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* --- Vista previa de chunks --- */}
      <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
        <h3 className="mb-4 text-sm font-semibold text-slate-950">
          Vista previa de chunks
          {processResult && (
            <span className="ml-2 text-xs font-normal text-slate-400">
              ({processResult.chunks.length} chunks)
            </span>
          )}
        </h3>

        {processResult && processResult.chunks.length > 0 ? (
          <div className="max-h-96 space-y-3 overflow-y-auto">
            {processResult.chunks.map((chunk, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-100 bg-slate-50 p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-sky-600">
                    #{i + 1} &middot; {chunk.section_id || 'Sin seccion'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {chunk.char_count} chars
                  </span>
                </div>
                <p className="line-clamp-4 text-xs leading-relaxed text-slate-600">
                  {chunk.content}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10">
            <Layers3 className="h-6 w-6 text-slate-300" />
            <p className="text-sm text-slate-400">
              Los chunks apareceran aqui despues del procesamiento
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                 PESTANA 3: EXTRAER (Extraccion de datos de aeronaves)       */
/* -------------------------------------------------------------------------- */

/** Etapas del flujo de extraccion */
type ExtractStage = 'select' | 'extracting' | 'review' | 'saving' | 'saved'

function ExtractTab({
  token,
  lastProcessedChunksText,
  lastProcessedDocCode,
}: {
  token: string
  /** Texto de chunks del ultimo documento procesado en Ingest */
  lastProcessedChunksText: string
  /** Codigo del ultimo documento procesado en Ingest */
  lastProcessedDocCode: string
}) {
  /** Etapa actual del flujo de extraccion */
  const [stage, setStage] = useState<ExtractStage>('select')

  /** Texto fuente para la extraccion (pegado o proveniente de Ingest) */
  const [sourceText, setSourceText] = useState('')

  /** Codigo del documento TCDS */
  const [documentCode, setDocumentCode] = useState('')

  /** Resultado de la extraccion por IA */
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null)

  /** Variantes editables (el usuario puede eliminar filas antes de guardar) */
  const [variants, setVariants] = useState<AircraftVariant[]>([])

  /** Numero de variantes guardadas (para confirmacion) */
  const [savedCount, setSavedCount] = useState(0)

  /** Error actual */
  const [error, setError] = useState<string | null>(null)

  /** Usar datos del ultimo documento procesado en Ingest */
  function handleUseLastProcessed() {
    if (lastProcessedChunksText) {
      setSourceText(lastProcessedChunksText)
      setDocumentCode(lastProcessedDocCode)
    }
  }

  /** Lanzar la extraccion por IA */
  async function handleExtract() {
    if (!sourceText.trim()) {
      setError('No hay texto fuente para extraer. Pega texto o usa el ultimo documento procesado.')
      return
    }
    setStage('extracting')
    setError(null)

    try {
      const result = await ragExtractAircraft(sourceText, documentCode, token)
      setExtractionResult(result)
      setVariants(result.variants)
      setStage('review')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error durante la extraccion'
      setError(msg)
      setStage('select')
    }
  }

  /** Eliminar una variante de la lista antes de guardar */
  function handleRemoveVariant(index: number) {
    setVariants((prev) => prev.filter((_, i) => i !== index))
  }

  /** Aprobar y guardar las variantes en la base de datos */
  async function handleSave() {
    if (variants.length === 0) {
      setError('No hay variantes para guardar.')
      return
    }
    setStage('saving')
    setError(null)

    try {
      const result = await ragSaveAircraft(variants, token)
      setSavedCount(result.saved)
      setStage('saved')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar'
      setError(msg)
      setStage('review')
    }
  }

  /** Resetear todo para una nueva extraccion */
  function handleReset() {
    setStage('select')
    setSourceText('')
    setDocumentCode('')
    setExtractionResult(null)
    setVariants([])
    setSavedCount(0)
    setError(null)
  }

  /** Determinar estado para deshabilitar/habilitar botones */
  const stageStr = stage as string
  const isExtracting = stageStr === 'extracting'
  const isReview = stageStr === 'review'
  const isSaving = stageStr === 'saving'
  const isSaved = stageStr === 'saved'

  return (
    <div className="space-y-6">
      {/* === PASO 1: SELECCIONAR FUENTE === */}
      {(stageStr === 'select' || stageStr === 'extracting') && (
        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 text-sky-700">
              <Plane className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-950">
                Extraer datos de aeronave
              </h3>
              <p className="text-xs text-slate-500">
                Usa IA para extraer datos estructurados de un TCDS
              </p>
            </div>
          </div>

          {/* Boton para usar el ultimo documento procesado */}
          {lastProcessedChunksText && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-sm text-emerald-800">
                  Documento disponible: <strong>{lastProcessedDocCode || 'ultimo procesado'}</strong>
                </span>
              </div>
              <button
                onClick={handleUseLastProcessed}
                disabled={isExtracting}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                <ClipboardPaste className="h-3 w-3" />
                Usar este documento
              </button>
            </div>
          )}

          {/* Codigo del documento */}
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Codigo del documento TCDS
            </label>
            <input
              type="text"
              value={documentCode}
              onChange={(e) => setDocumentCode(e.target.value)}
              placeholder="Ej: EASA.A.064"
              disabled={isExtracting}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-sky-300 focus:ring-1 focus:ring-sky-200 disabled:opacity-50"
            />
          </div>

          {/* Area de texto para pegar contenido */}
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Texto fuente (contenido del TCDS)
            </label>
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder="Pega aqui el texto del TCDS o usa el boton de arriba para cargar el ultimo documento procesado..."
              rows={8}
              disabled={isExtracting}
              className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs leading-relaxed text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-sky-300 focus:ring-1 focus:ring-sky-200 disabled:opacity-50"
            />
            {sourceText && (
              <p className="mt-1 text-[10px] text-slate-400">
                {sourceText.length.toLocaleString()} caracteres
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-600">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Boton de extraccion */}
          <button
            onClick={handleExtract}
            disabled={isExtracting || !sourceText.trim()}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-colors ${
              sourceText.trim() && !isExtracting
                ? 'bg-sky-600 text-white hover:bg-sky-700'
                : 'cursor-not-allowed bg-slate-200 text-slate-400'
            }`}
          >
            {isExtracting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Extrayendo datos con IA...
              </>
            ) : (
              <>
                <Plane className="h-4 w-4" />
                Extraer datos de aeronave
              </>
            )}
          </button>
        </div>
      )}

      {/* === PASO 2: EXTRACCION EN PROGRESO (spinner) === */}
      {isExtracting && (
        <div className="rounded-[22px] border border-slate-200 bg-white p-10 text-center shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-sky-500" />
          <p className="mt-4 text-sm font-medium text-slate-600">
            Extrayendo datos con IA...
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Analizando el contenido del TCDS para identificar variantes de aeronave
          </p>
        </div>
      )}

      {/* === PASO 3: REVISION DE DATOS EXTRAIDOS === */}
      {(isReview || isSaving || isSaved) && extractionResult && (
        <div className="space-y-5">
          {/* Cabecera con informacion del TCDS */}
          <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 text-sky-700">
                  <Plane className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">
                    Datos extraidos del TCDS
                  </h3>
                  <p className="text-xs text-slate-500">
                    Revisa los datos antes de guardar en la base de datos
                  </p>
                </div>
              </div>
              {!isSaved && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50"
                >
                  <RefreshCw className="h-3 w-3" />
                  Nueva extraccion
                </button>
              )}
            </div>

            {/* ================================================================
               TARJETA PROMINENTE DE IDENTIFICACION TCDS
               El codigo TCDS (especialmente el "short") es el identificador
               clave para proyectos en la DOA. Se muestra grande y destacado
               para que el usuario lo identifique de inmediato.
               ================================================================ */}
            <div className="mb-4 rounded-xl border-2 border-sky-200 bg-gradient-to-r from-sky-50 via-white to-sky-50 p-4">
              <div className="flex flex-wrap items-center gap-6">
                {/* Codigo TCDS completo — grande y en negrita */}
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    TCDS Code
                  </p>
                  <p className="text-2xl font-bold tracking-tight text-slate-900">
                    {(variants.length > 0 && variants[0].tcds_code) || documentCode || '--'}
                  </p>
                </div>

                {/* Codigo TCDS corto — badge destacado, es el que se usa para codigos de proyecto */}
                {variants.length > 0 && variants[0].tcds_code_short && (
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-500">
                      Codigo Proyecto
                    </p>
                    <span className="mt-0.5 inline-flex items-center rounded-lg bg-sky-600 px-3 py-1 text-lg font-bold text-white shadow-md shadow-sky-200">
                      {variants[0].tcds_code_short}
                    </span>
                  </div>
                )}

                {/* Separador vertical */}
                <div className="hidden h-12 w-px bg-slate-200 sm:block" />

                {/* Issue y Fecha */}
                <div className="flex flex-wrap gap-4">
                  {variants.length > 0 && variants[0].tcds_issue && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Issue
                      </p>
                      <p className="text-sm font-medium text-slate-800">
                        {variants[0].tcds_issue}
                      </p>
                    </div>
                  )}
                  {variants.length > 0 && variants[0].tcds_date && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Fecha
                      </p>
                      <p className="text-sm font-medium text-slate-800">
                        {variants[0].tcds_date}
                      </p>
                    </div>
                  )}
                </div>

                {/* Separador vertical */}
                <div className="hidden h-12 w-px bg-slate-200 sm:block" />

                {/* Fabricante y Tipo */}
                <div className="flex flex-wrap gap-4">
                  {variants.length > 0 && variants[0].fabricante && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Fabricante
                      </p>
                      <p className="text-sm font-medium text-slate-800">
                        {variants[0].fabricante}
                      </p>
                    </div>
                  )}
                  {variants.length > 0 && variants[0].tipo && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Tipo
                      </p>
                      <p className="text-sm font-medium text-slate-800">
                        {variants[0].tipo}
                      </p>
                    </div>
                  )}
                </div>

                {/* Contador de variantes — a la derecha */}
                <div className="ml-auto rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-500">
                    Variantes
                  </p>
                  <p className="text-lg font-bold text-sky-700">
                    {variants.length}
                  </p>
                </div>
              </div>
            </div>

            {/* Metadata de la extraccion */}
            <div className="flex items-center gap-4 text-[10px] text-slate-400">
              <span>Modelo IA: {extractionResult.model_used}</span>
              <span>Tokens: {extractionResult.tokens_used.toLocaleString()}</span>
            </div>
          </div>

          {/* Tabla de variantes */}
          <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
            <h3 className="mb-4 text-sm font-semibold text-slate-950">
              Variantes de aeronave
              <span className="ml-2 text-xs font-normal text-slate-400">
                ({variants.length} {variants.length === 1 ? 'variante' : 'variantes'})
              </span>
            </h3>

            {variants.length > 0 ? (
              <div className="overflow-x-auto">
                {/* Tabla de variantes — TCDS CODE como primera columna
                   porque es el identificador principal de proyecto en la DOA */}
                <table className="w-full min-w-[1000px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      {/* Primera columna: TCDS CODE — destacada porque identifica el proyecto */}
                      <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-sky-600 bg-sky-50 rounded-tl-lg">
                        TCDS Code
                      </th>
                      <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Modelo
                      </th>
                      <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Fabricante
                      </th>
                      <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Motor
                      </th>
                      <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        MTOW (kg)
                      </th>
                      <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        MLW (kg)
                      </th>
                      <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 bg-amber-50 rounded-t-lg">
                        Regulacion Base
                      </th>
                      <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Categoria
                      </th>
                      <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        MSN Elegibles
                      </th>
                      {/* Columna de acciones solo si no se ha guardado todavia */}
                      {!isSaved && (
                        <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          {/* Sin titulo, solo icono de eliminar */}
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v, i) => (
                      <tr
                        key={i}
                        className="border-b border-slate-100 transition-colors hover:bg-slate-50"
                      >
                        {/* Codigo TCDS corto — badge destacado en cada fila para identificacion rapida */}
                        <td className="px-3 py-2.5 bg-sky-50/50">
                          <span className="inline-flex items-center rounded-md bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-800">
                            {v.tcds_code_short || v.tcds_code || '--'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-medium text-slate-900">
                          {v.modelo || '--'}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">
                          {v.fabricante || '--'}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">
                          <span className="max-w-[180px] truncate block" title={v.motor}>
                            {v.motor || '--'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 tabular-nums">
                          {v.mtow_kg != null ? v.mtow_kg.toLocaleString() : '--'}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 tabular-nums">
                          {v.mlw_kg != null ? v.mlw_kg.toLocaleString() : '--'}
                        </td>
                        {/* Columna destacada: Regulacion Base */}
                        <td className="px-3 py-2.5 bg-amber-50">
                          <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            {v.regulacion_base || '--'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">
                          {v.categoria || '--'}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">
                          <span className="max-w-[140px] truncate block text-xs" title={v.msn_elegibles}>
                            {v.msn_elegibles || '--'}
                          </span>
                        </td>
                        {/* Boton de eliminar fila */}
                        {!isSaved && (
                          <td className="px-3 py-2.5">
                            <button
                              onClick={() => handleRemoveVariant(i)}
                              disabled={isSaving}
                              className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                              title="Eliminar variante"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10">
                <Plane className="h-6 w-6 text-slate-300" />
                <p className="text-sm text-slate-400">
                  No hay variantes para mostrar. Se han eliminado todas las filas.
                </p>
              </div>
            )}
          </div>

          {/* Notas de las variantes (si hay) */}
          {variants.some((v) => v.notas) && (
            <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
              <h3 className="mb-3 text-sm font-semibold text-slate-950">
                Notas adicionales
              </h3>
              <div className="space-y-2">
                {variants
                  .filter((v) => v.notas)
                  .map((v, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5"
                    >
                      <span className="text-xs font-semibold text-sky-600">
                        {v.modelo}:
                      </span>{' '}
                      <span className="text-xs text-slate-600">{v.notas}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-600">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* === PASO 4: BOTONES DE ACCION === */}
          {!isSaved && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={isSaving || variants.length === 0}
                className={`flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-colors ${
                  variants.length > 0 && !isSaving
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700'
                    : 'cursor-not-allowed bg-slate-200 text-slate-400'
                }`}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Aprobar y guardar en Base de Datos
                  </>
                )}
              </button>
              <span className="text-xs text-slate-400">
                {variants.length} {variants.length === 1 ? 'variante' : 'variantes'} para guardar
              </span>
            </div>
          )}

          {/* Confirmacion de guardado exitoso */}
          {isSaved && (
            <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-800">
                      {savedCount} {savedCount === 1 ? 'variante guardada' : 'variantes guardadas'} en aeronaves
                    </h3>
                    <p className="text-xs text-emerald-600">
                      Los datos han sido aprobados y almacenados correctamente
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
                >
                  <RefreshCw className="h-3 w-3" />
                  Nueva extraccion
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                      PESTANA 4: DOCUMENTS                                  */
/* -------------------------------------------------------------------------- */

function DocumentsTab({ token }: { token: string }) {
  /** Lista de documentos indexados */
  const [documents, setDocuments] = useState<RagDocument[]>([])
  /** Documento seleccionado */
  const [selectedDoc, setSelectedDoc] = useState<RagDocument | null>(null)
  /** Chunks del documento seleccionado */
  const [chunks, setChunks] = useState<RagChunk[]>([])

  /** Estados de carga */
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [loadingChunks, setLoadingChunks] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** Busqueda local en la lista de documentos */
  const [searchQuery, setSearchQuery] = useState('')

  /** Busqueda semantica (chat) */
  const [chatQuery, setChatQuery] = useState('')
  const [chatResult, setChatResult] = useState<ChatResponse | null>(null)
  const [searchingChat, setSearchingChat] = useState(false)

  /** Cargar lista de documentos al montar */
  const loadDocuments = useCallback(async () => {
    setLoadingDocs(true)
    setError(null)
    try {
      const docs = await ragListDocuments(token)
      setDocuments(docs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar documentos')
    } finally {
      setLoadingDocs(false)
    }
  }, [token])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  /** Cargar chunks de un documento al seleccionarlo */
  async function handleSelectDoc(doc: RagDocument) {
    setSelectedDoc(doc)
    setChunks([])
    setChatResult(null)
    setLoadingChunks(true)
    setError(null)

    try {
      const docChunks = await ragGetDocumentChunks(doc.code, token)
      setChunks(docChunks)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar chunks')
    } finally {
      setLoadingChunks(false)
    }
  }

  /** Busqueda semantica con el motor RAG */
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!chatQuery.trim()) return

    setSearchingChat(true)
    setChatResult(null)
    setError(null)

    try {
      const result = await ragChat(chatQuery, token)
      setChatResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en la busqueda')
    } finally {
      setSearchingChat(false)
    }
  }

  /** Filtrar documentos por texto de busqueda local */
  const filteredDocs = documents.filter((doc) => {
    const q = searchQuery.toLowerCase()
    return (
      doc.code.toLowerCase().includes(q) ||
      doc.title.toLowerCase().includes(q) ||
      doc.agency.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-5">
      {/* --- Busqueda semantica RAG --- */}
      <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
        <h3 className="mb-3 text-sm font-semibold text-slate-950">
          Busqueda semantica RAG
        </h3>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={chatQuery}
              onChange={(e) => setChatQuery(e.target.value)}
              placeholder="Buscar en todos los documentos indexados..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-sky-300 focus:ring-1 focus:ring-sky-200"
            />
          </div>
          <button
            type="submit"
            disabled={searchingChat || !chatQuery.trim()}
            className="flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {searchingChat ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Buscar
          </button>
        </form>

        {/* Resultados de busqueda semantica */}
        {chatResult && (
          <div className="mt-4 space-y-3">
            {/* Respuesta generada */}
            <div className="rounded-xl border border-sky-100 bg-sky-50 p-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-sky-500">
                Respuesta
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                {chatResult.answer}
              </p>
              {chatResult.tokens_used > 0 && (
                <p className="mt-2 text-[10px] text-slate-400">
                  {chatResult.tokens_used} tokens usados
                </p>
              )}
            </div>

            {/* Fuentes */}
            {chatResult.sources.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-500">
                  Fuentes ({chatResult.sources.length})
                </p>
                <div className="space-y-2">
                  {chatResult.sources.map((src, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-slate-100 bg-slate-50 p-3"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-semibold text-sky-600">
                          {src.code} &middot; {src.section}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Score: {(src.score * 100).toFixed(1)}%
                        </span>
                      </div>
                      <p className="line-clamp-2 text-xs text-slate-600">
                        {src.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- Grid de documentos y chunks --- */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Panel izquierdo: lista de documentos indexados */}
        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)] xl:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-950">
              Documentos indexados
              {documents.length > 0 && (
                <span className="ml-1.5 text-xs font-normal text-slate-400">
                  ({documents.length})
                </span>
              )}
            </h3>
            <button
              onClick={loadDocuments}
              disabled={loadingDocs}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-500 transition-colors hover:bg-slate-50"
            >
              <RefreshCw className={`h-3 w-3 ${loadingDocs ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Buscador local */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar documentos..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-sky-300 focus:ring-1 focus:ring-sky-200"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Lista de documentos o estado vacio */}
          {loadingDocs ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
            </div>
          ) : filteredDocs.length > 0 ? (
            <div className="max-h-[500px] space-y-2 overflow-y-auto">
              {filteredDocs.map((doc) => (
                <button
                  key={doc.code}
                  onClick={() => handleSelectDoc(doc)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                    selectedDoc?.code === doc.code
                      ? 'border-sky-300 bg-sky-50'
                      : 'border-slate-100 bg-slate-50 hover:border-sky-200 hover:bg-sky-50/50'
                  }`}
                >
                  <p className="truncate text-sm font-medium text-slate-950">
                    {doc.code}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {doc.title || doc.doc_type || 'Sin titulo'}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-md bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                      {doc.agency}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {doc.chunk_count} chunks
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10">
              <FileStack className="h-6 w-6 text-slate-300" />
              <p className="text-center text-sm text-slate-400">
                {searchQuery
                  ? 'No se encontraron documentos'
                  : 'No hay documentos indexados'}
              </p>
            </div>
          )}
        </div>

        {/* Panel derecho: visor de chunks del documento seleccionado */}
        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)] xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-950">
              {selectedDoc ? (
                <>
                  Chunks: {selectedDoc.code}
                  <span className="ml-1.5 text-xs font-normal text-slate-400">
                    ({chunks.length} chunks)
                  </span>
                </>
              ) : (
                'Chunks del documento'
              )}
            </h3>
          </div>

          {/* Contenido: chunks o estado vacio */}
          {loadingChunks ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
            </div>
          ) : chunks.length > 0 ? (
            <div className="max-h-[600px] space-y-3 overflow-y-auto">
              {chunks.map((chunk, i) => (
                <div
                  key={chunk.id}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                >
                  {/* Cabecera del chunk */}
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-sky-600">
                      #{i + 1}
                    </span>
                    {chunk.section_id && (
                      <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                        {chunk.section_id}
                      </span>
                    )}
                    {chunk.chapter && (
                      <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                        {chunk.chapter}
                      </span>
                    )}
                    {chunk.page_number && (
                      <span className="text-[10px] text-slate-400">
                        Pag. {chunk.page_number}
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-slate-400">
                      {chunk.char_count} chars
                    </span>
                    {chunk.has_image && (
                      <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        Imagen
                      </span>
                    )}
                  </div>

                  {/* Titulo/topico del chunk */}
                  {chunk.topic && (
                    <p className="mb-1.5 text-xs font-medium text-slate-700">
                      {chunk.topic}
                    </p>
                  )}

                  {/* Contenido del chunk */}
                  <p className="line-clamp-6 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">
                    {chunk.content}
                  </p>

                  {/* Imagen de captura de pagina si existe */}
                  {chunk.page_capture_url && (
                    <div className="mt-2">
                      <a
                        href={chunk.page_capture_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-sky-500 hover:underline"
                      >
                        Ver captura de pagina
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-16">
              <Database className="h-6 w-6 text-slate-300" />
              <p className="text-sm text-slate-400">
                Selecciona un documento para ver sus chunks
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
