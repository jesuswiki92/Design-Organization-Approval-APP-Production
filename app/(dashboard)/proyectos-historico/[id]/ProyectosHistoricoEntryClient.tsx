/**
 * ============================================================================
 * PAGINA DE DETALLE DE UN PROYECTO HISTORICO
 * ============================================================================
 *
 * Este archivo muestra la "ficha" completa de un proyecto historico de aviacion.
 * Es una vista de SOLO LECTURA: el usuario puede consultar los datos del
 * proyecto pero NO puede editarlos desde aqui.
 *
 * La pagina se divide en varias secciones:
 *   - Cabecera con titulo, numero de proyecto y datos resumidos
 *   - Botones de atajo para saltar rapidamente a cada seccion
 *   - Bloque 01: Datos basicos (codigo, cliente, titulo, anio)
 *   - Bloque 02: Origen (carpeta y ruta de donde se importo el proyecto)
 *   - Bloque 03: Descripcion (texto libre del proyecto)
 *   - Bloque 04: Compliance Documents (MDL colapsable + familias documentales)
 *   - Metadata: Fechas de creacion y ultima actualizacion
 *   - Siguiente paso: Lista de bloques que aun no estan implementados
 *
 * NOTA TECNICA: Este componente usa 'use client' porque necesita interactuar
 * con el navegador (por ejemplo, hacer scroll suave al pulsar los atajos).
 * ============================================================================
 */

'use client'

// -- Importaciones de librerias externas --
// Link: permite navegar entre paginas de la aplicacion sin recargar toda la web
import Link from 'next/link'
// Iconos decorativos que se muestran junto a las etiquetas de los campos
import {
  ArrowLeft,       // Flecha hacia la izquierda (boton "Volver")
  CalendarDays,    // Icono de calendario (campo de anio)
  Check,           // Icono de checkmark (feedback al copiar ruta)
  ChevronDown,     // Icono de chevron hacia abajo (seccion expandida)
  ChevronRight,    // Icono de chevron hacia la derecha (seccion colapsada)
  Copy,            // Icono de copiar (boton copiar ruta)
  FileText,        // Icono de documento (campos de titulo y ruta)
  FolderOpen,      // Icono de carpeta abierta (campo de carpeta de origen)
  Hash,            // Icono de almohadilla/numeral (campo de codigo)
  NotebookTabs,    // Icono de libreta (campo de cliente)
} from 'lucide-react'
// ReactNode: tipo que representa cualquier contenido visual de React (texto, iconos, etc.)
import { type ReactNode, useMemo, useState } from 'react'

// Tipos para el Master Document List (MDL) del proyecto
import type { MdlContenido, MdlDocumento, ProyectoHistoricoRow } from '@/types/database'

// ============================================================================
// DEFINICION DE LA ESTRUCTURA DE DATOS
// ============================================================================
// Estas "interfaces" describen la forma que tienen los datos que llegan desde
// la base de datos. Es como una plantilla que dice "un proyecto historico
// siempre tiene estos campos, con estos tipos de valor".

/**
 * Estructura de un proyecto historico.
 * Cada campo corresponde a una columna de la tabla en la base de datos.
 *
 * - id: identificador unico interno (no se muestra al usuario)
 * - numero_proyecto: codigo visible del proyecto (ej: "PRJ-2024-001")
 * - titulo: nombre descriptivo del proyecto
 * - descripcion: texto libre con detalles del proyecto (puede estar vacio)
 * - cliente_nombre: nombre del cliente asociado (puede estar vacio)
 * - anio: anio del proyecto (puede estar vacio)
 * - ruta_origen: ruta completa de la carpeta original en el servidor
 * - nombre_carpeta_origen: nombre corto de la carpeta de donde se importo
 * - created_at: fecha en que se creo el registro en la base de datos
 * - updated_at: fecha de la ultima modificacion del registro
 */
type ProyectoHistoricoDetailRow = Omit<ProyectoHistoricoRow, 'mdl_contenido'> & {
  mdl_contenido: MdlContenido | null
}

/**
 * Estructura de un documento/familia documental del proyecto historico.
 * Cada registro representa una familia documental con sus archivos asociados.
 */
interface ProyectoHistoricoDocumentoRow {
  id: string
  proyecto_historico_id: string
  orden_documental: number | null
  familia_documental: string
  carpeta_origen: string
  ruta_origen: string
  archivo_referencia: string | null
  total_archivos: number
  formatos_disponibles: string[]
  created_at: string
  updated_at: string
}

// ============================================================================
// COMPONENTES AUXILIARES (piezas reutilizables de la interfaz)
// ============================================================================

/**
 * DataField - Tarjeta individual de dato
 *
 * Muestra un campo de informacion con su etiqueta, icono y valor.
 * Se usa para presentar cada dato del proyecto (codigo, cliente, titulo, etc.)
 * de forma visual y ordenada, como una "ficha" pequena.
 *
 * Si el campo no tiene valor, muestra un guion "-" en gris para indicar
 * que el dato no esta disponible.
 *
 * Parametros que recibe:
 *   - label: texto de la etiqueta (ej: "Codigo", "Cliente")
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
      {/* Etiqueta superior: muestra el icono y el nombre del campo en mayusculas */}
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
 * suavemente hasta una seccion especifica de la pagina. Funciona como un
 * "indice rapido" para que el usuario no tenga que hacer scroll manualmente.
 *
 * Parametros que recibe:
 *   - label: texto que se muestra en el boton (ej: "Datos basicos")
 *   - targetId: identificador de la seccion a la que debe saltar (ej: "datos-basicos")
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
 * MdlDocumentList - Lista compacta de documentos del MDL
 *
 * Renderiza las filas de documentos de una seccion del MDL (entregables o no
 * entregables). Cada fila muestra referencia, titulo, edicion, fecha y estado.
 * Los documentos Active aparecen primero; los Superseded van al final, atenuados.
 */
function MdlDocumentList({ docs }: { docs: MdlDocumento[] }) {
  // Ordenar: Active primero, Superseded al final
  const sorted = [...docs].sort((a, b) => {
    if (a.estado === 'Active' && b.estado !== 'Active') return -1
    if (a.estado !== 'Active' && b.estado === 'Active') return 1
    return 0
  })

  return (
    <div className="divide-y divide-[color:var(--ink-4)]">
      {sorted.map((doc, idx) => {
        const isSuperseded = doc.estado === 'Superseded'
        return (
          <div
            key={`${doc.ref}-${idx}`}
            className={`flex items-center gap-3 px-4 py-2 ${isSuperseded ? 'opacity-60' : ''}`}
          >
            {/* Badge de referencia */}
            <span className="shrink-0 rounded bg-[color:var(--paper-2)] px-2 py-0.5 font-mono text-[11px] font-medium text-[color:var(--ink-2)]">
              {doc.ref}
            </span>

            {/* Titulo del documento */}
            <span className={`min-w-0 flex-1 truncate text-sm text-[color:var(--ink-2)] ${isSuperseded ? 'line-through' : ''}`}>
              {doc.titulo}
            </span>

            {/* Badge de edicion */}
            <span className="hidden shrink-0 rounded-full bg-[color:var(--paper-2)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--ink-3)] sm:inline-block">
              Ed {doc.edicion}
            </span>

            {/* Fecha */}
            <span className="hidden shrink-0 text-[11px] text-[color:var(--ink-3)] md:inline-block">
              {doc.fecha}
            </span>

            {/* Pill de estado */}
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                isSuperseded
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {doc.estado}
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
// Parsea el markdown del resumen de proyecto para renderizarlo como HTML.
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

/** Renderiza una tabla markdown (delimitada por pipes) a HTML */
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
 * ProyectosHistoricoEntryClient - Componente principal de la ficha de proyecto
 *
 * Este es el componente que dibuja TODA la pagina de detalle de un proyecto
 * historico. Recibe los datos del proyecto desde el servidor (a traves de
 * page.tsx) y los presenta de forma visual y organizada. Los documentos de
 * compliance se leen del campo JSONB mdl_contenido del propio registro.
 *
 * Parametros que recibe:
 *   - project: todos los datos del proyecto (codigo, titulo, cliente, mdl_contenido, etc.)
 *   - documentos: familias documentales del proyecto (tabla doa_proyectos_historico_documentos)
 */
export default function ProyectosHistoricoEntryClient({
  project,
  documentos,
}: {
  project: ProyectoHistoricoDetailRow
  documentos: ProyectoHistoricoDocumentoRow[]
}) {
  // -- Estado para el feedback visual al copiar la ruta al portapapeles --
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // -- Estado para controlar la seccion MDL (colapsada por defecto) --
  const [mdlOpen, setMdlOpen] = useState(false)

  // -- Estado para controlar que sub-secciones MDL estan expandidas --
  // Por defecto: entregables abierto, no_entregables cerrado (cuando el MDL se abre)
  const [entregablesOpen, setEntregablesOpen] = useState(true)
  const [noEntregablesOpen, setNoEntregablesOpen] = useState(false)

  // -- Estado para el panel colapsable de resumen del proyecto (cerrado por defecto) --
  const [summaryOpen, setSummaryOpen] = useState(false)

  // -- Estado para controlar que familias documentales muestran su contenido markdown --
  const [expandedDocFamilies, setExpandedDocFamilies] = useState<Set<string>>(new Set())

  // -- Parsear el markdown del resumen una sola vez (memoizado) --
  const summaryHtml = useMemo(() => {
    if (!project.summary_md) return null
    return parseMarkdown(project.summary_md)
  }, [project.summary_md])

  /**
   * Busca documentos de compliance_docs_md que coincidan con una familia documental.
   * Compara por nombre de carpeta (familia) o por referencia de archivo.
   */
  const findComplianceDocsForFamily = useMemo(() => {
    if (!project.compliance_docs_md) return (_familia: string, _archivoRef: string | null) => []
    const docsMap = project.compliance_docs_md
    return (familia: string, archivoRef: string | null) => {
      const matches: Array<{ ref: string; title: string; content_md: string }> = []
      for (const [ref, doc] of Object.entries(docsMap)) {
        // Coincidencia por nombre de familia (ej: "01.Change Classification")
        if (doc.familia === familia) {
          matches.push({ ref, title: doc.title, content_md: doc.content_md })
          continue
        }
        // Coincidencia por referencia de archivo (ej: archivo_referencia contiene "20885-12-01")
        if (archivoRef && archivoRef.includes(ref)) {
          matches.push({ ref, title: doc.title, content_md: doc.content_md })
        }
      }
      return matches
    }
  }, [project.compliance_docs_md])

  /**
   * Alterna la visibilidad del contenido markdown de una familia documental.
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
   * Copia un texto al portapapeles y muestra feedback visual
   * cambiando el icono a un checkmark durante 1.5 segundos.
   */
  const handleCopyRuta = (field: string, ruta: string) => {
    navigator.clipboard.writeText(ruta)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 1500)
  }

  // -- Preparacion de datos antes de mostrarlos --

  // Convierte el anio (que es un numero) a texto para mostrarlo en pantalla.
  // Si no hay anio registrado, queda como "null" (vacio).
  const anio = project.anio ? String(project.anio) : null

  // Formatea la fecha de creacion en formato espanol legible (ej: "15 ene 2024").
  // Si no hay fecha, queda como "null" (vacio).
  const fechaCreacion = project.created_at
    ? new Date(project.created_at).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null

  // Formatea la fecha de ultima actualizacion en formato espanol legible.
  const fechaActualizacion = project.updated_at
    ? new Date(project.updated_at).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null

  // ==========================================================================
  // INICIO DEL CONTENIDO VISUAL (lo que el usuario ve en pantalla)
  // ==========================================================================
  return (
    // Contenedor principal de toda la pagina, con scroll vertical si el contenido es largo
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-5 pb-8 pt-5">

      {/* ------------------------------------------------------------------ */}
      {/* BARRA SUPERIOR: Boton de volver + Etiqueta "Ficha de proyecto"     */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Boton azul para volver a la lista de proyectos historicos */}
        <Link
          href="/proyectos-historico"
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--ink-4)] bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(37,99,235,0.22)] transition-colors hover:bg-sky-500"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Proyectos Historico
        </Link>

        {/* Etiqueta decorativa que indica que esta pagina es una ficha de proyecto */}
        <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper)]/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-3)] shadow-sm">
          Ficha de proyecto
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* CABECERA DEL PROYECTO                                              */}
      {/* Tarjeta grande con fondo degradado azul claro que muestra:         */}
      {/*   - Numero de proyecto (codigo)                                    */}
      {/*   - Titulo principal del proyecto                                  */}
      {/*   - Texto explicativo                                              */}
      {/*   - Etiquetas resumen: cliente, anio y carpeta de origen           */}
      {/* ------------------------------------------------------------------ */}
      <section className="rounded-[34px] border border-[color:var(--ink-4)] bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_52%,#f8fafc_100%)] p-6 shadow-[0_24px_50px_rgba(14,165,233,0.10)]">
        {/* Codigo del proyecto mostrado en estilo "monoespaciado" (como texto tecnico) */}
        <span className="inline-block rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper)]/90 px-3 py-1 font-mono text-xs font-medium text-[color:var(--ink-3)]">
          {project.numero_proyecto}
        </span>
        {/* Titulo grande del proyecto */}
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{project.titulo}</h1>
        {/* Texto informativo que explica que esta es una ficha de solo consulta */}
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[color:var(--ink-3)]">
          Ficha de consulta del proyecto historico. Toda la informacion mostrada proviene de la base de datos.
        </p>

        {/* Etiquetas resumen: muestran el cliente, anio y carpeta de origen de un vistazo */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {/* Nombre del cliente (o "Sin cliente" si no hay dato) */}
          <span className="rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-3 py-1 text-xs text-[color:var(--ink-3)]">
            {project.cliente_nombre || 'Sin cliente'}
          </span>
          {/* Anio del proyecto (o "Sin anio" si no hay dato) */}
          <span className="rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-3 py-1 text-xs text-[color:var(--ink-3)]">
            {anio || 'Sin anio'}
          </span>
          {/* Nombre de la carpeta de origen (solo se muestra si existe) */}
          {project.nombre_carpeta_origen && (
            <span className="rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-3 py-1 text-xs text-[color:var(--ink-3)]">
              {project.nombre_carpeta_origen}
            </span>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* BARRA DE ATAJOS DE NAVEGACION                                      */}
      {/* Fila de botones que permiten saltar directamente a cada seccion     */}
      {/* de la pagina sin necesidad de hacer scroll manualmente.             */}
      {/* ------------------------------------------------------------------ */}
      <section className="rounded-[28px] border border-[color:var(--ink-4)] bg-[color:var(--paper)]/90 p-4 shadow-[0_12px_28px_rgba(148,163,184,0.10)]">
        <div className="flex flex-wrap gap-2">
          <ShortcutButton label="Datos basicos" targetId="datos-basicos" />
          <ShortcutButton label="Origen" targetId="origen" />
          <ShortcutButton label="Descripcion" targetId="descripcion" />
          <ShortcutButton label="Documentacion DOA" targetId="documentacion-doa" />
          <ShortcutButton label="Metadata" targetId="metadata" />
          <ShortcutButton label="Siguiente paso" targetId="siguiente-paso" />
        </div>
      </section>

      {/* ================================================================== */}
      {/* CONTENIDO PRINCIPAL - Distribucion en dos columnas                */}
      {/* Columna izquierda (mas ancha): bloques de datos del proyecto     */}
      {/* Columna derecha (mas estrecha): metadata y siguiente paso        */}
      {/* En pantallas pequenas, todo se apila en una sola columna         */}
      {/* ================================================================== */}
      <div className="grid min-h-0 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
        {/* ------ COLUMNA IZQUIERDA: Bloques principales de datos ------ */}
        <div className="space-y-5">

          {/* ------------------------------------------------------------ */}
          {/* BLOQUE 01: DATOS BASICOS DEL PROYECTO                        */}
          {/* Muestra: codigo, cliente, titulo y anio en tarjetas           */}
          {/* ------------------------------------------------------------ */}
          <section
            id="datos-basicos"
            className="rounded-[28px] border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-6 shadow-[0_18px_40px_rgba(148,163,184,0.12)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-3)]">
              Bloque 01
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">Datos del proyecto</h2>

            {/* Cuadricula de 2 columnas con los campos de datos basicos */}
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <DataField label="Codigo" icon={<Hash className="h-3.5 w-3.5" />} value={project.numero_proyecto} />
              <DataField label="Cliente" icon={<NotebookTabs className="h-3.5 w-3.5" />} value={project.cliente_nombre} />
              {/* El titulo ocupa dos columnas (wide) porque suele ser texto largo */}
              <DataField label="Titulo" icon={<FileText className="h-3.5 w-3.5" />} value={project.titulo} wide />
              <DataField label="Anio" icon={<CalendarDays className="h-3.5 w-3.5" />} value={anio} />
            </div>
          </section>

          {/* ------------------------------------------------------------ */}
          {/* BLOQUE 02: ORIGEN                                              */}
          {/* Muestra de donde se importo el proyecto: la carpeta y la ruta   */}
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
              {/* Nombre corto de la carpeta de donde proviene el proyecto */}
              <DataField
                label="Carpeta de origen"
                icon={<FolderOpen className="h-3.5 w-3.5" />}
                value={project.nombre_carpeta_origen}
              />
              {/* Ruta completa en el servidor donde estaba almacenado el proyecto */}
              {/* Se oculta la ruta larga y se muestra un boton azul para copiarla */}
              <div className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/80 px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
                    <FileText className="h-3.5 w-3.5" />
                    Ruta de origen
                  </span>
                  {/* Boton azul para copiar la ruta de origen al portapapeles */}
                  {project.ruta_origen && (
                    <button
                      type="button"
                      title="Copiar ruta"
                      onClick={() => handleCopyRuta('ruta_origen', project.ruta_origen!)}
                      className={`rounded-lg p-1.5 transition-colors ${
                        copiedField === 'ruta_origen'
                          ? 'bg-emerald-100 text-emerald-600'
                          : 'bg-[color:var(--paper-2)] text-[color:var(--ink-3)] hover:bg-[color:var(--paper-3)]'
                      }`}
                    >
                      {copiedField === 'ruta_origen' ? (
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
          {/* Muestra el texto descriptivo del proyecto. Si no hay            */}
          {/* descripcion en la base de datos, muestra un aviso en gris.     */}
          {/* ------------------------------------------------------------ */}
          <section
            id="descripcion"
            className="rounded-[28px] border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-6 shadow-[0_18px_40px_rgba(148,163,184,0.12)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-3)]">
              Bloque 03
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">Descripcion</h2>

            <div className="mt-5 rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/80 px-4 py-4">
              {/* Texto de la descripcion. Si no hay descripcion guardada, muestra
                  "Sin descripcion registrada." en gris y cursiva */}
              <p className="whitespace-pre-wrap text-sm leading-7 text-[color:var(--ink)]">
                {project.descripcion || <span className="italic text-[color:var(--ink-3)]">Sin descripcion registrada.</span>}
              </p>
            </div>
          </section>

          {/* ------------------------------------------------------------ */}
          {/* BLOQUE 04: COMPLIANCE DOCUMENTS                                */}
          {/* Seccion A: Master Document List (colapsable, cerrado por def.) */}
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
                {project.mdl_contenido && (
                  <>
                    <span className="rounded-full bg-[color:var(--paper-2)] px-2.5 py-0.5 text-[11px] font-medium text-[color:var(--ink-2)]">
                      {project.mdl_contenido.entregables.length} Entregables
                    </span>
                    <span className="rounded-full bg-[color:var(--paper-2)] px-2.5 py-0.5 text-[11px] font-medium text-[color:var(--ink-3)]">
                      {project.mdl_contenido.no_entregables.length} No entregables
                    </span>
                  </>
                )}
                {documentos.length > 0 && (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                    {documentos.length} Familias
                  </span>
                )}
              </div>
            </div>

            {/* ============================================================ */}
            {/* SECCION A: Master Document List (colapsable, cerrado por def) */}
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
                  {!project.mdl_contenido ? (
                    // Sin MDL cargado: mensaje sutil
                    <div className="rounded-2xl border border-dashed border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/80 px-4 py-4 text-sm italic text-[color:var(--ink-3)]">
                      No se ha cargado el Master Document List para este proyecto
                    </div>
                  ) : (
                    <>
                      {/* ── Seccion 4.1 - Documentos Entregables (default OPEN) ── */}
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
                            4.1 Documentos Entregables
                          </span>
                          <span className="ml-auto rounded-full bg-[color:var(--paper-2)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--ink-2)]">
                            {project.mdl_contenido.entregables.length}
                          </span>
                        </button>

                        {/* Filas de documentos entregables */}
                        {entregablesOpen && (
                          <div className="border-t border-[color:var(--ink-4)]">
                            {project.mdl_contenido.entregables.length === 0 ? (
                              <p className="px-4 py-3 text-xs italic text-[color:var(--ink-3)]">Sin documentos entregables.</p>
                            ) : (
                              <MdlDocumentList docs={project.mdl_contenido.entregables} />
                            )}
                          </div>
                        )}
                      </div>

                      {/* ── Seccion 4.2 - Documentos No Entregables (default CLOSED) ── */}
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
                            4.2 Documentos No Entregables
                          </span>
                          <span className="ml-auto rounded-full bg-[color:var(--paper-2)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--ink-3)]">
                            {project.mdl_contenido.no_entregables.length}
                          </span>
                        </button>

                        {/* Filas de documentos no entregables */}
                        {noEntregablesOpen && (
                          <div className="border-t border-[color:var(--ink-4)]">
                            {project.mdl_contenido.no_entregables.length === 0 ? (
                              <p className="px-4 py-3 text-xs italic text-[color:var(--ink-3)]">Sin documentos no entregables.</p>
                            ) : (
                              <MdlDocumentList docs={project.mdl_contenido.no_entregables} />
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
            {/* SECCION A.2: Resumen del Proyecto (colapsable, cerrado)      */}
            {/* Muestra el contenido summary_md del proyecto historico en     */}
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
                  Resumen del Proyecto (Summary)
                </span>
              </button>

              {/* Contenido del resumen (solo visible cuando esta expandido) */}
              {summaryOpen && (
                <div className="mt-3">
                  {summaryHtml === null ? (
                    <div className="rounded-2xl border border-dashed border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/80 px-4 py-4 text-sm italic text-[color:var(--ink-3)]">
                      No hay resumen disponible para este proyecto
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

              {documentos.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/80 px-4 py-4 text-sm italic text-[color:var(--ink-3)]">
                  No se han registrado familias documentales para este proyecto
                </div>
              ) : (
                <div className="space-y-3">
                  {documentos.map((doc) => (
                    <div
                      key={doc.id}
                      className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/80 px-4 py-3.5 transition-colors hover:border-[color:var(--ink-4)]"
                    >
                      {/* Cabecera: nombre de familia + badge de orden */}
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

                      {/* Carpeta de origen */}
                      <p className="mt-1.5 text-xs text-[color:var(--ink-3)]">
                        <span className="font-medium text-[color:var(--ink-3)]">Carpeta:</span>{' '}
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

                        {/* Boton azul para copiar ruta_origen al portapapeles */}
                        <button
                          type="button"
                          title="Copiar ruta de origen"
                          onClick={() => handleCopyRuta(`doc-${doc.id}`, doc.ruta_origen)}
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

                      {/* Contenido markdown del documento de compliance (colapsable) */}
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
          {/* Muestra las fechas automaticas del sistema:                    */}
          {/*   - Cuando se creo el registro en la base de datos            */}
          {/*   - Cuando fue la ultima vez que se modifico                   */}
          {/* Estas fechas las genera el sistema, no las introduce el usuario*/}
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
              {/* Fecha en que se creo el proyecto en el sistema */}
              <div className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/80 px-4 py-3.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
                  Fecha de creacion
                </span>
                <p className="mt-1.5 text-sm text-[color:var(--ink)]">{fechaCreacion || '-'}</p>
              </div>
              {/* Fecha de la ultima modificacion del proyecto */}
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
          {/* esta ficha de proyecto. Sirve como recordatorio de lo que      */}
          {/* falta por desarrollar en el futuro.                            */}
          {/* Tiene un fondo degradado azul claro para destacar visualmente. */}
          {/* ------------------------------------------------------------ */}
          <section
            id="siguiente-paso"
            className="rounded-[28px] border border-[color:var(--ink-4)] bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_46%,#f8fafc_100%)] p-6 shadow-[0_18px_40px_rgba(14,165,233,0.08)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-3)]">
              Siguiente paso
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">Bloques pendientes</h2>
            {/* Lista de bloques que se anadiran en el futuro */}
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[color:var(--ink-3)]">
              <li className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper)]/80 px-4 py-3">
                Aeronave, familia y variante.
              </li>
              <li className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper)]/80 px-4 py-3">
                Tipo de trabajo y clasificacion tecnica.
              </li>
              <li className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper)]/80 px-4 py-3">
                Notas y trazabilidad adicional.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
