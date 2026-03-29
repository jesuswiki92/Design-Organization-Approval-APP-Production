'use client'

import { Bot, Building2, Mail, Plane, Sparkles, UserRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

import type { IncomingQuery } from './incoming-queries'

function QueryMetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  )
}

function DetailPanelCard({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_12px_28px_rgba(148,163,184,0.12)]',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function IncomingQueryDetailDialog({
  query,
  open,
  onOpenChange,
  onMarkReviewed,
}: {
  query: IncomingQuery | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onMarkReviewed: (id: string) => void
}) {
  if (!query) {
    return null
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-none overflow-y-auto border-l border-slate-200 bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_16%)] p-0 sm:w-[min(94vw,1040px)] sm:max-w-[1040px]"
      >
        <SheetHeader className="border-b border-slate-200 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_54%,#f8fafc_100%)] px-6 py-5 pr-16">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <SheetTitle className="text-xl font-semibold text-slate-950">
                {query.asunto}
              </SheetTitle>
              <SheetDescription className="max-w-3xl text-sm text-slate-600">
                Entrada comercial real leida desde la tabla de consultas entrantes antes de
                convertirla en quotation.
              </SheetDescription>
            </div>

            <div className="rounded-2xl border border-sky-200 bg-white/80 px-4 py-3 text-right shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Codigo consulta
              </p>
              <p className="mt-1 font-mono text-sm text-slate-900">{query.codigo}</p>
              <p className="mt-1 text-xs text-slate-500">{query.recibidoEn}</p>
            </div>
          </div>
        </SheetHeader>

        <div className="grid min-h-0 gap-0 xl:grid-cols-[minmax(0,1.2fr)_340px]">
          <div className="min-w-0 px-6 py-5">
            <Tabs defaultValue="summary" className="gap-4">
              <TabsList
                variant="line"
                className="w-full justify-start gap-1 overflow-x-auto bg-transparent p-0"
              >
                <TabsTrigger value="summary">Resumen</TabsTrigger>
                <TabsTrigger value="contact">Origen</TabsTrigger>
                <TabsTrigger value="ai">Analisis IA</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <QueryMetaPill label="Remitente" value={query.remitente} />
                  <QueryMetaPill
                    label="Clasificacion"
                    value={query.clasificacion ?? 'Sin clasificar'}
                  />
                  <QueryMetaPill label="Recibido" value={query.recibidoEn} />
                </div>

                <DetailPanelCard>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Resumen de la consulta
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-700">{query.resumen}</p>
                </DetailPanelCard>

                <DetailPanelCard className="border-slate-200 bg-slate-50">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Siguiente paso sugerido
                  </p>
                  <p className="mt-3 text-sm font-medium text-slate-900">
                    Revisar la consulta, validar si procede convertirla en quotation y
                    completar el pipeline comercial cuando exista el flujo de handoff.
                  </p>
                </DetailPanelCard>
              </TabsContent>

              <TabsContent value="contact" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <DetailPanelCard>
                    <div className="flex items-center gap-3 text-slate-900">
                      <Mail className="h-4 w-4 text-sky-700" />
                      <p className="text-sm font-semibold">Correo de origen</p>
                    </div>
                    <p className="mt-3 text-sm text-slate-700">{query.remitente}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Remitente leido directamente desde la tabla de consultas entrantes.
                    </p>
                  </DetailPanelCard>

                  <DetailPanelCard>
                    <div className="flex items-center gap-3 text-slate-900">
                      <Building2 className="h-4 w-4 text-sky-700" />
                      <p className="text-sm font-semibold">Contexto disponible</p>
                    </div>
                    <p className="mt-3 text-sm text-slate-700">
                      {query.clasificacion ?? 'Sin clasificacion automatica'}
                    </p>
                    <div className="mt-2 inline-flex items-center gap-2 text-xs text-slate-500">
                      <UserRound className="h-3.5 w-3.5" />
                      Pendiente de matching con cliente/contacto en una fase posterior
                    </div>
                  </DetailPanelCard>
                </div>

                <DetailPanelCard className="border-dashed bg-slate-50 text-sm text-slate-600 shadow-none">
                  Esta seccion se conectara despues con matching de cliente/contacto y
                  conversion a quotation. Hoy muestra solo el contexto real disponible.
                </DetailPanelCard>
              </TabsContent>

              <TabsContent value="ai" className="space-y-4">
                <DetailPanelCard className="border-sky-200 bg-sky-50/60">
                  <div className="flex items-center gap-3 text-slate-950">
                    <Sparkles className="h-4 w-4 text-sky-700" />
                    <p className="text-sm font-semibold">Lectura automatica sugerida</p>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-700">
                    {query.respuestaIa ?? 'Todavia no hay respuesta IA almacenada para esta consulta.'}
                  </p>
                </DetailPanelCard>

                <DetailPanelCard>
                  <div className="flex items-center gap-3 text-slate-900">
                    <Bot className="h-4 w-4 text-slate-700" />
                    <p className="text-sm font-semibold">Uso previsto</p>
                  </div>
                  <ul className="mt-3 space-y-2 text-sm text-slate-600">
                    <li>- Detectar si la consulta debe pasar a quotation o a formulario tecnico.</li>
                    <li>- Clasificar la entrada y preparar el triage comercial.</li>
                    <li>- Preparar una respuesta inicial o un handoff comercial posterior.</li>
                  </ul>
                </DetailPanelCard>
              </TabsContent>
            </Tabs>
          </div>

          <aside className="border-t border-slate-200 bg-slate-50/70 px-6 py-5 xl:border-l xl:border-t-0">
            <div className="space-y-4 xl:sticky xl:top-0">
              <DetailPanelCard>
                <div className="flex items-center gap-3 text-slate-900">
                  <Plane className="h-4 w-4 text-sky-700" />
                  <p className="text-sm font-semibold">Ficha rapida</p>
                </div>
                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-[0.16em] text-slate-400">Estado</dt>
                    <dd className="mt-1 text-slate-900">{query.estado}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.16em] text-slate-400">Clasificacion</dt>
                    <dd className="mt-1 text-slate-900">{query.clasificacion ?? 'Sin clasificar'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.16em] text-slate-400">Remitente</dt>
                    <dd className="mt-1 break-all text-slate-900">{query.remitente}</dd>
                  </div>
                </dl>
              </DetailPanelCard>

              <DetailPanelCard className="border-dashed bg-white text-xs leading-6 text-slate-500 shadow-none">
                El marcado persistente y la conversion real a quotation se conectaran cuando
                el esquema incluya el workflow de consultas entrantes.
              </DetailPanelCard>
            </div>
          </aside>
        </div>

        <SheetFooter className="border-t border-slate-200 bg-white/95 px-6 py-4 sm:flex-row sm:justify-end">
          <Button variant="outline" disabled>
            Crear oferta
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              onMarkReviewed(query.id)
              onOpenChange(false)
            }}
          >
            Marcar como revisado
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
