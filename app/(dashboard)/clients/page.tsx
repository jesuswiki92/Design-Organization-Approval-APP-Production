// ⏸️ BASE DE DATOS DESCONECTADA - ver BASES-DE-DATOS.md para reconectar
import type { ClienteWithContactos } from '@/types/database'
import ClientsPageClient from './ClientsPageClient'

export default async function ClientsPage() {
  const clientesWithContactos: ClienteWithContactos[] = []

  return <ClientsPageClient clients={clientesWithContactos} />
}
