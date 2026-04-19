'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, Plus, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ReferenceProjectButton } from './ReferenceProjectButton'

type SearchResult = {
  id: string
  numero_proyecto: string
  titulo: string | null
  descripcion: string | null
  estado: string | null
  aeronave: string | null
  msn: string | null
  cliente_nombre: string | null
  anio: number | null
  created_at: string | null
}

type Props = {
  consultaId: string
  currentRefs: string[]
}

export function ManualProjectSearch({ consultaId, currentRefs }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      setSearched(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/proyectos-historico/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(data)
      setSearched(true)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSearch(query), 300)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query, doSearch])

  return (
    <div className="mt-3">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--ink-3)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por codigo, titulo, cliente, aeronave..."
          className="w-full rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] py-2 pl-9 pr-3 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] focus:border-[color:var(--ink-4)] focus:outline-none focus:ring-1 focus:ring-[color:var(--ink-4)]"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-[color:var(--ink-3)]" />
        )}
      </div>

      {/* Results */}
      {searched && results.length === 0 && !loading && (
        <p className="mt-3 text-xs italic text-[color:var(--ink-3)]">
          No se encontraron proyectos para &ldquo;{query}&rdquo;
        </p>
      )}

      {results.length > 0 && (
        <div className="mt-3 space-y-2">
          {results.map((project) => {
            const isRef = currentRefs.includes(project.id)
            return (
              <div
                key={`manual-${project.id}`}
                className={`rounded-xl border px-3 py-2.5 ${
                  isRef
                    ? 'border-amber-300 bg-amber-50/60'
                    : 'border-[color:var(--ink-4)] bg-[color:var(--paper-2)]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {project.numero_proyecto && (
                        <span className="inline-block rounded bg-[color:var(--paper-3)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[color:var(--ink-2)]">
                          {project.numero_proyecto}
                        </span>
                      )}
                      {isRef && (
                        <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700">
                          Referencia
                        </span>
                      )}
                      {project.aeronave && (
                        <span className="rounded bg-[color:var(--paper-2)] px-1.5 py-0.5 text-[9px] font-medium text-[color:var(--ink-2)]">
                          {project.aeronave}
                        </span>
                      )}
                      {project.msn && (
                        <span className="rounded bg-[color:var(--paper-2)] px-1.5 py-0.5 text-[9px] font-medium text-[color:var(--ink-3)]">
                          MSN {project.msn}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm font-medium leading-snug text-[color:var(--ink)]">
                      {project.titulo ?? '—'}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {project.cliente_nombre && (
                        <p className="text-[10px] text-[color:var(--ink-3)]">{project.cliente_nombre}</p>
                      )}
                      {project.anio && (
                        <p className="text-[10px] text-[color:var(--ink-3)]">{project.anio}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {project.estado && (
                      <span className="rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--ink-3)]">
                        {project.estado}
                      </span>
                    )}
                    <ReferenceProjectButton
                      consultaId={consultaId}
                      proyectoId={project.id}
                      isReferenced={isRef}
                    />
                    <Link
                      href={`/proyectos-historico/${project.id}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] text-[color:var(--ink-2)] transition-colors hover:bg-[color:var(--paper-3)]"
                      title="Abrir ficha"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
