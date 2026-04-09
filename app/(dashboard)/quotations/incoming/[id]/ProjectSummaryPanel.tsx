'use client'

/**
 * ============================================================================
 * PANEL DE RESUMEN DE PROYECTO HISTORICO
 * ============================================================================
 *
 * Muestra el contenido summary_md (markdown) de un proyecto historico de
 * referencia. Se usa dentro de la seccion "Definir alcance. Preliminar"
 * debajo de la tabla de comparacion de cada proyecto referencia.
 *
 * Diseno colapsable: empieza cerrado, el ingeniero hace clic para expandir.
 * Renderiza el markdown con parseo basico (headers, listas, tablas, negrita).
 * ============================================================================
 */

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, FileText, Loader2 } from 'lucide-react'

type Props = {
  projectId: string
  projectCode: string
  projectTitle: string
}

type SummaryData = {
  summary_md: string | null
  numero_proyecto: string
  titulo: string
}

// ---------------------------------------------------------------------------
// Minimal markdown parser — no external dependencies
// ---------------------------------------------------------------------------

/** Escape HTML entities to prevent XSS */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Parse inline markdown: **bold**, *italic*, `code` */
function parseInline(text: string): string {
  let result = escapeHtml(text)
  // Bold: **text**
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>')
  // Italic: *text*
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>')
  // Inline code: `code`
  result = result.replace(/`(.+?)`/g, '<code class="rounded bg-slate-100 px-1 py-0.5 text-[11px] font-mono text-slate-700">$1</code>')
  return result
}

/**
 * Renders a simple markdown table (pipes delimited) into an HTML table.
 * Expects rows like: | col1 | col2 | col3 |
 */
function renderTable(lines: string[]): string {
  if (lines.length < 2) return lines.map((l) => `<p class="text-xs text-slate-700">${escapeHtml(l)}</p>`).join('')

  const parseRow = (line: string) =>
    line
      .split('|')
      .map((c) => c.trim())
      .filter((c) => c.length > 0)

  const headerCells = parseRow(lines[0])

  // Skip separator row (e.g. |---|---|)
  const isSeparator = (line: string) => /^\|[\s\-:|]+\|$/.test(line.trim())
  const dataStartIdx = isSeparator(lines[1]) ? 2 : 1

  const dataRows = lines.slice(dataStartIdx).map(parseRow)

  const ths = headerCells
    .map((h) => `<th class="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">${parseInline(h)}</th>`)
    .join('')

  const trs = dataRows
    .map((cells) => {
      const tds = cells
        .map((c) => `<td class="px-2 py-1 text-xs text-slate-700">${parseInline(c)}</td>`)
        .join('')
      return `<tr class="border-t border-slate-100">${tds}</tr>`
    })
    .join('')

  return `<div class="overflow-x-auto rounded-lg border border-slate-200 my-2"><table class="w-full text-left text-xs"><thead><tr class="bg-slate-50">${ths}</tr></thead><tbody>${trs}</tbody></table></div>`
}

/**
 * Parse a full markdown string into HTML.
 * Handles: ## headers, - list items, | tables |, blank lines, paragraphs.
 */
function parseMarkdown(md: string): string {
  const lines = md.split('\n')
  const htmlParts: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Blank line
    if (trimmed === '') {
      i++
      continue
    }

    // Header: ## or ###
    if (trimmed.startsWith('###')) {
      const text = trimmed.replace(/^###\s*/, '')
      htmlParts.push(`<h4 class="mt-3 mb-1 text-xs font-bold text-slate-700">${parseInline(text)}</h4>`)
      i++
      continue
    }
    if (trimmed.startsWith('##')) {
      const text = trimmed.replace(/^##\s*/, '')
      htmlParts.push(`<h3 class="mt-4 mb-1.5 text-sm font-bold text-slate-900 border-b border-slate-100 pb-1">${parseInline(text)}</h3>`)
      i++
      continue
    }
    if (trimmed.startsWith('#')) {
      const text = trimmed.replace(/^#\s*/, '')
      htmlParts.push(`<h3 class="mt-4 mb-1.5 text-sm font-bold text-slate-900 border-b border-slate-100 pb-1">${parseInline(text)}</h3>`)
      i++
      continue
    }

    // Table block: consecutive lines starting with |
    if (trimmed.startsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim())
        i++
      }
      htmlParts.push(renderTable(tableLines))
      continue
    }

    // List item: - text or * text
    if (/^[-*]\s/.test(trimmed)) {
      const listItems: string[] = []
      while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^[-*]\s/, ''))
        i++
      }
      const lis = listItems
        .map((item) => `<li class="text-xs text-slate-700 leading-relaxed">${parseInline(item)}</li>`)
        .join('')
      htmlParts.push(`<ul class="my-1.5 ml-4 list-disc space-y-0.5">${lis}</ul>`)
      continue
    }

    // Numbered list: 1. text
    if (/^\d+\.\s/.test(trimmed)) {
      const listItems: string[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^\d+\.\s/, ''))
        i++
      }
      const lis = listItems
        .map((item) => `<li class="text-xs text-slate-700 leading-relaxed">${parseInline(item)}</li>`)
        .join('')
      htmlParts.push(`<ol class="my-1.5 ml-4 list-decimal space-y-0.5">${lis}</ol>`)
      continue
    }

    // Regular paragraph
    htmlParts.push(`<p class="text-xs text-slate-700 leading-relaxed my-1">${parseInline(trimmed)}</p>`)
    i++
  }

  return htmlParts.join('\n')
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectSummaryPanel({ projectId, projectCode, projectTitle }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)
  const [summaryHtml, setSummaryHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchSummary = useCallback(async () => {
    if (fetched) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/proyectos-historico/${projectId}/summary`)
      if (!res.ok) {
        if (res.status === 404) {
          setSummaryHtml(null)
          setFetched(true)
          return
        }
        throw new Error(`Error ${res.status}`)
      }
      const data: SummaryData = await res.json()
      if (data.summary_md) {
        setSummaryHtml(parseMarkdown(data.summary_md))
      } else {
        setSummaryHtml(null)
      }
      setFetched(true)
    } catch (err) {
      console.error('Error fetching project summary:', err)
      setError('No se pudo cargar el resumen del proyecto.')
    } finally {
      setLoading(false)
    }
  }, [projectId, fetched])

  function handleToggle() {
    const willExpand = !expanded
    setExpanded(willExpand)
    if (willExpand && !fetched) {
      fetchSummary()
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-white">
      {/* Toggle header */}
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-slate-50"
      >
        <FileText className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
        <span className="flex-1 text-xs font-medium text-slate-600">
          Resumen del proyecto {projectCode || 'referencia'}
        </span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Content */}
      {expanded && (
        <div className="border-t border-slate-100 px-3 py-3">
          {loading && (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              <span className="text-xs text-slate-400">Cargando resumen...</span>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          {fetched && !error && summaryHtml === null && (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-3 py-3">
              <p className="text-xs italic text-slate-400">
                No hay resumen disponible para este proyecto.
              </p>
            </div>
          )}

          {fetched && !error && summaryHtml !== null && (
            <div
              className="max-h-[500px] overflow-y-auto pr-1"
              dangerouslySetInnerHTML={{ __html: summaryHtml }}
            />
          )}
        </div>
      )}
    </div>
  )
}
