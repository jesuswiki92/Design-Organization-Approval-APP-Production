/**
 * ============================================================================
 * ASISTENTE DOA — UI ONLY (frame placeholder)
 * ============================================================================
 *
 * Frame visual del chat con OpenRouter. El backend de IA esta desconectado
 * en esta version frame-only.
 * ============================================================================
 */

import { TopBar } from '@/components/layout/TopBar'

export default function CertificationExpertPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      <TopBar title="Asistente DOA" subtitle="Chat operativo general con OpenRouter" />

      <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
        <div className="rounded-[22px] border border-dashed border-[color:var(--ink-4)] bg-[color:var(--paper)] px-6 py-16 text-center">
          <p className="text-base font-semibold text-[color:var(--ink)]">Próximamente</p>
          <p className="mt-2 text-sm text-[color:var(--ink-3)]">
            El asistente conversacional esta temporalmente desconectado.
          </p>
        </div>
      </div>
    </div>
  )
}
