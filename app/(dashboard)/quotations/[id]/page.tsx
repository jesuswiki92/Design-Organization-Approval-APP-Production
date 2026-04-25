/**
 * ============================================================================
 * PAGINA SERVIDOR DE DETALLE DE UNA QUOTATION — UI ONLY (frame)
 * ============================================================================
 */

import { TopBar } from '@/components/layout/TopBar'
import { QuotationDetailClient } from './QuotationDetailClient'

export const dynamic = 'force-dynamic'

export default async function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,#eff6ff_0%,#f8fbff_34%,#f8fafc_100%)]">
      <TopBar
        title="Detalle de quotation"
        subtitle="Vista preparada para alojar todo el detalle operativo de la quote"
      />
      <QuotationDetailClient
        id={id}
        initialStateConfigRows={[]}
        initialIncomingQueries={[]}
      />
    </div>
  )
}
