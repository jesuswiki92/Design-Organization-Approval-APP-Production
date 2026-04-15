import {
  AlertCircle,
  BookOpenText,
  BrainCircuit,
  CircleHelp,
  Crosshair,
  FileSearch,
  Layers3,
  ShieldCheck,
} from 'lucide-react'
import type { ReactNode } from 'react'

import type { PreliminaryScopeModel } from '@/lib/quotations/build-preliminary-scope-model'

export function PreliminaryScopePanel({
  model,
}: {
  model: PreliminaryScopeModel
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-emerald-200 bg-white shadow-[0_18px_40px_rgba(148,163,184,0.14)]">
      <div className="border-b border-emerald-100 bg-[linear-gradient(135deg,#ffffff_0%,#ecfdf5_45%,#f8fafc_100%)] px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              <Crosshair className="h-3.5 w-3.5" />
              Definir alcance. Preliminar
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              Alcance preliminar propuesto
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">{model.proposedScope.summary}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge label={`Confianza ${model.confidence.label}`} tone="emerald" />
            <Badge label={model.context.chosenReferenceLabel} tone="slate" />
            {model.proposedScope.continuity && <Badge label="Con continuidad tecnica" tone="sky" />}
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {model.proposedScope.metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3"
            >
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                {metric.label}
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-950">{metric.value}</div>
            </div>
          ))}
        </div>

        {model.confidence.reasons.length > 0 && (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Porque esta confianza
            </div>
            <ul className="mt-3 space-y-2">
              {model.confidence.reasons.map((reason) => (
                <li key={reason} className="flex items-start gap-2 text-sm leading-6 text-emerald-900">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-5 px-6 py-6">
        <SectionCard
          icon={<BookOpenText className="h-4 w-4" />}
          title="Lo que dice el cliente"
          tone="sky"
        >
          <div className="grid gap-3 md:grid-cols-2">
            {model.clientProvided.map((fact) => (
              <div key={fact.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  {fact.label}
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-900">{fact.value}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          icon={<BrainCircuit className="h-4 w-4" />}
          title="Lo que DOA / ingenieria propone"
          tone="emerald"
        >
          <div className="grid gap-3 md:grid-cols-2">
            {model.doaInference.map((item) => (
              <InferenceCard key={item.key} label={item.label} value={item.value} />
            ))}
          </div>
        </SectionCard>

        <SectionCard
          icon={<ShieldCheck className="h-4 w-4" />}
          title="Areas de impacto"
          tone="slate"
        >
          <div className="grid gap-3 md:grid-cols-2">
            {model.impacts.map((impact) => (
              <div
                key={impact.discipline}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-950">{impact.discipline}</div>
                  <ImpactStatusBadge status={impact.status} />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{impact.rationale}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          icon={<Layers3 className="h-4 w-4" />}
          title="Lo que aporta el proyecto base"
          tone="amber"
        >
          <ul className="space-y-3">
            {model.baseContribution.map((item) => (
              <li key={item} className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm leading-6 text-slate-800">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-amber-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <div className="grid gap-5 xl:grid-cols-2">
          <SectionCard
            icon={<CircleHelp className="h-4 w-4" />}
            title="Lo que falta para cerrar alcance"
            tone="rose"
          >
            <div className="space-y-4">
              <MissingBlock
                title="Pedir al cliente"
                emptyLabel="No hay preguntas nuevas detectadas para el cliente."
                items={model.missingInfo.askClient}
                tone="sky"
              />
              <MissingBlock
                title="Validacion interna"
                emptyLabel="No hay validaciones internas nuevas detectadas."
                items={model.missingInfo.internalValidation}
                tone="slate"
              />
            </div>
          </SectionCard>

          <SectionCard
            icon={<FileSearch className="h-4 w-4" />}
            title="Evidencia secundaria"
            tone="slate"
          >
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                Precedente seleccionado
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-950">
                {model.context.chosenReferenceLabel}
              </div>
              {model.evidence.tcdsNotes.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {model.evidence.tcdsNotes.map((note) => (
                    <span
                      key={note}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
                    >
                      {note}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {model.evidence.precedentUnknowns.length > 0 && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Lagunas visibles del precedente
                </div>
                <ul className="mt-3 space-y-2">
                  {model.evidence.precedentUnknowns.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm leading-6 text-slate-600">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-300" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <details className="mt-4 rounded-2xl border border-slate-200 bg-white">
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-slate-900">
                Ver PROJECT_SUMMARY / evidencia cruda
              </summary>
              <div className="border-t border-slate-200 px-4 py-4">
                {model.evidence.rawSummaryMd ? (
                  <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                    {model.evidence.rawSummaryMd}
                  </pre>
                ) : (
                  <p className="text-sm leading-6 text-slate-500">
                    No hay PROJECT_SUMMARY cargado para este precedente.
                  </p>
                )}
              </div>
            </details>
          </SectionCard>
        </div>
      </div>
    </section>
  )
}

function SectionCard({
  children,
  icon,
  title,
  tone,
}: {
  children: ReactNode
  icon: ReactNode
  title: string
  tone: 'amber' | 'emerald' | 'rose' | 'sky' | 'slate'
}) {
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-100 bg-emerald-50/40 text-emerald-700'
      : tone === 'amber'
        ? 'border-amber-100 bg-amber-50/40 text-amber-700'
        : tone === 'rose'
          ? 'border-rose-100 bg-rose-50/40 text-rose-700'
          : tone === 'sky'
            ? 'border-sky-100 bg-sky-50/40 text-sky-700'
            : 'border-slate-200 bg-slate-50/60 text-slate-700'

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5">
      <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${toneClass}`}>
        {icon}
        {title}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function InferenceCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
        {label}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-800">{value}</p>
    </div>
  )
}

function ImpactStatusBadge({
  status,
}: {
  status: PreliminaryScopeModel['impacts'][number]['status']
}) {
  const className =
    status === 'probable'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : status === 'possible'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-slate-200 bg-white text-slate-500'

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${className}`}>
      {status}
    </span>
  )
}

function Badge({ label, tone }: { label: string; tone: 'emerald' | 'sky' | 'slate' }) {
  const className =
    tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'sky'
        ? 'border-sky-200 bg-sky-50 text-sky-700'
        : 'border-slate-200 bg-white text-slate-600'

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

function MissingBlock({
  emptyLabel,
  items,
  title,
  tone,
}: {
  emptyLabel: string
  items: string[]
  title: string
  tone: 'sky' | 'slate'
}) {
  const toneClass =
    tone === 'sky'
      ? 'border-sky-100 bg-sky-50/60'
      : 'border-slate-200 bg-slate-50'

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{title}</div>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm leading-6 text-slate-700">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm leading-6 text-slate-500">{emptyLabel}</p>
      )}
    </div>
  )
}
