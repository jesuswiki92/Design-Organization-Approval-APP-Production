/**
 * ============================================================================
 * AIRCRAFT PANEL — sección "Datos de aircraft" del detalle de incoming
 * ============================================================================
 * Server-friendly (sin hooks). Muestra dos bloques:
 *
 *   1) "Form data" — los valores tal cual los rellenó el cliente en el
 *      formulario público (manufacturer, model, MSN, count, location, TCDS).
 *
 *   2) "Catalog match" — enriquecimiento opcional desde `public.doa_aircraft`,
 *      buscando por `tcds_code = incoming.tcds_number`. Si hay coincidencia,
 *      mostramos manufacturer / country / category / base regulation / engine
 *      / MTOW / MLW del catálogo y un enlace al PDF oficial. Si el manufacturer
 *      del formulario difiere del del catálogo, lo destacamos.
 *
 * Cuando `tcds_number` viene vacío y no hay otros datos, mostramos el empty
 * state habitual ("formulario pendiente").
 * ============================================================================
 */

import { AlertTriangle, BookOpenCheck, ExternalLink, Hash, MapPin, Package, Plane } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { Aircraft, IncomingRequest } from '@/types/database'

type AircraftPanelProps = {
  incoming: Pick<
    IncomingRequest,
    | 'aircraft_manufacturer'
    | 'aircraft_model'
    | 'aircraft_msn'
    | 'aircraft_count'
    | 'aircraft_location'
    | 'tcds_number'
    | 'tcds_pdf_url'
  >
  /**
   * Rows from `doa_aircraft` whose `tcds_code` equals `incoming.tcds_number`.
   * Empty array means either no TCDS provided or no row matched. The panel
   * picks the first variant (sorted by `model` upstream) as the canonical
   * match and exposes the variant count as context.
   */
  catalogMatches?: Aircraft[]
}

function isFilled(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  return Number.isFinite(value)
}

export function AircraftPanel({ incoming, catalogMatches = [] }: AircraftPanelProps) {
  const hasAnyData =
    isFilled(incoming.aircraft_manufacturer) ||
    isFilled(incoming.aircraft_model) ||
    isFilled(incoming.aircraft_msn) ||
    isFilled(incoming.aircraft_count) ||
    isFilled(incoming.aircraft_location) ||
    isFilled(incoming.tcds_number) ||
    isFilled(incoming.tcds_pdf_url)

  if (!hasAnyData) {
    return <FormPendingEmptyState />
  }

  const manufacturer = incoming.aircraft_manufacturer?.trim()
  const model = incoming.aircraft_model?.trim()
  const headerTitle = [manufacturer, model].filter(Boolean).join(' — ') || 'Unidentified aircraft'

  // Catalog match: pick the first variant (sorted by model upstream). The
  // remaining variants are surfaced only as a count, not the primary content.
  const tcdsProvided = isFilled(incoming.tcds_number)
  const catalogMatch = catalogMatches[0] ?? null
  const extraVariants = Math.max(catalogMatches.length - 1, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-4 py-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--terracotta)]/15">
          <Plane className="h-4 w-4 text-[color:var(--terracotta)]" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
            Aircraft
          </p>
          <h3 className="font-[family-name:var(--font-heading)] text-[17px] font-semibold text-[color:var(--ink)]">
            {headerTitle}
          </h3>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DataCell icon={<Hash className="h-3.5 w-3.5" />} label="MSN" value={incoming.aircraft_msn} mono />
        <DataCell icon={<Package className="h-3.5 w-3.5" />} label="Count" value={incoming.aircraft_count} />
        <DataCell
          icon={<MapPin className="h-3.5 w-3.5" />}
          label="Location"
          value={incoming.aircraft_location}
        />
        <DataCell
          icon={<Hash className="h-3.5 w-3.5" />}
          label="TCDS"
          value={incoming.tcds_number}
          mono
        />
      </div>

      {incoming.tcds_pdf_url ? (
        <a
          href={incoming.tcds_pdf_url}
          target="_blank"
          rel="noreferrer noopener"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border border-[color:var(--terracotta)]/40 bg-[color:var(--terracotta)]/10 px-3 py-1.5',
            'text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--terracotta)] transition-colors hover:bg-[color:var(--terracotta)]/20',
          )}
        >
          <ExternalLink className="h-3 w-3" />
          View TCDS
        </a>
      ) : null}

      {/* Catalog enrichment — only rendered when a TCDS number is on the form */}
      {tcdsProvided ? (
        catalogMatch ? (
          <CatalogMatchBlock
            match={catalogMatch}
            extraVariants={extraVariants}
            formManufacturer={manufacturer ?? null}
          />
        ) : (
          <CatalogNotFoundBadge tcds={incoming.tcds_number ?? ''} />
        )
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-componentes locales (compartidos vía import barrel sólo si los reusan
// otros paneles; por ahora cada panel mantiene los suyos para evitar sobre-
// abstraer mientras los layouts son distintos).
// ---------------------------------------------------------------------------

function DataCell({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ReactNode
  label: string
  value: string | number | null | undefined
  mono?: boolean
}) {
  const display = isFilled(value) ? String(value) : '—'
  return (
    <div className="rounded-[18px] border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0 text-[color:var(--ink-3)]">{icon}</span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ink-3)]">
            {label}
          </p>
          <p
            className={cn(
              'mt-0.5 truncate text-sm text-[color:var(--ink)]',
              mono && 'font-mono',
              !isFilled(value) && 'text-[color:var(--ink-3)]',
            )}
            title={display}
          >
            {display}
          </p>
        </div>
      </div>
    </div>
  )
}

export function FormPendingEmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-[color:var(--ink-4)] bg-[color:var(--paper)] px-5 py-10 text-center">
      <p className="text-sm font-medium text-[color:var(--ink-2)]">
        Awaiting form submission from client
      </p>
      <p className="mt-1.5 text-xs text-[color:var(--ink-3)]">
        Generate the URL from the <span className="font-semibold">Communications</span> section and
        send it to the client to complete this block.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Catalog match — pure enrichment from `doa_aircraft`. English copy on
// purpose, since this block is part of the new TCDS catalog feature.
// ---------------------------------------------------------------------------

function CatalogMatchBlock({
  match,
  extraVariants,
  formManufacturer,
}: {
  match: Aircraft
  extraVariants: number
  formManufacturer: string | null
}) {
  // Heuristic mismatch detection — case-insensitive substring either way.
  // Used only to surface a soft hint, never to block the UI.
  const manufacturerMismatch =
    formManufacturer != null &&
    formManufacturer.length > 0 &&
    !match.manufacturer.toLowerCase().includes(formManufacturer.toLowerCase()) &&
    !formManufacturer.toLowerCase().includes(match.manufacturer.toLowerCase())

  return (
    <div className="rounded-2xl border border-[color:var(--cobalt)]/30 bg-[color:var(--cobalt)]/[0.04] p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--cobalt)]/15">
          <BookOpenCheck className="h-4 w-4 text-[color:var(--cobalt)]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--cobalt)]">
              Catalog match
            </p>
            <p className="font-mono text-[11px] text-[color:var(--ink-3)]">{match.tcds_code}</p>
            {extraVariants > 0 ? (
              <span className="rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[color:var(--ink-3)]">
                +{extraVariants} more variant{extraVariants === 1 ? '' : 's'}
              </span>
            ) : null}
          </div>
          <h4 className="mt-1 font-[family-name:var(--font-heading)] text-[15px] font-semibold text-[color:var(--ink)]">
            {match.manufacturer} — {match.type}
            <span className="ml-2 font-mono text-[12px] font-medium text-[color:var(--ink-3)]">
              {match.model}
            </span>
          </h4>
          {manufacturerMismatch ? (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
              <AlertTriangle className="h-3 w-3" />
              Form manufacturer &ldquo;{formManufacturer}&rdquo; differs from catalog &ldquo;
              {match.manufacturer}&rdquo;.
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        <CatalogCell label="Country" value={match.country} />
        <CatalogCell label="Category" value={match.category} />
        <CatalogCell label="Base regulation" value={match.base_regulation} />
        <CatalogCell label="Engine" value={match.engine} />
        <CatalogCell
          label="MTOW (kg)"
          value={match.mtow_kg != null ? match.mtow_kg.toLocaleString('en-US') : null}
          mono
        />
        <CatalogCell
          label="MLW (kg)"
          value={match.mlw_kg != null ? match.mlw_kg.toLocaleString('en-US') : null}
          mono
        />
      </div>

      {match.tcds_pdf_url ? (
        <a
          href={match.tcds_pdf_url}
          target="_blank"
          rel="noreferrer noopener"
          className={cn(
            'mt-3 inline-flex items-center gap-1.5 rounded-full border border-[color:var(--cobalt)]/40 bg-[color:var(--cobalt)]/10 px-3 py-1.5',
            'text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--cobalt)] transition-colors hover:bg-[color:var(--cobalt)]/20',
          )}
        >
          <ExternalLink className="h-3 w-3" />
          Open official TCDS
        </a>
      ) : null}
    </div>
  )
}

function CatalogCell({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string | number | null | undefined
  mono?: boolean
}) {
  const display = isFilled(value) ? String(value) : '—'
  return (
    <div className="rounded-xl border border-[color:var(--ink-4)]/70 bg-[color:var(--paper)]/80 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ink-3)]">
        {label}
      </p>
      <p
        className={cn(
          'mt-0.5 truncate text-sm text-[color:var(--ink)]',
          mono && 'font-mono',
          !isFilled(value) && 'text-[color:var(--ink-3)]',
        )}
        title={display}
      >
        {display}
      </p>
    </div>
  )
}

function CatalogNotFoundBadge({ tcds }: { tcds: string }) {
  return (
    <p className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-3 py-1.5 text-[11px] font-medium text-[color:var(--ink-3)]">
      <AlertTriangle className="h-3 w-3" />
      TCDS <span className="font-mono">{tcds}</span> not found in catalog
    </p>
  )
}
