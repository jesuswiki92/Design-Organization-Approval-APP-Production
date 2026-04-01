// ? Quotations board/list surface
import { TopBar } from '@/components/layout/TopBar'

import { QuotationsClient } from './QuotationsClient'

export default async function QuotationsPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      <TopBar title="Quotations" subtitle="Seguimiento comercial previo al proyecto" />
      <QuotationsClient />
    </div>
  )
}
