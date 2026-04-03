import { ExternalLink, FileText } from 'lucide-react'

import type { ClienteWithContactos } from '@/types/database'

type ConsultaFormPreviewProps = {
  consultaId: string
  consultaCode: string
  senderEmail: string | null
  publicFormUrl: string | null
  matchedClient: ClienteWithContactos | null
}

export async function ConsultaFormPreview({
  publicFormUrl,
}: ConsultaFormPreviewProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
      <div className="px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          Formulario
        </p>
        <h2 className="mt-1.5 text-sm font-semibold text-slate-950">
          Formulario del cliente
        </h2>

        <div className="mt-3 flex flex-col gap-3">
          {publicFormUrl ? (
            <>
              <a
                href={publicFormUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700 transition-colors hover:bg-sky-100"
              >
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                Abrir URL publica
              </a>

              <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    URL registrada en Supabase
                  </p>
                  <p className="mt-1 break-all text-xs text-slate-600">{publicFormUrl}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/70 px-3 py-3 text-xs leading-5 text-slate-600">
              No hay una URL de formulario guardada en esta consulta.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
