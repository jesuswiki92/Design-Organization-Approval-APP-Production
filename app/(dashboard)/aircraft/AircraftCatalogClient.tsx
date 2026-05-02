/**
 * ============================================================================
 * AIRCRAFT CATALOG — client component (interactive filtering)
 * ============================================================================
 * Renders the certified type catalog (`doa_aircraft`) as a table with a
 * client-side text filter. The dataset is small (one row per type variant,
 * grouped by TCDS), so we keep everything in memory and skip pagination.
 *
 * Columns: TCDS, Manufacturer, Type, Model, Country, Category, MTOW, Engine,
 * link to the official TCDS PDF.
 *
 * Rows that share the same `tcds_code_short` get a stronger top border on
 * the first row of the next group, making variant blocks easy to scan.
 * ============================================================================
 */

'use client'

import { useMemo, useState } from 'react'
import { ExternalLink, Search } from 'lucide-react'

import { TopBar } from '@/components/layout/TopBar'
import { cn } from '@/lib/utils'
import type { Aircraft } from '@/types/database'

type AircraftCatalogClientProps = {
  aircraft: Aircraft[]
}

export default function AircraftCatalogClient({ aircraft }: AircraftCatalogClientProps) {
  const [search, setSearch] = useState('')

  /**
   * Lowercased, trimmed query. Empty string means "show everything".
   * Matches against TCDS (full + short), manufacturer, type, model, country,
   * category, engine and base_regulation.
   */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return aircraft

    return aircraft.filter((a) => {
      return (
        a.tcds_code.toLowerCase().includes(q) ||
        a.tcds_code_short.toLowerCase().includes(q) ||
        a.manufacturer.toLowerCase().includes(q) ||
        a.type.toLowerCase().includes(q) ||
        a.model.toLowerCase().includes(q) ||
        (a.country ?? '').toLowerCase().includes(q) ||
        (a.category ?? '').toLowerCase().includes(q) ||
        (a.engine ?? '').toLowerCase().includes(q) ||
        (a.base_regulation ?? '').toLowerCase().includes(q)
      )
    })
  }, [aircraft, search])

  // Distinct TCDS count for the header — useful context next to the row count.
  const distinctTcds = useMemo(() => {
    const set = new Set(filtered.map((a) => a.tcds_code))
    return set.size
  }, [filtered])

  /** True if the row is the first of a new TCDS group within the filtered list. */
  const isFirstInGroup = (index: number): boolean => {
    if (index === 0) return true
    return filtered[index].tcds_code_short !== filtered[index - 1].tcds_code_short
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      <TopBar title="Aircraft" subtitle="Certified type catalog (TCDS)" />

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-5 text-[color:var(--ink)]">
        {/* Header — title, description, counters and search box */}
        <section className="rounded-[34px] border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-6 shadow-[0_24px_50px_rgba(14,165,233,0.10)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                Aircraft catalog
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-[color:var(--ink-3)]">
                Master list of EASA / FAA certified type data sheets (TCDS).
                One row per model variant. Use it as a reference when matching
                an incoming request to a known type.
              </p>
            </div>

            <div className="flex gap-3">
              <div className="rounded-[22px] border border-[color:var(--ink-4)] bg-[color:var(--paper)]/90 px-4 py-3 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-3)]">
                  Variants
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{filtered.length}</p>
              </div>
              <div className="rounded-[22px] border border-[color:var(--ink-4)] bg-[color:var(--paper)]/90 px-4 py-3 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-3)]">
                  TCDS
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{distinctTcds}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="relative max-w-lg flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-3)]"
              />
              <input
                type="text"
                placeholder="Search by TCDS, manufacturer, type, model, engine..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] py-2 pl-9 pr-3 text-sm text-slate-950 shadow-sm transition-colors placeholder:text-[color:var(--ink-3)] focus:border-[color:var(--ink-4)] focus:outline-none"
              />
            </div>

            <div className="rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
              {filtered.length} variant{filtered.length === 1 ? '' : 's'} · {distinctTcds} TCDS
            </div>
          </div>
        </section>

        {/* Catalog table */}
        <div className="min-h-0 flex-1 overflow-y-auto rounded-[22px] border border-[color:var(--ink-4)]/70 bg-[color:var(--paper-2)] shadow-[0_14px_32px_rgba(74,60,36,0.08)] ring-1 ring-inset ring-[color:var(--ink-4)]/25">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-[color:var(--ink-4)]/80 bg-[color:var(--paper-2)]/96 shadow-[inset_0_-1px_0_rgba(74,60,36,0.08)] backdrop-blur-sm">
                  <Th>TCDS</Th>
                  <Th>Manufacturer</Th>
                  <Th>Type</Th>
                  <Th>Model</Th>
                  <Th>Country</Th>
                  <Th>Category</Th>
                  <Th align="right">MTOW (kg)</Th>
                  <Th>Engine</Th>
                  <Th align="center">PDF</Th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[color:var(--ink-4)]/55">
                {filtered.map((row, index) => (
                  <tr
                    key={row.id}
                    className={cn(
                      'transition-colors odd:bg-[color:var(--paper-2)] even:bg-[color:var(--paper)]/80 hover:bg-[color:var(--paper-3)]/45',
                      isFirstInGroup(index) && index !== 0
                        ? 'border-t-2 border-t-[color:var(--umber)]/20'
                        : '',
                    )}
                  >
                    <td className="px-4 py-3">
                      <span
                        title={row.tcds_code}
                        className="inline-flex items-center rounded-full border border-[color:var(--ink-4)]/70 bg-white px-2.5 py-0.5 font-mono text-xs font-bold text-[color:var(--ink)] shadow-[0_1px_0_rgba(255,255,255,0.75)_inset]"
                      >
                        {row.tcds_code_short}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-[color:var(--ink-2)]">{row.manufacturer}</td>

                    <td className="px-4 py-3">
                      <p className="font-medium text-[color:var(--ink)]">{row.type}</p>
                    </td>

                    <td className="px-4 py-3">
                      <p className="font-mono text-[13px] text-[color:var(--ink-2)]">{row.model}</p>
                    </td>

                    <td className="px-4 py-3 text-[color:var(--ink-2)]">{row.country ?? '—'}</td>

                    <td className="px-4 py-3 text-[color:var(--ink-2)]">{row.category ?? '—'}</td>

                    <td className="px-4 py-3 text-right font-mono text-[color:var(--ink-2)]">
                      {row.mtow_kg != null ? row.mtow_kg.toLocaleString('en-US') : '—'}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        title={row.engine ?? ''}
                        className="inline-block max-w-[260px] truncate text-sm text-[color:var(--ink-2)]"
                      >
                        {row.engine ?? '—'}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      {row.tcds_pdf_url ? (
                        <a
                          href={row.tcds_pdf_url}
                          target="_blank"
                          rel="noreferrer noopener"
                          title="Open official TCDS"
                          className="inline-flex items-center gap-1 rounded-md border border-[color:var(--ink-4)] bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-2)] transition-colors hover:border-[color:var(--cobalt)] hover:text-[color:var(--cobalt)]"
                        >
                          <ExternalLink className="h-3 w-3" />
                          PDF
                        </a>
                      ) : (
                        <span className="text-[color:var(--ink-3)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-12 text-center text-sm text-[color:var(--ink-2)]"
                    >
                      {aircraft.length === 0 ? (
                        <>
                          <p className="font-medium">No aircraft in the catalog yet.</p>
                          <p className="mt-1 text-xs text-[color:var(--ink-3)]">
                            Ingest TCDS data from Tools to populate this list.
                          </p>
                        </>
                      ) : (
                        <>No results for &ldquo;{search}&rdquo;.</>
                      )}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small helpers — keep table head columns visually consistent.
// ---------------------------------------------------------------------------

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right' | 'center'
}) {
  return (
    <th
      className={cn(
        'whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-2)]',
        align === 'left' && 'text-left',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
      )}
    >
      {children}
    </th>
  )
}
