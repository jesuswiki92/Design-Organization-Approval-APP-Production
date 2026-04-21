'use client'

/**
 * Panel "Abrir project".
 *
 * Se muestra en la page de detalle de request cuando la request esta en
 * status `quote_accepted` o `final_review`. Ofrece una vista previa del
 * project a crear (numero sugerido, estructura de carpetas, data clave) y
 * un boton para confirmar la apertura.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  FolderPlus,
  Loader2,
  Sparkles,
} from 'lucide-react'

type ProjectPreview = {
  project_number_sugerido: string
  modelo_prefijo: string
  existentes_mismo_prefijo: number
  secuencia_sugerida: number
  titulo_sugerido: string
  aircraft: string | null
  client: string | null
  tcds_code: string | null
  tcds_code_short: string | null
  folder_path: string
  folder_structure: readonly string[]
}

type CreatedProject = {
  id: string
  project_number: string
  folder_path: string
}

type Props = {
  consultaId: string
  currentState: string
}

export function PreparaProyectoPanel({ consultaId }: Props) {
  const [preview, setPreview] = useState<ProjectPreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(true)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedProject | null>(null)

  const loadPreview = useCallback(async () => {
    setLoadingPreview(true)
    setPreviewError(null)
    try {
      const res = await fetch(`/api/incoming-requests/${consultaId}/project-preview`, {
        method: 'GET',
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error ?? 'No se pudo cargar la vista previa.')
      }
      setPreview(data as ProjectPreview)
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Error inesperado.')
    } finally {
      setLoadingPreview(false)
    }
  }, [consultaId])

  useEffect(() => {
    loadPreview()
  }, [loadPreview])

  const handleAbrirProyecto = async () => {
    if (!preview || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(`/api/incoming-requests/${consultaId}/open-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_number: preview.project_number_sugerido,
          title: preview.titulo_sugerido,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error ?? 'No se pudo abrir el project.')
      }
      setCreated(data as CreatedProject)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Error inesperado.')
    } finally {
      setSubmitting(false)
    }
  }

  // ---------- Status: exito ----------
  if (created) {
    return (
      <section className="rounded-[22px] border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-5 shadow-[0_10px_24px_rgba(74,60,36,0.08)]">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-[color:var(--ink)]">
              Project opened correctamente
            </h2>
            <p className="mt-1 text-xs text-[color:var(--ink-3)]">
              Se ha creado el project{' '}
              <span className="font-mono font-semibold text-emerald-700">
                {created.project_number}
              </span>{' '}
              y la folder en disco.
            </p>
            <div className="mt-3 rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper)]/70 p-3">
              <p className="text-[11px] uppercase tracking-wider text-[color:var(--ink-3)]">
                Folder
              </p>
              <p className="mt-1 break-all font-mono text-xs text-[color:var(--ink-2)]">
                {created.folder_path}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                href={`/engineering/${created.id}`}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm transition-colors hover:bg-emerald-200"
              >
                <FolderOpen className="h-4 w-4" />
                Ir al project
              </Link>
            </div>
          </div>
        </div>
      </section>
    )
  }

  // ---------- Status: cargando preview ----------
  if (loadingPreview) {
    return (
      <section className="rounded-[22px] border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-5 shadow-[0_12px_28px_rgba(74,60,36,0.12)]">
        <div className="flex items-center gap-2 text-sm text-[color:var(--ink-2)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Calculando propuesta de project...
        </div>
      </section>
    )
  }

  // ---------- Status: error preview ----------
  if (previewError || !preview) {
    return (
      <section className="rounded-[22px] border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div>
            <h2 className="text-sm font-semibold text-[color:var(--ink)]">
              No se pudo cargar la vista previa
            </h2>
            <p className="mt-1 text-xs text-[color:var(--ink-2)]">
              {previewError ?? 'Response vacia del servidor.'}
            </p>
            <button
              type="button"
              onClick={loadPreview}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ink-2)] shadow-sm hover:bg-[color:var(--paper-3)]"
            >
              Reintentar
            </button>
          </div>
        </div>
      </section>
    )
  }

  // ---------- Status: preview cargada ----------
  return (
    <section className="overflow-hidden rounded-[22px] border border-[color:var(--ink-4)] bg-[color:var(--paper)] shadow-[0_10px_24px_rgba(74,60,36,0.08)]">
      <div className="border-b border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-5 py-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[color:var(--umber)]" />
          <h2 className="text-sm font-semibold text-[color:var(--ink)]">
            Abrir project
          </h2>
        </div>
        <p className="mt-1 text-xs text-[color:var(--ink-3)]">
          Confirma la informacion y abre el project. Se creara la fila en la
          base de data y la folder fisica con sus subcarpetas estandar.
        </p>
      </div>

      <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
        {/* Columna izquierda: data del project */}
        <div className="space-y-3">
          <div className="rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-3">
            <p className="text-[11px] uppercase tracking-wider text-[color:var(--ink-3)]">
              Numero de project sugerido
            </p>
            <p className="mt-1 font-mono text-xl font-semibold text-[color:var(--ink)]">
              {preview.project_number_sugerido}
            </p>
            <p className="mt-1 text-[11px] text-[color:var(--ink-3)]">
              Prefijo {preview.modelo_prefijo} - secuencia{' '}
              {preview.secuencia_sugerida} (existentes:{' '}
              {preview.existentes_mismo_prefijo})
            </p>
          </div>

          <dl className="grid grid-cols-1 gap-2 text-xs">
            <div className="rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-2.5">
              <dt className="text-[11px] uppercase tracking-wider text-[color:var(--ink-3)]">
                Titulo
              </dt>
              <dd className="mt-0.5 text-[color:var(--ink-2)]">{preview.titulo_sugerido}</dd>
            </div>
            <div className="rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-2.5">
              <dt className="text-[11px] uppercase tracking-wider text-[color:var(--ink-3)]">
                Aircraft
              </dt>
              <dd className="mt-0.5 text-[color:var(--ink-2)]">
                {preview.aircraft ?? '—'}
              </dd>
            </div>
            <div className="rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-2.5">
              <dt className="text-[11px] uppercase tracking-wider text-[color:var(--ink-3)]">
                Client
              </dt>
              <dd className="mt-0.5 text-[color:var(--ink-2)]">
                {preview.client ?? '—'}
              </dd>
            </div>
            <div className="rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-2.5">
              <dt className="text-[11px] uppercase tracking-wider text-[color:var(--ink-3)]">
                TCDS
              </dt>
              <dd className="mt-0.5 font-mono text-[color:var(--ink-2)]">
                {preview.tcds_code ?? '—'}
                {preview.tcds_code_short ? ` (${preview.tcds_code_short})` : ''}
              </dd>
            </div>
          </dl>
        </div>

        {/* Columna derecha: estructura de carpetas */}
        <div className="space-y-3">
          <div className="rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-3">
            <p className="text-[11px] uppercase tracking-wider text-[color:var(--ink-3)]">
              Folder a crear
            </p>
            <p className="mt-1 break-all font-mono text-xs text-[color:var(--ink-2)]">
              {preview.folder_path}
            </p>
          </div>
          <div className="rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-3">
            <p className="text-[11px] uppercase tracking-wider text-[color:var(--ink-3)]">
              Subcarpetas estandar
            </p>
            <ul className="mt-2 space-y-1">
              {preview.folder_structure.map((folder) => (
                <li
                  key={folder}
                  className="flex items-center gap-2 rounded-md bg-[color:var(--paper-2)] px-2 py-1.5 text-xs text-[color:var(--ink-2)]"
                >
                  <FolderPlus className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="font-mono">{folder}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {submitError && (
        <div className="mx-5 mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{submitError}</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/50 px-5 py-4">
        <button
          type="button"
          onClick={handleAbrirProyecto}
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Abriendo project...
            </>
          ) : (
            <>
              <FolderPlus className="h-4 w-4" />
              Abrir project
            </>
          )}
        </button>
      </div>
    </section>
  )
}

export default PreparaProyectoPanel
