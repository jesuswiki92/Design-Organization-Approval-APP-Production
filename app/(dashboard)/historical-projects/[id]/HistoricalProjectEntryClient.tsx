/**
 * ============================================================================
 * PAGINA DE DETALLE DE UN PROYECTO HISTORICO
 * ============================================================================
 *
 * Este archivo muestra la "ficha" completa de un project historical de aviacion.
 * Es una vista de SOLO LECTURA: el user_label puede consultar los data del
 * project pero NO puede editarlos desde aqui.
 *
 * La page se divide en varias secciones:
 *   - Cabecera con title, numero de project y data resumidos
 *   - Botones de atajo para saltar rapidamente a cada seccion
 *   - Bloque 01: Data basicos (codigo, client, title, year)
 *   - Bloque 02: Origen (folder y path de donde se importo el project)
 *   - Bloque 03: Description (text libre del project)
 *   - Bloque 04: Compliance Documents (MDL colapsable + familias documentales)
 *   - Metadata: Dates de creacion y ultima actualizacion
 *   - Siguiente paso: Lista de bloques que aun no estan implementados
 *
 * NOTA TECNICA: Este componente usa 'use client' porque necesita interactuar
 * con el navegador (por ejemplo, hacer scroll suave al pulsar los atajos).
 * ============================================================================
 */

'use client'

// -- Importaciones de librerias externas --
// Link: permite navegar entre paginas de la aplicacion sin recargar toda la website
import Link from 'next/link'
// Iconos decorativos que se muestran junto a las etiquetas de los campos
import {
  ArrowLeft,       // Flecha hacia la izquierda (boton "Volver")
  CalendarDays,    // Icono de calendario (campo de year)
  Check,           // Icono de checkmark (feedback al copiar path)
  ChevronDown,     // Icono de chevron hacia abajo (seccion expandida)
  ChevronRight,    // Icono de chevron hacia la derecha (seccion colapsada)
  Copy,            // Icono de copiar (boton copiar path)
  FileText,        // Icono de document (campos de title y path)
  FolderOpen,      // Icono de folder abierta (campo de folder de origen)
  Hash,            // Icono de almohadilla/numeral (campo de codigo)
  NotebookTabs,    // Icono de libreta (campo de client)
} from 'lucide-react'
// ReactNode: type que representa cualquier contenido visual de React (text, iconos, etc.)
import { type ReactNode, useMemo, useState } from 'react'

// Tipos para el Master Document List (MDL) del project
import type {
  MdlContent,
  MdlDocument,
  HistoricalProjectFile,
  HistoricalProjectRow,
} from '@/types/database'

// ============================================================================
// DEFINICION DE LA ESTRUCTURA DE DATOS
// ============================================================================
// Estas "interfaces" describen la forma que tienen los data que llegan desde
// la base de data. Es como una template que dice "un project historical
// siempre tiene estos campos, con estos tipos de valor".

/**
 * Estructura de un project historical.
 * Cada campo corresponde a una columna de la table en la base de data.
 *
 * - id: identificador unico internal (no se muestra al user_label)
 * - project_number: codigo visible del project (ej: "PRJ-2024-001")
 * - title: name descriptivo del project
 * - description: text libre con detalles del project (puede estar vacio)
 * - client_name: name del client asociado (puede estar vacio)
 * - year: year del project (puede estar vacio)
 * - source_path: path completa de la folder original en el servidor
 * - source_folder_name: name corto de la folder de donde se importo
 * - created_at: date en que se creo el registro en la base de data
 * - updated_at: date de la ultima modificacion del registro
 */
type ProyectoHistoricoDetailRow = Omit<HistoricalProjectRow, 'mdl_content'> & {
  mdl_content: MdlContent | null
}

/**
 * Estructura de un document/family documental del project historical.
 * Cada registro representa una family documental con sus archivos asociados.
 */
interface ProyectoHistoricoDocumentoRow {
  id: string
  historical_project_id: string
  orden_documental: number | null
  familia_documental: string
  carpeta_origen: string
  source_path: string
  archivo_referencia: string | null
  total_archivos: number
  formatos_disponibles: string[]
  created_at: string
  updated_at: string
  archivos: HistoricalProjectFile[]
}

// ============================================================================
// COMPONENTES AUXILIARES (piezas reutilizables de la interfaz)
// ============================================================================

/**
 * DataField - Tarjeta individual de dato
 *
 * Muestra un campo de informacion con su etiqueta, icono y valor.
 * Se usa para presentar cada dato del project (codigo, client, title, etc.)
 * de forma visual y ordenada, como una "ficha" pequena.
 *
 * Si el campo no tiene valor, muestra un guion "-" en gris para indicar
 * que el dato no esta disponible.
 *
 * Parametros que recibe:
 *   - label: text de la etiqueta (ej: "Codigo", "Client")
 *   - icon: icono decorativo que acompana a la etiqueta
 *   - value: el valor del dato a mostrar (puede estar vacio)
 *   - wide: si es verdadero, la tarjeta ocupa el ancho de dos columnas
 */
function DataField({
  label,
  icon,
  value,
  wide,
}: {
  label: string
  icon: ReactNode
  value: string | null | undefined
  wide?: boolean
}) {
  return (
    // Tarjeta con bordes redondeados y fondo gris claro
    // Si "wide" es verdadero, ocupa dos columnas en pantallas medianas o mayores
    <div className={`rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/80 px-4 py-3.5 ${wide ? 'md:col-span-2' : ''}`}>
      {/* Etiqueta superior: muestra el icono y el name del campo en mayusculas */}
      <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
        {icon}
        {label}
      </span>
      {/* Valor del campo: si no hay dato, muestra un guion gris en cursiva */}
      <p className="mt-1.5 text-sm leading-6 text-[color:var(--ink)]">
        {value || <span className="italic text-[color:var(--ink-3)]">-</span>}
      </p>
    </div>
  )
}

/**
 * ShortcutButton - Boton de atajo de navegacion
 *
 * Es un boton pequeno y redondeado que, al pulsarlo, desplaza la pantalla
 * suavemente hasta una seccion especifica de la page. Funciona como un
 * "indice rapido" para que el user_label no tenga que hacer scroll manualmente.
 *
 * Parametros que recibe:
 *   - label: text que se muestra en el boton (ej: "Data basicos")
 *   - targetId: identificador de la seccion a la que debe saltar (ej: "data-basicos")
 */
function ShortcutButton({ label, targetId }: { label: string; targetId: string }) {
  return (
    <button
      type="button"
      // Al hacer clic, busca la seccion por su identificador y desplaza la pantalla
      // suavemente hasta ella ("smooth" = desplazamiento animado, no brusco)
      onClick={() =>
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      className="rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-3 py-1.5 text-xs font-medium text-[color:var(--ink-3)] shadow-sm transition-colors hover:border-[color:var(--ink-4)] hover:text-[color:var(--ink-2)]"
    >
      {label}
    </button>
  )
}

/**
 * MdlDocumentList - Lista compacta de documents del MDL
 *
 * Renderiza las filas de documents de una seccion del MDL (entregables o no
 * entregables). Cada fila muestra referencia, title, edicion, date y status.
 * Los documents Active aparecen primero; los Superseded van al final, atenuados.
 */
function MdlDocumentList({ docs }: { docs: MdlDocument[] }) {
  // Ordenar: Active primero, Superseded al final
  const sorted = [...docs].sort((a, b) => {
    if (a.status === 'Active' && b.status !== 'Active') return -1
    if (a.status !== 'Active' && b.status === 'Active') return 1
    return 0
  })

  return (
    <div className="divide-y divide-[color:var(--ink-4)]">
      {sorted.map((doc, idx) => {
        const isSuperseded = doc.status === 'Superseded'
        return (
          <div
            key={`${doc.ref}-${idx}`}
            className={`flex items-center gap-3 px-4 py-2 ${isSuperseded ? 'opacity-60' : ''}`}
          >
            {/* Badge de referencia */}
            <span className="shrink-0 rounded bg-[color:var(--paper-2)] px-2 py-0.5 font-mono text-[11px] font-medium text-[color:var(--ink-2)]">
              {doc.ref}
            </span>

            {/* Titulo del document */}
            <span className={`min-w-0 flex-1 truncate text-sm text-[color:var(--ink-2)] ${isSuperseded ? 'line-through' : ''}`}>
              {doc.title}
            </span>

            {/* Badge de edicion */}
            <span className="hidden shrink-0 rounded-full bg-[color:var(--paper-2)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--ink-3)] sm:inline-block">
              Ed {doc.edicion}
            </span>

            {/* Date */}
            <span className="hidden shrink-0 text-[11px] text-[color:var(--ink-3)] md:inline-block">
              {doc.date}
            </span>

            {/* Pill de status */}
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                isSuperseded
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {doc.status}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================================
// MARKDOWN PARSER MINIMO (sin dependencias externas)
// ============================================================================
// Parsea el markdown del resumen de project para renderizarlo como HTML.
// Soporta: encabezados (# ## ###), listas (- *), listas numeradas,
// tablas (|), negrita (**), cursiva (*), codigo en linea (`), parrafos.

/** Escapa entidades HTML para evitar XSS */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Parsea markdown inline: **negrita**, *cursiva*, `codigo` */
function parseInline(text: string): string {
  let result = escapeHtml(text)
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-[color:var(--ink)]">$1</strong>')
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>')
  result = result.replace(/`(.+?)`/g, '<code class="rounded bg-[color:var(--paper-2)] px-1 py-0.5 text-[11px] font-mono text-[color:var(--ink-2)]">$1</code>')
  return result
}

/** Renderiza una table markdown (delimitada por pipes) a HTML */
function renderMdTable(lines: string[]): string {
  if (lines.length < 2) return lines.map((l) => `<p class="text-xs text-[color:var(--ink-2)]">${escapeHtml(l)}</p>`).join('')

  const parseRow = (line: string) =>
    line.split('|').map((c) => c.trim()).filter((c) => c.length > 0)

  const headerCells = parseRow(lines[0])
  const isSeparator = (line: string) => /^\|[\s\-:|]+\|$/.test(line.trim())
  const dataStartIdx = isSeparator(lines[1]) ? 2 : 1
  const dataRows = lines.slice(dataStartIdx).map(parseRow)

  const ths = headerCells
    .map((h) => `<th class="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">${parseInline(h)}</th>`)
    .join('')

  const trs = dataRows
    .map((cells) => {
      const tds = cells.map((c) => `<td class="px-2 py-1 text-xs text-[color:var(--ink-2)]">${parseInline(c)}</td>`).join('')
      return `<tr class="border-t border-[color:var(--ink-4)]">${tds}</tr>`
    })
    .join('')

  return `<div class="overflow-x-auto rounded-lg border border-[color:var(--ink-4)] my-2"><table class="w-full text-left text-xs"><thead><tr class="bg-[color:var(--paper-2)]">${ths}</tr></thead><tbody>${trs}</tbody></table></div>`
}

/** Convierte un string markdown completo a HTML */
function parseMarkdown(md: string): string {
  const lines = md.split('\n')
  const htmlParts: string[] = []
  let i = 0

  while (i < lines.length) {
    const trimmed = lines[i].trim()

    if (trimmed === '') { i++; continue }

    if (trimmed.startsWith('###')) {
      htmlParts.push(`<h4 class="mt-3 mb-1 text-xs font-bold text-[color:var(--ink-2)]">${parseInline(trimmed.replace(/^###\s*/, ''))}</h4>`)
      i++; continue
    }
    if (trimmed.startsWith('##')) {
      htmlParts.push(`<h3 class="mt-4 mb-1.5 text-sm font-bold text-[color:var(--ink)] border-b border-[color:var(--ink-4)] pb-1">${parseInline(trimmed.replace(/^##\s*/, ''))}</h3>`)
      i++; continue
    }
    if (trimmed.startsWith('#')) {
      htmlParts.push(`<h3 class="mt-4 mb-1.5 text-sm font-bold text-[color:var(--ink)] border-b border-[color:var(--ink-4)] pb-1">${parseInline(trimmed.replace(/^#\s*/, ''))}</h3>`)
      i++; continue
    }

    if (trimmed.startsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) { tableLines.push(lines[i].trim()); i++ }
      htmlParts.push(renderMdTable(tableLines))
      continue
    }

    if (/^[-*]\s/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^[-*]\s/, '')); i++ }
      htmlParts.push(`<ul class="my-1.5 ml-4 list-disc space-y-0.5">${items.map((t) => `<li class="text-xs text-[color:var(--ink-2)] leading-relaxed">${parseInline(t)}</li>`).join('')}</ul>`)
      continue
    }

    if (/^\d+\.\s/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^\d+\.\s/, '')); i++ }
      htmlParts.push(`<ol class="my-1.5 ml-4 list-decimal space-y-0.5">${items.map((t) => `<li class="text-xs text-[color:var(--ink-2)] leading-relaxed">${parseInline(t)}</li>`).join('')}</ol>`)
      continue
    }

    htmlParts.push(`<p class="text-xs text-[color:var(--ink-2)] leading-relaxed my-1">${parseInline(trimmed)}</p>`)
    i++
  }

  return htmlParts.join('\n')
}

// ============================================================================
// COMPONENTE PRINCIPAL DE LA PAGINA
// ============================================================================

/**
 * HistoricalProjectEntryClient - Componente primary de la ficha de project
 *
 * Este es el componente que dibuja TODA la page de detalle de un project
 * historical. Recibe los data del project desde el servidor (a traves de
 * page.tsx) y los presenta de forma visual y organizada. Los documents de
 * compliance se leen del campo JSONB mdl_content del propio registro.
 *
 * Parametros que recibe:
 *   - project: todos los data del project (codigo, title, client, mdl_content, etc.)
 *   - documents: familias documentales del project (table doa_historical_project_documents)
 */
export default function HistoricalProjectEntryClient({
  project,
  documents,
}: {
  project: ProyectoHistoricoDetailRow
  documents: ProyectoHistoricoDocumentoRow[]
}) {
  // Defensas sobre arrays/jsonb que pueden llegar con shape inesperado desde la BBDD.
  // El server component ya intenta normalizar, pero reforzamos aqui para evitar
  // que un registro antiguo o mal formado reviente el render del client.
  const documentosSafe: ProyectoHistoricoDocumentoRow[] = Array.isArray(documents)
    ? documents.map((d) => ({
        ...d,
        archivos: Array.isArray(d.archivos) ? d.archivos : [],
        formatos_disponibles: Array.isArray(d.formatos_disponibles) ? d.formatos_disponibles : [],
      }))
    : []

  const mdlContenidoSafe: MdlContent | null =
    project.mdl_content &&
    Array.isArray(project.mdl_content.entregables) &&
    Array.isArray(project.mdl_content.no_entregables)
      ? project.mdl_content
      : null

  const complianceDocsSafe: Record<
    string,
    { title: string; family: string; content_md: string }
  > | null =
    project.compliance_docs_md && typeof project.compliance_docs_md === 'object'
      ? project.compliance_docs_md
      : null

  // -- Status para el feedback visual al copiar la path al portapapeles --
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // -- Status para controlar la seccion MDL (colapsada por defecto) --
  const [mdlOpen, setMdlOpen] = useState(false)

  // -- Status para controlar que sub-secciones MDL estan expandidas --
  // Por defecto: entregables open, no_entregables closed (cuando el MDL se abre)
  const [entregablesOpen, setEntregablesOpen] = useState(true)
  const [noEntregablesOpen, setNoEntregablesOpen] = useState(false)

  // -- Status para el panel colapsable de resumen del project (closed por defecto) --
  const [summaryOpen, setSummaryOpen] = useState(false)

  // -- Status para controlar que familias documentales muestran su contenido markdown --
  const [expandedDocFamilies, setExpandedDocFamilies] = useState<Set<string>>(new Set())

  // -- Parsear el markdown del resumen una sola vez (memoizado) --
  const summaryHtml = useMemo(() => {
    if (!project.summary_md) return null
    return parseMarkdown(project.summary_md)
  }, [project.summary_md])

  /**
   * Busca documents de compliance_docs_md que coincidan con una family documental.
   * Compara por name de folder (family) o por referencia de archivo.
   */
  function findComplianceDocsForFamily(family: string, archivoRef: string | null) {
    if (!complianceDocsSafe) return []

    const matches: Array<{ ref: string; title: string; content_md: string }> = []
    for (const [ref, doc] of Object.entries(complianceDocsSafe)) {
      if (!doc || typeof doc !== 'object') continue
      // Coincidencia por name de family (ej: "01.Change Classification")
      if (doc.family === family) {
        matches.push({ ref, title: doc.title ?? ref, content_md: doc.content_md ?? '' })
        continue
      }
      // Coincidencia por referencia de archivo (ej: archivo_referencia contiene "20885-12-01")
      if (archivoRef && archivoRef.includes(ref)) {
        matches.push({ ref, title: doc.title ?? ref, content_md: doc.content_md ?? '' })
      }
    }
    return matches
  }

  /**
   * Alterna la visibilidad del contenido markdown de una family documental.
   */
  const toggleDocFamily = (docId: string) => {
    setExpandedDocFamilies(prev => {
      const next = new Set(prev)
      if (next.has(docId)) {
        next.delete(docId)
      } else {
        next.add(docId)
      }
      return next
    })
  }

  /**
   * Copia un text al portapapeles y muestra feedback visual
   * cambiando el icono a un checkmark durante 1.5 segundos.
   */
  const handleCopyRuta = (field: string, path: string) => {
    navigator.clipboard.writeText(path)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 1500)
  }

  // -- Preparacion de data antes de mostrarlos --

  // Convierte el year (que es un numero) a text para mostrarlo en pantalla.
  // Si no hay year registrado, queda como "null" (vacio).
  const year = project.year ? String(project.year) : null

  // Formatea la date de creacion en formato espanol legible (ej: "15 ene 2024").
  // Si no hay date, queda como "null" (vacio).
  const fechaCreacion = project.created_at
    ? new Date(project.created_at).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null

  // Formatea la date de ultima actualizacion en formato espanol legible.
  const fechaActualizacion = project.updated_at
    ? new Date(project.updated_at).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null

  // ==========================================================================
  // INICIO DEL CONTENIDO VISUAL (lo que el user_label ve en pantalla)
  // ==========================================================================
  return (
    // Contenedor primary de toda la page, con scroll vertical si el contenido es largo
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-5 pb-8 pt-5">

      {/* ------------------------------------------------------------------ */}
      {/* BARRA SUPERIOR: Boton de volver + Etiqueta "Ficha de project"     */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Boton azul para volver a la lista de projects historicos */}
        <Link
          href="/historical-projects"
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--ink-4)] bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(37,99,235,0.22)] transition-colors hover:bg-sky-500"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Projects Historical
        </Link>

        {/* Etiqueta decorativa que indica que esta page es una ficha de project */}
        <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper)]/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-3)] shadow-sm">
          Ficha de project
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* CABECERA DEL PROYECTO                                              */}
      {/* Tarjeta grande con fondo degradado azul claro que muestra:         */}
      {/*   - Numero de project (codigo)                                    */}
      {/*   - Titulo primary del project                                  */}
      {/*   - Texto explicativo                                              */}
      {/*   - Etiquetas resumen: client, year y folder de origen           */}
      {/* ------------------------------------------------------------------ */}
      <section className="rounded-[34px] border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-6 shadow-[0_24px_50px_rgba(14,165,233,0.10)]">
        {/* Codigo del project mostrado en estilo "monoespaciado" (como text technical) */}
        <span className="inline-block rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper)]/90 px-3 py-1 font-mono text-xs font-medium text-[color:var(--ink-3)]">
          {project.project_number}
        </span>
        {/* Titulo grande del project */}
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{project.title}</h1>
        {/* Texto informativo que explica que esta es una ficha de solo request */}
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[color:var(--ink-3)]">
          Ficha de request del project historical. Toda la informacion mostrada proviene de la base de data.
        </p>

        {/* Etiquetas resumen: muestran el client, year y folder de origen de un vistazo */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {/* Name del client (o "Sin client" si no hay dato) */}
          <span className="rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-3 py-1 text-xs text-[color:var(--ink-3)]">
            {project.client_name || 'Sin client'}
          </span>
          {/* Anio del project (o "Sin year" si no hay dato) */}
          <span className="rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-3 py-1 text-xs text-[color:var(--ink-3)]">
            {year || 'Sin year'}
          </span>
          {/* Name de la folder de origen (solo se muestra si existe) */}
          {project.source_folder_name && (
            <span className="rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-3 py-1 text-xs text-[color:var(--ink-3)]">
              {project.source_folder_name}
            </span>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* BARRA DE ATAJOS DE NAVEGACION                                      */}
      {/* Fila de botones que permiten saltar directamente a cada seccion     */}
      {/* de la page sin necesidad de hacer scroll manualmente.             */}
      {/* ------------------------------------------------------------------ */}
      <section className="rounded-[28px] border border-[color:var(--ink-4)] bg-[color:var(--paper)]/90 p-4 shadow-[0_12px_28px_rgba(148,163,184,0.10)]">
        <div className="flex flex-wrap gap-2">
          <ShortcutButton label="Data basicos" targetId="data-basicos" />
          <ShortcutButton label="Origen" targetId="origen" />
          <ShortcutButton label="Description" targetId="description" />
          <ShortcutButton label="Documentacion DOA" targetId="documentacion-doa" />
          <ShortcutButton label="Metadata" targetId="metadata" />
          <ShortcutButton label="Siguiente paso" targetId="siguiente-paso" />
        </div>
      </section>

      {/* ================================================================== */}
      {/* CONTENIDO PRINCIPAL - Distribucion en dos columnas                */}
      {/* Columna izquierda (mas ancha): bloques de data del project     */}
      {/* Columna derecha (mas estrecha): metadata y siguiente paso        */}
      {/* En pantallas pequenas, todo se apila en una sola columna         */}
      {/* ================================================================== */}
      <div className="grid min-h-0 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
        {/* ------ COLUMNA IZQUIERDA: Bloques principales de data ------ */}
        <div className="space-y-5">

          {/* ------------------------------------------------------------ */}
          {/* BLOQUE 01: DATOS BASICOS DEL PROYECTO                        */}
          {/* Muestra: codigo, client, title y year en tarjetas           */}
          {/* ------------------------------------------------------------ */}
          <section
            id="data-basicos"
            className="rounded-[28px] border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-6 shadow-[0_18px_40px_rgba(148,163,184,0.12)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-3)]">
              Bloque 01
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">Data del project</h2>

            {/* Cuadricula de 2 columnas con los campos de data basicos */}
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <DataField label="Codigo" icon={<Hash className="h-3.5 w-3.5" />} value={project.project_number} />
              <DataField label="Client" icon={<NotebookTabs className="h-3.5 w-3.5" />} value={project.client_name} />
              {/* El title ocupa dos columnas (wide) porque suele ser text largo */}
              <DataField label="Titulo" icon={<FileText className="h-3.5 w-3.5" />} value={project.title} wide />
              <DataField label="Anio" icon={<CalendarDays className="h-3.5 w-3.5" />} value={year} />
            </div>
          </section>

          {/* ------------------------------------------------------------ */}
          {/* BLOQUE 02: ORIGEN                                              */}
          {/* Muestra de donde se importo el project: la folder y la path   */}
          {/* completa en el servidor original.                               */}
          {/* ------------------------------------------------------------ */}
          <section
            id="origen"
            className="rounded-[28px] border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-6 shadow-[0_18px_40px_rgba(148,163,184,0.12)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-3)]">
              Bloque 02
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">Origen</h2>

            <div className="mt-5 grid gap-3">
              {/* Name corto de la folder de donde proviene el project */}
              <DataField
                label="Folder de origen"
                icon={<FolderOpen className="h-3.5 w-3.5" />}
                value={project.source_folder_name}
              />
              {/* Path completa en el servidor donde estaba almacenado el project */}
              {/* Se oculta la path larga y se muestra un boton azul para copiarla */}
              <div className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/80 px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
                    <FileText className="h-3.5 w-3.5" />
                    Path de origen
                  </span>
                  {/* Boton azul para copiar la path de origen al portapapeles */}
                  {project.source_path && (
                    <button
                      type="button"
                      title="Copiar path"
                      onClick={() => handleCopyRuta('source_path', project.source_path!)}
                      className={`rounded-lg p-1.5 transition-colors ${
                        copiedField === 'source_path'
                          ? 'bg-emerald-100 text-emerald-600'
                          : 'bg-[color:var(--paper-2)] text-[color:var(--ink-3)] hover:bg-[color:var(--paper-3)]'
                      }`}
                    >
                      {copiedField === 'source_path' ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* ------------------------------------------------------------ */}
          {/* BLOQUE 03: DESCRIPCION                                         */}
          {/* Muestra el text descriptivo del project. Si no hay            */}
          {/* description en la base de data, muestra un aviso en gris.     */}
          {/* ------------------------------------------------------------ */}
          <section
            id="description"
            className="rounded-[28px] border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-6 shadow-[0_18px_40px_rgba(148,163,184,0.12)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-3)]">
              Bloque 03
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">Description</h2>

            <div className="mt-5 rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/80 px-4 py-4">
              {/* Texto de la description. Si no hay description guardada, muestra
                  "Sin description registrada." en gris y cursiva */}
              <p className="whitespace-pre-wrap text-sm leading-7 text-[color:var(--ink)]">
                {project.description || <span className="italic text-[color:var(--ink-3)]">Sin description registrada.</span>}
              </p>
            </div>
          </section>

          {/* ------------------------------------------------------------ */}
          {/* BLOQUE 04: COMPLIANCE DOCUMENTS                                */}
          {/* Seccion A: Master Document List (colapsable, closed por def.) */}
          {/* Seccion B: Familias documentales (tarjetas, siempre visibles)  */}
          {/* ------------------------------------------------------------ */}
          <section
            id="documentacion-doa"
            className="rounded-[28px] border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-6 shadow-[0_18px_40px_rgba(148,163,184,0.12)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-3)]">
              Bloque 04
            </p>

            {/* Titulo + contadores resumen */}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-950">Compliance Documents</h2>
              <div className="flex items-center gap-2">
                {mdlContenidoSafe && (
                  <>
                    <span className="rounded-full bg-[color:var(--paper-2)] px-2.5 py-0.5 text-[11px] font-medium text-[color:var(--ink-2)]">
                      {mdlContenidoSafe.entregables.length} Entregables
                    </span>
                    <span className="rounded-full bg-[color:var(--paper-2)] px-2.5 py-0.5 text-[11px] font-medium text-[color:var(--ink-3)]">
                      {mdlContenidoSafe.no_entregables.length} No entregables
                    </span>
                  </>
                )}
                {documentosSafe.length > 0 && (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                    {documentosSafe.length} Familias
                  </span>
                )}
              </div>
            </div>

            {/* ============================================================ */}
            {/* SECCION A: Master Document List (colapsable, closed por def) */}
            {/* ============================================================ */}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setMdlOpen(prev => !prev)}
                className="flex w-full items-center gap-2 rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/60 px-5 py-3 text-left transition-colors hover:bg-[color:var(--paper-3)]/60"
              >
                {mdlOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-[color:var(--ink-3)]" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--ink-3)]" />
                )}
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--ink)]">
                  <FileText className="h-4 w-4 text-[color:var(--ink-3)]" />
                  Master Document List
                </span>
              </button>

              {/* Contenido del MDL (solo visible cuando esta expandido) */}
              {mdlOpen && (
                <div className="mt-3 space-y-3">
                  {!mdlContenidoSafe ? (
                    // Sin MDL cargado: mensaje sutil
                    <div className="rounded-2xl border border-dashed border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/80 px-4 py-4 text-sm italic text-[color:var(--ink-3)]">
                      No se ha cargado el Master Document List para este project
                    </div>
                  ) : (
                    <>
                      {/* ── Seccion 4.1 - Documents Entregables (default OPEN) ── */}
                      <div className="rounded-xl border border-[color:var(--ink-4)]">
                        <button
                          type="button"
                          onClick={() => setEntregablesOpen(prev => !prev)}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-[color:var(--paper-3)]/80"
                        >
                          {entregablesOpen ? (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[color:var(--ink-3)]" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[color:var(--ink-3)]" />
                          )}
                          <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ink-3)]">
                            4.1 Documents Entregables
                          </span>
                          <span className="ml-auto rounded-full bg-[color:var(--paper-2)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--ink-2)]">
                            {mdlContenidoSafe.entregables.length}
                          </span>
                        </button>

                        {/* Filas de documents entregables */}
                        {entregablesOpen && (
                          <div className="border-t border-[color:var(--ink-4)]">
                            {mdlContenidoSafe.entregables.length === 0 ? (
                              <p className="px-4 py-3 text-xs italic text-[color:var(--ink-3)]">Sin documents entregables.</p>
                            ) : (
                              <MdlDocumentList docs={mdlContenidoSafe.entregables} />
                            )}
                          </div>
                        )}
                      </div>

                      {/* ── Seccion 4.2 - Documents No Entregables (default CLOSED) ── */}
                      <div className="rounded-xl border border-[color:var(--ink-4)]">
                        <button
                          type="button"
                          onClick={() => setNoEntregablesOpen(prev => !prev)}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-[color:var(--paper-3)]/80"
                        >
                          {noEntregablesOpen ? (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[color:var(--ink-3)]" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[color:var(--ink-3)]" />
                          )}
                          <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ink-3)]">
                            4.2 Documents No Entregables
                          </span>
                          <span className="ml-auto rounded-full bg-[color:var(--paper-2)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--ink-3)]">
                            {mdlContenidoSafe.no_entregables.length}
                          </span>
                        </button>

                        {/* Filas de documents no entregables */}
                        {noEntregablesOpen && (
                          <div className="border-t border-[color:var(--ink-4)]">
                            {mdlContenidoSafe.no_entregables.length === 0 ? (
                              <p className="px-4 py-3 text-xs italic text-[color:var(--ink-3)]">Sin documents no entregables.</p>
                            ) : (
                              <MdlDocumentList docs={mdlContenidoSafe.no_entregables} />
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ============================================================ */}
            {/* SECCION A.2: Resumen del Project (colapsable, closed)      */}
            {/* Muestra el contenido summary_md del project historical en     */}
            {/* formato markdown renderizado. Posicionado entre el MDL y     */}
            {/* las familias documentales.                                    */}
            {/* ============================================================ */}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setSummaryOpen(prev => !prev)}
                className="flex w-full items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-5 py-3 text-left transition-colors hover:bg-emerald-100/60"
              >
                {summaryOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-emerald-500" />
                )}
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900">
                  <FileText className="h-4 w-4 text-emerald-600" />
                  Resumen del Project (Summary)
                </span>
              </button>

              {/* Contenido del resumen (solo visible cuando esta expandido) */}
              {summaryOpen && (
                <div className="mt-3">
                  {summaryHtml === null ? (
                    <div className="rounded-2xl border border-dashed border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/80 px-4 py-4 text-sm italic text-[color:var(--ink-3)]">
                      No hay resumen disponible para este project
                    </div>
                  ) : (
                    <div
                      className="max-h-[600px] overflow-y-auto rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/80 px-4 py-4"
                      dangerouslySetInnerHTML={{ __html: summaryHtml }}
                    />
                  )}
                </div>
              )}
            </div>

            {/* ============================================================ */}
            {/* SECCION B: Familias documentales (tarjetas, siempre visibles) */}
            {/* ============================================================ */}
            <div className="mt-6">
              <div className="mb-3 flex items-center gap-3">
                <div className="h-px flex-1 bg-[color:var(--paper-3)]" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
                  Familias Documentales
                </span>
                <div className="h-px flex-1 bg-[color:var(--paper-3)]" />
              </div>

              {documentosSafe.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/80 px-4 py-4 text-sm italic text-[color:var(--ink-3)]">
                  No se han registrado familias documentales para este project
                </div>
              ) : (
                <div className="space-y-3">
                  {documentosSafe.map((doc) => (
                    <div
                      key={doc.id}
                      className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/80 px-4 py-3.5 transition-colors hover:border-[color:var(--ink-4)]"
                    >
                      {/* Cabecera: name de family + badge de sort_order */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <FolderOpen className="h-4 w-4 shrink-0 text-[color:var(--ink-3)]" />
                          <span className="text-sm font-semibold text-[color:var(--ink)]">
                            {doc.familia_documental}
                          </span>
                        </div>
                        {doc.orden_documental != null && (
                          <span className="shrink-0 rounded-full bg-[color:var(--paper-2)] px-2.5 py-0.5 text-[10px] font-bold text-[color:var(--ink-2)]">
                            Orden {doc.orden_documental}
                          </span>
                        )}
                      </div>

                      {/* Folder de origen */}
                      <p className="mt-1.5 text-xs text-[color:var(--ink-3)]">
                        <span className="font-medium text-[color:var(--ink-3)]">Folder:</span>{' '}
                        {doc.carpeta_origen}
                      </p>

                      {/* Archivo de referencia (si existe) */}
                      {doc.archivo_referencia && (
                        <p className="mt-1 truncate text-xs text-[color:var(--ink-3)]">
                          <span className="font-medium text-[color:var(--ink-3)]">Ref:</span>{' '}
                          <span className="font-mono">{doc.archivo_referencia}</span>
                        </p>
                      )}

                      {/* Fila inferior: conteo de archivos, formatos y boton copiar */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        {/* Conteo de archivos */}
                        <span className="rounded-full bg-[color:var(--paper-3)]/80 px-2.5 py-0.5 text-[10px] font-medium text-[color:var(--ink-3)]">
                          {doc.total_archivos} {doc.total_archivos === 1 ? 'archivo' : 'archivos'}
                        </span>

                        {/* Pills de formatos disponibles */}
                        {doc.formatos_disponibles.map((fmt) => (
                          <span
                            key={fmt}
                            className="rounded-full bg-[color:var(--paper-2)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--ink-3)]"
                          >
                            {fmt}
                          </span>
                        ))}

                        {/* Boton azul para copiar source_path al portapapeles */}
                        <button
                          type="button"
                          title="Copiar path de origen"
                          onClick={() => handleCopyRuta(`doc-${doc.id}`, doc.source_path)}
                          className={`ml-auto rounded-lg p-1.5 transition-colors ${
                            copiedField === `doc-${doc.id}`
                              ? 'bg-emerald-100 text-emerald-600'
                              : 'bg-[color:var(--paper-2)] text-[color:var(--ink-3)] hover:bg-[color:var(--paper-3)]'
                          }`}
                        >
                          {copiedField === `doc-${doc.id}` ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>

                      {/* Lista de archivos asociados a esta family documental */}
                      {doc.archivos.length > 0 && (
                        <div className="mt-2.5 rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper)]/60 px-3 py-2">
                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
                            Archivos ({doc.archivos.length})
                          </p>
                          <ul className="space-y-1">
                            {doc.archivos.map((archivo) => (
                              <li
                                key={archivo.id}
                                className="flex flex-wrap items-center gap-2 text-[11px] text-[color:var(--ink-2)]"
                              >
                                <FileText className="h-3 w-3 shrink-0 text-[color:var(--ink-3)]" />
                                <span className="font-mono">{archivo.file_name}</span>
                                {archivo.edicion && (
                                  <span className="rounded-full bg-[color:var(--paper-2)] px-1.5 py-0.5 text-[9px] font-medium text-[color:var(--ink-3)]">
                                    {archivo.edicion}
                                  </span>
                                )}
                                <span className="rounded-full bg-[color:var(--paper-2)] px-1.5 py-0.5 text-[9px] font-medium text-[color:var(--ink-3)]">
                                  {archivo.formato}
                                </span>
                                {archivo.es_edicion_vigente && (
                                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                                    Vigente
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Contenido markdown del document de compliance (colapsable) */}
                      {(() => {
                        const complianceDocs = findComplianceDocsForFamily(doc.familia_documental, doc.archivo_referencia)
                        if (complianceDocs.length === 0) return null
                        return (
                          <div className="mt-2.5 space-y-2">
                            {complianceDocs.map((cDoc) => {
                              const isExpanded = expandedDocFamilies.has(cDoc.ref)
                              return (
                                <div key={cDoc.ref}>
                                  <button
                                    type="button"
                                    onClick={() => toggleDocFamily(cDoc.ref)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--ink-3)] transition-colors hover:border-[color:var(--ink-4)] hover:text-[color:var(--ink-2)]"
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="h-3 w-3 text-[color:var(--ink-3)]" />
                                    ) : (
                                      <ChevronRight className="h-3 w-3 text-[color:var(--ink-3)]" />
                                    )}
                                    <FileText className="h-3 w-3" />
                                    Ver contenido: {cDoc.title}
                                    <span className="rounded bg-[color:var(--paper-2)] px-1.5 py-0.5 font-mono text-[9px] text-[color:var(--ink-3)]">
                                      {cDoc.ref}
                                    </span>
                                  </button>
                                  {isExpanded && (
                                    <div
                                      className="mt-2 max-h-[400px] overflow-y-auto rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-4 py-3"
                                      dangerouslySetInnerHTML={{ __html: parseMarkdown(cDoc.content_md) }}
                                    />
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ------ COLUMNA DERECHA: Metadata y Siguiente paso ------ */}
        <div className="space-y-5">

          {/* ------------------------------------------------------------ */}
          {/* METADATA: INFORMACION DEL REGISTRO                            */}
          {/* Muestra las dates automaticas del sistema:                    */}
          {/*   - Cuando se creo el registro en la base de data            */}
          {/*   - Cuando fue la ultima vez que se modifico                   */}
          {/* Estas dates las genera el sistema, no las introduce el user_label*/}
          {/* ------------------------------------------------------------ */}
          <section
            id="metadata"
            className="rounded-[28px] border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-6 shadow-[0_18px_40px_rgba(148,163,184,0.12)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-3)]">
              Metadata
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">Informacion del registro</h2>
            <div className="mt-4 space-y-3">
              {/* Date en que se creo el project en el sistema */}
              <div className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/80 px-4 py-3.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
                  Date de creacion
                </span>
                <p className="mt-1.5 text-sm text-[color:var(--ink)]">{fechaCreacion || '-'}</p>
              </div>
              {/* Date de la ultima modificacion del project */}
              <div className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/80 px-4 py-3.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
                  Ultima actualizacion
                </span>
                <p className="mt-1.5 text-sm text-[color:var(--ink)]">{fechaActualizacion || '-'}</p>
              </div>
            </div>
          </section>

          {/* ------------------------------------------------------------ */}
          {/* SIGUIENTE PASO: BLOQUES PENDIENTES                             */}
          {/* Lista de funcionalidades que aun no estan implementadas en     */}
          {/* esta ficha de project. Sirve como recordatorio de lo que      */}
          {/* falta por desarrollar en el futuro.                            */}
          {/* Tiene un fondo degradado azul claro para destacar visualmente. */}
          {/* ------------------------------------------------------------ */}
          <section
            id="siguiente-paso"
            className="rounded-[28px] border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-6 shadow-[0_18px_40px_rgba(14,165,233,0.08)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-3)]">
              Siguiente paso
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">Bloques pendientes</h2>
            {/* Lista de bloques que se anadiran en el futuro */}
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[color:var(--ink-3)]">
              <li className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper)]/80 px-4 py-3">
                Aircraft, family y variante.
              </li>
              <li className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper)]/80 px-4 py-3">
                Tipo de trabajo y classification technical.
              </li>
              <li className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper)]/80 px-4 py-3">
                Notes y trazabilidad adicional.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
