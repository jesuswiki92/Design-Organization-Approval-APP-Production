/**
 * ============================================================================
 * SECCION "PROYECTOS SIMILARES" (PRECEDENTES)
 * ============================================================================
 *
 * Renderiza el top-3 de proyectos pasados similares al proyecto actual,
 * usando busqueda vectorial sobre PROJECT_SUMMARY.md (ver
 * `app/api/proyectos/[id]/precedentes/route.ts` y la migracion
 * `doa_proyectos_embeddings`).
 *
 * Estados gestionados de forma elegante:
 *   - 200 con resultados   -> tarjetas con score, clasificacion, snippet
 *   - 200 con array vacio  -> "No hay proyectos similares en el indice"
 *   - 503                  -> "Indice no inicializado" (migracion + backfill)
 *   - 401                  -> "Sesion expirada" + boton de refresco
 *   - otros                -> mensaje generico de error
 *
 * Filtros cliente:
 *   - "Minor" / "Major" toggle chips (independientes)
 *   - "Copiar ruta" copia el path absoluto al portapapeles
 * ============================================================================
 */

'use client'

import { useEffect, useState } from 'react'
import {
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  FolderTree,
  Archive,
  BookOpen,
  Database,
} from 'lucide-react'

// --- TIPOS ---

type Precedente = {
  project_number: string
  project_title: string | null
  score: number
  classification: string | null
  cert_basis: string | null
  family: string | null
  doc_pack: string[] | null
  source_path: string | null
  snippet: string | null
  /**
   * Sprint 4: origen del precedente.
   *   - 'historico'  -> indice OpenAI (doa_proyectos_embeddings).
   *   - 'archivado'  -> indice Pinecone doa-precedentes (proyectos archivados).
   *   - 'cerrado'    -> Pinecone, proyecto cerrado pero no archivado.
   */
  fuente?: 'historico' | 'archivado' | 'cerrado'
  /** Sprint 4: lecciones aprendidas asociadas al precedente. */
  lecciones_count?: number
}

type Props = {
  projectId: string
  projectNumber: string
}

// --- UTILIDADES ---

/** Devuelve clases Tailwind para el badge de clasificacion */
function classificationBadge(classification: string | null): {
  label: string
  cls: string
} {
  const c = (classification ?? '').toLowerCase()
  if (c === 'minor') {
    return {
      label: 'Minor',
      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    }
  }
  if (c === 'major') {
    return {
      label: 'Major',
      cls: 'bg-orange-50 text-orange-700 border-orange-200',
    }
  }
  return {
    label: 'Sin clasificar',
    cls: 'bg-slate-100 text-slate-500 border-slate-200',
  }
}

/** Convierte un score 0..1 a porcentaje legible */
function scorePct(score: number): string {
  const n = Math.round(score * 100)
  return `${n}% similar`
}

/** Badge para la fuente del precedente (Sprint 4). */
function fuenteBadge(fuente: Precedente['fuente']): {
  label: string
  cls: string
  Icon: typeof Database
} {
  if (fuente === 'archivado') {
    return {
      label: 'Archivado',
      cls: 'bg-violet-50 text-violet-700 border-violet-200',
      Icon: Archive,
    }
  }
  if (fuente === 'cerrado') {
    return {
      label: 'Cerrado',
      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      Icon: Archive,
    }
  }
  return {
    label: 'Historico',
    cls: 'bg-slate-50 text-slate-600 border-slate-200',
    Icon: Database,
  }
}

// --- COMPONENTE ---

export function PrecedentesSection({ projectId, projectNumber }: Props) {
  const [results, setResults] = useState<Precedente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterMinor, setFilterMinor] = useState(false)
  const [filterMajor, setFilterMajor] = useState(false)
  const [copiedSource, setCopiedSource] = useState<string | null>(null)

  // --- Fetch al montar ---
  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/proyectos/${projectId}/precedentes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })

        if (cancelled) return

        if (res.status === 401) {
          setError('Sesion expirada. Refresca la pagina para iniciar sesion de nuevo.')
          setResults([])
          return
        }

        if (res.status === 404) {
          setError('Proyecto no encontrado.')
          setResults([])
          return
        }

        if (res.status === 503) {
          setError(
            'Indice de precedentes no inicializado. Aplica la migracion y ejecuta el backfill (ver docs/precedentes-panel.md).',
          )
          setResults([])
          return
        }

        if (!res.ok) {
          const body = await res.json().catch(() => null)
          const detail = body?.error ?? `HTTP ${res.status}`
          setError(`No se pudieron cargar los precedentes: ${detail}`)
          setResults([])
          return
        }

        const body = (await res.json()) as { results?: Precedente[] }
        setResults(Array.isArray(body.results) ? body.results : [])
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : 'unknown'
        setError(`Error de red: ${msg}`)
        setResults([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
    // projectNumber no se usa para el fetch (lo usa el backend) pero forma parte
    // de la identidad logica de la seccion; lo incluimos para que React reaccione
    // si cambia.
  }, [projectId, projectNumber])

  // --- Filtros cliente ---
  const filtered = results.filter((p) => {
    if (!filterMinor && !filterMajor) return true
    const c = (p.classification ?? '').toLowerCase()
    if (filterMinor && c === 'minor') return true
    if (filterMajor && c === 'major') return true
    return false
  })

  // --- Copiar ruta ---
  async function handleCopy(sourcePath: string) {
    try {
      await navigator.clipboard.writeText(sourcePath)
      setCopiedSource(sourcePath)
      setTimeout(() => {
        setCopiedSource((cur) => (cur === sourcePath ? null : cur))
      }, 2000)
    } catch (err) {
      console.error('No se pudo copiar al portapapeles:', err)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header de la seccion */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <Sparkles className="h-4 w-4 text-slate-400" />
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Proyectos similares
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Top 3 segun el indice
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterMinor((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              filterMinor
                ? 'border-emerald-300 bg-emerald-100 text-emerald-700'
                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            Minor
          </button>
          <button
            type="button"
            onClick={() => setFilterMajor((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              filterMajor
                ? 'border-orange-300 bg-orange-100 text-orange-700'
                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            Major
          </button>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="px-5 py-4">
        {loading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-slate-100 bg-slate-50 p-4"
              >
                <div className="h-3 w-1/3 rounded bg-slate-200" />
                <div className="mt-2 h-4 w-2/3 rounded bg-slate-200" />
                <div className="mt-3 h-3 w-full rounded bg-slate-200" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-6 text-center">
            <p className="text-sm text-amber-800">{error}</p>
            {error.startsWith('Sesion expirada') && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-3 inline-flex items-center gap-1 rounded-md border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
              >
                <RefreshCw className="h-3 w-3" />
                Refrescar
              </button>
            )}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
            {results.length === 0
              ? 'No hay proyectos similares en el indice.'
              : 'Ningun proyecto coincide con los filtros activos.'}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <ul className="space-y-3">
            {filtered.map((p) => {
              const badge = classificationBadge(p.classification)
              const fuente = fuenteBadge(p.fuente)
              const FuenteIcon = fuente.Icon
              const isCopied = copiedSource === p.source_path
              return (
                <li
                  key={p.project_number}
                  className="rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm"
                >
                  {/* Header line */}
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-mono text-xs text-slate-500">
                      {p.project_number}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                      {scorePct(p.score)}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">
                    {p.project_title ?? 'Sin titulo'}
                  </h3>

                  {/* Metadata row */}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${fuente.cls}`}
                      title={`Fuente: ${fuente.label}`}
                    >
                      <FuenteIcon className="h-3 w-3" />
                      {fuente.label}
                    </span>
                    {typeof p.lecciones_count === 'number' && p.lecciones_count > 0 && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                        title="Lecciones aprendidas asociadas"
                      >
                        <BookOpen className="h-3 w-3" />
                        {p.lecciones_count} lecciones
                      </span>
                    )}
                    {p.family && (
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                        {p.family}
                      </span>
                    )}
                    {p.cert_basis && (
                      <span className="text-[11px] text-slate-500">
                        {p.cert_basis}
                      </span>
                    )}
                  </div>

                  {/* Snippet */}
                  {p.snippet && (
                    <p className="mt-2 line-clamp-2 text-xs italic text-slate-500">
                      {p.snippet}
                    </p>
                  )}

                  {/* Actions */}
                  {p.source_path && (
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(p.source_path as string)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
                      >
                        {isCopied ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" />
                            <span className="text-emerald-700">Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            Copiar ruta
                          </>
                        )}
                      </button>
                      <span
                        className="inline-flex items-center gap-1 truncate text-[11px] text-slate-400"
                        title={p.source_path}
                      >
                        <FolderTree className="h-3 w-3" />
                        <span className="truncate">{p.source_path}</span>
                      </span>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
