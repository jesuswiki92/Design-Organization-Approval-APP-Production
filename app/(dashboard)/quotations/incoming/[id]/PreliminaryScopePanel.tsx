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
    <section className="overflow-hidden rounded-[28px] border border-[color:var(--ink-4)] bg-[color:var(--paper)] shadow-[0_18px_40px_rgba(74,60,36,0.08)]">
      <div className="border-b border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--umber)]">
              <Crosshair className="h-3.5 w-3.5" />
              Definir alcance. Preliminar
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--ink)]">
              Alcance preliminar propuesto
            </h2>
            <p className="mt-3 text-sm leading-7 text-[color:var(--ink-3)]">{model.proposedScope.summary}</p>
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
              className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper)]/90 px-4 py-3"
            >
              <div className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
                {metric.label}
              </div>
              <div className="mt-2 text-sm font-semibold text-[color:var(--ink)]">{metric.value}</div>
            </div>
          ))}
        </div>

        {model.confidence.reasons.length > 0 && (
          <div className="mt-5 rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-2)]">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Porque esta confianza
            </div>
            <ul className="mt-3 space-y-2">
              {model.confidence.reasons.map((reason) => (
                <li key={reason} className="flex items-start gap-2 text-sm leading-6 text-[color:var(--ink-2)]">
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
              <div key={fact.label} className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
                  {fact.label}
                </div>
                <div className="mt-2 text-sm leading-6 text-[color:var(--ink)]">{fact.value}</div>
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
                className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-semibold text-[color:var(--ink)]">{impact.discipline}</div>
                  <ImpactStatusBadge status={impact.status} />
                </div>
                <p className="mt-3 text-sm leading-6 text-[color:var(--ink-3)]">{impact.rationale}</p>
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
              <li key={item} className="flex items-start gap-3 rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-4 py-3 text-sm leading-6 text-[color:var(--ink-2)]">
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
            <div className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
                Precedente seleccionado
              </div>
              <div className="mt-2 text-sm font-semibold text-[color:var(--ink)]">
                {model.context.chosenReferenceLabel}
              </div>
              {model.evidence.tcdsNotes.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {model.evidence.tcdsNotes.map((note) => (
                    <span
                      key={note}
                      className="rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-3 py-1 text-xs text-[color:var(--ink-3)]"
                    >
                      {note}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {model.evidence.precedentUnknowns.length > 0 && (
              <div className="mt-4 rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Lagunas visibles del precedente
                </div>
                <ul className="mt-3 space-y-2">
                  {model.evidence.precedentUnknowns.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm leading-6 text-[color:var(--ink-3)]">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[color:var(--paper-3)]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <details className="mt-4 rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper)]">
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-[color:var(--ink)]">
                Ver PROJECT_SUMMARY / evidencia cruda
              </summary>
              <div className="border-t border-[color:var(--ink-4)] px-4 py-4">
                {model.evidence.rawSummaryMd ? (
                  <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                    {model.evidence.rawSummaryMd}
                  </pre>
                ) : (
                  <p className="text-sm leading-6 text-[color:var(--ink-3)]">
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
            ? 'border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/40 text-[color:var(--ink-2)]'
            : 'border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/60 text-[color:var(--ink-2)]'

  return (
    <section className="rounded-[24px] border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-5">
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
    <div className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
        {label}
      </div>
      <p className="mt-3 text-sm leading-6 text-[color:var(--ink-2)]">{value}</p>
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
        : 'border-[color:var(--ink-4)] bg-[color:var(--paper)] text-[color:var(--ink-3)]'

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
        ? 'border-[color:var(--ink-4)] bg-[color:var(--paper-2)] text-[color:var(--ink-2)]'
        : 'border-[color:var(--ink-4)] bg-[color:var(--paper)] text-[color:var(--ink-3)]'

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
      ? 'border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/60'
      : 'border-[color:var(--ink-4)] bg-[color:var(--paper-2)]'

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--ink-3)]">{title}</div>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm leading-6 text-[color:var(--ink-2)]">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm leading-6 text-[color:var(--ink-3)]">{emptyLabel}</p>
      )}
    </div>
  )
}
