'use client'

import { Bot, BookCopy, CheckCircle2, Files, PanelRightOpen, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ProyectoConRelaciones, ProyectoDocumento, ProyectoTarea } from '@/types/database'

import { buildExpertAnalysis, type ExpertMode, inferDocumentCoverage } from './workspace-utils'

export function ProjectExpertPanel({
  project,
  docs,
  tasks,
  selectedDoc,
  mode,
  onModeChange,
}: {
  project: ProyectoConRelaciones
  docs: ProyectoDocumento[]
  tasks: ProyectoTarea[]
  selectedDoc: ProyectoDocumento | null
  mode: ExpertMode
  onModeChange: (mode: ExpertMode) => void
}) {
  const analysis = buildExpertAnalysis({
    project,
    docs,
    tasks,
    selectedDoc,
    mode,
  })
  const coverage = inferDocumentCoverage(docs)
  const includedSources = [
    `Proyecto ${project.numero_proyecto}`,
    project.tcds_code ? `TCDS: ${project.tcds_code}` : null,
    selectedDoc ? `Documento activo: ${selectedDoc.nombre}` : 'Resumen documental del expediente',
    `${docs.length} documentos visibles en workspace`,
  ].filter(Boolean) as string[]

  const excludedSources = [
    'Correos del proyecto',
    'Base de datos histórica de proyectos',
    'Notas externas no cargadas en esta vista',
  ]

  return (
    <aside className="flex min-h-[520px] flex-col overflow-hidden rounded-[24px] border border-sky-200 bg-white xl:sticky xl:top-6">
      <div className="border-b border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-5 py-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-[#0B1220] text-sky-700">
            <PanelRightOpen className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
              Experto contextual
            </div>
            <h3 className="mt-2 text-lg font-semibold text-slate-950">
              Asistencia técnica dentro del expediente
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              La asistencia se mantiene discreta, declara contexto activo y prioriza respuestas accionables sobre el workspace actual.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <ModeButton current={mode} value="overview" onModeChange={onModeChange}>Estado</ModeButton>
          <ModeButton current={mode} value="missing" onModeChange={onModeChange}>Faltantes</ModeButton>
          <ModeButton current={mode} value="next" onModeChange={onModeChange}>Próximo paso</ModeButton>
          <ModeButton current={mode} value="references" onModeChange={onModeChange}>Referencias</ModeButton>
          {selectedDoc && (
            <ModeButton current={mode} value="document" onModeChange={onModeChange}>Documento</ModeButton>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
            <Sparkles className="h-3.5 w-3.5" />
            {analysis.eyebrow}
          </div>
          <h4 className="mt-3 text-base font-semibold text-slate-950">{analysis.title}</h4>
          <p className="mt-3 text-sm leading-6 text-slate-700">{analysis.summary}</p>
          <div className="mt-4 space-y-2">
            {analysis.bullets.map((item) => (
              <div key={item} className="flex items-start gap-2 text-sm text-slate-500">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-sky-700" />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Acciones sugeridas</div>
            <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
              {analysis.actions.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-sky-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
            <Bot className="h-3.5 w-3.5" />
            Contexto activo
          </div>
          <div className="mt-3 space-y-3">
            <SourceList title="Fuentes incluidas" items={includedSources} icon={<Files className="h-4 w-4" />} />
            <SourceList title="No incluidas" items={excludedSources} icon={<BookCopy className="h-4 w-4" />} dimmed />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Cobertura documental</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <MiniMetric
              label="Cobertura base"
              value={`${coverage.present.length}/${coverage.present.length + coverage.missing.length}`}
            />
            <MiniMetric label="Piezas por localizar" value={String(coverage.missing.length)} />
          </div>
          {coverage.missing.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-50 p-3 text-sm text-amber-700">
              Faltan referencias claras para: {coverage.missing.join(', ')}.
            </div>
          )}
        </section>
      </div>
    </aside>
  )
}

function ModeButton({
  current,
  value,
  onModeChange,
  children,
}: {
  current: ExpertMode
  value: ExpertMode
  onModeChange: (mode: ExpertMode) => void
  children: ReactNode
}) {
  return (
    <Button
      variant={current === value ? 'secondary' : 'outline'}
      size="sm"
      className={cn(
        'border-[#334155] bg-[#0B1220] text-slate-700 hover:bg-[#172033]',
        current === value && 'bg-[#172033] text-white',
      )}
      onClick={() => onModeChange(value)}
    >
      {children}
    </Button>
  )
}

function SourceList({
  title,
  items,
  icon,
  dimmed = false,
}: {
  title: string
  items: string[]
  icon: ReactNode
  dimmed?: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
        {icon}
        {title}
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            key={item}
            className={cn('text-sm leading-6', dimmed ? 'text-slate-400' : 'text-slate-500')}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-2 text-lg font-semibold text-slate-950">{value}</div>
    </div>
  )
}
