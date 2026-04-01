'use client'

import Link from 'next/link'
import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { LayoutGrid, List, Plus, Sparkles, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { QuotationLane } from './quotation-board-data'
import {
  canDeleteQuotationLane,
  defaultQuotationLanes,
  loadStoredQuotationLanes,
  makeCustomQuotationLane,
  stripQuotationLaneAccent,
  type QuotationCard,
  QUOTATION_BOARD_STORAGE_KEY,
} from './quotation-board-data'

type BoardView = 'board' | 'list'

const VIEW_OPTIONS: Array<{
  value: BoardView
  label: string
  icon: typeof LayoutGrid
}> = [
  { value: 'board', label: 'Tablero', icon: LayoutGrid },
  { value: 'list', label: 'Lista', icon: List },
]

function BoardCard({ card }: { card: QuotationCard }) {
  return (
    <article className="rounded-[22px] border border-slate-200 bg-white p-3.5 shadow-[0_14px_32px_rgba(15,23,42,0.06)] transition-transform hover:-translate-y-0.5 hover:border-sky-300">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-[10px] tracking-[0.2em] text-slate-500">{card.code}</p>
          <h4 className="text-sm font-semibold leading-5 text-slate-950">{card.title}</h4>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {card.tag}
        </span>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-600">{card.note}</p>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <div className="flex items-center justify-between gap-3 text-[11px] text-slate-500">
          <span>{card.owner}</span>
          <span>{card.due}</span>
        </div>

        <Link
          href={`/quotations/${card.id}`}
          className="mt-3 inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800"
        >
          Más detalle
        </Link>
      </div>
    </article>
  )
}

function BoardLane({
  lane,
  onDeleteLane,
}: {
  lane: QuotationLane
  onDeleteLane: (laneId: string) => void
}) {
  return (
    <section
      className={cn(
        'flex h-full w-[320px] flex-none flex-col rounded-[30px] border bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_18px_42px_rgba(148,163,184,0.14)]',
        lane.accent.border,
      )}
    >
      <div className={cn('rounded-[22px] border px-4 py-4', lane.accent.bg, lane.accent.border)}>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={cn('h-2.5 w-2.5 rounded-full', lane.accent.dot)} />
              <h3 className={cn('text-sm font-semibold', lane.accent.text)}>{lane.title}</h3>
            </div>
            <p className="max-w-[220px] text-xs leading-5 text-slate-600">{lane.description}</p>
          </div>
          <div className="flex items-start gap-2">
            <span
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]',
                lane.accent.chip,
              )}
            >
              {lane.cards.length}
            </span>
            {canDeleteQuotationLane(lane) ? (
              <button
                type="button"
                onClick={() => onDeleteLane(lane.id)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-700"
                aria-label={`Delete state ${lane.title}`}
                title="Delete custom state"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 flex-1 space-y-3">
        {lane.cards.map((card) => (
          <BoardCard key={card.id} card={card} />
        ))}

        <button
          type="button"
          className="flex w-full items-center justify-between rounded-[22px] border border-dashed border-slate-200 bg-white/80 px-4 py-3 text-left text-sm text-slate-600 transition-colors hover:border-sky-300 hover:bg-sky-50/60 hover:text-sky-800"
        >
          <span className="inline-flex items-center gap-2">
            <Plus className="h-3.5 w-3.5" />
            Add quotation card
          </span>
          <Sparkles className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  )
}

function ListRow({
  lane,
  onDeleteLane,
}: {
  lane: QuotationLane
  onDeleteLane: (laneId: string) => void
}) {
  const leadCard = lane.cards[0]

  return (
    <tr className="border-b border-slate-200/70 bg-white transition-colors hover:bg-sky-50/50">
      <td className="px-4 py-3 align-top">
        <div className="flex items-center gap-2">
          <span className={cn('h-2.5 w-2.5 rounded-full', lane.accent.dot)} />
          <div>
            <p className="font-mono text-[11px] text-slate-500">{leadCard?.code ?? 'STATE'}</p>
            <p className="text-sm font-semibold text-slate-950">{lane.title}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 align-top text-sm text-slate-600">{lane.cards.length}</td>
      <td className="px-4 py-3 align-top text-sm text-slate-600">
        <div className="space-y-1">
          <p className="font-medium text-slate-900">{leadCard?.title ?? 'No cards yet'}</p>
          <p className="text-slate-500">
            {leadCard?.note ?? 'Add a card to show a preview in the list view.'}
          </p>
        </div>
      </td>
      <td className="px-4 py-3 align-top text-sm text-slate-600">{leadCard?.owner ?? '-'}</td>
      <td className="px-4 py-3 align-top text-sm text-slate-600">{leadCard?.due ?? '-'}</td>
      <td className="px-4 py-3 align-top">
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {leadCard?.tag ?? 'Empty'}
        </span>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-wrap items-center gap-2">
          {leadCard ? (
            <Link
              href={`/quotations/${leadCard.id}`}
              className="inline-flex h-9 items-center rounded-full border border-sky-200 bg-sky-50 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700 transition-colors hover:bg-sky-100"
            >
              Más detalle
            </Link>
          ) : null}
          {canDeleteQuotationLane(lane) ? (
            <button
              type="button"
              onClick={() => onDeleteLane(lane.id)}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-rose-700 transition-colors hover:bg-rose-100"
              aria-label={`Delete state ${lane.title}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          ) : (
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Locked</span>
          )}
        </div>
      </td>
    </tr>
  )
}

export function QuotationStatesBoard() {
  const [lanes, setLanes] = useState<QuotationLane[]>(defaultQuotationLanes)
  const [view, setView] = useState<BoardView>('board')
  const [composerOpen, setComposerOpen] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const hasMountedRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Load browser-local lanes after mount to keep the first render deterministic.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLanes(loadStoredQuotationLanes())
    hasMountedRef.current = true
  }, [])

  useEffect(() => {
    if (!hasMountedRef.current) return

    try {
      window.localStorage.setItem(
        QUOTATION_BOARD_STORAGE_KEY,
        JSON.stringify(lanes.map(stripQuotationLaneAccent)),
      )
    } catch {
      // Best-effort local persistence for the visual iteration.
    }
  }, [lanes])

  useEffect(() => {
    if (composerOpen) {
      inputRef.current?.focus()
    }
  }, [composerOpen])

  const metrics = useMemo(() => {
    const cards = lanes.reduce((total, lane) => total + lane.cards.length, 0)
    return { cards, lanes: lanes.length }
  }, [lanes])

  function handleAddLane(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const title = draftTitle.trim()
    if (!title) return

    const nextLane = makeCustomQuotationLane(title, lanes.length)
    startTransition(() => {
      setLanes((current) => [...current, nextLane])
      setView('board')
    })
    setDraftTitle('')
    setComposerOpen(false)
  }

  function handleDeleteLane(laneId: string) {
    const lane = lanes.find((currentLane) => currentLane.id === laneId)
    if (!lane || !canDeleteQuotationLane(lane)) return

    const confirmed = window.confirm(
      `Delete the custom state "${lane.title}"? This will remove it from both Board and List views.`,
    )
    if (!confirmed) return

    startTransition(() => {
      setLanes((current) => current.filter((currentLane) => currentLane.id !== laneId))
    })
  }

  return (
    <Tabs
      value={view}
      onValueChange={(nextValue) => setView(nextValue as BoardView)}
      className="w-full gap-4"
    >
      <section className="overflow-hidden rounded-[34px] border border-sky-100 bg-[radial-gradient(circle_at_top_left,#eff8ff_0%,#ffffff_45%,#f8fafc_100%)] shadow-[0_24px_60px_rgba(15,23,42,0.06)]">
        <div className="border-b border-sky-100 px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                <LayoutGrid className="h-3.5 w-3.5" />
                Quotations workspace
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                  Board navigation for quotations
                </h2>
                <p className="max-w-3xl text-sm leading-6 text-slate-600">
                  The board is the primary surface. Use the list view when you want a compact operational scan.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="rounded-[22px] border border-sky-200 bg-white/90 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Columns
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{metrics.lanes}</p>
              </div>
              <div className="rounded-[22px] border border-sky-200 bg-white/90 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Cards
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{metrics.cards}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-[18px] border-sky-200 bg-white px-4 text-sky-800 shadow-sm hover:bg-sky-50"
                onClick={() => setComposerOpen((current) => !current)}
              >
                <Plus className="mr-2 h-4 w-4" />
                {composerOpen ? 'Close state editor' : 'New state'}
              </Button>
            </div>
          </div>

          <TabsList
            variant="default"
            className="mt-5 flex w-full flex-wrap gap-2 rounded-[24px] border border-slate-200 bg-slate-50 p-2"
          >
            {VIEW_OPTIONS.map((option) => {
              const Icon = option.icon

              return (
                <TabsTrigger
                  key={option.value}
                  value={option.value}
                  className="rounded-[18px] px-4 py-2.5 text-sm font-semibold text-slate-500 transition-all data-active:bg-white data-active:text-slate-950 data-active:shadow-sm"
                >
                  <Icon className="h-4 w-4" />
                  {option.label}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </div>

        {composerOpen ? (
          <form
            className="grid gap-3 border-b border-sky-100 bg-white/80 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto]"
            onSubmit={handleAddLane}
          >
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                State name
              </label>
              <input
                ref={inputRef}
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                placeholder="e.g. Pending signature"
                className="h-11 w-full rounded-[16px] border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-[16px] border-slate-200 bg-white px-4 text-slate-700 hover:bg-slate-50"
                onClick={() => setComposerOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-11 rounded-[16px] bg-sky-600 px-4 text-white hover:bg-sky-500"
              >
                Create state
              </Button>
            </div>
          </form>
        ) : null}

        <TabsContent value="board" className="min-h-0">
          <div className="px-5 py-5">
            <div className="mb-4 rounded-[28px] border border-sky-100 bg-white/85 px-4 py-3 text-sm text-slate-600 shadow-sm">
              Horizontal overflow is enabled on the board track. Use the scrollbar or trackpad to browse columns.
            </div>

            <div className="overflow-x-auto pb-4">
              <div className="flex min-w-max gap-4 pr-2">
                {lanes.map((lane) => (
                  <BoardLane key={lane.id} lane={lane} onDeleteLane={handleDeleteLane} />
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="list" className="px-5 py-5">
          <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_42px_rgba(148,163,184,0.12)]">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-950">Quotation list</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Compact operational scan grouped by the same states as the board.
              </p>
            </div>

            <div className="overflow-auto">
              <table className="min-w-[960px] w-full border-separate border-spacing-0 text-left">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {['State', 'Cards', 'Lead quotation', 'Owner', 'Due', 'Tag', 'Actions'].map((label) => (
                      <th
                        key={label}
                        className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lanes.map((lane) => (
                    <ListRow key={lane.id} lane={lane} onDeleteLane={handleDeleteLane} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </section>
    </Tabs>
  )
}

